import { describe, expect, it } from "vitest";
import { findLeaks } from "./leaks";

describe("findLeaks", () => {
  it("finds a code standing alone in the HTML, masked", () => {
    expect(findLeaks("<p>Use 4821 at the door</p>", ["4821"])).toEqual(["4***"]);
  });

  it("ignores the digits inside a longer token", () => {
    expect(findLeaks('<a href="/x48219">x</a><i>a4821b</i>', ["4821"])).toEqual([]);
  });

  it("ignores blank entries and reports each leaked code once", () => {
    expect(findLeaks("4821 and 4821 and 7777", ["", " ", "4821", "7777"])).toEqual([
      "4***",
      "7***",
    ]);
  });
});
