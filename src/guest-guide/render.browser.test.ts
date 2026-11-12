/**
 * Rendered checks in a real headless Chrome (Playwright's Chromium), nothing
 * mocked: every link and button on a guide is at least 44 x 44 px (Palisade
 * found one-word quick-find links under it), and the Home Screen icon draws
 * the house initials in the brand's display face, not a generic fallback.
 * Fails, never skips, without a browser, unless WEB_KIT_SKIP_BROWSER=1.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveCopy } from "./copy";
import { columbus52Fixture, columbusBrand, sunMountainBrand, yaleFixture } from "./fixtures";
import { guideIconSvg } from "./manifest";
import type { GuideModel } from "./model";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";

const SKIP = process.env.WEB_KIT_SKIP_BROWSER === "1";
const FONT = readFileSync(
  new URL("../../test-assets/fonts/cinzel-600-latin.woff2", import.meta.url),
);

/** Yale with one-word rows in quick find (the Palisade case: "Pets", "Help"). */
function oneWordRows(): GuideModel {
  const m = structuredClone(yaleFixture);
  const rules = m.sections.find((s) => s.id === "rules");
  rules?.items.push({
    label: "Pets",
    body: "One dog is welcome.",
    source: "fixture",
    checked: "2026-11-11",
  });
  m.look.quickFind = ["wifi", "rules.pets", "checkout", "rules.guests"];
  return m;
}

describe.skipIf(SKIP)("rendered in headless Chrome", () => {
  it("every link and button is at least 44 x 44 px on a phone, one-word quick-find links included", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      for (const [m, brand] of [
        [oneWordRows(), sunMountainBrand],
        [columbus52Fixture, columbusBrand],
      ] as const) {
        const html = renderGuideHtml({
          plan: planGuide(m, resolveCopy(m, { approvals: [], brandLabels: brand.labels })),
          brand,
          head: { canonical: "https://example.invalid/g" },
        });
        const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await p.setContent(html, { waitUntil: "load" });
        const small = await p.evaluate(() =>
          [...document.querySelectorAll(".gg a, .gg button")]
            .filter((el) => !el.classList.contains("skip"))
            .map((el) => {
              const r = el.getBoundingClientRect();
              return {
                text: (el.textContent ?? "").trim().slice(0, 30),
                w: Math.round(r.width),
                h: Math.round(r.height),
              };
            })
            .filter((r) => r.w < 44 || r.h < 44),
        );
        expect(small, JSON.stringify(small)).toEqual([]);
        const pets = await p.evaluate(() => {
          const a = [...document.querySelectorAll(".find__q a")].find(
            (x) => x.textContent === "Pets",
          );
          return a
            ? { w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height }
            : null;
        });
        if (m.slug === "yale") expect(pets && pets.w >= 44 && pets.h >= 44).toBe(true);
        await p.close();
      }
    } finally {
      await browser.close();
    }
  }, 60_000);

  it("the Home Screen icon draws the initials in the brand display face", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const brand = {
        ...sunMountainBrand,
        faces: {
          ...sunMountainBrand.faces,
          display: { family: "Cinzel", fallback: "serif", weight: 600 },
        },
      };
      const m = structuredClone(yaleFixture);
      m.name = "Crown Ridge Cottage";
      const plan = planGuide(m, resolveCopy(m, { approvals: [] }));
      const withFace = guideIconSvg(plan, brand, { font: { data: new Uint8Array(FONT) } });
      const fallback = guideIconSvg(plan, {
        ...brand,
        faces: { ...brand.faces, display: { ...brand.faces.display, family: "NoSuchFace" } },
      });
      expect(withFace).toContain(">CR</text>");
      const shot = async (svg: string) => {
        const p = await browser.newPage({ viewport: { width: 512, height: 512 } });
        await p.setContent(
          `<body style="margin:0"><img id="i" width="512" height="512" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body>`,
        );
        await p.waitForFunction(() => (document.getElementById("i") as HTMLImageElement).complete);
        await p.waitForTimeout(300);
        const png = await p.screenshot();
        await p.close();
        return png;
      };
      const a = await shot(withFace);
      const b = await shot(fallback);
      // The embedded face changes the drawn letters; with the fallback they would be identical.
      expect(a.equals(b)).toBe(false);
      const again = await shot(withFace);
      expect(again.equals(a)).toBe(true);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
