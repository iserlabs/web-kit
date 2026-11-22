import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StatementBrand, StatementModel } from "./index.js";
import { BRANDS, renderStatement } from "./index.mjs";

/**
 * Layout, measured in a real browser: the text floor and sideways overflow, at the phone widths
 * that matter, for every brand. Skipped when no headless Chrome is installed on the machine.
 */
const BRAND_FILES: StatementBrand[] = ["sun-mountain", "palisade", "columbus", "xenia"];
const CHROME = join(homedir(), ".claude/bin/chrome-headless");
const HAVE_CHROME = existsSync(CHROME);
const PHONES = [320, 360, 390];
const LOGO = { src: "/logo.png", alt: "The sender", width: 994, height: 192 };

function load(name: string): StatementModel {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as StatementModel;
}

/** The same statement with the longest heading the real data has ("Paid to you by Airbnb"). */
function withLongHeading(m: StatementModel): StatementModel {
  const copy = structuredClone(m);
  for (const g of copy.groups) {
    const lastMoney = [...g.columns].reverse().find((c) => c.kind === "money");
    if (lastMoney) lastMoney.label = "Paid to you by Airbnb";
  }
  return copy;
}

function page(m: StatementModel): string {
  const { html, css, fontsHref } = renderStatement(m, { logo: LOGO });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${fontsHref}"><style>body{margin:0}</style><style>${css}</style></head><body>${html}</body></html>`;
}

interface Reading {
  width: number;
  scrollWidth: number;
  smallest: { px: number; text: string };
  clipped: string[];
}

/** Runs inside the page: the sizes, and every piece of text that leaves its own box or the window. */
function measure(): Omit<Reading, "width"> {
  const de = document.documentElement;
  const smallest = { px: 999, text: "" };
  const clipped: string[] = [];
  for (const el of Array.from(document.querySelectorAll(".os *"))) {
    const own = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "",
    );
    if (!own) continue;
    if (getComputedStyle(el).display === "none") continue;
    const px = Number.parseFloat(getComputedStyle(el).fontSize);
    if (px < smallest.px) {
      smallest.px = px;
      smallest.text = `${el.className} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (text.width === 0) continue;
    if (
      text.right > box.right + 0.5 ||
      text.left < box.left - 0.5 ||
      text.right > window.innerWidth + 0.5 ||
      text.left < -0.5
    ) {
      clipped.push(
        `${el.className} "${(el.textContent ?? "").trim().slice(0, 30)}" text ${text.left.toFixed(1)}..${text.right.toFixed(1)} box ${box.left.toFixed(1)}..${box.right.toFixed(1)}`,
      );
    }
  }
  return { scrollWidth: de.scrollWidth, smallest, clipped };
}

describe.skipIf(!HAVE_CHROME)("layout in a real browser", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ executablePath: CHROME });
  }, 60_000);
  afterAll(async () => {
    // A slow shutdown must not fail the measurements: wait up to 5s, then let the run end.
    await Promise.race([browser?.close(), new Promise((done) => setTimeout(done, 5_000))]);
  }, 30_000);

  async function readings(m: StatementModel, widths: number[]): Promise<Reading[]> {
    const p = await browser.newPage({ viewport: { width: widths[0] ?? 390, height: 900 } });
    try {
      await p.setContent(page(m), { waitUntil: "load" });
      await p.evaluate(() => document.fonts.ready);
      const out: Reading[] = [];
      for (const width of widths) {
        await p.setViewportSize({ width, height: 900 });
        out.push({ width, ...(await p.evaluate(measure)) });
      }
      return out;
    } finally {
      await p.close();
    }
  }

  const variants: [string, (m: StatementModel) => StatementModel][] = [
    ["fixture", (m) => m],
    ["long heading", withLongHeading],
  ];

  for (const name of BRAND_FILES) {
    for (const [label, make] of variants) {
      it(`${name} (${label}): no text under 13px at any width, 14px on phones`, async () => {
        const all = await readings(make(load(name)), [...PHONES, 600, 760, 1000]);
        for (const r of all) {
          const floor = r.width <= 600 ? 14 : 13;
          expect(r.smallest.px, `${r.width}px wide: ${r.smallest.text}`).toBeGreaterThanOrEqual(
            floor,
          );
        }
      }, 60_000);

      it(`${name} (${label}): no sideways scroll and nothing clipped at 320, 360 and 390`, async () => {
        const all = await readings(make(load(name)), PHONES);
        for (const r of all) {
          expect(r.scrollWidth, `${r.width}px wide`).toBeLessThanOrEqual(r.width);
          expect(r.clipped, `${r.width}px wide`).toEqual([]);
        }
      }, 60_000);
    }
  }

  it("every brand sets a figure scale that keeps tabular figures at or over 13px", () => {
    for (const id of BRAND_FILES) {
      const scale = (BRANDS[id] as unknown as { figureScale?: number }).figureScale;
      expect(scale, id).toBeGreaterThan(0);
      expect(14 * (scale ?? 0), id).toBeGreaterThanOrEqual(13);
    }
  });
});
