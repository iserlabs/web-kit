import { describe, expect, it } from "vitest";
// @ts-expect-error -- CLI code is .mjs, consumed by bare Node
import { GEOMETRIES, gradeConsole, gradeGeometry, gradeTouch, measureExpression } from "./checks.mjs";

const ctx = { route: "/", geometry: { name: "iPhone 16 Pro", w: 402, h: 874, dpr: 3, mobile: true } };

/** A page that passes everything, to vary one thing at a time from. */
const clean = () => ({
  vw: 402,
  vh: 874,
  docWidth: 402,
  docHeight: 5000,
  sideways: false,
  hero: { top: 0, bottom: 874, height: 874, nextTop: 874, contentBottom: 800, contentTop: 120 },
  targets: [{ sel: "a.btn", w: 160, h: 48 }],
  clipped: [],
  offRight: [],
});
const codes = (fs: Array<{ code: string }>) => fs.map((f) => f.code);

describe("gradeGeometry", () => {
  it("passes a page that fills the window with nothing cut off", () => {
    expect(gradeGeometry(clean(), ctx)).toEqual([]);
  });

  it("catches a hero that stops short of the fold", () => {
    const m = clean();
    m.hero.bottom = 647;
    m.hero.nextTop = 647;
    const found = codes(gradeGeometry(m, ctx));
    expect(found).toContain("browser-hero-short");
    expect(found).toContain("browser-hero-bleed");
  });

  it("catches hero content pushed past the bottom of the screen", () => {
    const m = clean();
    m.hero.contentBottom = 920;
    expect(codes(gradeGeometry(m, ctx))).toContain("browser-hero-cut");
  });

  it("catches sideways scroll and reports both widths", () => {
    const m = clean();
    m.sideways = true;
    m.docWidth = 430;
    const [f] = gradeGeometry(m, ctx);
    expect(f.code).toBe("browser-sideways-scroll");
    expect(f.message).toContain("430px in 402px");
  });

  it("names the smallest tap target rather than just counting them", () => {
    const m = clean();
    m.targets = [
      { sel: "a.big", w: 100, h: 48 },
      { sel: "button.rv-icb", w: 36, h: 38 },
      { sel: "a.small", w: 40, h: 41 },
    ];
    const [f] = gradeGeometry(m, ctx);
    expect(f.code).toBe("browser-tap-target");
    expect(f.message).toContain("button.rv-icb at 38px");
    expect(f.message).toContain("2 target(s)");
  });

  it("reports clipped text with the words that are being lost", () => {
    const m = clean();
    m.clipped = [{ sel: "h1.t-hero", text: "A house for art, conversation" }];
    const [f] = gradeGeometry(m, ctx);
    expect(f.code).toBe("browser-text-clipped");
    expect(f.message).toContain("A house for art");
  });

  it("only asks about the hero where a hero was configured", () => {
    const m = clean();
    m.hero = null;
    expect(gradeGeometry(m, { ...ctx, requireHero: false })).toEqual([]);
    expect(codes(gradeGeometry(m, ctx))).toContain("browser-hero-missing");
  });

  it("stamps the geometry into the message, since the same route passes at other sizes", () => {
    const m = clean();
    m.sideways = true;
    expect(gradeGeometry(m, ctx)[0].message.startsWith("iPhone 16 Pro:")).toBe(true);
  });
});

describe("gradeTouch", () => {
  it("passes when the page moved under the finger", () => {
    expect(gradeTouch({ before: 300, after: 900, scrollable: true }, ctx)).toEqual([]);
  });

  it("fails a page that will not scroll, which is what touch-action:none does", () => {
    const [f] = gradeTouch({ before: 300, after: 300, scrollable: true }, ctx);
    expect(f.code).toBe("browser-touch-frozen");
    expect(f.severity).toBe("error");
  });

  it("says nothing about a page too short to scroll", () => {
    expect(gradeTouch({ before: 0, after: 0, scrollable: false }, ctx)).toEqual([]);
  });
});

describe("gradeConsole", () => {
  it("reports at most three, so one broken route cannot bury the run", () => {
    expect(gradeConsole(["a", "b", "c", "d", "e"], ctx)).toHaveLength(3);
  });
});

describe("the matrix and the measurement", () => {
  it("keeps the landscape phone, which is the row that breaks", () => {
    expect(GEOMETRIES.some((g) => g.w > g.h && g.mobile)).toBe(true);
  });

  it("covers phone, tablet, laptop and a short window", () => {
    expect(GEOMETRIES.some((g) => g.w <= 375)).toBe(true);
    expect(GEOMETRIES.some((g) => g.w >= 1700)).toBe(true);
    expect(GEOMETRIES.some((g) => g.h <= 480)).toBe(true);
  });

  it("only looks for a hero when one is configured", () => {
    expect(measureExpression({ heroSelector: null })).toContain("const hero = null");
    expect(measureExpression({ heroSelector: ".doorway" })).toContain('querySelector(".doorway")');
  });
});
