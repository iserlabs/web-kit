import { describe, expect, it } from "vitest";
import {
  type Approval,
  approved,
  draftTable,
  heldStrings,
  resolveCopy,
  sectionOf,
  TEMPLATE_LABELS,
} from "./copy";
import { columbus52Fixture, sunMountainBrand, yaleFixture } from "./fixtures";

const ok = (section: Approval["section"], scope: Approval["scope"] = "brand"): Approval => ({
  section,
  scope,
  by: "Jake",
  on: "2026-11-11",
  source: "test",
});

describe("TEMPLATE_LABELS", () => {
  it("carries the live v1 wording beside each held one", () => {
    expect(TEMPLATE_LABELS.quickFindHead).toEqual({
      live: "Quick find",
      alpenglow: "10 questions",
    });
    expect(TEMPLATE_LABELS.coverIn).toEqual({ live: "Check-in", alpenglow: "In" });
    expect(TEMPLATE_LABELS["chapter.arrival"]).toEqual({
      live: "Getting in",
      alpenglow: "Arrival",
    });
    expect(TEMPLATE_LABELS.unknownLine.live).toBeNull();
    expect(TEMPLATE_LABELS.ifCodeFailsHead.live).toBeNull();
    expect(TEMPLATE_LABELS.landmarkHead.live).toBeNull();
  });
});

describe("resolveCopy with zero approvals", () => {
  const c = resolveCopy(yaleFixture, { approvals: [], brandLabels: sunMountainBrand.labels });

  it("prints only live labels, and none whose live value is null", () => {
    expect(c.labels.quickFindHead).toEqual({ text: "Quick find", from: "live" });
    expect(c.labels.coverIn?.text).toBe("Check-in");
    expect(c.labels["chapter.arrival"]?.text).toBe("Getting in");
    expect(c.labels.unknownLine).toBeNull();
    expect(c.labels.ifCodeFailsHead).toBeNull();
    expect(c.labels.landmarkHead).toBeNull();
    expect(c.alpenglowLabels).toBe(false);
  });

  it("uses the brand's own live label over the kit default", () => {
    expect(c.labels.copyButton).toEqual({ text: "Copy password", from: "live" });
  });

  it("returns no held line at all", () => {
    expect(c.chapterHeads).toEqual({});
    expect(c.subheads).toEqual({});
    expect(c.quickFind).toEqual({});
    expect(c.coverLines).toEqual({});
    expect(c.priceCells).toEqual({});
    expect(c.ifCodeFails).toBeUndefined();
    expect(c.landmark).toBeUndefined();
    expect(c.unknownLine).toBeNull();
    expect(c.unknownsOn).toBe(false);
  });

  it("prints the door-code timing verbatim (R6)", () => {
    expect(c.codeDelivery).toEqual({ text: yaleFixture.entry.codeDelivery.value, from: "live" });
  });

  it("every returned line is live", () => {
    const lines = Object.values(c.labels).filter((l) => l !== null);
    expect(lines.every((l) => l?.from === "live")).toBe(true);
  });
});

describe("resolveCopy with approvals", () => {
  it("prints exactly the approved section's lines", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("first-hour")] });
    expect(c.chapterHeads["first-hour"]).toEqual({
      text: "Too warm upstairs, too cold?",
      from: "approved",
    });
    expect(c.subheads["first-hour|Cooling"]?.text).toBe("Top floor too warm");
    expect(c.chapterHeads.arrival).toBeUndefined();
    expect(c.chapterHeads.house).toBeUndefined();
    expect(c.quickFind).toEqual({});
    expect(c.labels.quickFindHead?.text).toBe("Quick find");
  });

  it("a house-scoped approval covers only that house", () => {
    const a = [ok("arrival", "house:yale")];
    expect(resolveCopy(yaleFixture, { approvals: a }).chapterHeads.arrival?.text).toBe(
      "Front door and keypad",
    );
    expect(resolveCopy(columbus52Fixture, { approvals: a }).chapterHeads.arrival).toBeUndefined();
  });

  it("template labels switch together on their own approval", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("template-labels")] });
    expect(c.labels.quickFindHead).toEqual({ text: "10 questions", from: "approved" });
    expect(c.labels.coverDoor?.text).toBe("Door");
    expect(c.alpenglowLabels).toBe(true);
    // The unknown line has its own section.
    expect(c.labels.unknownLine).toBeNull();
    expect(c.unknownLine).toBeNull();
  });

  it("the unknown line needs the unknowns approval", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("unknowns")] });
    expect(c.unknownLine?.text).toBe("Not confirmed yet. Message us in your booking app.");
    expect(c.unknownsOn).toBe(true);
  });

  it("quick-find drafts carry question and answer", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("quick-find")] });
    expect(c.quickFind["house.for-kids"]).toEqual({
      question: { text: "Pack 'n play for kids?", from: "approved" },
      answer: { text: "Top-floor primary bedroom closet. No charge.", from: "approved" },
    });
    expect(c.quickFind.wifi?.answer).toBeUndefined();
  });

  it("a cover-line approval sets the cover rows", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("cover")] });
    expect(c.coverLines.parking?.text).toBe("Garage, two in the driveway, one street spot");
    expect(c.coverLines.door).toBeUndefined();
  });

  it("an if-code-fails draft prints with the arrival approval; a live ladder wins", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("arrival")] });
    expect(c.ifCodeFails).toEqual({
      steps: ["Enter the code again, slowly.", "Message us in your booking app, any hour."],
      from: "approved",
    });
    const live = structuredClone(yaleFixture);
    live.entry.ifCodeFails = { value: ["Live step."], source: "s", checked: "2026-10-23" };
    expect(resolveCopy(live, { approvals: [ok("arrival")] }).ifCodeFails).toEqual({
      steps: ["Live step."],
      from: "live",
    });
    expect(resolveCopy(live, { approvals: [] }).ifCodeFails?.from).toBe("live");
  });
});

