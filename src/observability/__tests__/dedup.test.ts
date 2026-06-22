import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetDedupForTests, checkAndRecord } from "../dedup";

afterEach(() => {
  __resetDedupForTests();
  vi.useRealTimers();
});

describe("checkAndRecord", () => {
  it("sends first occurrence, suppresses within TTL, counts suppressions", () => {
    expect(checkAndRecord("k")).toEqual({ shouldSend: true, suppressedCount: 0 });
    expect(checkAndRecord("k")).toEqual({
      shouldSend: false,
      suppressedCount: 1,
    });
    expect(checkAndRecord("k")).toEqual({
      shouldSend: false,
      suppressedCount: 2,
    });
  });
  it("sends again after the TTL elapses (no carry-over when nothing was suppressed)", () => {
    vi.useFakeTimers();
    checkAndRecord("k", 1000);
    vi.advanceTimersByTime(1001);
    expect(checkAndRecord("k", 1000)).toEqual({
      shouldSend: true,
      suppressedCount: 0,
    });
  });
  it("carries the suppressed count forward into the next window's first send", () => {
    vi.useFakeTimers();
    checkAndRecord("k", 1000); // send, window opens
    checkAndRecord("k", 1000); // suppressed -> 1
    checkAndRecord("k", 1000); // suppressed -> 2
    vi.advanceTimersByTime(1001);
    expect(checkAndRecord("k", 1000)).toEqual({
      shouldSend: true,
      suppressedCount: 2,
    });
  });
  it("accepts an injectable `now` and rolls over at exactly ttlMs (>=)", () => {
    const t0 = 1_000_000;
    expect(checkAndRecord("k", 1000, t0)).toEqual({
      shouldSend: true,
      suppressedCount: 0,
    });
    expect(checkAndRecord("k", 1000, t0 + 500)).toEqual({
      shouldSend: false,
      suppressedCount: 1,
    });
    // Exactly at the boundary → new window sends, carrying the 1 suppressed.
    expect(checkAndRecord("k", 1000, t0 + 1000)).toEqual({
      shouldSend: true,
      suppressedCount: 1,
    });
  });
});
