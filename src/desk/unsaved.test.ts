import { describe, expect, it } from "vitest";
import { createUnsavedRegistry, LEAVE_QUESTION, leaveDecision, mayLeaveFor } from "./unsaved";

describe("unsaved work, asked about in one place", () => {
  it("lets you leave without a question when nothing is unsaved", () => {
    const r = createUnsavedRegistry();
    let asked = 0;
    expect(
      r.mayLeave(() => {
        asked += 1;
        return false;
      }),
    ).toBe(true);
    expect(asked).toBe(0);
  });

  it("asks once when a pane holds unsaved work, and stays when the answer is no", () => {
    const r = createUnsavedRegistry();
    r.set("forms", true);
    const asked: string[] = [];
    expect(
      r.mayLeave((q) => {
        asked.push(q);
        return false;
      }),
    ).toBe(false);
    expect(asked).toEqual([LEAVE_QUESTION]);
    expect(r.any()).toBe(true);
  });

  it("drops every flag when the answer is yes, so a second question never follows", () => {
    const r = createUnsavedRegistry();
    r.set("forms", true);
    r.set("paperwork", true);
    expect(r.mayLeave(() => true)).toBe(true);
    expect(r.any()).toBe(false);
    expect(
      r.mayLeave(() => {
        throw new Error("asked twice");
      }),
    ).toBe(true);
  });

  it("forgets a pane that reports clean again, and keeps the others", () => {
    const r = createUnsavedRegistry();
    r.set("forms", true);
    r.set("publicevents", true);
    r.set("forms", false);
    expect(r.any()).toBe(true);
    r.set("publicevents", false);
    expect(r.any()).toBe(false);
  });
});

describe("leaving for another tab", () => {
  it.each([
    ["same tab, dirty, no", { to: "forms", from: "forms", dirty: true, confirmed: false }, "leave"],
    ["clean", { to: "events", from: "forms", dirty: false, confirmed: false }, "leave"],
    ["dirty, declined", { to: "events", from: "forms", dirty: true, confirmed: false }, "stay"],
    ["dirty, agreed", { to: "events", from: "forms", dirty: true, confirmed: true }, "leave"],
  ] as const)("%s", (_n, input, want) => {
    expect(leaveDecision(input)).toBe(want);
  });

  it("asks nothing for the tab already open, and stays on a no", () => {
    const r = createUnsavedRegistry();
    r.set("forms", true);
    const never = () => {
      throw new Error("asked");
    };
    expect(mayLeaveFor(r, "forms", "forms", never)).toBe(true);
    expect(mayLeaveFor(r, "forms", "events", () => false)).toBe(false);
    expect(r.any()).toBe(true);
    expect(mayLeaveFor(r, "forms", "events", () => true)).toBe(true);
    expect(r.any()).toBe(false);
  });
});

/* The suite runs in Node with no DOM library, so the wiring is held by reading the source, the
   same way Build 5 held the Forms focus effect. */
