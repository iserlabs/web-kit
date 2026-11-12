import { describe, expect, it } from "vitest";
import {
  BANNED_FACES,
  brandCss,
  contrast,
  type GuideBrand,
  lch,
  validateBrand,
  worstContrast,
} from "./brand";
import { columbusBrand, sunMountainBrand } from "./fixtures";

const fields = (list: readonly string[]): GuideBrand["fields"] => {
  const [arrival, first, house, know, rules, out, near, paper] = list as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return { arrival, first, house, know, rules, out, near, paper };
};

const brand = (over: Partial<GuideBrand>): GuideBrand => ({ ...sunMountainBrand, ...over });

/** The spec's token table (section 6), with its computed worst ratios. */
const SPEC_TABLE = [
  {
    id: "palisade",
    ink: "#2a2d31",
    sec: "#4f5359",
    accent: "#233755",
    accentText: "#233755",
    fields: [
      "#ece0c6",
      "#ece4d6",
      "#efe7dc",
      "#e6e4df",
      "#dde2ea",
      "#e1e6ee",
      "#e6e2d6",
      "#f4f3f1",
    ],
    worst: { ink: 10.57, accent: 9.17, sec: 5.91 },
  },
  {
    id: "euclid",
    ink: "#16150f",
    sec: "#5f5847",
    accent: "#8c3b2b",
    accentText: "#8c3b2b",
    fields: [
      "#ebd2c4",
      "#efe2c8",
      "#e8d6cc",
      "#e0e2cc",
      "#e4ded0",
      "#dde3d0",
      "#d9e0c8",
      "#f4efe4",
    ],
    worst: { ink: 12.67, accent: 5.24, sec: 4.89 },
    noBlue: true,
  },
  {
    id: "peak",
    ink: "#141413",
    sec: "#4a4842",
    accent: "#8a6a35",
    accentText: "#6f5428",
    fields: [
      "#ece2cf",
      "#efe8da",
      "#eae3d8",
      "#e6e3dc",
      "#e3e3df",
      "#e1e5e6",
      "#e3e6da",
      "#f7f5f1",
    ],
    worst: { ink: 14.33, accent: 3.9, accentText: 5.49 },
  },
  {
    id: "bluebill",
    ink: "#15211d",
    sec: "#38473f",
    accent: "#266857",
    accentText: "#266857",
    fields: [
      "#efe6d6",
      "#e7dcc7",
      "#ece3d3",
      "#d6e4de",
      "#e3e7e0",
      "#cfe3db",
      "#dfe6d6",
      "#fdfaf4",
    ],
    worst: { ink: 12.2, accent: 4.83, sec: 7.22 },
  },
] as const;

const within = (got: number, want: number) =>
  expect(Math.abs(got - want)).toBeLessThanOrEqual(0.01);

describe("contrast numbers reproduce the spec within 0.01", () => {
  it("Sun Mountain, every field (SPECS section 5 table)", () => {
    const want: [string, number, number, number][] = [
      ["#e9c2a4", 9.79, 4.55, 5.77],
      ["#eed6aa", 11.42, 5.31, 6.72],
      ["#e5c3b9", 9.88, 4.6, 5.82],
      ["#dcd2e0", 11.04, 5.13, 6.5],
      ["#d3dce3", 11.64, 5.41, 6.85],
      ["#cfe0ea", 11.94, 5.55, 7.03],
      ["#d6e2c9", 12.0, 5.58, 7.06],
      ["#f3ebdc", 13.65, 6.35, 8.04],
    ];
    for (const [field, ink, accent, sec] of want) {
      within(contrast(sunMountainBrand.ink, field), ink);
      within(contrast(sunMountainBrand.accent, field), accent);
      within(contrast(sunMountainBrand.sec, field), sec);
    }
    within(contrast(sunMountainBrand.button.ink, sunMountainBrand.button.fill), 9.79);
  });

  it("Columbus, its four fields", () => {
    const want: [string, number, number][] = [
      ["#eedcb6", 11.17, 4.98],
      ["#f1d6b8", 10.81, 4.82],
      ["#d8e0ec", 11.35, 5.06],
      ["#f7f1e5", 13.41, 5.98],
    ];
    for (const [field, ink, accent] of want) {
      within(contrast(columbusBrand.ink, field), ink);
      within(contrast(columbusBrand.accent, field), accent);
    }
  });

  it.each(SPEC_TABLE)("$id worst ratios", (b) => {
    const f = fields(b.fields);
    for (const [role, want] of Object.entries(b.worst)) {
      within(worstContrast(b[role as "ink" | "sec" | "accent" | "accentText"], f), want);
    }
  });

  it.each(SPEC_TABLE)("$id passes validateBrand", (b) => {
    const problems = validateBrand(
      brand({
        id: b.id,
        ink: b.ink,
        sec: b.sec,
        accent: b.accent,
        accentText: b.accentText,
        fields: fields(b.fields),
        button: { fill: b.fields[0], ink: b.ink, doneFill: b.ink, doneInk: b.fields[7] },
        noBlue: "noBlue" in b ? b.noBlue : undefined,
      }),
    );
    expect(problems).toEqual([]);
  });
});

