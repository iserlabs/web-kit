import { describe, expect, it } from "vitest";
import {
  type Artwork,
  catalogIds,
  formatAvailability,
  formatDimensionsLine,
  formatEdition,
  formatLabel,
  formatMediumLine,
  formatTitleLine,
  isFullyDocumented,
  isPurchasable,
  missingFields,
} from "./record";

/** A record with only what every work is guaranteed to have. */
const bare = (over: Partial<Artwork> = {}): Artwork => ({
  slug: "waterscape-01",
  catalogId: "AA-0001",
  series: "waterscapes",
  lifecycle: "current",
  publish: "published",
  src: "/works/waterscape-01.png",
  alt: "A waterscape",
  aspect: "landscape",
  ...over,
});

describe("Carole 06: the label block", () => {
  it("puts the title before the date", () => {
    expect(formatTitleLine(bare({ title: "Alcyone", year: 2025 }))).toBe("Alcyone, 2025");
  });

  it("calls an untitled work Untitled rather than leaving a hole", () => {
    expect(formatTitleLine(bare())).toBe("Untitled");
    expect(formatTitleLine(bare({ year: 2024 }))).toBe("Untitled, 2024");
  });

  it("names the materials and the substrate", () => {
    expect(formatMediumLine(bare({ medium: ["Oil"], substrate: "linen" }))).toBe("Oil on linen");
  });

  it("lists multiple materials instead of saying mixed media", () => {
    const w = bare({ medium: ["Oil", "graphite", "wax"], substrate: "linen" });
    expect(formatMediumLine(w)).toBe("Oil, graphite and wax on linen");
    expect(formatMediumLine(w)).not.toContain("Mixed media");
  });

  it("puts height before width", () => {
    const w = bare({ dimensions: { height: 36, width: 24, unit: "in" } });
    expect(formatDimensionsLine(w)).toBe("36 × 24 in");
  });

  it("adds depth only when the work has it", () => {
    expect(
      formatDimensionsLine(bare({ dimensions: { height: 36, width: 24, depth: 2, unit: "in" } })),
    ).toBe("36 × 24 × 2 in");
  });

  it("prints the full three-line block when everything is known", () => {
    const w = bare({
      title: "Alcyone",
      year: 2025,
      medium: ["Oil", "graphite"],
      substrate: "linen",
      dimensions: { height: 36, width: 24, unit: "in" },
    });
    expect(formatLabel(w)).toEqual(["Alcyone, 2025", "Oil and graphite on linen", "36 × 24 in"]);
  });
});

describe("the absent-field rule: show only what exists", () => {
  it("drops the dimensions line entirely rather than printing a blank", () => {
    const w = bare({ title: "Alcyone", year: 2025, medium: ["Oil"], substrate: "linen" });
    expect(formatLabel(w)).toEqual(["Alcyone, 2025", "Oil on linen"]);
  });

  it("drops the medium line when neither material nor substrate is known", () => {
    expect(formatLabel(bare({ title: "Alcyone" }))).toEqual(["Alcyone"]);
  });

  it("never emits an empty string, a placeholder, or an on-request stand-in", () => {
    for (const line of formatLabel(bare())) {
      expect(line.trim()).not.toBe("");
      expect(line).not.toMatch(/on request|TBD|unknown|n\/a/i);
    }
  });

  it("survives a record where only the substrate is known", () => {
    expect(formatMediumLine(bare({ substrate: "linen" }))).toBe("linen");
  });

  it("prints an edition only where one exists", () => {
    expect(formatEdition(bare())).toBe("");
    expect(formatEdition(bare({ edition: { number: 2, of: 10 } }))).toBe("Edition 2 of 10");
  });
});

describe("Carole 05: sold work never reads as available", () => {
  it("says sold plainly", () => {
    expect(formatAvailability(bare({ availability: "sold" }))).toBe("Sold");
  });

  it("does not invite an inquiry on a sold work", () => {
    expect(formatAvailability(bare({ availability: "sold" }))).not.toMatch(/request|inquire/i);
  });

  it("shows a public price when the price is public", () => {
    const w = bare({
      availability: "available",
      price: { amount: 4200, currency: "USD", visibility: "public" },
    });
    expect(formatAvailability(w)).toBe("$4,200");
  });

  it("withholds the amount when the price is on request", () => {
    const w = bare({
      availability: "available",
      price: { amount: 4200, currency: "USD", visibility: "on-request" },
    });
    expect(formatAvailability(w)).toBe("Price on request");
    expect(formatAvailability(w)).not.toContain("4,200");
  });

  it("stays silent when availability was never recorded, rather than implying a sale", () => {
    expect(formatAvailability(bare())).toBe("");
  });

  it("only lets a published, available work be purchased", () => {
    expect(isPurchasable(bare({ availability: "available" }))).toBe(true);
    expect(isPurchasable(bare({ availability: "sold" }))).toBe(false);
    expect(isPurchasable(bare({ availability: "available", publish: "draft" }))).toBe(false);
    expect(isPurchasable(bare())).toBe(false);
  });
});

describe("Carole 15: the record reports its own gaps", () => {
  it("names every missing field on a bare record", () => {
    expect(missingFields(bare())).toEqual([
      "title",
      "year",
      "medium",
      "substrate",
      "dimensions",
      "availability",
    ]);
  });

  it("counts a fully documented work as complete", () => {
    const w = bare({
      title: "Alcyone",
      year: 2025,
      medium: ["Oil"],
      substrate: "linen",
      dimensions: { height: 36, width: 24, unit: "in" },
      availability: "available",
    });
    expect(missingFields(w)).toEqual([]);
    expect(isFullyDocumented(w)).toBe(true);
  });

  it("treats an empty medium list as missing, not as documented", () => {
    expect(missingFields(bare({ medium: [] }))).toContain("medium");
  });
});

describe("catalog ids come from the site's prefix", () => {
  it("numbers works by sorted slug, so list order cannot shift them", () => {
    const ids = catalogIds(["b-work", "a-work", "c-work"], "JP-");
    expect(ids.get("a-work")).toBe("JP-0001");
    expect(ids.get("b-work")).toBe("JP-0002");
    expect(ids.get("c-work")).toBe("JP-0003");
  });

  it("uses whatever prefix the site configures", () => {
    expect(catalogIds(["only"], "PL-").get("only")).toBe("PL-0001");
  });

  it("leaves the caller's list in its own order", () => {
    const slugs = ["b", "a"];
    catalogIds(slugs, "X-");
    expect(slugs).toEqual(["b", "a"]);
  });
});
