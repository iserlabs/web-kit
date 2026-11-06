import { describe, expect, it } from "vitest";
import {
  AI_ENGINES,
  closeDay,
  createVisits,
  emptyDay,
  summarize,
  type VercelEvent,
} from "./visits";

const { skipReason, sourceOf, foldDay, sortBatch } = createVisits({
  hosts: ["www.example-house.org", "example-house.org"],
  project: "prj_test",
  team: "team_test",
});
/* A stand-in: the real hash lives in each site, and needs `node:crypto`. */
const hasher = (id: unknown, day: string) => `s:${day}:${Number(id) * 7 + 3}`;

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
const fresh = () => emptyDay("2026-11-03");

describe("which AI assistant sent the visit", () => {
  const engine = (ref: string, qs = "") => sourceOf(ref, qs) as { source: string; engine?: string };
  it.each([
    ["https://chatgpt.com/", "ChatGPT"],
    ["https://chat.openai.com/", "ChatGPT"],
    ["android-app://com.openai.chatgpt/", "ChatGPT"],
    ["https://www.perplexity.ai/search/abc", "Perplexity"],
    ["android-app://ai.perplexity.app.android/", "Perplexity"],
    ["https://claude.ai/chat/1", "Claude"],
    ["android-app://com.anthropic.claude/", "Claude"],
    ["https://gemini.google.com/app", "Gemini"],
    ["https://bard.google.com/", "Gemini"],
    ["android-app://com.google.android.apps.bard/", "Gemini"],
    ["https://copilot.microsoft.com/", "Copilot"],
    ["https://copilot.cloud.microsoft/", "Copilot"],
    ["https://chat.deepseek.com/", "DeepSeek"],
    ["android-app://com.deepseek.chat/", "DeepSeek"],
    ["https://grok.com/chat", "Grok"],
    ["android-app://ai.x.grok/", "Grok"],
    ["https://www.meta.ai/", "Meta AI"],
    ["https://poe.com/", "Poe"],
    ["https://chat.mistral.ai/chat", "Mistral"],
    ["https://you.com/search", "You.com"],
    ["https://www.phind.com/", "Phind"],
    ["https://duck.ai/", "Duck.ai"],
  ])("%s is %s", (ref, name) => {
    const s = engine(ref);
    expect(s.source).toBe("AI assistants");
    expect(s.engine).toBe(name);
  });
  it.each([
    ["chatgpt.com", "ChatGPT"],
    ["chatgpt", "ChatGPT"],
    ["openai", "ChatGPT"],
    ["perplexity", "Perplexity"],
    ["perplexity.ai", "Perplexity"],
    ["claude", "Claude"],
    ["claude.ai", "Claude"],
    ["gemini", "Gemini"],
    ["copilot", "Copilot"],
  ])("a link tagged utm_source=%s is %s", (tag, name) => {
    const s = engine("https://www.google.com/", `utm_source=${tag}`);
    expect(s.source).toBe("AI assistants");
    expect(s.engine).toBe(name);
  });
  it("keeps plain Google search as Google search, since AI Overviews cannot be told apart", () => {
    expect(sourceOf("https://www.google.com/", "")?.source).toBe("Google search");
  });
  it("keeps the group's detail empty so old screens read the same", () => {
    expect(sourceOf("https://chatgpt.com/", "")?.site).toBe("");
  });
  it("lists every engine once in the name list", () => {
    expect(new Set(AI_ENGINES).size).toBe(AI_ENGINES.length);
    expect(AI_ENGINES).toContain("Duck.ai");
  });
  it("counts each engine in the day record beside the AI assistants group", () => {
    const { record } = foldDay(
      fresh(),
      [
        view({ referrer: "https://chatgpt.com/", deviceId: 1 }),
        view({ referrer: "https://chatgpt.com/", deviceId: 2 }),
        view({ referrer: "https://www.perplexity.ai/", deviceId: 3 }),
        view({ referrer: "https://www.google.com/", deviceId: 4 }),
      ],
      { hasher },
    );
    expect(record.sources["AI assistants"]).toBe(3);
    expect(record.engines).toEqual({ ChatGPT: 2, Perplexity: 1 });
  });
  it("does not count an engine for a click inside the site", () => {
    const { record } = foldDay(
      fresh(),
      [view({ referrer: "https://www.example-house.org/spaces", path: "/history" })],
      {},
    );
    expect(record.engines ?? {}).toEqual({});
  });
  it("summarizes engines ranked, with a share of the AI arrivals", () => {
    const { record } = foldDay(
      fresh(),
      [
        view({ referrer: "https://chatgpt.com/", deviceId: 1 }),
        view({ referrer: "https://chatgpt.com/", deviceId: 2 }),
        view({ referrer: "https://claude.ai/", deviceId: 3 }),
        view({ referrer: "https://poe.com/", deviceId: 4 }),
      ],
      { hasher },
    );
    const s = summarize([record], { today: "2026-11-04", days: 7 });
    expect(s.aiEngines.rows[0]).toEqual({ name: "ChatGPT", n: 2, share: 50 });
    expect(s.aiEngines.rows.map((r) => r.name)).toEqual(["ChatGPT", "Claude", "Poe"]);
    expect(s.aiArrivals).toBe(4);
  });
  it("summarizes an old record with none of the new fields without failing", () => {
    const old: Partial<ReturnType<typeof emptyDay>> = { ...fresh() };
    for (const k of [
      "engines",
      "pageSeconds",
      "pageTimed",
      "visitorSeconds",
      "siteSeconds",
      "timedVisitors",
    ] as const)
      delete old[k];
    const s = summarize([old as ReturnType<typeof emptyDay>], { today: "2026-11-04", days: 7 });
    expect(s.aiEngines.rows).toEqual([]);
    expect(s.aiArrivals).toBe(0);
    expect(s.regions.rows).toEqual([]);
    expect(s.timeOnSite).toEqual({ average: null, visitors: 0 });
    expect(s.pageTimes).toEqual({});
  });
});

