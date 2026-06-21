import { describe, expect, it } from "vitest";
import { IGNORE_ERRORS, shouldIgnore } from "../ignore";

describe("IGNORE_ERRORS", () => {
  it("covers the known browser-noise sources", () => {
    expect(IGNORE_ERRORS).toContain("Load failed");
    expect(IGNORE_ERRORS).toContain("ResizeObserver loop completed with undelivered notifications");
  });
  it("shouldIgnore matches substrings", () => {
    expect(shouldIgnore("TypeError: Load failed")).toBe(true);
    expect(shouldIgnore("genuine app crash")).toBe(false);
  });
});
