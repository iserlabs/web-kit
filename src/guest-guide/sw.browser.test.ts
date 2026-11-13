/**
 * The offline save, proven in a real headless Chrome against a real server,
 * nothing mocked (minimum standard A2): the page asks the kit worker to save
 * itself, the saved line appears only after the worker answers, the page then
 * loads with the network off, a page never told to save is not cached, and
 * activation drops only this site's older caches.
 *
 * Needs Playwright's Chromium (`pnpm exec playwright install chromium`). It
 * fails, never skips, when the browser cannot start, unless
 * WEB_KIT_SKIP_BROWSER=1 is set on purpose.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveCopy } from "./copy";
import { sunMountainBrand, yaleFixture } from "./fixtures";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";
import { guideServiceWorker } from "./sw";

const SKIP = process.env.WEB_KIT_SKIP_BROWSER === "1";
// A 1x1 PNG, served for every photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==",
  "base64",
);

function page(slug: string, save: boolean): string {
  const m = { ...structuredClone(yaleFixture), slug };
  const plan = planGuide(m, resolveCopy(m, { approvals: [] }), { page: `/guides/${slug}` });
  return renderGuideHtml({
    plan,
    brand: sunMountainBrand,
    page: `/guides/${slug}`,
    serviceWorker: save ? { url: "/guides/sw.js", scope: "/guides/" } : undefined,
    head: { canonical: `https://example.invalid/guides/${slug}` },
  });
}

/**
 * A Next-style page: the brand face lives in an external stylesheet with a
 * hashed font file the plan never lists (what next/font produces).
 */
function fontedPage(): string {
  const m = { ...structuredClone(yaleFixture), slug: "fonted" };
  const brand = {
    ...sunMountainBrand,
    faces: {
      ...sunMountainBrand.faces,
      display: { family: "TestFace", fallback: "serif", weight: 600 },
    },
  };
  const plan = planGuide(m, resolveCopy(m, { approvals: [] }), { page: "/guides/fonted" });
  return renderGuideHtml({
    plan,
    brand,
    page: "/guides/fonted",
    serviceWorker: { url: "/guides/sw.js", scope: "/guides/" },
    head: { canonical: "https://example.invalid/guides/fonted" },
  }).replace("</head>", '<link rel="stylesheet" href="/_next/static/css/a1b2c3.css">\n</head>');
}

const FONT = readFileSync(
  new URL("../../test-assets/fonts/cinzel-600-latin.woff2", import.meta.url),
);

let server: Server;
let origin = "";
const hits: string[] = [];

beforeAll(async () => {
  const routes: Record<string, [string, string | Buffer]> = {
    "/guides/fonted": ["text/html; charset=utf-8", fontedPage()],
    "/_next/static/css/a1b2c3.css": [
      "text/css",
      '@font-face{font-family:"TestFace";src:url(/_next/static/media/9f8e7d-s.p.woff2) format("woff2");font-weight:600;font-display:swap}',
    ],
    "/_next/static/media/9f8e7d-s.p.woff2": ["font/woff2", FONT],
    "/guides/yale": ["text/html; charset=utf-8", page("yale", true)],
    "/guides/lark": ["text/html; charset=utf-8", page("lark", false)],
    "/guides/sw.js": [
      "text/javascript",
      guideServiceWorker({ cachePrefix: "test-guides", scope: "/guides/", version: "b2" }),
    ],
    "/blank": ["text/html", "<!doctype html><title>blank</title>"],
  };
  server = createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0] ?? "/";
    hits.push(url);
    const hit = routes[url] ?? (url.startsWith("/guides/img/") ? ["image/png", PNG] : undefined);
    if (!hit) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-cache" }).end(hit[1]);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe.skipIf(SKIP)("guide service worker in headless Chrome", () => {
  it("saves the page, serves it offline, never caches an unsaved page, drops only its own old caches", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const p = await context.newPage();
      const errors: string[] = [];
      p.on("pageerror", (e) => errors.push(e.message));

      // Old caches: this site's v1 cache, and someone else's.
      await p.goto(`${origin}/blank`);
      await p.evaluate(async () => {
        await caches.open("test-guides-v1");
        await caches.open("another-site-cache");
      });

      await p.goto(`${origin}/guides/yale`);
      await expect
        .poll(
          () => p.evaluate(() => document.querySelector("[data-saved]")?.hasAttribute("data-on")),
          {
            timeout: 20_000,
          },
        )
        .toBe(true);

      const keys = await p.evaluate(() => caches.keys());
      expect(keys).toContain("test-guides-v2-b2");
      expect(keys).toContain("another-site-cache");
      expect(keys).not.toContain("test-guides-v1");

      // An unsaved page visited online stays out of the cache.
      await p.goto(`${origin}/guides/lark`);
      const cached = await p.evaluate(async () => {
        const c = await caches.open("test-guides-v2-b2");
        return (await c.keys()).map((r) => new URL(r.url).pathname);
      });
      expect(cached).toContain("/guides/yale");
      expect(cached).not.toContain("/guides/lark");
      expect(cached.some((u) => u.startsWith("/guides/img/"))).toBe(true);

      // Offline: the saved page loads from the cache; the unsaved one does not.
      const before = hits.length;
      await context.setOffline(true);
      const res = await p.goto(`${origin}/guides/yale`);
      expect(res?.status()).toBe(200);
      expect(await p.locator("h1").textContent()).toBe("135 Yale");
      expect(hits.length).toBe(before);
      await expect(p.goto(`${origin}/guides/lark`)).rejects.toThrow();
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60_000);

  it("saves the brand faces the page loaded, so the offline page keeps them (no Georgia fallback)", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const p = await context.newPage();
      await p.goto(`${origin}/guides/fonted`);
      await expect
        .poll(
          () => p.evaluate(() => document.querySelector("[data-saved]")?.hasAttribute("data-on")),
          {
            timeout: 20_000,
          },
        )
        .toBe(true);
      const cached = await p.evaluate(async () => {
        const c = await caches.open("test-guides-v2-b2");
        return (await c.keys()).map((r) => new URL(r.url).pathname);
      });
      expect(cached).toContain("/_next/static/css/a1b2c3.css");
      expect(cached).toContain("/_next/static/media/9f8e7d-s.p.woff2");

      await context.setOffline(true);
      const res = await p.goto(`${origin}/guides/fonted`);
      expect(res?.status()).toBe(200);
      const face = await p.evaluate(async () => {
        await document.fonts.ready;
        await document.fonts.load('600 80px "TestFace"');
        const loaded = [...document.fonts].some(
          (f) => f.family.replace(/"/g, "") === "TestFace" && f.status === "loaded",
        );
        const h1 = getComputedStyle(document.querySelector("h1") as Element).fontFamily;
        return { loaded, h1 };
      });
      expect(face.h1).toContain("TestFace");
      expect(face.loaded).toBe(true);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
