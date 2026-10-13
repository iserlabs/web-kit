import { describe, expect, it } from "vitest";
import { type Cv, cvFromShows, cvGaps, cvSections, hasCvContent, mergeCv, newestFirst } from "./cv";
import type { Show } from "./shows";

const empty: Cv = {
  education: [],
  soloExhibitions: [],
  groupExhibitions: [],
  press: [],
  awards: [],
};

const withSolo: Cv = {
  ...empty,
  soloExhibitions: [
    { year: "2025", title: "Light Codes", venue: "Metro Craft", location: "Brooklyn" },
  ],
};

describe("Carole 13: no empty headings", () => {
  it("renders no section at all when there is nothing to put in it", () => {
    expect(cvSections(empty)).toEqual([]);
    expect(hasCvContent(empty)).toBe(false);
  });

  it("renders only the sections that have entries, in Carole's order", () => {
    const source: Cv = { ...withSolo, awards: [{ year: "2024", title: "A prize" }] };
    expect(cvSections(source).map((s) => s.id)).toEqual(["solo", "awards"]);
  });

  it("counts education alone as content", () => {
    expect(hasCvContent({ ...empty, education: [{ what: "Studied under a mentor" }] })).toBe(true);
  });
});

describe("Carole 10: order", () => {
  it("orders entries newest first", () => {
    const sorted = newestFirst([
      { year: "2024", title: "Alcyone" },
      { year: "2025", title: "Light Codes" },
    ]);
    expect(sorted.map((e) => e.year)).toEqual(["2025", "2024"]);
  });

  it("does not throw on a non-numeric year", () => {
    expect(() => newestFirst([{ year: "n.d.", title: "Untitled show" }])).not.toThrow();
  });
});

describe("what is still missing", () => {
  it("names education and exhibitions when both are missing", () => {
    expect(cvGaps(empty)).toEqual(["education, mentors or meaningful study", "exhibitions"]);
  });

  it("stops reporting a gap once it is filled", () => {
    const filled: Cv = { ...withSolo, education: [{ what: "Studied under a mentor" }] };
    expect(cvGaps(filled)).toEqual([]);
  });
});

/** Obviously fake facts: nothing here describes a real show. */
const testShow = (over: Partial<Show> = {}): Show => ({
  slug: "test-show",
  title: "Test Show",
  kind: "solo",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: [],
  publish: "published",
  ...over,
});

const later = new Date("2027-06-15T16:00:00Z");

