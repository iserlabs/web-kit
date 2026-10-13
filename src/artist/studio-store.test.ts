import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArtworkOverlay } from "./overlay";
import type { Artwork } from "./record";
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
});