describe("validateBrand", () => {
  it("passes the two fixture brands", () => {
    expect(validateBrand(sunMountainBrand)).toEqual([]);
    expect(validateBrand(columbusBrand)).toEqual([]);
  });

  it("refuses ink, sec or accentText under 4.5:1 on any field", () => {
    expect(validateBrand(brand({ sec: "#8a8a8a" })).some((x) => x.startsWith("sec "))).toBe(true);
    expect(
      validateBrand(brand({ accentText: "#c07050" })).some((x) => x.startsWith("accentText ")),
    ).toBe(true);
  });

  it("refuses an accent under 3:1", () => {
    expect(validateBrand(brand({ accent: "#d9a080" })).some((x) => x.startsWith("accent "))).toBe(
      true,
    );
  });

  it("refuses button ink under 4.5:1 on its fill", () => {
    const p = validateBrand(
      brand({
        button: { fill: "#e9c2a4", ink: "#a08070", doneFill: "#1c2129", doneInk: "#f3ebdc" },
      }),
    );
    expect(p.some((x) => x.startsWith("button"))).toBe(true);
  });

  it("refuses a field at or below luminance 0.55 (light page only)", () => {
    const p = validateBrand(brand({ fields: { ...sunMountainBrand.fields, rules: "#7a8a99" } }));
    expect(p.some((x) => x.includes("fields.rules") && x.includes("luminance"))).toBe(true);
  });

  it("refuses every banned primary face, case-insensitive", () => {
    expect(BANNED_FACES.length).toBe(5);
    for (const family of BANNED_FACES) {
      const p = validateBrand(
        brand({
          faces: {
            ...sunMountainBrand.faces,
            text: { family: family.toUpperCase(), fallback: "serif", weight: 400, strong: 600 },
          },
        }),
      );
      expect(p.some((x) => x.includes("faces.text"))).toBe(true);
    }
  });

  it("lch matches culori's D50 values", () => {
    const navy = lch("#16273d");
    expect(navy.h).toBeCloseTo(265.91, 1);
    expect(navy.c).toBeCloseTo(16.54, 1);
    expect(lch("#cfe0ea").c).toBeCloseTo(8.23, 1);
  });

  it("noBlue refuses a blue or navy anywhere", () => {
    expect(
      validateBrand(brand({ noBlue: true })).some(
        (x) => x.includes("fields.out") && x.includes("blue"),
      ),
    ).toBe(true);
    expect(validateBrand({ ...columbusBrand, noBlue: true }).some((x) => x.startsWith("ink"))).toBe(
      true,
    );
  });
});

describe("brandCss", () => {
  it("writes only the scoped custom properties", () => {
    const css = brandCss(sunMountainBrand);
    expect(css.startsWith('.gg[data-brand="sun-mountain"]{')).toBe(true);
    expect(css.endsWith("}")).toBe(true);
    expect(css).toContain("--ink:#1c2129;");
    expect(css).toContain("--f-arrival:#e9c2a4;");
    expect(css).toContain('--display:"Newsreader",Georgia, serif;');
    expect(css).toContain("--fig-large:300;");
    expect(css.match(/\{/g)).toHaveLength(1);
  });

  it("writes the figure numeric setting, tabular by default", () => {
    expect(brandCss(sunMountainBrand)).toContain("--fig-num:tabular-nums;");
    const serifFigures = brand({
      faces: {
        ...sunMountainBrand.faces,
        figure: {
          family: "Newsreader",
          fallback: "Georgia, serif",
          weight: 400,
          large: 300,
          numeric: "lining-nums tabular-nums",
        },
      },
    });
    expect(brandCss(serifFigures)).toContain("--fig-num:lining-nums tabular-nums;");
  });

  it("refuses to write a value that could break out of the rule", () => {
    expect(() => brandCss(brand({ ink: "#000;}body{display:none" }))).toThrow();
    expect(() =>
      brandCss(
        brand({
          faces: {
            ...sunMountainBrand.faces,
            display: { family: 'x"}body{', fallback: "serif", weight: 300 },
          },
        }),
      ),
    ).toThrow();
  });
});
