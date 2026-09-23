import { describe, expect, it } from "vitest";
import { OPERATING_RECORD } from "./index.js";

describe("OPERATING_RECORD (canonical proof dataset)", () => {
  it("is the framed 8-stat ledger in canonical reading order", () => {
    expect(OPERATING_RECORD.eyebrow).toBe("The operating record behind the work");
    expect(OPERATING_RECORD.stamp).toBe("Attested · as of 2026");
    expect(OPERATING_RECORD.stats).toHaveLength(8);
  });

  // Pin the exact owner-attested figures. This is the network-wide drift guard:
  // any change must be intentional and re-synced to every site's port.
  it("publishes the exact attested figures", () => {
    expect(OPERATING_RECORD.stats).toEqual([
      { value: "273+", label: "STRs operated" },
      { value: "120+", label: "listings launched" },
      { value: "16,900+", label: "reservations facilitated" },
      { value: "$94.5M+", label: "real estate stewarded" },
      { value: "78+", label: "clients served" },
      { value: "28+", label: "markets · 8 states" },
      { value: "9+", label: "hospitality companies built" },
      { value: "670+", label: "claims filed" },
    ]);
  });


  // Ruled by Jake, 2026-09-23. Every figure here counts something that is still
  // happening, so a bare exact count goes false the moment the next one lands and
  // nothing on the page knows. A "+" makes each one a floor that can only ever
  // understate, which is the only shape that cannot rot between refreshes.
  it("states every figure as a floor, never as an exact count", () => {
    for (const stat of OPERATING_RECORD.stats) {
      expect(stat.value, `${stat.label} must end in + so it cannot go false`).toMatch(/\+$/);
    }
  });

  it("has no empty values or labels", () => {
    for (const stat of OPERATING_RECORD.stats) {
      expect(stat.value.trim().length).toBeGreaterThan(0);
      expect(stat.label.trim().length).toBeGreaterThan(0);
    }
  });
});
