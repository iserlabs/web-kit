import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArtworkOverlay } from "./overlay";
import { generatePressToken, pressTokenMatches } from "./press-kit";
import type { Artwork } from "./record";
import { formatAvailability } from "./record";
import type { ShowRecord } from "./shows";
import { createStudioStore, merge, mergeAll } from "./studio-store";

const base = (over: Partial<Artwork> = {}): Artwork => ({
  slug: "waterscape-01",
  catalogId: "AA-0001",
  series: "waterscapes",
  lifecycle: "current",
  publish: "published",
  src: "/works/waterscape-01.png",
  alt: "A waterscape",
  aspect: "landscape",
  medium: ["Oil"],
  substrate: "linen",
  ...over,
});

describe("an overlay corrects what is known, never what a work is", () => {
  it("adds the fields the base record lacks", () => {
    const merged = merge(base(), {
      title: "Alcyone",
      year: 2025,
      dimensions: { height: 36, width: 24, unit: "in" },
    });
    expect(merged.title).toBe("Alcyone");
    expect(merged.year).toBe(2025);
    expect(merged.dimensions).toEqual({ height: 36, width: 24, unit: "in" });
  });

  it("leaves the base untouched where the overlay says nothing", () => {
    const merged = merge(base(), { title: "Alcyone" });
    expect(merged.src).toBe("/works/waterscape-01.png");
    expect(merged.alt).toBe("A waterscape");
    expect(merged.series).toBe("waterscapes");
    expect(merged.substrate).toBe("linen");
  });

  it("ignores empty strings rather than blanking a real value", () => {
    const merged = merge(base({ substrate: "linen" }), { substrate: "" } as ArtworkOverlay);
    expect(merged.substrate).toBe("linen");
  });

  it("ignores undefined and null rather than erasing", () => {
    const merged = merge(base(), {
      title: undefined,
      substrate: null as unknown as string,
    } as ArtworkOverlay);
    expect(merged.substrate).toBe("linen");
  });

  it("does not carry the audit fields onto the artwork", () => {
    const merged = merge(base(), {
      title: "Alcyone",
      updatedAt: "2026-08-09T00:00:00Z",
      updatedBy: "julian",
    });
    expect("updatedAt" in merged).toBe(false);
    expect("updatedBy" in merged).toBe(false);
  });

  it("returns the base unchanged when there is no overlay", () => {
    expect(merge(base(), undefined)).toEqual(base());
  });
});

describe("the overlay can change status, which is the whole point", () => {
  it("marks a work sold", () => {
    expect(merge(base(), { availability: "sold" }).availability).toBe("sold");
  });

  it("unpublishes a work without deleting it", () => {
    const merged = merge(base(), { publish: "draft" });
    expect(merged.publish).toBe("draft");
    expect(merged.slug).toBe("waterscape-01");
  });

  it("sets a price and its visibility independently", () => {
    const merged = merge(base(), {
      price: { amount: 4200, currency: "USD", visibility: "on-request" },
    });
    expect(merged.price?.amount).toBe(4200);
    expect(merged.price?.visibility).toBe("on-request");
  });
});

describe("merging the whole catalog", () => {
  it("applies each overlay to its own slug only", () => {
    const works = [base(), base({ slug: "waterscape-02", catalogId: "AA-0002" })];
    const merged = mergeAll(works, { "waterscape-02": { title: "Second" } });
    expect(merged[0]?.title).toBeUndefined();
    expect(merged[1]?.title).toBe("Second");
  });

  it("returns the base catalog untouched when there is no store", () => {
    const works = [base()];
    expect(mergeAll(works, null)).toEqual(works);
  });

  it("ignores an overlay for a slug that does not exist", () => {
    const works = [base()];
    expect(mergeAll(works, { "not-a-work": { title: "Ghost" } })).toHaveLength(1);
  });
});

const URL_ENV = "KIT_TEST_KV_URL";
const TOKEN_ENV = "KIT_TEST_KV_TOKEN";
const original = { ...process.env };

interface FakeCall {
  url: string;
  init: RequestInit & { next?: unknown };
}

