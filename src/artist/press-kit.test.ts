import { describe, expect, it } from "vitest";
import type { Cv } from "./cv";
import { generatePressToken, isPressToken, pressKit, pressTokenMatches } from "./press-kit";
import type { Artwork, Price } from "./record";
import type { Show } from "./shows";

/** Obviously fake works and prices: test fixtures only, nothing here ships. */
const work = (slug: string, over: Partial<Artwork> = {}): Artwork => ({
  slug,
  catalogId: `TT-${slug}`,
  series: "test-series",
  lifecycle: "current",
  publish: "published",
  src: `/works/${slug}.jpg`,
  alt: "A test work",
  aspect: "portrait",
  title: `Title ${slug}`,
  year: 2025,
  ...over,
});

const usd = (amount: number, visibility: Price["visibility"]): Price => ({
  amount,
  currency: "USD",
  visibility,
});

const works: Artwork[] = [
  work("public-price", {
    availability: "available",
    price: usd(4200, "public"),
    hi: "/works-hi/public-price.jpeg",
  }),
  work("on-request", { availability: "available", price: usd(6800, "on-request") }),
  work("no-price", { availability: "available" }),
  work("sold", { availability: "sold", price: usd(3000, "public") }),
  work("reserved", { availability: "reserved", price: usd(3100, "on-request") }),
  work("kept", { availability: "not-for-sale", price: usd(3200, "public") }),
  work("unrecorded", { price: usd(3300, "public") }),
  work("held-back", { publish: "draft", availability: "available", price: usd(9900, "public") }),
];

const cv: Cv = {
  education: [],
  soloExhibitions: [
    { year: "2025", title: "Hand Show", venue: "Hand Venue", location: "Hand City" },
  ],
  groupExhibitions: [],
  press: [],
  awards: [],
};

const opened: Show = {
  slug: "test-show",
  title: "Test Show",
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["public-price"],
  publish: "published",
};

const now = new Date("2026-11-20T17:00:00Z");
const kit = pressKit({ works, cv, shows: [opened], statement: "A statement.", now });

describe("pressKit: what a gallerist is sent", () => {
  it("lists every published work, priced only where the work can still be had", () => {
    expect(kit.priceList).toEqual([
      {
        slug: "public-price",
        catalogId: "TT-public-price",
        title: "Title public-price, 2025",
        status: "available",
        price: usd(4200, "public"),
      },
      {
        slug: "on-request",
        catalogId: "TT-on-request",
        title: "Title on-request, 2025",
        status: "available",
        price: usd(6800, "on-request"),
      },
      {
        slug: "no-price",
        catalogId: "TT-no-price",
        title: "Title no-price, 2025",
        status: "available",
      },
      { slug: "sold", catalogId: "TT-sold", title: "Title sold, 2025", status: "sold" },
      {
        slug: "reserved",
        catalogId: "TT-reserved",
        title: "Title reserved, 2025",
        status: "reserved",
      },
      { slug: "kept", catalogId: "TT-kept", title: "Title kept, 2025", status: "not-for-sale" },
      {
        slug: "unrecorded",
        catalogId: "TT-unrecorded",
        title: "Title unrecorded, 2025",
        status: "unstated",
      },
    ]);
  });

  it("never prints a price for a sold, reserved, kept or unrecorded work, whatever its visibility", () => {
    for (const slug of ["sold", "reserved", "kept", "unrecorded"]) {
      expect(
        kit.priceList.find((p) => p.slug === slug),
        slug,
      ).not.toHaveProperty("price");
    }
  });

  it("leaves held-back works out entirely", () => {
    expect(kit.works.map((w) => w.work.slug)).not.toContain("held-back");
    expect(kit.priceList.map((p) => p.slug)).not.toContain("held-back");
    expect(kit.works).toHaveLength(7);
  });

  it("offers each work's highest-resolution image the site serves", () => {
    expect(kit.works[0]?.image).toBe("/works-hi/public-price.jpeg");
    expect(kit.works[1]?.image).toBe("/works/on-request.jpg");
  });

  it("carries the CV with the shows that have opened", () => {
    expect(kit.cv.soloExhibitions.map((e) => e.title)).toEqual(["Hand Show"]);
    expect(kit.cv.groupExhibitions.map((e) => e.title)).toEqual(["Test Show"]);
  });

  it("prints the statement verbatim, and nothing when there is none", () => {
    expect(kit.statement).toBe("A statement.");
    const without = pressKit({ works, cv, shows: [], statement: "  ", now });
    expect(without).not.toHaveProperty("statement");
  });
});

describe("the press token", () => {
  it("is long, random and safe in a web address", () => {
    const a = generatePressToken();
    const b = generatePressToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
    expect(isPressToken(a)).toBe(true);
  });

  it("is recognized only in that exact shape", () => {
    expect(isPressToken("a".repeat(43))).toBe(true);
    for (const bad of [
      "",
      "short",
      "a".repeat(42),
      "a".repeat(44),
      `${"a".repeat(42)}=`,
      `${"a".repeat(42)}/`,
      42,
      undefined,
    ]) {
      expect(isPressToken(bad), String(bad)).toBe(false);
    }
  });

  it("opens only for the current token", () => {
    const current = generatePressToken();
    expect(pressTokenMatches(current, current)).toBe(true);
    expect(pressTokenMatches(generatePressToken(), current)).toBe(false);
  });

  it("opens for nothing when no token is set or either side is malformed", () => {
    const current = generatePressToken();
    expect(pressTokenMatches(current, undefined)).toBe(false);
    expect(pressTokenMatches(current, null)).toBe(false);
    expect(pressTokenMatches(undefined, undefined)).toBe(false);
    expect(pressTokenMatches("", "")).toBe(false);
    expect(pressTokenMatches("short", "short")).toBe(false);
  });
});

describe("pressKit: the full record carries no hidden price or master file", () => {
  const hidden = pressKit({
    works: [
      work("a-sold", { availability: "sold", price: usd(1000, "public"), masterSrc: "/m/a.tif" }),
      work("a-reserved", {
        availability: "reserved",
        price: usd(1100, "on-request"),
        masterSrc: "/m/b.tif",
      }),
      work("a-kept", { availability: "not-for-sale", price: usd(1200, "public") }),
      work("a-unstated", { price: usd(1300, "public"), masterSrc: "/m/d.tif" }),
      work("a-request", {
        availability: "available",
        price: usd(1400, "on-request"),
        masterSrc: "/m/e.tif",
      }),
    ],
    cv,
    shows: [],
    now,
  });
  const entry = (slug: string) => hidden.works.find((w) => w.work.slug === slug)?.work;

  it("strips the price from a sold, reserved, not-for-sale or unstated work", () => {
    for (const slug of ["a-sold", "a-reserved", "a-kept", "a-unstated"]) {
      expect(entry(slug), slug).toBeDefined();
      expect(entry(slug), slug).not.toHaveProperty("price");
    }
  });

  it("keeps the price of an available work, on request included", () => {
    expect(entry("a-request")?.price).toEqual(usd(1400, "on-request"));
  });

  it("never carries masterSrc", () => {
    for (const w of hidden.works) expect(w.work, w.work.slug).not.toHaveProperty("masterSrc");
  });
});
