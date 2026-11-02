import { describe, expect, it } from "vitest";
import { clientKey, MAX_BODY, rateLimited, readSmallJson } from "./intake-guard";

/** A fresh key per test, since the limiter's state is module-level by design. */
let n = 0;
const key = () => `test-${++n}`;

describe("rateLimited", () => {
  it("lets an ordinary run of requests through", () => {
    const k = key();
    for (let i = 0; i < 8; i++) expect(rateLimited(k), `request ${i + 1}`).toBe(false);
  });

  it("refuses the ninth request inside the window", () => {
    const k = key();
    for (let i = 0; i < 8; i++) rateLimited(k);
    expect(rateLimited(k)).toBe(true);
  });

  it("forgives once the window has passed", () => {
    const k = key();
    const t0 = 1_000_000;
    for (let i = 0; i < 9; i++) rateLimited(k, t0);
    expect(rateLimited(k, t0)).toBe(true);
    expect(rateLimited(k, t0 + 60_001)).toBe(false);
  });

  it("counts each caller separately", () => {
    const a = key();
    const b = key();
    for (let i = 0; i < 9; i++) rateLimited(a);
    expect(rateLimited(a)).toBe(true);
    expect(rateLimited(b)).toBe(false);
  });
});

describe("clientKey", () => {
  it("takes the leftmost forwarded address, which is the one the proxy set", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientKey(req)).toBe("203.0.113.5");
  });

  it("falls back to a single shared bucket rather than silently not limiting", () => {
    /* Failing closed matters more than precision here: a limiter that stops
       limiting when a header is missing is worse than no limiter, because it
       reads as protection. */
    expect(clientKey(new Request("https://example.com"))).toBe("unknown");
  });
});

describe("readSmallJson", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("https://example.com", { method: "POST", body, headers });

  it("parses an ordinary form body", async () => {
    expect(await readSmallJson(post(JSON.stringify({ email: "a@b.com" })))).toEqual({
      email: "a@b.com",
    });
  });

  it("refuses a body past the cap without buffering it, on the declared length", async () => {
    const req = post("{}", { "content-length": String(MAX_BODY + 1) });
    expect(await readSmallJson(req)).toBeNull();
  });

  it("ALSO refuses on the real length, because the header is the caller's word", async () => {
    const huge = JSON.stringify({ notes: "x".repeat(MAX_BODY) });
    /* Declares a small body, sends a large one. Trusting the header here is
       exactly how a size cap becomes decorative. */
    expect(await readSmallJson(post(huge, { "content-length": "10" }))).toBeNull();
  });

  it("returns null rather than throwing on malformed JSON", async () => {
    expect(await readSmallJson(post("{not json"))).toBeNull();
  });
});
