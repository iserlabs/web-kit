import { describe, expect, it } from "vitest";
import { findLeaks } from "./leaks";

describe("findLeaks", () => {
  it("finds a code standing alone in the HTML, masked", () => {
    expect(findLeaks("<p>Use 4821 at the door</p>", ["4821"])).toEqual(["code 1 of 1"]);
  });

  it("ignores the digits inside a longer token", () => {
    expect(findLeaks('<a href="/x48219">x</a><i>a4821b</i>', ["4821"])).toEqual([]);
  });

  it("ignores blank entries and reports each leaked code once", () => {
    expect(findLeaks("4821 and 4821 and 7777", ["", " ", "4821", "7777"])).toEqual([
      "code 3 of 4",
      "code 4 of 4",
    ]);
  });

  it("never prints a digit of a code", () => {
    const out = findLeaks("Use 7777 at the door", ["7777"]);
    expect(out).toEqual(["code 1 of 1"]);
    expect(out.join("")).not.toContain("7");
  });

  it("matches a code with regex characters only as a standalone token", () => {
    expect(findLeaks("door 4.8+1 here", ["4.8+1"])).toEqual(["code 1 of 1"]);
    expect(findLeaks("door 4x8+1 here", ["4.8+1"])).toEqual([]);
  });
});