describe("cvFromShows: a show typed once becomes its CV line", () => {
  it("turns a published show that has opened into a line", () => {
    const s = testShow({ href: "https://gallery.example.test/test-show", note: "A line." });
    expect(cvFromShows([s], later)).toEqual({
      soloExhibitions: [
        {
          year: "2026",
          title: "Test Show",
          venue: "Test Gallery",
          location: "Test City",
          href: "https://gallery.example.test/test-show",
          note: "A line.",
        },
      ],
      groupExhibitions: [],
    });
  });

  it("files solo shows and evenings under solo, two-person and group shows under group", () => {
    const lines = cvFromShows(
      [
        testShow({
          slug: "a",
          title: "Solo",
          kind: "solo",
          startsOn: "2026-01-01",
          endsOn: "2026-01-31",
        }),
        testShow({
          slug: "b",
          title: "Evening",
          kind: "event",
          startsOn: "2026-02-01",
          endsOn: "2026-02-01",
        }),
        testShow({
          slug: "c",
          title: "Pair",
          kind: "two-person",
          startsOn: "2026-03-01",
          endsOn: "2026-03-31",
        }),
        testShow({
          slug: "d",
          title: "Group",
          kind: "group",
          startsOn: "2026-04-01",
          endsOn: "2026-04-30",
        }),
      ],
      later,
    );
    expect(lines.soloExhibitions.map((e) => e.title)).toEqual(["Evening", "Solo"]);
    expect(lines.groupExhibitions.map((e) => e.title)).toEqual(["Group", "Pair"]);
  });

  it("lists newest first by the day each show opened", () => {
    const lines = cvFromShows(
      [
        testShow({ slug: "old", title: "Old", startsOn: "2025-03-01", endsOn: "2025-03-30" }),
        testShow({ slug: "new", title: "New", startsOn: "2026-05-01", endsOn: "2026-05-30" }),
        testShow({ slug: "mid", title: "Mid", startsOn: "2025-09-01", endsOn: "2025-09-30" }),
      ],
      later,
    );
    expect(lines.soloExhibitions.map((e) => e.title)).toEqual(["New", "Mid", "Old"]);
  });

  it("leaves off a show that has not opened, and a held-back show", () => {
    const lines = cvFromShows(
      [
        testShow({ slug: "soon", startsOn: "2027-09-01", endsOn: "2027-09-30" }),
        testShow({ slug: "held", publish: "draft" }),
      ],
      later,
    );
    expect(lines).toEqual({ soloExhibitions: [], groupExhibitions: [] });
  });

  it("puts a show on the CV from its first day in New York, not in UTC", () => {
    // 03:00Z on November 7 is still November 6 in New York.
    expect(cvFromShows([testShow()], new Date("2026-11-07T03:00:00Z")).soloExhibitions).toEqual([]);
    expect(
      cvFromShows([testShow()], new Date("2026-11-07T05:00:00Z")).soloExhibitions,
    ).toHaveLength(1);
  });

  it("reads the first day where the site is, east of UTC too", () => {
    // 15:00Z on November 6 is midnight on November 7 in Tokyo.
    const tokyo = cvFromShows([testShow()], new Date("2026-11-06T15:00:00Z"), "Asia/Tokyo");
    expect(tokyo.soloExhibitions).toHaveLength(1);
  });
});

describe("mergeCv: lines typed by hand and lines from shows, in one CV", () => {
  const hand: Cv = {
    education: [{ what: "Studied under a mentor" }],
    soloExhibitions: [
      {
        year: "2025",
        title: "Hand Show",
        venue: "Hand Venue",
        location: "Hand City",
        note: "Typed by hand",
      },
      { year: "2024", title: "Older Show" },
    ],
    groupExhibitions: [],
    press: [{ year: "2024", title: "A review" }],
    awards: [],
  };
  const none = { soloExhibitions: [], groupExhibitions: [] };

  it("leaves a CV with no shows exactly as typed", () => {
    expect(mergeCv(hand, none)).toEqual(hand);
  });

  it("adds show lines, newest first, among the lines typed by hand", () => {
    const merged = mergeCv(hand, {
      soloExhibitions: [
        { year: "2026", title: "Test Show", venue: "Test Gallery", location: "Test City" },
      ],
      groupExhibitions: [
        { year: "2025", title: "Test Group", venue: "Test Gallery", location: "Test City" },
      ],
    });
    expect(merged.soloExhibitions.map((e) => e.title)).toEqual([
      "Test Show",
      "Hand Show",
      "Older Show",
    ]);
    expect(merged.groupExhibitions.map((e) => e.title)).toEqual(["Test Group"]);
  });

  it("prints a show entered in both places once, as it was typed by hand", () => {
    const merged = mergeCv(hand, {
      soloExhibitions: [
        { year: "2025", title: "  hand show ", venue: "Test Gallery", location: "Test City" },
      ],
      groupExhibitions: [],
    });
    expect(merged.soloExhibitions).toEqual(hand.soloExhibitions);
  });

  it("leaves education, press and awards untouched", () => {
    const merged = mergeCv(hand, {
      soloExhibitions: [{ year: "2026", title: "Test Show" }],
      groupExhibitions: [],
    });
    expect(merged.education).toEqual(hand.education);
    expect(merged.press).toEqual(hand.press);
    expect(merged.awards).toEqual(hand.awards);
  });
});
