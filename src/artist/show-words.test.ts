import { describe, expect, it } from "vitest";
import { formatOpening, formatShowDates } from "./show-words";

const run = (startsOn: string, endsOn: string) => formatShowDates({ startsOn, endsOn });

describe("formatShowDates: a show's run in plain words", () => {
  it("says a one-day show's date once", () => {
    expect(run("2026-11-07", "2026-11-07")).toBe("November 7, 2026");
  });

  it("says the month once when the run stays inside it", () => {
    expect(run("2026-11-07", "2026-11-29")).toBe("November 7 – 29, 2026");
  });

  it("names both months when the run crosses one", () => {
    expect(run("2026-11-07", "2026-12-05")).toBe("November 7 – December 5, 2026");
  });

  it("names both years when the run crosses the new year", () => {
    expect(run("2026-12-12", "2027-01-09")).toBe("December 12, 2026 – January 9, 2027");
  });

  it("prints the first of a month as the first, never the evening before", () => {
    // Parsed as UTC midnight and read in New York, "2026-11-01" would print October 31.
    expect(run("2026-11-01", "2026-11-30")).toBe("November 1 – 30, 2026");
  });
});

describe("formatOpening: the reception in plain words", () => {
  const at = (on: string, from: string, to?: string) =>
    formatOpening(to ? { on, from, to } : { on, from });

  it("says the weekday and the date, and the half of the day once", () => {
    expect(at("2026-11-07", "18:00", "21:00")).toBe("Saturday, November 7, 6 to 9 PM");
  });

  it("prints minutes only when there are some, and the start alone when there is no end", () => {
    expect(at("2026-11-07", "18:30")).toBe("Saturday, November 7, 6:30 PM");
  });

  it("names both halves when the reception crosses noon", () => {
    expect(at("2026-11-07", "11:00", "13:00")).toBe("Saturday, November 7, 11 AM to 1 PM");
  });

  it("calls noon 12 PM and midnight 12 AM", () => {
    expect(at("2026-11-07", "12:00", "14:00")).toBe("Saturday, November 7, 12 to 2 PM");
    expect(at("2026-11-07", "00:00")).toBe("Saturday, November 7, 12 AM");
  });

  it("counts the weekday right across a leap day and before 1970", () => {
    expect(at("2028-02-29", "18:00")).toBe("Tuesday, February 29, 6 PM");
    expect(at("1969-12-31", "18:00")).toBe("Wednesday, December 31, 6 PM");
  });

  it("names a Sunday", () => {
    expect(at("2026-11-01", "15:00", "17:00")).toBe("Sunday, November 1, 3 to 5 PM");
  });
});
