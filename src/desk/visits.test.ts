import { describe, expect, it } from "vitest";
import {
  cleanPath,
  createVisits,
  emptyDay,
  nameCampaigns,
  nyDay,
  parseBody,
  shiftDay,
  summarize,
  type VercelEvent,
} from "./visits";

const { skipReason, sourceOf, foldDay, sortBatch } = createVisits({
  hosts: ["www.example-house.org", "example-house.org"],
  project: "prj_test",
  team: "team_test",
  listingHosts: /(^|\.)artsy\.net$/,
  utmSources: [[/^house-letter$/, "Newsletter"]],
});
/* A stand-in: the real hash lives in each site, and needs `node:crypto`. */
const visitorHasher = (salt: string) => (id: unknown, day: string) =>
  `${salt}:${day}:${Number(id) * 7 + 3}`;

const T = Date.parse("2026-11-03T15:00:00Z"); // 10 AM in New York
const view = (over: Partial<VercelEvent> = {}): VercelEvent => ({
  eventType: "pageview",
  projectId: "prj_test",
  vercelEnvironment: "production",
  origin: "https://www.example-house.org",
  timestamp: T,
  path: "/spaces",
  referrer: "https://www.google.com/",
  deviceId: 1,
  deviceType: "mobile",
  country: "US",
  region: "ny",
  city: "Springfield",
  ...over,
});

describe("the New York day", () => {
  it("puts 11 PM on the 2nd in New York on the 2nd, though it is the 3rd in UTC", () => {
    expect(nyDay(Date.parse("2026-11-03T04:30:00Z"))).toBe("2026-11-02");
  });
  it("moves a day by calendar across the November clock change", () => {
    expect(shiftDay("2026-11-01", 1)).toBe("2026-11-02");
    expect(shiftDay("2026-03-08", -1)).toBe("2026-03-07");
  });
});

describe("which page views are kept", () => {
  it("keeps a production page view on the site's own address", () => {
    expect(skipReason(view())).toBe("");
  });
  it.each([
    [{ eventType: "event" }, "custom-event"],
    [{ projectId: "prj_other", ownerId: "team_other" }, "other-project"],
    [{ vercelEnvironment: "preview" }, "not-production"],
    [{ origin: "https://example.com" }, "other-site"],
    [{ timestamp: "soon" }, "no-time"],
    [{ path: "/desk/someone" }, "desk"],
    [{ path: "/spaces", queryParams: "edit=1" }, "desk"],
  ])("sets aside %j as %s", (over, why) => {
    expect(skipReason(view(over as Partial<VercelEvent>))).toBe(why);
  });
});

describe("how a visit found the site", () => {
  it("reads a tagged newsletter link as the newsletter even from a webmail referrer", () => {
    expect(sourceOf("https://mail.google.com/", "utm_source=newsletter&utm_medium=email")).toEqual({
      source: "Newsletter",
      site: "",
    });
  });
  it("is not an arrival when the referrer is the site itself", () => {
    expect(sourceOf("https://www.example-house.org/spaces", "")).toBeNull();
  });
  it.each([
    ["https://www.google.com/", "Google search"],
    ["https://www.instagram.com/", "Instagram"],
    ["https://chatgpt.com/", "AI assistants"],
    ["https://example-blog.org/post", "Other websites"],
    ["", "Typed or bookmarked"],
  ])("%s is %s", (ref, want) => {
    expect(sourceOf(ref, "")?.source).toBe(want);
  });
  it("names the other website", () => {
    expect(sourceOf("https://www.example-blog.org/post", "")).toEqual({
      source: "Other websites",
      site: "example-blog.org",
    });
  });
});

describe("folding a day", () => {
  const hasher = visitorHasher("secret");
  it("counts one person who reads two pages as one visitor and one arrival", () => {
    const first = view();
    const second = view({ path: "/history", referrer: "https://www.example-house.org/spaces" });
    const { record } = foldDay(emptyDay("2026-11-03"), [first, second], { batch: "b1", hasher });
    expect(record.pageviews).toBe(2);
    expect(record.visitors).toBe(1);
    expect(record.arrivals).toBe(1);
    expect(record.sources).toEqual({ "Google search": 1 });
    expect(record.cities).toEqual({ "Springfield, NY": 1 });
    expect(record.hours).toEqual({ "10": 1 });
  });
  it("counts a delivery Vercel sends twice only once", () => {
    const once = foldDay(emptyDay("2026-11-03"), [view()], { batch: "b1", hasher });
    const twice = foldDay(once.record, [view()], { batch: "b1", hasher });
    expect(twice.repeat).toBe(true);
    expect(twice.record.pageviews).toBe(1);
  });
  it("keeps no person: ids are one-way hashes, and the record has no address or name", () => {
    const { record } = foldDay(emptyDay("2026-11-03"), [view({ deviceId: 123456 })], { hasher });
    expect(JSON.stringify(record)).not.toContain("123456");
  });
});

describe("the Desk's summary", () => {
  const hasher = visitorHasher("s");
  const day = (d: string, n: number) => {
    const events = Array.from({ length: n }, (_, i) =>
      view({ timestamp: Date.parse(`${d}T15:00:00Z`), deviceId: i }),
    );
    return foldDay(emptyDay(d), events, { hasher }).record;
  };
  it("matches a fixed fixture", () => {
    const s = summarize([day("2026-11-01", 3), day("2026-11-02", 5)], {
      today: "2026-11-03",
      days: 7,
    });
    expect(s.visitors).toBe(8);
    expect(s.pageviews).toBe(8);
    expect(s.busiest).toEqual({ day: "2026-11-02", visitors: 5 });
    expect(s.average).toBe(4); // finished days only: (3 + 5) / 2; today is still filling
    expect(s.sources[0]).toMatchObject({ name: "Google search", n: 8, share: 100 });
  });
  it("does not draw days before the first counted day as zeros", () => {
    const s = summarize([day("2026-11-02", 2)], { today: "2026-11-03", days: 30 });
    expect(s.byDay.map((d) => d.day)).toEqual(["2026-11-02", "2026-11-03"]);
  });
  it("says not connected when no day exists", () => {
    expect(summarize([], { today: "2026-11-03" }).connected).toBe(false);
  });
});

describe("reading a delivery", () => {
  it("reads an array, lines, and counts junk lines", () => {
    expect(parseBody('[{"a":1},{"b":2}]').events).toHaveLength(2);
    const lines = parseBody('{"a":1}\nnot json\n{"b":2}');
    expect(lines.events).toHaveLength(2);
    expect(lines.unreadable).toBe(1);
  });
  it("sorts a batch by New York day and counts reasons", () => {
    const out = sortBatch([
      view(),
      view({ eventType: "event" }),
      view({ timestamp: T + 86400000 }),
    ]);
    expect(Object.keys(out.byDay)).toEqual(["2026-11-03", "2026-11-04"]);
    expect(out.skipped).toEqual({ "custom-event": 1 });
  });
  it("cleans a path to one line", () => {
    expect(cleanPath("/spaces/?x=1#y")).toBe("/spaces");
    expect(cleanPath("")).toBe("/");
  });
});

describe("naming a newsletter", () => {
  it("shows the letter's subject for a known id and keeps an unknown id as it came", () => {
    const named = nameCampaigns(
      {
        rows: [
          { name: "d-1", n: 5, share: 50 },
          { name: "d-9", n: 3, share: 30 },
        ],
        rest: 0,
      },
      new Map([["d-1", "November at the house"]]),
    );
    expect(named.rows.map((r) => r.name)).toEqual(["November at the house", "d-9"]);
  });
});
