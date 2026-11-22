import { describe, expect, it } from "vitest";
import { icsFor, nyWallToUtc } from "./ics";

describe("New York wall time to a calendar instant", () => {
  it("reads a summer evening as 4 hours behind UTC", () => {
    expect(nyWallToUtc("2026-10-10T15:00")?.toISOString()).toBe("2026-10-10T19:00:00.000Z");
  });
  it("reads a winter afternoon as 5 hours behind UTC", () => {
    expect(nyWallToUtc("2027-01-16T15:00")?.toISOString()).toBe("2027-01-16T20:00:00.000Z");
  });
  it("is right on both sides of the November 1 2026 clock change", () => {
    expect(nyWallToUtc("2026-10-31T19:00")?.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(nyWallToUtc("2026-11-01T19:00")?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
  it("is right on both sides of the March 2027 change", () => {
    expect(nyWallToUtc("2027-03-13T12:00")?.toISOString()).toBe("2027-03-13T17:00:00.000Z");
    expect(nyWallToUtc("2027-03-14T12:00")?.toISOString()).toBe("2027-03-14T16:00:00.000Z");
  });
  it("refuses what is not a real time or day", () => {
    expect(nyWallToUtc("2026-02-31T10:00")).toBeNull();
    expect(nyWallToUtc("2026-10-10T25:00")).toBeNull();
    expect(nyWallToUtc("tomorrow")).toBeNull();
  });
});

const calendar = { name: "Example House", domain: "example-house.org", product: "Programs" };

describe("the file", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  it("carries the start, an end an hour later by default, and the place", () => {
    const f = icsFor({
      calendar,
      title: "Concert, with talk",
      start: "2026-11-14T19:30",
      where: "The Studio, Springfield, NY",
      now,
      uid: "concert",
    });
    expect(f).toContain("DTSTART:20261115T003000Z");
    expect(f).toContain("DTEND:20261115T013000Z");
    expect(f).toContain("SUMMARY:Concert\\, with talk");
    expect(f).toContain("LOCATION:The Studio\\, Springfield\\, NY");
    expect(f?.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(f?.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("uses a real end time when it is later than the start", () => {
    const f = icsFor({
      calendar,
      title: "T",
      start: "2026-11-14T19:30",
      end: "2026-11-14T21:00",
      now,
    });
    expect(f).toContain("DTEND:20261115T020000Z");
  });
  it("gives no file when the start is not a real time", () => {
    expect(icsFor({ calendar, title: "T", start: "", now })).toBeNull();
  });
  it("says who it is from, and falls back to the site's name for an empty title", () => {
    const f = icsFor({ calendar, title: "", start: "2026-11-14T19:30", now, uid: "x" });
    expect(f).toContain("PRODID:-//Example House//Programs//EN");
    expect(f).toContain("@example-house.org");
    expect(f).toContain("SUMMARY:Example House");
  });
  it("says Events when the site names no product", () => {
    const f = icsFor({
      calendar: { name: "H", domain: "h.org" },
      title: "T",
      start: "2026-11-14T19:30",
      now,
    });
    expect(f).toContain("PRODID:-//H//Events//EN");
  });
});
