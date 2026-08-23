import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Is anything already listening on this port?
 *
 * THE AUDIT CANNOT TELL A WORKING BUILD FROM SOMEBODY ELSE'S SERVER, and until this
 * existed it did not try. `startPreview` spawns the preview command and `waitForReady`
 * only pings the URL, so when another checkout already owns the port the spawned server
 * fails to bind, the ping succeeds instantly against the squatter, and the whole audit
 * crawls a different site and reports OK about it.
 *
 * That is not theoretical. On 2026-08-23 a starter repo's required tier printed
 * "OK" while an unrelated project held 3000. A green check that measured the wrong thing
 * is worse than a red one, because a red one gets looked at.
 *
 * Exported so a caller can make the same check before doing any work.
 */
export function portInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(true));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(port, host);
  });
}

/** The port a baseUrl addresses, defaulting the way a URL does. */
export function portOf(baseUrl) {
  const u = new URL(baseUrl);
  if (u.port) return Number(u.port);
  return u.protocol === "https:" ? 443 : 80;
}

/**
 * Refuse to audit a port this run did not get to bind.
 *
 * Called before `startPreview`, so nothing is spawned and no time is spent producing an
 * answer about the wrong codebase. Only local hosts are checked: a deliberately remote
 * baseUrl is somebody auditing a deployed site on purpose, and of course something is
 * already listening there.
 */
export async function assertPortFree(baseUrl) {
  const u = new URL(baseUrl);
  if (!["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(u.hostname)) return;
  const port = portOf(baseUrl);
  if (!(await portInUse(port, u.hostname === "localhost" ? "127.0.0.1" : u.hostname))) return;
  throw new Error(
    `Something is already listening on ${u.hostname}:${port}, so this audit would run ` +
      `against it instead of the repo you are in, and report on its routes as if they ` +
      `were yours.\n\n` +
      `Stop it, or point the audit somewhere of its own by setting baseUrl and the port ` +
      `in your previewCommand (most repos read an AUDIT_PORT env var for exactly this).`,
  );
}

export async function waitForReady(baseUrl, timeoutMs, fetchImpl = fetch) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetchImpl(baseUrl);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Preview server at ${baseUrl} not ready within ${timeoutMs}ms`);
}

export function startPreview(previewCommand) {
  // detached → the child leads its own process group, so we can tear down the
  // whole tree (shell + server, e.g. `pnpm build && pnpm start` → next start)
  // with a single group kill (avoids orphaned ports).
  const child = spawn(previewCommand, { shell: true, stdio: "ignore", detached: true });
  child.unref?.();
  return {
    async stop() {
      const signalGroup = (sig) => {
        try {
          if (child.pid) process.kill(-child.pid, sig);
        } catch {
          // already exited / no such process group
        }
      };
      signalGroup("SIGTERM");
      await sleep(500);
      signalGroup("SIGKILL"); // forceful fallback for deep trees that ignore SIGTERM
    },
  };
}
