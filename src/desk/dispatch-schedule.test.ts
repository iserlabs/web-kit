import { describe, expect, it } from "vitest";
import {
  clock12,
  nyParts,
  nyWallToInstant,
  planSend,
  sayWhen,
  scheduleProblem,
  to24,
} from "./dispatch-schedule";

const NOW = new Date("2026-11-02T15:00:00.000Z"); // 10:00 AM in New York (EST)

describe("a time typed in New York, on a 12-hour clock", () => {
  it("reads 12:00 AM as midnight and 12:00 PM as noon", () => {
    expect(to24(12, false)).toBe(0);
    expect(to24(12, true)).toBe(12);
    expect(to24(9, true)).toBe(21);
    expect(clock12(0, 5)).toBe("12:05 AM");
    expect(clock12(12, 0)).toBe("12:00 PM");
    expect(clock12(21, 30)).toBe("9:30 PM");
  });

  it("is the right moment in winter (UTC-5) and in summer (UTC-4)", () => {
    const winter = nyWallToInstant("2026-12-10", 9, 0);
    const summer = nyWallToInstant("2027-07-10", 9, 0);
    expect(winter.ok && winter.at.toISOString()).toBe("2026-12-10T14:00:00.000Z");
    expect(summer.ok && summer.at.toISOString()).toBe("2027-07-10T13:00:00.000Z");
  });

  it("round-trips: the moment read back in New York is what was typed", () => {
    for (const [date, h, m] of [
      ["2026-11-08", 0, 59],
      ["2026-11-08", 3, 0],
      ["2027-03-14", 3, 0],
      ["2027-03-13", 23, 59],
    ] as const) {
      const r = nyWallToInstant(date, h, m);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const p = nyParts(r.at.getTime());
        expect([p.h, p.mi]).toEqual([h, m]);
      }
    }
  });

  it("refuses the time that does not exist when the clocks jump forward (2:30 AM, 14 March 2027)", () => {
    const r = nyWallToInstant("2027-03-14", 2, 30);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("does not exist");
  });

  it("takes the first of the two 1:30 AM moments when the clocks go back (7 November 2027)", () => {
    const r = nyWallToInstant("2027-11-07", 1, 30);
    expect(r.ok && r.ambiguous).toBe(true);
    expect(r.ok && r.at.toISOString()).toBe("2027-11-07T05:30:00.000Z");
  });

  it("refuses a day that is not on the calendar", () => {
    expect(nyWallToInstant("2026-02-30", 9, 0)).toMatchObject({ ok: false });
    expect(nyWallToInstant("", 9, 0)).toMatchObject({ ok: false });
  });
});

describe("the rules, each refused in a sentence", () => {
  it("refuses a time in the past", () => {
    expect(scheduleProblem(new Date("2026-11-02T14:00:00.000Z"), NOW)).toContain("already passed");
  });

  it("refuses a time under 5 minutes away, and allows exactly 5", () => {
    expect(scheduleProblem(new Date(NOW.getTime() + 4 * 60_000 + 59_000), NOW)).toContain(
      "5 minutes",
    );
    expect(scheduleProblem(new Date(NOW.getTime() + 5 * 60_000), NOW)).toBe("");
  });

  it("refuses more than 30 days ahead, and allows exactly 30", () => {
    const day = 86_400_000;
    expect(scheduleProblem(new Date(NOW.getTime() + 30 * day + 1000), NOW)).toContain("30 days");
    expect(scheduleProblem(new Date(NOW.getTime() + 30 * day), NOW)).toBe("");
  });

  it("plans a good time and says it back in New York words", () => {
    const out = planSend({ date: "2026-11-10", hour12: 9, minute: 30, pm: false }, NOW);
    expect(out).toMatchObject({ ok: true, iso: "2026-11-10T14:30:00.000Z" });
    expect(out.ok && out.said).toBe("Tuesday, November 10, 2026 at 9:30 AM");
  });

  it("plans across the November clock change without moving the wall time", () => {
    const now = new Date("2027-10-30T15:00:00.000Z");
    const out = planSend({ date: "2027-11-08", hour12: 9, minute: 0, pm: false }, now);
    // After clocks go back (7 Nov) New York is UTC-5.
    expect(out.ok && out.iso).toBe("2027-11-08T14:00:00.000Z");
  });

  it("refuses an hour outside 1 to 12", () => {
    expect(planSend({ date: "2026-11-10", hour12: 0, minute: 0, pm: false }, NOW)).toMatchObject({
      ok: false,
    });
    expect(planSend({ date: "2026-11-10", hour12: 13, minute: 0, pm: false }, NOW)).toMatchObject({
      ok: false,
    });
  });

  it("says a stored time back the same way", () => {
    expect(sayWhen("2026-11-10T14:30:00.000Z")).toBe("Tuesday, November 10, 2026 at 9:30 AM");
  });
});
