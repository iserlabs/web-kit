import { describe, expect, it } from "vitest";
import { closedGroups, groupKey, groupsFoldable, setAllGroups, toggleGroup } from "./fold-groups";

describe("folding the groups of a list", () => {
  it("keeps only strings, each once, whatever was stored", () => {
    expect(closedGroups(["a", "a", 3, null, "", "b"])).toEqual(["a", "b"]);
    expect(closedGroups("nope")).toEqual([]);
    expect(closedGroups(null)).toEqual([]);
  });

  it("toggles one group and leaves the rest", () => {
    expect(toggleGroup([], groupKey("changes", "Nov 2"))).toEqual(["changes:Nov 2"]);
    expect(toggleGroup(["changes:Nov 2", "x:y"], "changes:Nov 2")).toEqual(["x:y"]);
  });

  it("closes or opens every group of one list and never touches another list's folds", () => {
    const labels = ["Nov 2", "Nov 1"];
    const shut = setAllGroups(["other:keep"], "changes", labels, true);
    expect(shut.sort()).toEqual(["changes:Nov 1", "changes:Nov 2", "other:keep"]);
    expect(setAllGroups(shut, "changes", labels, false)).toEqual(["other:keep"]);
  });

  it("offers Close all only above two or more named groups", () => {
    expect(groupsFoldable(["a"])).toBe(false);
    expect(groupsFoldable(["a", ""])).toBe(false);
    expect(groupsFoldable(["a", "b"])).toBe(true);
  });
});
