import { describe, expect, it } from "vitest";
import {
  cleanShow,
  DEFAULT_TIME_ZONE,
  noticeShow,
  onView,
  type Show,
  type ShowRecord,
  sanitizeStoredShows,
  showStatus,
} from "./shows";

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

describe("cleanShow: what the studio may save", () => {
  const catalog = { has: (slug: string) => slug === "waterscape-01" || slug === "floral-01" };
  const valid: Record<string, unknown> = {
    slug: "test-show",
    title: "  Test Show  ",
    kind: "group",
    venue: "Test Gallery",
    address: "1 Test Street",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    opening: { on: "2026-11-07", from: "18:00", to: "21:00" },
    workSlugs: ["waterscape-01", "floral-01", "waterscape-01"],
    href: "https://gallery.example.test/test-show",
    note: "A line in the artist's words.",
    publish: "published",
    extra: "not a show field",
  };

  const NAME = "The show needs a short web name: lowercase letters, digits and single hyphens.";
  const FIRST_DAY = "The first day must be a real date, written 2026-11-07.";
  const LAST_DAY = "The last day must be a real date, written 2026-11-07.";
  const KIND = "Choose the kind of show: solo, two-person, group or event.";
  const OPENING_IN_RUN = "The opening reception must fall within the run of the show.";
  const OPENING_FROM = "The opening reception needs a start time, written 18:00.";
  const HREF = "The gallery's page must be a full web address starting with https:// or http://.";

  it("keeps a complete show, trimmed, with each work listed once and unknown fields dropped", () => {
    expect(cleanShow(valid, catalog)).toEqual({
      ok: true,
      show: {
        slug: "test-show",
        title: "Test Show",
        kind: "group",
        venue: "Test Gallery",
        address: "1 Test Street",
        city: "Test City",
        startsOn: "2026-11-07",
        endsOn: "2026-12-05",
        opening: { on: "2026-11-07", from: "18:00", to: "21:00" },
        workSlugs: ["waterscape-01", "floral-01"],
        href: "https://gallery.example.test/test-show",
        note: "A line in the artist's words.",
        publish: "published",
      },
    });
  });

  it("holds a show back unless it is marked published", () => {
    const { publish: _publish, ...rest } = valid;
    const result = cleanShow(rest, catalog);
    expect(result.ok && result.show.publish).toBe("draft");
  });

  it("drops blank optional fields and an opening left entirely blank", () => {
    const result = cleanShow(
      {
        ...valid,
        address: " ",
        href: "",
        note: "",
        opening: { on: "", from: "", to: "" },
        workSlugs: [],
      },
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.show).not.toHaveProperty("address");
    expect(result.show).not.toHaveProperty("href");
    expect(result.show).not.toHaveProperty("note");
    expect(result.show).not.toHaveProperty("opening");
    expect(result.show.workSlugs).toEqual([]);
  });

  it("keeps an opening with no end time", () => {
    const result = cleanShow({ ...valid, opening: { on: "2026-11-07", from: "18:00" } }, catalog);
    expect(result.ok && result.show.opening).toEqual({ on: "2026-11-07", from: "18:00" });
  });

  it("cuts long text to length, the way a work's fields are cut", () => {
    const result = cleanShow({ ...valid, title: "T".repeat(500), note: "N".repeat(1000) }, catalog);
    expect(result.ok && result.show.title.length).toBe(200);
    expect(result.ok && result.show.note?.length).toBe(300);
  });

  it("names every missing required fact at once", () => {
    const result = cleanShow({}, catalog);
    expect(result.ok ? [] : result.problems).toEqual([
      NAME,
      "Give the show a title.",
      KIND,
      "Name the venue.",
      "Name the city.",
      FIRST_DAY,
      LAST_DAY,
    ]);
  });

  const refusals: [string, Record<string, unknown>, string][] = [
    ["a day that does not exist", { startsOn: "2026-02-30" }, FIRST_DAY],
    ["a thirteenth month", { endsOn: "2026-13-01" }, LAST_DAY],
    ["a date written month first", { startsOn: "11/07/2026" }, FIRST_DAY],
    [
      "a last day before the first",
      { endsOn: "2026-11-06" },
      "The last day cannot come before the first.",
    ],
    ["an opening before the run", { opening: { on: "2026-11-06", from: "18:00" } }, OPENING_IN_RUN],
    ["an opening after the run", { opening: { on: "2026-12-06", from: "18:00" } }, OPENING_IN_RUN],
    ["an opening with no start time", { opening: { on: "2026-11-07" } }, OPENING_FROM],
    ["an opening time in words", { opening: { on: "2026-11-07", from: "6pm" } }, OPENING_FROM],
    ["an hour past 23", { opening: { on: "2026-11-07", from: "24:00" } }, OPENING_FROM],
    [
      "a minute past 59",
      { opening: { on: "2026-11-07", from: "18:00", to: "21:60" } },
      "The opening reception's end time must be written 21:00.",
    ],
    [
      "an opening time with no date",
      { opening: { from: "18:00" } },
      "The opening reception needs a real date, written 2026-11-07.",
    ],
    [
      "a work not in the catalog",
      { workSlugs: ["waterscape-01", "not-a-work"] },
      '"not-a-work" is not a work on this site.',
    ],
    ["a work that is not a slug", { workSlugs: [7] }, "One of the works could not be read."],
    [
      "works that are not a list",
      { workSlugs: "waterscape-01" },
      "Could not read the list of works.",
    ],
    ["a kind outside the four", { kind: "retrospective" }, KIND],
    ["a publish state outside the two", { publish: "live" }, "Choose published or held back."],
    ["a slug with spaces", { slug: "Test Show" }, NAME],
    ["a slug with a double hyphen", { slug: "test--show" }, NAME],
    ["a slug over 120 characters", { slug: "a".repeat(121) }, NAME],
    ["a gallery page that is not a web address", { href: "gallery.example.test" }, HREF],
    ["a gallery page that runs script", { href: "javascript:alert(1)" }, HREF],
    [
      "an opening that is not an object",
      { opening: "the first night" },
      "Could not read the opening reception.",
    ],
  ];

  it.each(refusals)("refuses %s", (_label, change, problem) => {
    const result = cleanShow({ ...valid, ...change }, catalog);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems).toContain(problem);
  });

  // Dates are compared as text, so only exact zero-padded YYYY-MM-DD may pass.
  const looseDates = [
    "2026-11-7",
    "2026-1-07",
    "26-11-07",
    "2026-11-07T00:00",
    "2026-11-07T00:00:00Z",
    "2026-11-07 ",
    " 2026-11-07",
    "2026-11-07\n",
    "2026-02-29",
    "2026-04-31",
    "2026-00-10",
    "2026-11-00",
    "２026-11-07",
    "2026/11/07",
    "20261107",
  ];

  it.each(looseDates)("refuses the first day written %j", (date) => {
    const result = cleanShow({ ...valid, startsOn: date, opening: undefined }, catalog);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems).toContain(FIRST_DAY);
  });

  it.each(looseDates)("refuses the last day written %j", (date) => {
    const result = cleanShow({ ...valid, endsOn: date, opening: undefined }, catalog);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems).toContain(LAST_DAY);
  });

  it.each(looseDates)("refuses an opening date written %j", (date) => {
    const result = cleanShow({ ...valid, opening: { on: date, from: "18:00" } }, catalog);
    expect(result.ok).toBe(false);
  });

  it("accepts a real leap day", () => {
    const result = cleanShow(
      { ...valid, startsOn: "2028-02-29", endsOn: "2028-03-05", opening: undefined },
      catalog,
    );
    expect(result.ok).toBe(true);
  });
});