/** Upstash's REST shape: GET answers { result: <stored string or null> }, SET stores the body. */
function fakeUpstash(stored: unknown = null, status = 200) {
  const calls: FakeCall[] = [];
  let value = stored;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    if (status !== 200) return new Response("unavailable", { status });
    if (url.includes("/set/")) {
      value = init?.body;
      return Response.json({ result: "OK" });
    }
    return Response.json({ result: value });
  }) as typeof fetch;
  return { fetchFn, calls, stored: () => value };
}

function storeWith(fake: ReturnType<typeof fakeUpstash>) {
  return createStudioStore({
    key: "studio:test:overlays",
    urlEnv: URL_ENV,
    tokenEnv: TOKEN_ENV,
    cachedRead: { next: { revalidate: 60 } },
    fetch: fake.fetchFn,
  });
}

describe("the store", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns null, never an empty object, when no store is connected", async () => {
    delete process.env[URL_ENV];
    const fake = fakeUpstash();
    const store = storeWith(fake);
    expect(store.configured()).toBe(false);
    expect(await store.readOverlays()).toBeNull();
    expect(await store.writeOverlay("a", { title: "A" }, "artist")).toBe(false);
    expect(await store.clearOverlay("a")).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("reads every overlay by slug", async () => {
    const fake = fakeUpstash(JSON.stringify({ a: { title: "A" } }));
    expect(await storeWith(fake).readOverlays()).toEqual({ a: { title: "A" } });
  });

  it("reports nothing saved as an empty object", async () => {
    expect(await storeWith(fakeUpstash(null)).readOverlays()).toEqual({});
  });

  it("survives a corrupted blob rather than taking the site down", async () => {
    expect(await storeWith(fakeUpstash("{not json")).readOverlays()).toEqual({});
  });

  it("keeps public reads cacheable and studio reads fresh", async () => {
    const fake = fakeUpstash(null);
    const store = storeWith(fake);
    await store.readOverlays();
    await store.readOverlays(true);
    const [publicRead, studioRead] = fake.calls;
    expect(publicRead?.url).toBe("https://kv.example.test/get/studio:test:overlays");
    expect(publicRead?.init.next).toEqual({ revalidate: 60 });
    expect(publicRead?.init.cache).toBeUndefined();
    expect(studioRead?.init.cache).toBe("no-store");
    expect(studioRead?.init.next).toBeUndefined();
    expect(new Headers(publicRead?.init.headers).get("authorization")).toBe("Bearer kv-token");
  });

  it("writes one slug and keeps the rest, stamping who and when", async () => {
    const fake = fakeUpstash(JSON.stringify({ a: { title: "A" }, b: { title: "B" } }));
    expect(await storeWith(fake).writeOverlay("a", { year: 2025 }, "artist")).toBe(true);
    const saved = JSON.parse(String(fake.stored())) as Record<string, ArtworkOverlay>;
    expect(saved.a?.title).toBe("A");
    expect(saved.a?.year).toBe(2025);
    expect(saved.a?.updatedBy).toBe("artist");
    expect(Number.isNaN(Date.parse(saved.a?.updatedAt ?? ""))).toBe(false);
    expect(saved.b).toEqual({ title: "B" });
    const [read, write] = fake.calls;
    expect(read?.init.cache).toBe("no-store");
    expect(write?.url).toBe("https://kv.example.test/set/studio:test:overlays");
    expect(write?.init.method).toBe("POST");
  });

  it("clears one slug and keeps the rest", async () => {
    const fake = fakeUpstash(JSON.stringify({ a: { title: "A" }, b: { title: "B" } }));
    expect(await storeWith(fake).clearOverlay("a")).toBe(true);
    expect(JSON.parse(String(fake.stored()))).toEqual({ b: { title: "B" } });
  });

  it("throws when the store answers with an error, so a save never looks done", async () => {
    await expect(storeWith(fakeUpstash(null, 500)).readOverlays()).rejects.toThrow("store 500");
  });
  it.each([["null"], ["[1,2]"], ['"str"'], ["42"]])(
    "treats stored %s as configured with nothing usable, never as no store",
    async (stored) => {
      expect(await storeWith(fakeUpstash(stored)).readOverlays()).toEqual({});
    },
  );

  it("drops entries that are not plain objects", async () => {
    expect(
      await storeWith(
        fakeUpstash(JSON.stringify({ a: "garbage", b: null, c: [1], d: { title: "D" } })),
      ).readOverlays(),
    ).toEqual({ d: { title: "D" } });
  });

  it("does not let a price without an amount reach the merged artwork", async () => {
    const overlays = await storeWith(
      fakeUpstash(JSON.stringify({ "waterscape-01": { price: { visibility: "public" } } })),
    ).readOverlays();
    const merged = mergeAll([base()], overlays)[0] as Artwork;
    expect(merged.price).toBeUndefined();
    expect(() => formatAvailability(merged)).not.toThrow();
  });

  it("never writes junk-shaped stored data back on the next save", async () => {
    const fake = fakeUpstash(
      JSON.stringify({ a: { title: 7, price: { visibility: "public" }, extra: "x" }, b: "junk" }),
    );
    await storeWith(fake).writeOverlay("c", { title: "C" }, "artist");
    const saved = JSON.parse(String(fake.stored())) as Record<string, ArtworkOverlay>;
    expect(saved.a).toEqual({});
    expect(saved.b).toBeUndefined();
    expect(saved.c?.title).toBe("C");
  });

  it("reads a valid realistic overlay back unchanged", async () => {
    const valid: ArtworkOverlay = {
      title: "Alcyone",
      year: 2025,
      medium: ["Oil", "graphite"],
      substrate: "linen",
      dimensions: { height: 36, width: 24, depth: 1.5, unit: "in" },
      edition: { number: 2, of: 10 },
      availability: "available",
      lifecycle: "current",
      publish: "published",
      price: { amount: 4200, currency: "USD", visibility: "public" },
      certificateRef: "CERT-1",
      blurb: "A quiet one.",
      updatedAt: "2026-08-09T00:00:00.000Z",
      updatedBy: "julian",
    };
    const back = await storeWith(fakeUpstash(JSON.stringify({ a: valid }))).readOverlays();
    expect(JSON.stringify(back)).toBe(JSON.stringify({ a: valid }));
  });

  it("does not let cachedRead override Authorization or the request", async () => {
    const fake = fakeUpstash(null);
    const store = createStudioStore({
      key: "k",
      urlEnv: URL_ENV,
      tokenEnv: TOKEN_ENV,
      cachedRead: { headers: { Authorization: "Bearer evil" }, method: "DELETE" },
      fetch: fake.fetchFn,
    });
    await store.readOverlays();
    const init = fake.calls[0]?.init;
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer kv-token");
    expect(init?.method).not.toBe("DELETE");
  });

  it("throws when the SET fails after a good GET, so a save never looks done", async () => {
    const calls: string[] = [];
    const fetchFn = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/set/")) return new Response("down", { status: 503 });
      return Response.json({ result: JSON.stringify({ a: { title: "A" } }) });
    }) as typeof fetch;
    const store = createStudioStore({
      key: "k",
      urlEnv: URL_ENV,
      tokenEnv: TOKEN_ENV,
      fetch: fetchFn,
    });
    await expect(store.writeOverlay("a", { year: 2025 }, "artist")).rejects.toThrow("store 503");
    expect(calls).toHaveLength(2);
  });

  it("throws when the SET fails inside clearOverlay", async () => {
    const fetchFn = (async (input: string | URL | Request) => {
      if (String(input).includes("/set/")) return new Response("down", { status: 503 });
      return Response.json({ result: JSON.stringify({ a: { title: "A" } }) });
    }) as typeof fetch;
    const store = createStudioStore({
      key: "k",
      urlEnv: URL_ENV,
      tokenEnv: TOKEN_ENV,
      fetch: fetchFn,
    });
    await expect(store.clearOverlay("a")).rejects.toThrow("store 503");
  });

  it("keeps nested stored key order, depth before or after unit, on a round trip", async () => {
    const stored = {
      a: { dimensions: { height: 36, depth: 1.5, width: 24, unit: "in" }, title: "A" },
      b: { title: "B", dimensions: { unit: "cm", height: 9, width: 5, depth: 2 } },
    };
    const back = await storeWith(fakeUpstash(JSON.stringify(stored))).readOverlays();
    expect(JSON.stringify(back)).toBe(JSON.stringify(stored));
  });
});

