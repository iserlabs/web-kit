import { describe, expect, it } from "vitest";
import {
  AVAILABILITY,
  cleanOverlay,
  cleanText,
  LIFECYCLE,
  PUBLISH,
  sanitizeStoredOverlay,
  UNITS,
} from "./overlay";

describe("cleanOverlay: only what the studio owns survives", () => {
  it("keeps a trimmed title and drops a blank one", () => {
    expect(cleanOverlay({ title: "  Alcyone  " })).toEqual({ title: "Alcyone" });
    expect(cleanOverlay({ title: "   " })).toEqual({});
  });

  it("caps a title at 200 characters", () => {
    expect(cleanOverlay({ title: "x".repeat(300) }).title).toHaveLength(200);
  });

  it("takes a year as a number or a string, as a whole year", () => {
    expect(cleanOverlay({ year: 2025 }).year).toBe(2025);
    expect(cleanOverlay({ year: "2024" }).year).toBe(2024);
    expect(cleanOverlay({ year: 2025.7 }).year).toBe(2025);
  });

  it("drops a year outside 1900 to 2100 or one that is not a number", () => {
    for (const year of [1899, 2101, 0, -5, "abc", null]) {
      expect(cleanOverlay({ year }).year, String(year)).toBeUndefined();
    }
  });

  it("keeps a list of materials, trimmed, at most eight", () => {
    const medium = [" Oil ", "", "graphite", 7, "a", "b", "c", "d", "e", "f", "g"];
    expect(cleanOverlay({ medium }).medium).toEqual([
      "Oil",
      "graphite",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("splits a typed medium into the materials it names", () => {
    expect(cleanOverlay({ medium: "Oil, graphite and wax" }).medium).toEqual([
      "Oil",
      "graphite",
      "wax",
    ]);
  });

  it("caps the substrate at 60 characters and the blurb at 400", () => {
    expect(cleanOverlay({ substrate: "l".repeat(80) }).substrate).toHaveLength(60);
    expect(cleanOverlay({ blurb: "b".repeat(500) }).blurb).toHaveLength(400);
  });

  it("keeps height and width together, in inches unless centimeters are chosen", () => {
    expect(cleanOverlay({ height: "36", width: 24 }).dimensions).toEqual({
      height: 36,
      width: 24,
      unit: "in",
    });
    expect(cleanOverlay({ height: 90, width: 60, depth: 4, unit: "cm" }).dimensions).toEqual({
      height: 90,
      width: 60,
      depth: 4,
      unit: "cm",
    });
    expect(cleanOverlay({ height: 36, width: 24, unit: "furlongs" }).dimensions?.unit).toBe("in");
  });

  it("drops half a measurement, which would print as a complete-looking line", () => {
    expect(cleanOverlay({ height: 36 }).dimensions).toBeUndefined();
    expect(cleanOverlay({ height: 36, width: 0 }).dimensions).toBeUndefined();
  });

  it("accepts only the known availability, lifecycle and publish states", () => {
    expect(cleanOverlay({ availability: "sold", lifecycle: "earlier", publish: "draft" })).toEqual({
      availability: "sold",
      lifecycle: "earlier",
      publish: "draft",
    });
    expect(cleanOverlay({ availability: "gone", lifecycle: "old", publish: "live" })).toEqual({});
  });

  it("records a price in dollars, public only when asked, on request otherwise", () => {
    expect(cleanOverlay({ priceAmount: "4200", priceVisibility: "public" }).price).toEqual({
      amount: 4200,
      currency: "USD",
      visibility: "public",
    });
    expect(cleanOverlay({ priceAmount: 4200, priceVisibility: "anything" }).price).toEqual({
      amount: 4200,
      currency: "USD",
      visibility: "on-request",
    });
    expect(cleanOverlay({ priceAmount: 0 }).price).toBeUndefined();
  });

  it("drops what the studio does not own", () => {
    expect(
      cleanOverlay({
        slug: "x",
        src: "/evil.png",
        alt: "x",
        series: "x",
        catalogId: "x",
        updatedBy: "x",
      }),
    ).toEqual({});
  });
});

describe("cleanText", () => {
  it("reads text only from strings", () => {
    expect(cleanText(42)).toBeUndefined();
    expect(cleanText(undefined)).toBeUndefined();
    expect(cleanText("  hi  ")).toBe("hi");
    expect(cleanText("abcdef", 3)).toBe("abc");
  });
});

describe("sanitizeStoredOverlay: stored data gets the same rules as a form", () => {
  it("keeps only valid keys and drops junk", () => {
    expect(
      sanitizeStoredOverlay({
        title: 7,
        year: "2025",
        price: { visibility: "public" },
        availability: "gone",
        extra: "x",
      }),
    ).toEqual({});
    expect(sanitizeStoredOverlay("junk")).toEqual({});
  });

  it("returns a valid overlay with its key order unchanged", () => {
    const valid = {
      updatedBy: "julian",
      title: "Alcyone",
      dimensions: { height: 36, depth: 1.5, width: 24, unit: "in" },
      price: { visibility: "public", amount: 4200, currency: "USD" },
      edition: { of: 10, number: 2 },
      availability: "sold",
    };
    expect(JSON.stringify(sanitizeStoredOverlay(valid))).toBe(JSON.stringify(valid));
  });

  it("accepts every value cleanOverlay accepts, from one shared list", () => {
    for (const availability of AVAILABILITY) {
      expect(cleanOverlay({ availability }).availability).toBe(availability);
      expect(sanitizeStoredOverlay({ availability }).availability).toBe(availability);
    }
    for (const lifecycle of LIFECYCLE) {
      expect(cleanOverlay({ lifecycle }).lifecycle).toBe(lifecycle);
      expect(sanitizeStoredOverlay({ lifecycle }).lifecycle).toBe(lifecycle);
    }
    for (const publish of PUBLISH) {
      expect(cleanOverlay({ publish }).publish).toBe(publish);
      expect(sanitizeStoredOverlay({ publish }).publish).toBe(publish);
    }
    for (const unit of UNITS) {
      const dims = { height: 3, width: 4, unit };
      expect(cleanOverlay({ height: 3, width: 4, unit }).dimensions).toEqual(dims);
      expect(sanitizeStoredOverlay({ dimensions: dims }).dimensions).toEqual(dims);
    }
  });
});
