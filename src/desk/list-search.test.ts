import { describe, expect, it } from "vitest";
import { matches, pinOpen, search, summarize, TOP } from "./list-search";

describe("matching a query against a row", () => {
  it("matches everything when nothing has been typed", () => {
    expect(matches("Marta Ellery", "")).toBe(true);
    expect(matches("Marta Ellery", "   ")).toBe(true);
  });

  it("ignores case, because nobody types a search with capitals", () => {
    expect(matches("Marta Ellery", "MARTA")).toBe(true);
    expect(matches("MARTA ELLERY", "marta")).toBe(true);
  });

  /* The commonest way a search feels broken: matching the whole query as one string means
     "ellery marta" finds nothing, and nobody reliably remembers which way round a name was
     filed. */
  it("finds a name typed in either order", () => {
    expect(matches("Marta Ellery", "marta ellery")).toBe(true);
    expect(matches("Marta Ellery", "ellery marta")).toBe(true);
  });

  it("wants every word, not just one of them", () => {
    expect(matches("Marta Ellery, Northgate Partners", "marta northgate")).toBe(true);
    expect(matches("Marta Ellery, Northgate Partners", "marta riverbend")).toBe(false);
  });

  it("reaches an email and a company, not only a name", () => {
    const row = "Dov Ashworth dov@example.com Cedar & Co";
    expect(matches(row, "cedar")).toBe(true);
    expect(matches(row, "example.com")).toBe(true);
  });
});

describe("searching a list", () => {
  const rows = [{ n: "Marta Ellery" }, { n: "Dov Ashworth" }, { n: "Priya Raman" }];
  const text = (r: { n: string }) => r.n;

  it("hands back the whole list when nothing was typed", () => {
    expect(search(rows, text, "")).toHaveLength(3);
  });

  it("keeps the order it was given, so a list does not reshuffle as you type", () => {
    expect(search(rows, text, "a").map((r) => r.n)).toEqual([
      "Marta Ellery",
      "Dov Ashworth",
      "Priya Raman",
    ]);
  });

  it("narrows to the matches", () => {
    expect(search(rows, text, "priya").map((r) => r.n)).toEqual(["Priya Raman"]);
  });
});

describe("what the list says about itself", () => {
  const people: [string, string] = ["person", "people"];

  /* A short list showing all of itself needs no footnote. Adding one to every list in the
     building is how a screen fills up with text about itself. */
  it("says nothing at all when there is nothing worth saying", () => {
    expect(summarize(6, 6, false, people, false)).toBeNull();
  });

  it("says what was left out, and what to do about it", () => {
    expect(summarize(506, 506, false, people, false)).toBe(
      `Showing the first ${TOP} of 506 people. Search to narrow it down.`,
    );
  });

  it("counts the matches while searching", () => {
    expect(summarize(3, 506, false, people, true)).toBe("3 of 506 people.");
  });

  it("still caps a search that matched too much, and says so", () => {
    expect(summarize(40, 506, false, people, true)).toBe(
      `Showing the first ${TOP} of 40 matching people.`,
    );
  });

  /* An empty result must name the denominator it searched, or it reads as an empty list. */
  it("says nothing matched WITHOUT implying the list is empty", () => {
    expect(summarize(0, 506, false, people, true)).toBe("Nothing matches that, out of 506 people.");
  });

  it("confirms when everything is on screen after asking for all of it", () => {
    expect(summarize(506, 506, true, people, false)).toBe("All 506 people.");
  });

  it("uses the singular where a singular is right", () => {
    expect(summarize(1, 506, false, people, true)).toBe("1 of 506 people.");
    expect(summarize(1, 1, false, people, true)).toBe("1 of 1 person.");
  });
});

describe("keeping the open row visible", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}` }));
  const capped = rows.slice(0, TOP);
  const isOpen = (id: string) => (r: { id: string }) => r.id === id;

  it("leaves the list alone when the open row is already on screen", () => {
    expect(pinOpen(capped, rows, false, isOpen("r3"))).toBe(capped);
  });

  /* The record opens beside the list either way. Without this the screen shows an open record
     with nothing selected next to it, which reads as a bug. */
  it("puts the open row on top when the cap would have hidden it", () => {
    const out = pinOpen(capped, rows, false, isOpen("r40"));
    expect(out[0].id).toBe("r40");
    expect(out).toHaveLength(TOP + 1);
  });

  it("does nothing when nothing is open", () => {
    expect(pinOpen(capped, rows, false, undefined)).toBe(capped);
  });

  it("does nothing once everything is on screen anyway", () => {
    expect(pinOpen(rows, rows, true, isOpen("r40"))).toBe(rows);
  });

  /* The open row can be filtered out by a search, and then there is nothing to pin. */
  it("stays quiet when the open row does not match the search", () => {
    const narrowed = rows.slice(0, 5);
    expect(pinOpen(narrowed, narrowed, false, isOpen("r40"))).toBe(narrowed);
  });
});