/** Upstash's REST shape over several keys: GET answers { result }, SET stores the body.
    `failSet` makes every SET answer 503. */
function fakeKv(initial: Record<string, string> = {}, failSet = false) {
  const values = new Map<string, string>(Object.entries(initial));
  const calls: FakeCall[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const match = /\/(get|set)\/(.+)$/.exec(url);
    const key = match?.[2] ?? "";
    if (match?.[1] === "set") {
      if (failSet) return new Response("down", { status: 503 });
      values.set(key, String(init?.body));
      return Response.json({ result: "OK" });
    }
    return Response.json({ result: values.get(key) ?? null });
  }) as typeof fetch;
  return { fetchFn, calls, values };
}

const OVERLAYS_KEY = "studio:test:overlays";
const SHOWS_KEY = "studio:test:shows";
const PRESS_KEY = "studio:test:press";

function storesWith(
  kv: ReturnType<typeof fakeKv>,
  keys: { showsKey?: string; pressKey?: string } = { showsKey: SHOWS_KEY, pressKey: PRESS_KEY },
) {
  return createStudioStore({
    key: OVERLAYS_KEY,
    ...keys,
    urlEnv: URL_ENV,
    tokenEnv: TOKEN_ENV,
    cachedRead: { next: { revalidate: 60 } },
    fetch: kv.fetchFn,
  });
}

