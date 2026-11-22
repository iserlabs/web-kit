import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module
import { DEFAULT_AXE_TAGS } from "./axe.mjs";

describe("axe default tags", () => {
  it("covers WCAG 2.0, 2.1 and 2.2 at A and AA", () => {
    expect(DEFAULT_AXE_TAGS).toEqual(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  });
});
