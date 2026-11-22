import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runV3Audit } from "./index.mjs";

/**
 * Test support: serves fixture pages from memory and runs the audit against them.
 * Not part of the shipped audit; the tests import it.
 */
export async function startFixtureServer() {
  const pages = new Map();
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const hit = pages.get(path);
    if (hit == null) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    const body = typeof hit === "string" ? { type: "text/html", body: hit } : hit;
    setTimeout(() => {
      res.writeHead(body.status ?? 200, { "content-type": body.type ?? "text/html" });
      res.end(body.body);
    }, body.delay ?? 0);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let n = 0;
  return {
    origin,
    /** Registers a page and returns its URL. */
    add(html, path) {
      const p = path ?? `/p${++n}`;
      pages.set(p, html);
      return `${origin}${p}`;
    },
    set(path, value) {
      pages.set(path, value);
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Writes a throwaway site folder holding docs/design files. */
export function makeSite(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "wk-v3-"));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
  }
  return dir;
}

/** Runs one check against one page and returns its result. */
export async function runOne(server, browser, id, html, opts = {}) {
  const url = server.add(html);
  const out = await runV3Audit(url, { browser, routes: ["/"], only: [id], ...opts });
  return out.results[0];
}
