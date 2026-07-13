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
      { value: "237", label: "STRs operated" },
      { value: "116", label: "listings launched" },
      { value: "16,800+", label: "reservations facilitated" },
      { value: "$89.5M+", label: "real estate stewarded" },
      { value: "73", label: "clients served" },
      { value: "23", label: "markets · 7 states" },
      { value: "7", label: "STR operating companies built" },
      { value: "500+", label: "claims resolved" },
    ]);
  });

  it("has no empty values or labels", () => {
    for (const stat of OPERATING_RECORD.stats) {
      expect(stat.value.trim().length).toBeGreaterThan(0);
      expect(stat.label.trim().length).toBeGreaterThan(0);
    }
  });
});
