/**
 * A minimal Chrome DevTools Protocol driver, in plain Node with no dependencies.
 *
 * WHY NOT PLAYWRIGHT. The extended tier already pulls Lighthouse and Playwright on
 * demand, and that is the right trade for what it does. This tier runs on every site,
 * including the ones whose entire dependency list is five packages, so it drives the
 * Chrome that is already on the machine over a websocket Node has had built in since
 * v22. The cost is that we write the twelve lines of protocol below ourselves.
 */

import { spawn } from "node:child_process";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  process.env.CHROME_PATH,
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launch headless Chrome and connect. Returns a handle with everything the checks need. */
export async function openBrowser({ port = 9420, profile = "/tmp/web-kit-audit" } = {}) {
  const { existsSync } = await import("node:fs");
  const bin = CHROME_PATHS.find((p) => existsSync(p));
  if (!bin) {
    throw new Error(
      "No Chrome found for the browser audit tier. Install Google Chrome or set CHROME_PATH.",
    );
  }

  const proc = spawn(
    bin,
    [
      `--remote-debugging-port=${port}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-timer-throttling",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      const j = await res.json();
      wsUrl = j.webSocketDebuggerUrl ?? null;
    } catch {
      await sleep(250);
    }
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error("Chrome did not expose a debugging socket in 15s.");
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("Could not attach to Chrome."));
  });

  let seq = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method) events.push(msg);
  };

  const send = (method, params = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => pending.set(id, resolve));
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");

  return {
    send,
    events,
    /** Evaluate in the page and return a structured value. Page exceptions throw here. */
    async evaluate(expression) {
      const r = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.result?.exceptionDetails) {
        const d = r.result.exceptionDetails;
        throw new Error(`page threw: ${d.exception?.description ?? d.text}`);
      }
      return r.result?.result?.value;
    },
    async setViewport({ width, height, dpr = 2, mobile = false }) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile,
      });
      await send("Emulation.setTouchEmulationEnabled", {
        enabled: mobile,
        maxTouchPoints: mobile ? 5 : 0,
      });
    },
    async goto(url, settleMs = 2200) {
      events.length = 0;
      await send("Page.navigate", { url });
      await sleep(settleMs);
    },
    /** Real finger, with real timing: coalesced moves often never start a scroll. */
    async swipe({ x, fromY, toY, steps = 14 }) {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY, id: 1 }] });
      await sleep(30);
      for (let i = 1; i <= steps; i++) {
        const y = Math.round(fromY + ((toY - fromY) * i) / steps);
        await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
        await sleep(16);
      }
      await sleep(30);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(700);
    },
    /** Console errors and uncaught exceptions seen since the last navigation. */
    consoleErrors() {
      return events
        .filter(
          (e) =>
            e.method === "Runtime.exceptionThrown" ||
            (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") ||
            (e.method === "Log.entryAdded" &&
              e.params.entry.level === "error" &&
              !/favicon|net::ERR_.*favicon/.test(e.params.entry.text ?? "")),
        )
        .map((e) =>
          (
            e.params.entry?.text ??
            e.params.exceptionDetails?.exception?.description ??
            e.params.args?.[0]?.value ??
            "error"
          )
            .toString()
            .slice(0, 160),
        );
    },
    async close() {
      try {
        ws.close();
      } catch {
        /* already gone */
      }
      proc.kill();
    },
  };
}