describe("countries and US regions from the summary", () => {
  it("returns both lists, ranked by arrivals", () => {
    const { record } = foldDay(
      fresh(),
      [
        view({ deviceId: 1, country: "US", region: "ny" }),
        view({ deviceId: 2, country: "US", region: "ny" }),
        view({ deviceId: 3, country: "US", region: "ca" }),
        view({ deviceId: 4, country: "DE", region: "by" }),
      ],
      { hasher },
    );
    const s = summarize([record], { today: "2026-11-04", days: 7 });
    expect(s.countries.rows.map((r) => [r.name, r.n])).toEqual([
      ["US", 3],
      ["DE", 1],
    ]);
    expect(s.regions.rows.map((r) => [r.name, r.n])).toEqual([
      ["NY", 2],
      ["CA", 1],
    ]);
  });
});

describe("time on page and time on site", () => {
  const timed = (seconds: unknown, over: Partial<VercelEvent> = {}): VercelEvent => ({
    eventType: "event",
    eventName: "page_time",
    eventData: JSON.stringify({ seconds }),
    projectId: "prj_test",
    vercelEnvironment: "production",
    origin: "https://www.example-house.org",
    timestamp: T + 60_000,
    path: "/spaces",
    deviceId: 1,
    ...over,
  });

  it("keeps the page_time event and still sets aside every other custom event", () => {
    expect(skipReason(timed(30))).toBe("");
    expect(skipReason(timed(30, { eventName: "button_click" }))).toBe("custom-event");
    expect(skipReason(timed(30, { eventName: undefined }))).toBe("custom-event");
  });
  it("sets aside a page_time with no usable seconds", () => {
    expect(skipReason(timed("soon"))).toBe("bad-page-time");
    expect(skipReason(timed(0))).toBe("bad-page-time");
    expect(skipReason(timed(-4))).toBe("bad-page-time");
    expect(skipReason(timed(30, { eventData: "not json" }))).toBe("bad-page-time");
    expect(skipReason(timed(30, { eventData: undefined }))).toBe("bad-page-time");
  });
  it("applies the same site, project and staff-page checks to a timing", () => {
    expect(skipReason(timed(30, { origin: "https://example.com" }))).toBe("other-site");
    expect(skipReason(timed(30, { vercelEnvironment: "preview" }))).toBe("not-production");
    expect(skipReason(timed(30, { path: "/desk/x" }))).toBe("desk");
  });
  it("reads eventData sent as an object as well as a JSON string", () => {
    expect(skipReason(timed(30, { eventData: { seconds: 30 } as unknown as string }))).toBe("");
  });
  it("does not count a timing as a page view, an arrival or a visitor", () => {
    const { record } = foldDay(fresh(), [timed(30)], { hasher });
    expect(record.pageviews).toBe(0);
    expect(record.visitors).toBe(0);
    expect(record.arrivals).toBe(0);
    expect(record.pages).toEqual({});
  });
  it("sums seconds and counts timings per page", () => {
    const { record } = foldDay(
      fresh(),
      [timed(30), timed(50, { deviceId: 2 }), timed(10, { path: "/history" })],
      { hasher },
    );
    expect(record.pageSeconds).toEqual({ "/spaces": 80, "/history": 10 });
    expect(record.pageTimed).toEqual({ "/spaces": 2, "/history": 1 });
  });
  it("clamps seconds to 1..1800", () => {
    const { record } = foldDay(fresh(), [timed(99999), timed(0.6, { deviceId: 2 })], { hasher });
    expect(record.pageSeconds?.["/spaces"]).toBe(1800 + 1);
  });
  it("uses the page named in the data when the browser sends one", () => {
    const { record } = foldDay(
      fresh(),
      [
        timed(30, {
          path: "/history",
          eventData: JSON.stringify({ seconds: 30, path: "/spaces/" }),
        }),
      ],
      { hasher },
    );
    expect(record.pageSeconds).toEqual({ "/spaces": 30 });
  });
  it("sets aside a named page that is a staff page", () => {
    expect(
      skipReason(timed(30, { eventData: JSON.stringify({ seconds: 30, path: "/desk/x" }) })),
    ).toBe("desk");
  });
  it("keeps time per visitor under the same hash as the visit, never a raw id", () => {
    const { record } = foldDay(
      fresh(),
      [view({ deviceId: 123456 }), timed(40, { deviceId: 123456 })],
      {
        hasher,
      },
    );
    expect(JSON.stringify(record)).not.toContain("123456");
    expect(record.siteSeconds).toBe(40);
    expect(record.timedVisitors).toBe(1);
    expect(Object.keys(record.visitorSeconds ?? {})).toEqual([`s:2026-11-03:${123456 * 7 + 3}`]);
  });
  it("adds a continuation's seconds without counting the page view a second time", () => {
    const more = JSON.stringify({ seconds: 20, path: "/spaces", more: true });
    const { record } = foldDay(fresh(), [timed(30), timed(20, { eventData: more })], { hasher });
    expect(record.pageSeconds).toEqual({ "/spaces": 50 });
    expect(record.pageTimed).toEqual({ "/spaces": 1 });
    expect(record.siteSeconds).toBe(50);
    expect(record.timedVisitors).toBe(1);
  });
  it("reads a continuation sent under its own event name, with only two properties", () => {
    const more = timed(20, {
      eventName: "page_time_more",
      eventData: JSON.stringify({ seconds: 20, path: "/spaces" }),
    });
    const { record } = foldDay(fresh(), [timed(30), more], { hasher });
    expect(record.pageSeconds).toEqual({ "/spaces": 50 });
    expect(record.pageTimed).toEqual({ "/spaces": 1 });
    expect(record.siteSeconds).toBe(50);
  });
  it("keeps a continuation's seconds when its first timing never arrived and the list is full", () => {
    const events = [
      ...Array.from({ length: 70 }, (_, i) => timed(10, { path: `/p${i}`, deviceId: i })),
      timed(40, {
        deviceId: 99,
        eventData: JSON.stringify({ seconds: 40, path: "/lost", more: true }),
      }),
    ];
    const { record } = foldDay(fresh(), events, { hasher });
    const secs = Object.values(record.pageSeconds ?? {}).reduce((a, b) => a + b, 0);
    expect(secs).toBe(740);
  });
  it("adds one person's pages together into one time on site", () => {
    const { record } = foldDay(
      fresh(),
      [timed(30), timed(45, { path: "/history" }), timed(20, { deviceId: 2 })],
      { hasher },
    );
    expect(record.siteSeconds).toBe(95);
    expect(record.timedVisitors).toBe(2);
  });
  it("caps one visitor's day at four hours so a script cannot inflate the average", () => {
    const events = Array.from({ length: 20 }, () => timed(1800));
    const { record } = foldDay(fresh(), events, { hasher });
    expect(record.siteSeconds).toBe(4 * 3600);
    expect(record.timedVisitors).toBe(1);
  });
  it("counts a delivery Vercel sends twice only once", () => {
    const once = foldDay(fresh(), [timed(30)], { batch: "b9", hasher });
    const twice = foldDay(once.record, [timed(30)], { batch: "b9", hasher });
    expect(twice.repeat).toBe(true);
    expect(twice.record.siteSeconds).toBe(30);
    expect(twice.record.pageSeconds).toEqual({ "/spaces": 30 });
  });
  it("bounds the per-page lists like the page list, folding the rest into one line", () => {
    const events = Array.from({ length: 80 }, (_, i) => timed(10, { path: `/p${i}`, deviceId: i }));
    const { record } = foldDay(fresh(), events, { hasher });
    expect(Object.keys(record.pageSeconds ?? {}).length).toBeLessThanOrEqual(60);
    expect(Object.keys(record.pageTimed ?? {}).length).toBeLessThanOrEqual(60);
    const secs = Object.values(record.pageSeconds ?? {}).reduce((a, b) => a + b, 0);
    const n = Object.values(record.pageTimed ?? {}).reduce((a, b) => a + b, 0);
    expect(secs).toBe(800);
    expect(n).toBe(80);
  });
  it("closing the day drops the per-visitor hashes but keeps the totals", () => {
    const { record } = foldDay(fresh(), [timed(30)], { hasher });
    const closed = closeDay(record);
    expect(closed.visitorSeconds).toEqual({});
    expect(closed.siteSeconds).toBe(30);
    expect(closed.timedVisitors).toBe(1);
  });
  it("folds into a stored record from before timing existed", () => {
    const old: Partial<ReturnType<typeof emptyDay>> = { ...fresh() };
    for (const k of [
      "engines",
      "pageSeconds",
      "pageTimed",
      "visitorSeconds",
      "siteSeconds",
      "timedVisitors",
    ] as const)
      delete old[k];
    const { record } = foldDay(old as ReturnType<typeof emptyDay>, [timed(30)], { hasher });
    expect(record.siteSeconds).toBe(30);
  });
  it("accepts a timing and a view in the same delivery, and counts the other event by reason", () => {
    const out = sortBatch([view(), timed(30), timed(30, { eventName: "x" })]);
    expect(out.accepted).toBe(2);
    expect(out.skipped).toEqual({ "custom-event": 1 });
  });
  it("shows average time per page and per visitor in the summary", () => {
    const { record } = foldDay(
      fresh(),
      [
        view({ deviceId: 1 }),
        view({ deviceId: 2 }),
        timed(30, { deviceId: 1 }),
        timed(90, { deviceId: 2 }),
        timed(60, { deviceId: 2, path: "/history" }),
      ],
      { hasher },
    );
    const s = summarize([record], { today: "2026-11-04", days: 7 });
    expect(s.pageTimes["/spaces"]).toEqual({ average: 60, n: 2 });
    expect(s.pageTimes["/history"]).toEqual({ average: 60, n: 1 });
    expect(s.timeOnSite).toEqual({ average: 90, visitors: 2 });
  });
});
