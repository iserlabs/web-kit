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

  it("text rows never share a box with a photo or a video (the Cranbrook contrast fault)", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const m = withMedia();
      const html = renderGuideHtml({
        plan: planGuide(m, resolveCopy(m, { approvals: [] })),
        brand: sunMountainBrand,
        head: { canonical: "https://example.invalid/g" },
      });
      for (const [w, h] of [
        [390, 844],
        [768, 1024],
        [1024, 1366],
      ] as const) {
        const p = await browser.newPage({ viewport: { width: w, height: h } });
        await p.setContent(html, { waitUntil: "domcontentloaded" });
        const shared = await p.evaluate(() => {
          const out: string[] = [];
          const walker = document.createTreeWalker(
            document.querySelector("main") as Node,
            NodeFilter.SHOW_TEXT,
          );
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent?.trim()) continue;
            let box = n.parentElement;
            while (box && getComputedStyle(box).display.startsWith("inline"))
              box = box.parentElement;
            if (box?.querySelector(`img:not([alt=""]), video`))
              out.push(n.textContent.trim().slice(0, 40));
          }
          return out;
        });
        expect(shared, `${w}x${h}`).toEqual([]);
        await p.close();
      }
    } finally {
      await browser.close();
    }
  }, 60_000);

  it("a video loads nothing until play, gets its captions only then, shows in a numbered list, and stays within 72vh", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const m = withMedia();
      const html = renderGuideHtml({
        plan: planGuide(m, resolveCopy(m, { approvals: [] })),
        brand: sunMountainBrand,
        head: { canonical: "https://guide.test/guides/yale" },
      });
      expect(html).not.toContain("<track");
      const p = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
      const asked: string[] = [];
      await p.route("https://guide.test/**", (r) => {
        const u = new URL(r.request().url()).pathname;
        asked.push(u);
        if (u === "/guides/yale") return r.fulfill({ contentType: "text/html", body: html });
        return r.fulfill({ status: 404, body: "" });
      });
      await p.goto("https://guide.test/guides/yale", { waitUntil: "load" });
      await p.waitForTimeout(300);
      expect(asked.filter((u) => /\.(mp4|vtt)$/.test(u))).toEqual([]);

      // Both videos render: one on a row, one inside the Checkout steps.
      expect(await p.locator("video").count()).toBe(2);
      expect(await p.locator("#checkout .steps video").count()).toBe(1);
      const size = await p.evaluate(() =>
        [...document.querySelectorAll("video")].map((v) => {
          const r = v.getBoundingClientRect();
          return { w: r.width, h: r.height, cap: innerHeight * 0.72 };
        }),
      );
      for (const s of size) {
        expect(s.h).toBeLessThanOrEqual(s.cap + 1);
        expect(s.w).toBeLessThanOrEqual(720);
      }

      const tracks = await p.evaluate(async () => {
        const vs = [...document.querySelectorAll("video")];
        for (const v of vs) {
          v.muted = true;
          v.play().catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 400));
        return vs.map((v) => v.querySelectorAll("track").length);
      });
      // The clip with captions gets its track on play; the silent one never gets one.
      expect(tracks.sort()).toEqual([0, 1]);
    } finally {
      await browser.close();
    }
  }, 60_000);
});

/** Yale with a plain row that carries a photo, a room, and two videos (one in Checkout). */
function withMedia(): GuideModel {
  const m = structuredClone(yaleFixture);
  m.look.plates = {};
  m.photos.push({
    src: "img/yale-kitchen-1.jpg",
    alt: "The kitchen",
    room: "Kitchen",
    width: 1920,
    height: 1280,
  });
  const house = m.sections.find((s) => s.id === "house");
  house?.items.push({
    label: "Coffee",
    body: "A Keurig coffee machine.",
    photo: "img/yale-kitchen-1.jpg",
    source: "fixture",
    checked: "2026-11-11",
  });
  const S = { source: "fixture", checked: "2026-11-11" };
  const stairs = m.sections
    .find((s) => s.id === "good-to-know")
    ?.items.find((i) => i.label === "Stairs");
  if (stairs)
    stairs.video = {
      src: "/media/stairs.mp4",
      type: "video/mp4",
      poster: "/media/stairs.jpg",
      alt: "The stairs from the lower level to the top floor",
      width: 720,
      height: 1280,
      captions: "/media/stairs.vtt",
      ...S,
    };
  const lights = m.sections
    .find((s) => s.id === "checkout")
    ?.items.find((i) => i.label === "Lights and windows");
  if (lights)
    lights.video = {
      src: "/media/windows.mp4",
      type: "video/mp4",
      poster: "/media/windows.jpg",
      alt: "Closing the living room windows",
      width: 720,
      height: 1280,
      ...S,
    };
  return m;
}
