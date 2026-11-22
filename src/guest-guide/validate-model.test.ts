import { describe, expect, it } from "vitest";
import {
  columbus52Fixture,
  FIXTURE_TODAY,
  FIXTURES,
  longPasswordFixture,
  unknownsFixture,
  yaleFixture,
} from "./fixtures";
import type { GuideModel } from "./model";
import { validateModel } from "./validate";

const today = FIXTURE_TODAY;
const clone = (m: GuideModel = yaleFixture) => structuredClone(m);
const has = (problems: string[], text: string) =>
  expect(
    problems.some((p) => p.includes(text)),
    `${text} in\n${problems.join("\n")}`,
  ).toBe(true);

/** The fixtures' covers are the board's 744 px crops, which carry no refine record yet. */
const COVER_WIDTH = /portrait crop is \d+ px wide, under 1170 px, with no refine record/;

describe("validateModel on the fixtures", () => {
  it.each(FIXTURES)("$id has no problem but the known soft cover", ({ model }) => {
    const problems = validateModel(model, { today }).filter((p) => !COVER_WIDTH.test(p));
    expect(problems).toEqual([]);
  });

  it("names the soft cover crop until a refine record exists (SPEC 9)", () => {
    has(validateModel(yaleFixture, { today }), "portrait crop is 744 px wide");
    const m = clone();
    if (m.look.cover.kind === "photo")
      m.look.cover.portrait.refined = { method: "sanctioned upscale", checkedAt100: "2026-11-11" };
    expect(validateModel(m, { today })).toEqual([]);
  });
});

describe("validateModel refuses", () => {
  it("a checked date after today, and a newest check older than 60 days", () => {
    const m = clone();
    m.parking = { value: "Driveway.", source: "s", checked: "2026-11-12" };
    has(validateModel(m, { today }), 'parking: checked "2026-11-12" is after today');
    has(validateModel(yaleFixture, { today: "2027-01-20" }), "older than 60 days");
  });

  it("an item past its validThrough, at build time", () => {
    const m = clone();
    const item = m.sections[0]?.items[0];
    if (item) item.validThrough = "2026-11-10";
    has(validateModel(m, { today }), "validThrough 2026-11-10 has passed");
    if (item) item.validThrough = "2026-11-11";
    expect(validateModel(m, { today }).some((p) => p.includes("validThrough"))).toBe(false);
  });

  it("duplicate item keys", () => {
    const m = clone();
    m.sections[0]?.items.push({
      ...(m.sections[0]?.items[0] as GuideModel["sections"][0]["items"][0]),
    });
    has(validateModel(m, { today }), 'duplicate item key "first-hour.heat-and-a-c"');
  });

  it("a quick-find ref that resolves to nothing, and more than 10 rows", () => {
    const m = clone();
    m.look.quickFind = [...(m.look.quickFind ?? []), "house.no-such-row"];
    const p = validateModel(m, { today });
    has(p, 'quickFind: "house.no-such-row" is not an item key');
    has(p, "quickFind: 11 rows, at most 10");
  });

  it("a figure that is not a verbatim substring of its item", () => {
    const m = clone();
    m.look.figures = [{ key: "first-hour.heat-and-a-c", value: "72°F" }];
    has(
      validateModel(m, { today }),
      'figure "72°F" is not in the live text of first-hour.heat-and-a-c',
    );
  });

  it("a plate on rules, checkout or help, or a plate photo not on file", () => {
    const m = clone();
    m.look.plates = { rules: "img/d2-yale-living-1.jpg", house: "img/nope.jpg" };
    const p = validateModel(m, { today });
    has(p, "plates.rules: no plate on rules");
    has(p, 'plates.house: "img/nope.jpg" is not in photos');
  });

  it("a shade darker than 0.35", () => {
    const m = clone();
    if (m.look.cover.kind === "photo") m.look.cover.shade = { from: 0.45, max: 0.5 };
    has(validateModel(m, { today }), "shade max 0.5 is above 0.35");
  });

  it("a field fallback on a window group that does not exist, or on a cover that is not low", () => {
    const m = clone();
    if (m.look.cover.kind === "photo") {
      m.look.cover.layout = "band";
      m.look.cover.fieldOn = ["phone", "watch" as "phone"];
    }
    const p = validateModel(m, { today });
    has(p, 'cover: fieldOn "watch" is not phone, tablet or desktop');
    has(p, "cover: fieldOn is for a low cover, not band");
  });

  it("a cover photo that may not be placed", () => {
    const m = clone(columbus52Fixture);
    if (m.look.cover.kind === "photo") m.look.cover.src = "img/hero-1.jpg";
    has(validateModel(m, { today }), "cover: img/hero-1.jpg may not be placed (AI imagery)");
  });

  it("an empty section", () => {
    const m = clone();
    const s = m.sections[3];
    if (s) s.items = [];
    has(validateModel(m, { today }), "sections.3 (rules): has no rows");
  });

  it("clock wording ({{before}} tokens)", () => {
    const m = clone();
    m.contact.label = "{{before:2026-12-01}}Message us.";
    has(validateModel(m, { today }), "clock token");
  });

  it("an entry code in copy, an em dash and an exclamation mark", () => {
    const m = clone();
    const s = m.sections[0]?.items[0];
    if (s) s.body = `The keypad code is 4821${String.fromCharCode(0x2014)}enjoy!`;
    const p = validateModel(m, { today });
    has(p, "looks like an entry code");
    has(p, "em dash");
    has(p, "exclamation mark");
  });

  it("a phone number where the brand forbids phones", () => {
    const m = clone();
    m.contact.phone = "(555) 010-0100";
    has(validateModel(m, { today, phone: "never" }), "contact.phone: this brand prints no phone");
    expect(
      validateModel(m, { today, phone: "allowed" }).some((p) => p.includes("prints no phone")),
    ).toBe(false);
  });

  it("a forbidden string passed in by the site", () => {
    has(
      validateModel(yaleFixture, { today, forbidden: ["lower-level vents"] }),
      'forbidden string "lower-level vents"',
    );
  });

  it("a held-line target that points at nothing", () => {
    const m = clone();
    m.drafts = [
      {
        at: { kind: "price-cell", table: "Charges", item: "Nope" },
        text: "x",
        why: "w",
        writtenBy: "b",
        writtenOn: "2026-11-11",
      },
      {
        at: { kind: "quick-find", ref: "house.nope", question: "Q?" },
        text: "Q?",
        why: "w",
        writtenBy: "b",
        writtenOn: "2026-11-11",
      },
    ];
    const p = validateModel(m, { today });
    has(p, 'drafts.0: no row "Nope" in table "Charges"');
    has(p, 'drafts.1: "house.nope" is not an item key');
  });

  it("accepts the edge fixtures (long password, unknowns)", () => {
    expect(
      validateModel(longPasswordFixture, { today }).filter((p) => !COVER_WIDTH.test(p)),
    ).toEqual([]);
    expect(validateModel(unknownsFixture, { today }).filter((p) => !COVER_WIDTH.test(p))).toEqual(
      [],
    );
  });
});
