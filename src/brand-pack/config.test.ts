import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { defineBrandPack, UNFILLED, validateBrandPackConfig } from "./config.mjs";

const good = defineBrandPack({
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Front Range short-term rental management",
  markUrl: "https://sunmountainstays.com/brand/mark-128.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#ffffff",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [
    {
      name: "Jake Lee",
      title: "Founder",
      email: "hello@sunmountainstays.com",
      phone: "201.321.5446",
    },
  ],
});

const codes = (c: unknown) => validateBrandPackConfig(c).map((f: { code: string }) => f.code);

describe("validateBrandPackConfig", () => {
  it("passes a complete config", () => {
    expect(validateBrandPackConfig(good)).toEqual([]);
  });

  it("flags a missing share card pick", () => {
    expect(codes({ ...good, shareCard: null })).toContain("brand-pack-unpicked");
  });

  it("flags a share card pick that is not a known variant", () => {
    expect(codes({ ...good, shareCard: "nope" })).toContain("brand-pack-unpicked");
  });

  it("flags an unfilled person field", () => {
    expect(codes({ ...good, people: [{ ...good.people[0], phone: UNFILLED }] })).toContain(
      "brand-pack-placeholder",
    );
  });

  it("flags an empty person field the same way as an unfilled one", () => {
    expect(codes({ ...good, people: [{ ...good.people[0], title: "  " }] })).toContain(
      "brand-pack-placeholder",
    );
  });

  it("flags an unfilled brand token", () => {
    expect(codes({ ...good, markUrl: UNFILLED })).toContain("brand-pack-placeholder");
  });

  it("flags zero people, since a board with nobody on it is not a deliverable", () => {
    expect(codes({ ...good, people: [] })).toContain("brand-pack-no-people");
  });

  it("names the person and the field in the message so the fix is obvious", () => {
    const findings = validateBrandPackConfig({
      ...good,
      people: [{ ...good.people[0], phone: UNFILLED }],
    });
    expect(findings[0].message).toContain("Jake Lee");
    expect(findings[0].message).toContain("phone");
  });

  it("rejects an em dash in any string value", () => {
    expect(codes({ ...good, tagline: "Front Range \u2014 managed" })).toContain(
      "brand-pack-em-dash",
    );
  });
});
