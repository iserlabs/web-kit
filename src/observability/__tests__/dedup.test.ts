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
  it("sends again after the TTL elapses", () => {
    vi.useFakeTimers();
    checkAndRecord("k", 1000);
    vi.advanceTimersByTime(1001);
    expect(checkAndRecord("k", 1000)).toEqual({
      shouldSend: true,
      suppressedCount: 0,
    });
  });
});
