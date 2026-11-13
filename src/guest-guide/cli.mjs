/**
 * The guest guide CLIs, plain JavaScript for bare Node.
 *
 *   GUEST_GUIDE_CODES=a,b web-kit guide-leaks --dir <built dir> [--slugs yale,lark] [--forbid "x|y"]
 *   GUEST_GUIDE_CODES=a,b web-kit guide-leaks --url <origin> --paths /guides/yale,/guides/lark
 *   web-kit guide-check <url-or-html-file> [--geometries all|portrait]
 *
 * guide-leaks keeps the Sun Mountain script's contract: exit 0 every page
 * scanned and clean, 1 a code leaked, 2 no codes supplied, a page unreadable,
 * or nothing scanned. Codes come only from the environment and never reach a
 * file or a log (hits print as "code N of M").
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { decide, findForbidden, findLeaks } from "./leaks-core.mjs";

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out.sort();
}

/** @returns {Promise<{ lines: string[], code: 0 | 1 | 2 }>} */
export async function runGuideLeaks(args, env = process.env, fetchImpl = globalThis.fetch) {
  const codes = (env.GUEST_GUIDE_CODES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) return { lines: ["no codes supplied (set GUEST_GUIDE_CODES)"], code: 2 };
  const dir = flag(args, "--dir");
  const url = flag(args, "--url");
  if (!dir === !url)
    return {
      lines: ["usage: pass exactly one of --dir <built html dir> or --url <origin>"],
      code: 2,
    };
  const forbid = (flag(args, "--forbid") ?? "").split("|").filter(Boolean);
  const results = [];
  if (dir) {
    if (!existsSync(dir)) return { lines: [`ERROR no such directory ${dir}`], code: 2 };
    const slugs = (flag(args, "--slugs") ?? "").split(",").filter(Boolean);
    const files = htmlFiles(dir);
    for (const slug of slugs) {
      const want = [path.join(dir, `${slug}.html`), path.join(dir, slug, "index.html")];
      if (!want.some((f) => existsSync(f)))
        results.push({ route: slug, error: `missing ${want[0]}` });
    }
    for (const f of files) {
      try {
        results.push({ route: path.relative(dir, f), html: readFileSync(f, "utf8") });
      } catch (e) {
        results.push({ route: path.relative(dir, f), error: e.message });
      }
    }
  } else {
    const paths = (flag(args, "--paths") ?? "").split(",").filter(Boolean);
    if (paths.length === 0) return { lines: ["usage: --url needs --paths /a,/b"], code: 2 };
    for (const p of paths) {
      try {
        const res = await fetchImpl(`${url.replace(/\/$/, "")}${p}`);
        results.push(
          res.status === 200
            ? { route: p, html: await res.text() }
            : { route: p, error: `status ${res.status}` },
        );
      } catch (e) {
        results.push({ route: p, error: `fetch failed: ${e.message}` });
      }
    }
  }
  return decide(results, (html) => [
    ...findLeaks(html, codes),
    ...findForbidden(html, forbid).map((s) => `forbidden string "${s}"`),
  ]);
}

/** The 17 design-check geometries, plus the narrow tall phone the long-name rule names. */
export const GUIDE_GEOMETRIES = [
  ["iphone-se-1", 320, 568],
  ["narrow-tall", 320, 720],
  ["iphone-se", 375, 667],
  ["iphone-13", 390, 844],
  ["iphone-16-pro", 402, 874],
  ["iphone-15-pro-max", 430, 932],
  ["iphone-13-landscape", 844, 390],
  ["iphone-se-landscape", 667, 375],
  ["pixel-7", 412, 915],
  ["ipad-portrait", 768, 1024],
  ["ipad-mini", 744, 1133],
  ["ipad-pro", 1024, 1366],
  ["ipad-landscape", 1366, 1024],
  ["laptop-13", 1280, 800],
  ["laptop-16", 1512, 982],
  ["desktop-1080", 1920, 1080],
  ["desktop-1440", 1440, 900],
  ["desktop-short", 1440, 600],
];

/**
 * Every [data-essential] element inside the first window, unclipped, at each
 * geometry. @returns {Promise<{ lines: string[], code: 0 | 1 | 2 }>}
 */
export async function runGuideCheck(args) {
  const target = args.find((a) => !a.startsWith("--"));
  if (!target) return { lines: ["usage: web-kit guide-check <url-or-html-file>"], code: 2 };
  const url = /^https?:\/\//.test(target) ? target : pathToFileURL(path.resolve(target)).href;
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return {
      lines: [
        "guide-check needs playwright: pnpm add -D playwright && pnpm exec playwright install chromium",
      ],
      code: 2,
    };
  }
  const browser = await chromium.launch();
  const lines = [];
  let failed = 0;
  try {
    for (const [name, w, h] of GUIDE_GEOMETRIES) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const res = await page.goto(url, { waitUntil: "networkidle" });
      if (res && res.status() >= 400) {
        lines.push(`ERROR ${name} status ${res.status()}`);
        await page.close();
        return { lines, code: 2 };
      }
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const els = [...document.querySelectorAll("[data-essential]")];
        const bad = [];
        for (const el of els) {
          const b = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const hidden = cs.visibility === "hidden" || cs.display === "none" || b.height === 0;
          if (
            hidden ||
            b.top < 0 ||
            b.bottom > innerHeight + 0.5 ||
            b.left < 0 ||
            b.right > innerWidth + 0.5
          )
            bad.push(
              `${(el.textContent ?? "").trim().slice(0, 32)} (bottom ${Math.round(b.bottom)} of ${innerHeight})`,
            );
        }
        return {
          count: els.length,
          bad,
          overflowX: document.documentElement.scrollWidth > innerWidth,
        };
      });
      await page.close();
      if (r.count === 0) {
        lines.push(`FAIL ${name} ${w}x${h}: no [data-essential] element on the page`);
        failed++;
      } else if (r.bad.length || r.overflowX) {
        failed++;
        lines.push(
          `FAIL ${name} ${w}x${h}: ${r.bad.length} of ${r.count} outside the first window${r.overflowX ? ", sideways scroll" : ""}: ${r.bad.join("; ")}`,
        );
      } else
        lines.push(
          `PASS ${name} ${w}x${h}: ${r.count} of ${r.count} essentials in the first window`,
        );
    }
  } finally {
    await browser.close();
  }
  lines.push(
    failed
      ? `guide-check: FAIL at ${failed} of ${GUIDE_GEOMETRIES.length} geometries`
      : `guide-check: PASS at ${GUIDE_GEOMETRIES.length} of ${GUIDE_GEOMETRIES.length} geometries`,
  );
  return { lines, code: failed ? 1 : 0 };
}
