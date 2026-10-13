import { describe, expect, it } from "vitest";
import { type Cv, cvGaps, cvSections, hasCvContent, newestFirst } from "./cv";

const empty: Cv = {
  education: [],
  soloExhibitions: [],
  groupExhibitions: [],
  press: [],
  awards: [],
};

const withSolo: Cv = {
  ...empty,
  soloExhibitions: [
    { year: "2025", title: "Light Codes", venue: "Metro Craft", location: "Brooklyn" },
  ],
};

describe("Carole 13: no empty headings", () => {
  it("renders no section at all when there is nothing to put in it", () => {
    expect(cvSections(empty)).toEqual([]);
    expect(hasCvContent(empty)).toBe(false);
  });

  it("renders only the sections that have entries, in Carole's order", () => {
    const source: Cv = { ...withSolo, awards: [{ year: "2024", title: "A prize" }] };
    expect(cvSections(source).map((s) => s.id)).toEqual(["solo", "awards"]);
  });

  it("counts education alone as content", () => {
    expect(hasCvContent({ ...empty, education: [{ what: "Studied under a mentor" }] })).toBe(true);
  });
});

describe("Carole 10: order", () => {
  it("orders entries newest first", () => {
    const sorted = newestFirst([
      { year: "2024", title: "Alcyone" },
      { year: "2025", title: "Light Codes" },
    ]);
    expect(sorted.map((e) => e.year)).toEqual(["2025", "2024"]);
  });

  it("does not throw on a non-numeric year", () => {
    expect(() => newestFirst([{ year: "n.d.", title: "Untitled show" }])).not.toThrow();
  });
});

describe("what is still missing", () => {
  it("names education and exhibitions when both are missing", () => {
    expect(cvGaps(empty)).toEqual(["education, mentors or meaningful study", "exhibitions"]);
  });

  it("stops reporting a gap once it is filled", () => {
    const filled: Cv = { ...withSolo, education: [{ what: "Studied under a mentor" }] };
    expect(cvGaps(filled)).toEqual([]);
  });
});
