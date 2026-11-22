import { describe, expect, it } from "vitest";
import { resolveCopy } from "./copy";
import { longNameFixture, sunMountainBrand, yaleFixture } from "./fixtures";
import { guideIconSvg, guideManifest, iconText } from "./manifest";
import { planGuide } from "./plan";
import { guideServiceWorker } from "./sw";

const plan = (m = yaleFixture) => planGuide(m, resolveCopy(m, { approvals: [] }));

describe("guideManifest", () => {
  it("is per house, light, inside the worker's scope", () => {
    const m = guideManifest({
      plan: plan(),
      brand: sunMountainBrand,
      startUrl: "/guides/yale",
      scope: "/guides/",
      icons: [{ src: "/guides/yale/icon.png", sizes: "512x512", type: "image/png" }],
    });
    expect(m.name).toBe("135 Yale guest guide");
    expect(m.short_name).toBe("135 Yale");
    expect(m.theme_color).toBe("#e9c2a4");
    expect(m.display).toBe("standalone");
  });

  it("shortens a long name to its first two words", () => {
    expect(plan(longNameFixture).shortName).toBe("616 Bonfoy");
  });

  it("refuses a start URL outside the scope", () => {
    expect(() =>
      guideManifest({
        plan: plan(),
        brand: sunMountainBrand,
        startUrl: "/yale",
        scope: "/guides/",
        icons: [],
      }),
    ).toThrow();
  });
});

describe("guideIconSvg", () => {
  it("draws the house number on the arrival field in the display face", () => {
    const svg = guideIconSvg(plan(), sunMountainBrand);
    expect(iconText("135 Yale")).toBe("135");
    expect(iconText("Lark")).toBe("L");
    expect(iconText("Crown Ridge Cottage")).toBe("CR");
    expect(iconText("616 Bonfoy Main House and Cottage")).toBe("616");
    expect(iconText("Cranbrook")).toBe("C");
    expect(iconText("Apartment 202")).toBe("202");
    expect(iconText("2nd floor A2")).toBe("A2");
    expect(iconText("Unit 12b")).toBe("12B");
    expect(iconText("M02")).toBe("M02");
    expect(iconText("1st Street Loft")).toBe("SL");
    expect(svg).toContain('fill="#e9c2a4"');
    expect(svg).toContain(">135</text>");
    expect(svg).toContain('font-family="&quot;Newsreader&quot;, Georgia, serif"');
    expect(svg).not.toContain("@font-face");
    const embedded = guideIconSvg(plan(), sunMountainBrand, {
      font: { data: new Uint8Array([1, 2, 3]) },
    });
    expect(embedded).toContain(
      '@font-face{font-family:"Newsreader";src:url(data:font/woff2;base64,AQID)',
    );
  });
});

describe("guideServiceWorker", () => {
  it("names one cache per build and drops only its own prefix", () => {
    const js = guideServiceWorker({
      cachePrefix: "sms-guides",
      scope: "/guides/",
      version: "abc123",
    });
    expect(js).toContain('"cache":"sms-guides-v2-abc123"');
    expect(js).toContain('k.startsWith(CFG.prefix + "-")');
    expect(js).not.toMatch(/Date|setTimeout|max-age/);
  });

  it("refuses a prefix, version or scope that could break the script", () => {
    expect(() =>
      guideServiceWorker({ cachePrefix: "SMS guides", scope: "/guides/", version: "1" }),
    ).toThrow();
    expect(() =>
      guideServiceWorker({ cachePrefix: "sms-guides", scope: "/guides/", version: '1";x' }),
    ).toThrow();
    expect(() =>
      guideServiceWorker({ cachePrefix: "sms-guides", scope: "/g'uides/", version: "1" }),
    ).toThrow();
  });
});

describe("explicit icon initials", () => {
  it("a site's own iconText wins over the name, and the validator bounds it", async () => {
    const { validateModel } = await import("./validate");
    const m = structuredClone(yaleFixture);
    m.iconText = "Y1";
    const p = planGuide(m, resolveCopy(m, { approvals: [] }));
    expect(guideIconSvg(p, sunMountainBrand)).toContain(">Y1</text>");
    m.iconText = "TOOLONG";
    expect(validateModel(m, { today: "2026-11-11" }).some((x) => x.startsWith("iconText:"))).toBe(
      true,
    );
  });
});