describe("codeDeliveryNext needs both gates", () => {
  const confirmed = structuredClone(yaleFixture);
  if (confirmed.entry.codeDeliveryNext)
    confirmed.entry.codeDeliveryNext.guestyConfirmed = {
      on: "2026-11-12",
      by: "Jake",
      source: "Guesty message read",
    };
  const next = "Your door code comes in the check-in message in your booking app on check-in day.";

  it("an approval without Guesty confirmation keeps the live line", () => {
    const c = resolveCopy(yaleFixture, { approvals: [ok("door-timing")] });
    expect(c.codeDelivery.text).toBe(yaleFixture.entry.codeDelivery.value);
  });
  it("Guesty confirmation without an approval keeps the live line", () => {
    expect(resolveCopy(confirmed, { approvals: [] }).codeDelivery.from).toBe("live");
  });
  it("both together print the check-in-day line", () => {
    const c = resolveCopy(confirmed, { approvals: [ok("door-timing", "house:yale")] });
    expect(c.codeDelivery).toEqual({ text: next, from: "approved" });
  });
  it("the drafts preview never skips the Guesty gate", () => {
    expect(resolveCopy(yaleFixture, { approvals: [], drafts: "show" }).codeDelivery.from).toBe(
      "live",
    );
  });
});

describe("drafts preview", () => {
  it("prints every held line in place", () => {
    const c = resolveCopy(yaleFixture, { approvals: [], drafts: "show" });
    expect(c.drafts).toBe("show");
    expect(c.labels.quickFindHead?.text).toBe("10 questions");
    expect(Object.keys(c.quickFind)).toHaveLength(10);
    expect(c.unknownLine).not.toBeNull();
  });
});

describe("helpers", () => {
  it("sectionOf maps each target", () => {
    expect(sectionOf({ kind: "chapter-head", chapter: "good-to-know" })).toBe("good-to-know");
    expect(sectionOf({ kind: "landmark", text: "x" })).toBe("arrival");
    expect(sectionOf({ kind: "cover-line", row: "door" })).toBe("cover");
    expect(sectionOf({ kind: "price-cell", table: "Charges", item: "x" }, yaleFixture)).toBe(
      "rules",
    );
  });
  it("approved checks section and scope", () => {
    expect(approved([ok("house", "house:lark")], "house", "yale")).toBe(false);
    expect(approved([ok("house", "house:yale")], "house", "yale")).toBe(true);
  });
  it("heldStrings lists every distinctive held string and no live one", () => {
    const h = heldStrings(yaleFixture, sunMountainBrand.labels);
    expect(h).toContain("10 questions");
    expect(h).toContain("Front door and keypad");
    expect(h).toContain("Enter the code again, slowly.");
    expect(h).toContain(
      "Your door code comes in the check-in message in your booking app on check-in day.",
    );
    expect(h).not.toContain("Copy password");
    expect(h).not.toContain("Read this first");
  });
  it("draftTable puts each held line beside its live wording", () => {
    const rows = draftTable(yaleFixture);
    expect(rows.find((r) => r.held === "Top floor too warm")?.live).toBe("Cooling");
    expect(rows.find((r) => r.section === "door-timing")?.live).toBe(
      yaleFixture.entry.codeDelivery.value,
    );
  });
});
