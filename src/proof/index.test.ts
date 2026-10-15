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
      { value: "273+", label: "short-term rentals operated" },
      { value: "120+", label: "listings launched" },
      { value: "17,000+", label: "reservations handled" },
      { value: "$97.5M+", label: "in property value managed" },
      { value: "78", label: "owners served" },
      { value: "28+", label: "markets · 8 states" },
      { value: "9", label: "hospitality companies built, run, or scaled" },
      { value: "670+", label: "claims filed" },
    ]);
  });

  it("has no empty values or labels", () => {
    for (const stat of OPERATING_RECORD.stats) {
      expect(stat.value.trim().length).toBeGreaterThan(0);
      expect(stat.label.trim().length).toBeGreaterThan(0);
    }
  });
});
