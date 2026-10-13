import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, noticeShow, onView, type Show, showStatus } from "./shows";

/** Obviously fake facts: nothing here describes a real show. */
const show = (over: Partial<Show> = {}): Show => ({
  slug: "test-show",
  title: "Test Show",
  kind: "solo",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "published",
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("showStatus reads dates in the site's time zone, never UTC", () => {
  it("defaults to New York", () => {
    expect(DEFAULT_TIME_ZONE).toBe("America/New_York");
  });

  it("has not opened at 10 PM in New York on the eve, when UTC is already on the first day", () => {
    // 2026-11-07T03:00Z is 10:00 PM on November 6 in New York.
    expect(showStatus(show(), at("2026-11-07T03:00:00Z"))).toBe("upcoming");
    expect(showStatus(show(), at("2026-11-07T03:00:00Z"), "UTC")).toBe("current");
  });

  it("opens at midnight New York time", () => {
    expect(showStatus(show(), at("2026-11-07T04:59:59Z"))).toBe("upcoming");
    expect(showStatus(show(), at("2026-11-07T05:00:00Z"))).toBe("current");
  });

  it("is still on at 11:59 PM in New York on its last day, when UTC is already on the next", () => {
    expect(showStatus(show(), at("2026-12-06T04:59:59Z"))).toBe("current");
    expect(showStatus(show(), at("2026-12-06T04:59:59Z"), "UTC")).toBe("past");
    expect(showStatus(show(), at("2026-12-06T05:00:00Z"))).toBe("past");
  });

  it("counts the last day as open all day", () => {
    expect(showStatus(show(), at("2026-12-05T17:00:00Z"))).toBe("current");
  });

  it("reads a time zone east of UTC on its own calendar", () => {
    // 2026-11-06T15:00Z is midnight on November 7 in Tokyo and 10 AM on November 6 in New York.
    expect(showStatus(show(), at("2026-11-06T14:59:59Z"), "Asia/Tokyo")).toBe("upcoming");
    expect(showStatus(show(), at("2026-11-06T15:00:00Z"), "Asia/Tokyo")).toBe("current");
    expect(showStatus(show(), at("2026-11-06T15:00:00Z"))).toBe("upcoming");
  });

  it("uses the real offset on the night the clocks fall back", () => {
    // Daylight saving ends 2026-11-01. A fixed EDT offset would call 04:59Z on Nov 2 the next day.
    const s = show({ startsOn: "2026-10-01", endsOn: "2026-11-01" });
    expect(showStatus(s, at("2026-11-02T04:59:59Z"))).toBe("current");
    expect(showStatus(s, at("2026-11-02T05:00:00Z"))).toBe("past");
  });

  it("uses the real offset on the night the clocks spring forward", () => {
    // Daylight saving starts 2027-03-14. A fixed EST offset would call 04:00Z on Mar 15 the day before.
    const closing = show({ startsOn: "2027-02-01", endsOn: "2027-03-13" });
    expect(showStatus(closing, at("2027-03-14T04:59:59Z"))).toBe("current");
    expect(showStatus(closing, at("2027-03-14T05:00:00Z"))).toBe("past");
    const opening = show({ startsOn: "2027-03-15", endsOn: "2027-04-15" });
    expect(showStatus(opening, at("2027-03-15T03:59:59Z"))).toBe("upcoming");
    expect(showStatus(opening, at("2027-03-15T04:00:00Z"))).toBe("current");
  });

  it("throws on a time zone that does not exist, rather than guessing", () => {
    expect(() => showStatus(show(), at("2026-11-07T17:00:00Z"), "Mars/Olympus")).toThrow(
      RangeError,
    );
  });
});

describe("noticeShow: what the homepage mentions", () => {
  it("names the show on now", () => {
    expect(noticeShow([show()], at("2026-11-20T17:00:00Z"))?.slug).toBe("test-show");
  });

  it("comes down the day after the show closes, with no manual step", () => {
    expect(noticeShow([show()], at("2026-12-05T17:00:00Z"))?.slug).toBe("test-show");
    expect(noticeShow([show()], at("2026-12-06T04:59:59Z"))?.slug).toBe("test-show");
    expect(noticeShow([show()], at("2026-12-06T05:00:00Z"))).toBeUndefined();
  });

  it("names the next show once it is 45 days out, and not before", () => {
    // In New York, November 7 is 46 days after September 22 and 45 days after September 23.
    expect(noticeShow([show()], at("2026-09-22T16:00:00Z"))).toBeUndefined();
    expect(noticeShow([show()], at("2026-09-23T16:00:00Z"))?.slug).toBe("test-show");
  });

  it("never mentions a held-back show", () => {
    expect(noticeShow([show({ publish: "draft" })], at("2026-11-20T17:00:00Z"))).toBeUndefined();
  });

  it("prefers the show on now over a sooner upcoming one", () => {
    const onNow = show({ slug: "on-now", startsOn: "2026-11-01", endsOn: "2026-11-30" });
    const next = show({ slug: "next", startsOn: "2026-11-10", endsOn: "2026-11-20" });
    expect(noticeShow([next, onNow], at("2026-11-05T17:00:00Z"))?.slug).toBe("on-now");
  });

  it("of two upcoming shows, names the one opening first", () => {
    const later = show({ slug: "later", startsOn: "2026-11-20", endsOn: "2026-12-20" });
    const sooner = show({ slug: "sooner", startsOn: "2026-11-10", endsOn: "2026-12-30" });
    expect(noticeShow([later, sooner], at("2026-11-01T17:00:00Z"))?.slug).toBe("sooner");
  });

  it("of two shows on now, names the one closing first", () => {
    const long = show({ slug: "long", startsOn: "2026-11-01", endsOn: "2026-12-31" });
    const short = show({ slug: "short", startsOn: "2026-11-05", endsOn: "2026-11-15" });
    expect(noticeShow([long, short], at("2026-11-10T17:00:00Z"))?.slug).toBe("short");
  });

  it("returns nothing when there are no shows", () => {
    expect(noticeShow([], at("2026-11-10T17:00:00Z"))).toBeUndefined();
  });
});

describe("onView: the show a work is hanging in", () => {
  const during = at("2026-11-20T17:00:00Z");

  it("returns the published show on now that lists the work", () => {
    expect(onView("waterscape-01", [show()], during)?.slug).toBe("test-show");
  });

  it("returns nothing for a work the show does not list", () => {
    expect(onView("floral-01", [show()], during)).toBeUndefined();
  });

  it("returns nothing before the show opens and after it closes", () => {
    expect(onView("waterscape-01", [show()], at("2026-11-07T04:59:59Z"))).toBeUndefined();
    expect(onView("waterscape-01", [show()], at("2026-12-06T05:00:00Z"))).toBeUndefined();
  });

  it("ignores a held-back show", () => {
    expect(onView("waterscape-01", [show({ publish: "draft" })], during)).toBeUndefined();
  });

  it("reads the day in the time zone it is given", () => {
    const midnightInTokyo = at("2026-11-06T15:00:00Z");
    expect(onView("waterscape-01", [show()], midnightInTokyo, "Asia/Tokyo")?.slug).toBe(
      "test-show",
    );
  });
});