describe("sanitizeStoredShows: what is read back from the store", () => {
  const stored: ShowRecord = {
    slug: "test-show",
    title: "Test Show",
    kind: "solo",
    venue: "Test Gallery",
    address: "1 Test Street",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    opening: { on: "2026-11-07", from: "18:00", to: "21:00" },
    workSlugs: ["waterscape-01"],
    href: "https://gallery.example.test/test-show",
    note: "A line.",
    publish: "published",
    updatedAt: "2026-10-13T00:00:00.000Z",
    updatedBy: "artist",
  };

  it("reads a valid show back unchanged, nested key order included", () => {
    const reordered = {
      publish: "published",
      opening: { to: "21:00", from: "18:00", on: "2026-11-07" },
      endsOn: "2026-12-05",
      startsOn: "2026-11-07",
      updatedBy: "artist",
      city: "Test City",
      venue: "Test Gallery",
      kind: "solo",
      title: "Test Show",
      slug: "test-show",
      workSlugs: ["waterscape-01"],
    };
    const raw = { "test-show": reordered, "other-show": { ...stored, slug: "other-show" } };
    expect(JSON.stringify(sanitizeStoredShows(raw))).toBe(JSON.stringify(raw));
  });

  it("keeps the shows in stored order", () => {
    const raw = { b: { ...stored, slug: "b" }, a: { ...stored, slug: "a" } };
    expect(Object.keys(sanitizeStoredShows(raw))).toEqual(["b", "a"]);
  });

  const broken: [string, unknown][] = [
    ["a slug that does not match its key", { ...stored, slug: "another-show" }],
    ["no title", { ...stored, title: undefined }],
    ["a blank venue", { ...stored, venue: "  " }],
    ["an unknown kind", { ...stored, kind: "retrospective" }],
    ["a day that does not exist", { ...stored, startsOn: "2026-02-30" }],
    ["a first day without zero padding", { ...stored, startsOn: "2026-11-7" }],
    ["a last day without zero padding", { ...stored, endsOn: "2026-12-5" }],
    ["a first day with a time on it", { ...stored, startsOn: "2026-11-07T00:00" }],
    ["a last day with a time on it", { ...stored, endsOn: "2026-12-05T00:00" }],
    ["a last day before the first", { ...stored, endsOn: "2026-11-01" }],
    ["works that are not a list", { ...stored, workSlugs: "waterscape-01" }],
    ["works that are not slugs", { ...stored, workSlugs: [1] }],
    ["an unknown publish state", { ...stored, publish: "live" }],
    ["a string", "junk"],
    ["null", null],
  ];

  it.each(broken)("drops a whole show with %s", (_label, entry) => {
    expect(sanitizeStoredShows({ "test-show": entry })).toEqual({});
  });

  it.each(["2026-11-7", "2026-11-07T00:00", "2026-02-30", "2026-11-07 "])(
    "drops only an opening dated %j, and keeps the show",
    (on) => {
      const { opening: _opening, ...expected } = stored;
      const raw = { "test-show": { ...stored, opening: { on, from: "18:00" } } };
      expect(sanitizeStoredShows(raw)).toEqual({ "test-show": expected });
    },
  );

  it("drops only the wrongly shaped optional fields, and keeps the show", () => {
    const raw = {
      "test-show": {
        ...stored,
        href: "javascript:alert(1)",
        note: 7,
        address: ["1 Test Street"],
        opening: { on: "2026-12-06", from: "18:00" },
        extra: "not a show field",
      },
    };
    const { href: _href, note: _note, address: _address, opening: _opening, ...expected } = stored;
    expect(sanitizeStoredShows(raw)).toEqual({ "test-show": expected });
  });

  it.each([[null], ["junk"], [[1, 2]], [42]])("treats stored %j as no shows", (raw) => {
    expect(sanitizeStoredShows(raw)).toEqual({});
  });
});