/** Obviously fake facts: nothing here describes a real show. */
const testShow = (slug: string, over: Partial<ShowRecord> = {}): ShowRecord => ({
  slug,
  title: `Test Show ${slug}`,
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "published",
  ...over,
});

describe("the shows store", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("reads null and writes nothing when the site names no shows key", async () => {
    const kv = fakeKv();
    const { shows } = storesWith(kv, {});
    expect(shows.key).toBeUndefined();
    expect(shows.configured()).toBe(false);
    expect(await shows.readShows()).toBeNull();
    expect(await shows.writeShow(testShow("a"), "artist")).toBe(false);
    expect(await shows.deleteShow("a")).toBe(false);
    expect(kv.calls).toEqual([]);
  });

  it("reads null, never an empty list, when no store is connected", async () => {
    delete process.env[URL_ENV];
    const kv = fakeKv();
    const { shows } = storesWith(kv);
    expect(shows.key).toBe(SHOWS_KEY);
    expect(shows.configured()).toBe(false);
    expect(await shows.readShows()).toBeNull();
    expect(await shows.writeShow(testShow("a"), "artist")).toBe(false);
    expect(kv.calls).toEqual([]);
  });

  it("reads every valid show from its own key, in stored order", async () => {
    const kv = fakeKv({
      [SHOWS_KEY]: JSON.stringify({ b: testShow("b"), a: testShow("a"), junk: { slug: "junk" } }),
    });
    const back = await storesWith(kv).shows.readShows();
    expect(back?.map((s) => s.slug)).toEqual(["b", "a"]);
    expect(kv.calls[0]?.url).toBe(`https://kv.example.test/get/${SHOWS_KEY}`);
  });

  it("reports nothing saved, or a corrupted blob, as no shows", async () => {
    expect(await storesWith(fakeKv()).shows.readShows()).toEqual([]);
    expect(await storesWith(fakeKv({ [SHOWS_KEY]: "{not json" })).shows.readShows()).toEqual([]);
  });

  it("keeps public reads cacheable and studio reads fresh", async () => {
    const kv = fakeKv();
    const { shows } = storesWith(kv);
    await shows.readShows();
    await shows.readShows(true);
    const [publicRead, studioRead] = kv.calls;
    expect(publicRead?.init.next).toEqual({ revalidate: 60 });
    expect(publicRead?.init.cache).toBeUndefined();
    expect(studioRead?.init.cache).toBe("no-store");
    expect(studioRead?.init.next).toBeUndefined();
  });

  it("saves a show whole, so a field cleared in the studio stays cleared", async () => {
    const kv = fakeKv({
      [SHOWS_KEY]: JSON.stringify({ a: testShow("a", { note: "Old line." }), b: testShow("b") }),
    });
    expect(await storesWith(kv).shows.writeShow(testShow("a"), "artist")).toBe(true);
    const saved = JSON.parse(kv.values.get(SHOWS_KEY) ?? "{}") as Record<string, ShowRecord>;
    expect(Object.keys(saved)).toEqual(["a", "b"]);
    expect(saved.a?.note).toBeUndefined();
    expect(saved.a?.updatedBy).toBe("artist");
    expect(Number.isNaN(Date.parse(saved.a?.updatedAt ?? ""))).toBe(false);
    expect(saved.b).toEqual(testShow("b"));
    const write = kv.calls.at(-1);
    expect(write?.url).toBe(`https://kv.example.test/set/${SHOWS_KEY}`);
    expect(write?.init.method).toBe("POST");
    expect(kv.values.has(OVERLAYS_KEY)).toBe(false);
  });

  it("adds a new show after the ones already saved", async () => {
    const kv = fakeKv({ [SHOWS_KEY]: JSON.stringify({ a: testShow("a") }) });
    await storesWith(kv).shows.writeShow(testShow("c"), "operator");
    expect(Object.keys(JSON.parse(kv.values.get(SHOWS_KEY) ?? "{}"))).toEqual(["a", "c"]);
  });

  it("deletes one show and keeps the rest", async () => {
    const kv = fakeKv({ [SHOWS_KEY]: JSON.stringify({ a: testShow("a"), b: testShow("b") }) });
    expect(await storesWith(kv).shows.deleteShow("a")).toBe(true);
    expect(JSON.parse(kv.values.get(SHOWS_KEY) ?? "{}")).toEqual({ b: testShow("b") });
  });

  it("throws when the store refuses the write, so a save never looks done", async () => {
    const kv = fakeKv({ [SHOWS_KEY]: JSON.stringify({ a: testShow("a") }) }, true);
    await expect(storesWith(kv).shows.writeShow(testShow("b"), "artist")).rejects.toThrow(
      "store 503",
    );
    await expect(storesWith(kv).shows.deleteShow("a")).rejects.toThrow("store 503");
  });
});

