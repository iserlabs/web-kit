import { describe, expect, it } from "vitest";
import { currentFirst, forDisplay, groupByAvailability, hasAvailabilityData } from "./availability";
import type { Artwork } from "./record";

let made = 0;
const work = (over: Partial<Artwork> = {}): Artwork => {
  made += 1;
  return {
    slug: `w-${made}`,
    catalogId: "AA-0000",
    series: "waterscapes",
    lifecycle: "current",
    publish: "published",
    src: "/works/x.png",
    alt: "x",
    aspect: "landscape",
    ...over,
  };
};

describe("Carole 05: sold is separated from available", () => {
  it("puts available and sold in different groups", () => {
    const g = groupByAvailability([
      work({ availability: "available" }),
      work({ availability: "sold" }),
    ]);
    expect(g.available).toHaveLength(1);
    expect(g.unavailable).toHaveLength(1);
  });

  it("treats reserved as unavailable, not as active inventory", () => {
    const g = groupByAvailability([work({ availability: "reserved" })]);
    expect(g.available).toHaveLength(0);
    expect(g.unavailable).toHaveLength(1);
  });

  it("keeps not-for-sale apart from sold, since it never was inventory", () => {
    const g = groupByAvailability([work({ availability: "not-for-sale" })]);
    expect(g.notForSale).toHaveLength(1);
    expect(g.unavailable).toHaveLength(0);
  });

  it("never counts an unrecorded work as available", () => {
    const g = groupByAvailability([work()]);
    expect(g.available).toHaveLength(0);
    expect(g.unstated).toHaveLength(1);
  });
});

describe("a site stays silent until it knows something", () => {
  it("reports no availability data when no work has a status", () => {
    expect(hasAvailabilityData([work(), work()])).toBe(false);
  });

  it("reports data the moment one work has a status", () => {
    expect(hasAvailabilityData([work(), work({ availability: "sold" })])).toBe(true);
  });
});

describe("Carole 05: current work leads, older work stays visible", () => {
  it("orders current before earlier before archived", () => {
    const ordered = currentFirst([
      work({ lifecycle: "archived" }),
      work({ lifecycle: "current" }),
      work({ lifecycle: "earlier" }),
    ]);
    expect(ordered.map((w) => w.lifecycle)).toEqual(["current", "earlier", "archived"]);
  });

  it("keeps archived work present rather than dropping it", () => {
    const input = [work({ lifecycle: "archived" }), work({ lifecycle: "current" })];
    expect(currentFirst(input)).toHaveLength(input.length);
  });

  it("ranks an available work above a sold one within the same lifecycle", () => {
    const ordered = forDisplay([
      work({ availability: "sold" }),
      work({ availability: "available" }),
    ]);
    expect(ordered[0]?.availability).toBe("available");
  });

  it("lets lifecycle outrank availability, so current work leads regardless", () => {
    const ordered = forDisplay([
      work({ lifecycle: "archived", availability: "available" }),
      work({ lifecycle: "current", availability: "sold" }),
    ]);
    expect(ordered[0]?.lifecycle).toBe("current");
  });

  it("leaves a list with no statuses in the order it was given", () => {
    const input = [work(), work(), work()];
    expect(forDisplay(input).map((w) => w.slug)).toEqual(input.map((w) => w.slug));
  });
});
