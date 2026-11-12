import { describe, expect, it } from "vitest";
import { type Approval, draftTable, resolveCopy, sectionOf } from "./copy";
import { FIXTURE_TODAY, sunMountainBrand, yaleFixture } from "./fixtures";
import type { GuideModel } from "./model";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";
import { validateModel } from "./validate";

const ok = (section: Approval["section"]): Approval => ({
  section,
  scope: "house:yale",
  by: "Jake",
  on: "2026-11-11",
  source: "test",
});

const text = (m: GuideModel, approvals: Approval[]) =>
  renderGuideHtml({
    plan: planGuide(m, resolveCopy(m, { approvals, brandLabels: sunMountainBrand.labels })),
    brand: sunMountainBrand,
    head: { canonical: "https://example.invalid/guides/yale" },
  })
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

const live = (key: string) =>
  yaleFixture.sections
    .flatMap((s) => s.items)
    .find((i) => `${i.key ?? ""}` === key || i.label === key)?.body ?? "";
const WILDLIFE = live("Wildlife");
const SHORT_WILDLIFE = "Bears, deer and foxes pass through here.";
const SHORT_PARKING = "Two cars fit in the garage and two in the driveway.";
const SHORT_CONTACT = "Message us in your booking app. Day or night, we answer.";
const SHORT_VENTS = "Shut the lower-level vents, fully or halfway, to send cool air up.";

describe("item-body held lines", () => {
  it("each lands in its own chapter's approval section", () => {
    expect(sectionOf({ kind: "item-body", key: "good-to-know.wildlife" }, yaleFixture)).toBe(
      "good-to-know",
    );
    expect(sectionOf({ kind: "item-body", key: "first-hour.cooler-upstairs" }, yaleFixture)).toBe(
      "first-hour",
    );
    expect(sectionOf({ kind: "item-body", key: "parking" })).toBe("arrival");
    expect(sectionOf({ kind: "item-body", key: "contact" })).toBe("help");
  });

  it("zero approvals print every live body verbatim and no short answer", () => {
    const t = text(yaleFixture, []);
    expect(t).toContain(WILDLIFE);
    expect(t).toContain(yaleFixture.contact.label);
    expect(t).toContain("value" in yaleFixture.parking ? yaleFixture.parking.value : "");
    expect(t).toContain("Close or half-close the lower-level vents to push cool air upstairs.");
    for (const s of [SHORT_WILDLIFE, SHORT_PARKING, SHORT_CONTACT, SHORT_VENTS])
      expect(t).not.toContain(s);
  });

  it("an approval prints that section's short answers only", () => {
    const t = text(yaleFixture, [ok("good-to-know")]);
    expect(t).toContain(SHORT_WILDLIFE);
    expect(t).not.toContain(WILDLIFE);
    expect(t).not.toContain(SHORT_PARKING);
    expect(t).not.toContain(SHORT_VENTS);
    const all = text(yaleFixture, [ok("arrival"), ok("first-hour"), ok("help")]);
    expect(all).toContain(SHORT_PARKING);
    expect(all).toContain(SHORT_VENTS);
    expect(all).toContain(SHORT_CONTACT);
    expect(all).toContain(WILDLIFE);
  });

  it("a figure that is not in the approved short answer is dropped, never left orphaned", () => {
    const m = structuredClone(yaleFixture);
    m.drafts = [
      ...(m.drafts ?? []),
      {
        at: { kind: "item-body", key: "house.trash-day" },
        text: "Bins to the curb Tuesday morning.",
        why: "w",
        writtenBy: "b",
        writtenOn: "2026-11-11",
      },
    ];
    const plan = planGuide(m, resolveCopy(m, { approvals: [ok("house")] }));
    const house = plan.chapters.find((c) => c.id === "house");
    expect(house?.blocks.some((b) => b.kind === "figure" && b.key === "house.trash-day")).toBe(
      false,
    );
  });

  it("the drafts table shows the live body it replaces, read from the model", () => {
    const row = draftTable(yaleFixture).find((r) => r.held.startsWith(SHORT_WILDLIFE));
    expect(row?.live).toBe(WILDLIFE);
    expect(row?.section).toBe("good-to-know");
  });

  it("the validator refuses an item-body key that points at nothing", () => {
    const m = structuredClone(yaleFixture);
    m.drafts = [
      {
        at: { kind: "item-body", key: "house.nope" },
        text: "x",
        why: "w",
        writtenBy: "b",
        writtenOn: "2026-11-11",
      },
    ];
    expect(
      validateModel(m, { today: FIXTURE_TODAY }).some((p) => p.includes('item-body "house.nope"')),
    ).toBe(true);
  });
});