describe("the press token store", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("reads null and writes nothing when the site names no press key", async () => {
    const kv = fakeKv();
    const { press } = storesWith(kv, { showsKey: SHOWS_KEY });
    expect(press.key).toBeUndefined();
    expect(press.configured()).toBe(false);
    expect(await press.readToken()).toBeNull();
    expect(await press.writeToken(generatePressToken(), "operator")).toBe(false);
    expect(kv.calls).toEqual([]);
  });

  it("reads null when no store is connected", async () => {
    delete process.env[TOKEN_ENV];
    expect(await storesWith(fakeKv()).press.readToken()).toBeNull();
  });

  it("reads undefined until a token is set, then that token", async () => {
    const kv = fakeKv();
    const { press } = storesWith(kv);
    expect(await press.readToken()).toBeUndefined();
    const token = generatePressToken();
    expect(await press.writeToken(token, "operator")).toBe(true);
    expect(await press.readToken(true)).toBe(token);
    const saved = JSON.parse(kv.values.get(PRESS_KEY) ?? "{}") as Record<string, unknown>;
    expect(saved.token).toBe(token);
    expect(saved.updatedBy).toBe("operator");
  });

  it("replaces the stored token in place, so the old link stops matching", async () => {
    const kv = fakeKv();
    const { press } = storesWith(kv);
    const first = generatePressToken();
    const second = generatePressToken();
    await press.writeToken(first, "operator");
    expect(pressTokenMatches(first, await press.readToken(true))).toBe(true);
    await press.writeToken(second, "operator");
    const current = await press.readToken(true);
    expect(current).toBe(second);
    expect(pressTokenMatches(first, current)).toBe(false);
    expect(pressTokenMatches(second, current)).toBe(true);
    expect([...kv.values.keys()]).toEqual([PRESS_KEY]);
    expect(JSON.parse(kv.values.get(PRESS_KEY) ?? "{}").token).toBe(second);
  });

  it("refuses a token it did not make, and writes nothing", async () => {
    const kv = fakeKv();
    await expect(storesWith(kv).press.writeToken("short", "operator")).rejects.toThrow(
      "not a press token",
    );
    expect(kv.calls).toEqual([]);
  });

  it("treats a stored token of the wrong shape, or a corrupted blob, as none", async () => {
    const wrong = fakeKv({ [PRESS_KEY]: JSON.stringify({ token: "short" }) });
    expect(await storesWith(wrong).press.readToken()).toBeUndefined();
    const corrupted = fakeKv({ [PRESS_KEY]: "{not json" });
    expect(await storesWith(corrupted).press.readToken()).toBeUndefined();
  });
});
