import { describe, expect, it } from "vitest";
import {
  defaultSelection,
  groupStatements,
  nextTabIndex,
  parseSelection,
  portalTotals,
  validateModel,
} from "./index";
import type { OwnerPortalModel, StatementEntry } from "./types";

const entry = (over: Partial<StatementEntry>): StatementEntry => ({
  year: 2026,
  month: 9,
  label: "September 2026",
  status: "final",
  href: "/s",
  ...over,
});

const model = (
  statements: StatementEntry[],
  over: Partial<OwnerPortalModel> = {},
): OwnerPortalModel => ({
  owner: "Test Owner",
  brand: "Test Brand",
  properties: ["A", "B"],
  from: { year: 2026, month: 9 },
  through: { year: 2026, month: 10 },
  statements,
  ...over,
});

describe("groupStatements", () => {
  it("lists every month from..through, newest first, in year groups", () => {
    const g = groupStatements(
      model([entry({}), entry({ month: 10, label: "October 2026", status: "draft" })]),
    );
    expect(g).toHaveLength(1);
    expect(g[0]?.year).toBe(2026);
    expect(g[0]?.months.map((m) => m.month)).toEqual([10, 9]);
    expect(g[0]?.months[0]?.label).toBe("October 2026");
    expect(g[0]?.months[0]?.entries[0]?.status).toBe("draft");
  });

  it("spans a year boundary with newest year first", () => {
    const g = groupStatements(
      model([], { from: { year: 2026, month: 11 }, through: { year: 2027, month: 2 } }),
    );
    expect(g.map((y) => y.year)).toEqual([2027, 2026]);
    expect(g[0]?.months.map((m) => m.month)).toEqual([2, 1]);
    expect(g[1]?.months.map((m) => m.month)).toEqual([12, 11]);
  });

  it("keeps empty months with entries: []", () => {
    const g = groupStatements(model([entry({})]));
    const oct = g[0]?.months.find((m) => m.month === 10);
    expect(oct?.entries).toEqual([]);
  });

  it("drops statements outside the range (months before the start are not shown)", () => {
    const g = groupStatements(model([entry({ month: 8, label: "August 2026" }), entry({})]));
    expect(g[0]?.months.map((m) => m.month)).toEqual([10, 9]);
    expect(g[0]?.months.flatMap((m) => m.entries)).toHaveLength(1);
  });

  it("orders several statements in a month by the properties list", () => {
    const g = groupStatements(
      model([
        entry({ property: "B", label: "September 2026, B" }),
        entry({ property: "A", label: "September 2026, A" }),
      ]),
    );
    const sep = g[0]?.months.find((m) => m.month === 9);
    expect(sep?.entries.map((e) => e.property)).toEqual(["A", "B"]);
  });

  it("returns nothing when through is before from", () => {
    expect(groupStatements(model([], { through: { year: 2026, month: 8 } }))).toEqual([]);
  });
});

describe("portalTotals", () => {
  it("sums in whole cents and keeps final and draft apart", () => {
    const t = portalTotals([
      entry({ bookedRevenue: 0.1, managementFee: 0.01, toOwner: 0.09 }),
      entry({ bookedRevenue: 0.2, managementFee: 0.02, toOwner: 0.18 }),
      entry({ status: "draft", bookedRevenue: 1000.15, managementFee: 150.02, toOwner: 850.13 }),
    ]);
    expect(t.final).toEqual({ bookedRevenue: 0.3, managementFee: 0.03, toOwner: 0.27, count: 2 });
    expect(t.draft).toEqual({
      bookedRevenue: 1000.15,
      managementFee: 150.02,
      toOwner: 850.13,
      count: 1,
    });
  });

  it("does not drift on classic float cases", () => {
    const rows = Array.from({ length: 10 }, () => entry({ toOwner: 0.1 }));
    expect(portalTotals(rows).final.toOwner).toBe(1);
  });

  it("ignores waiting entries and treats missing figures as zero", () => {
    const t = portalTotals([entry({ status: "waiting", href: undefined, toOwner: 99 }), entry({})]);
    expect(t.final).toEqual({ bookedRevenue: 0, managementFee: 0, toOwner: 0, count: 1 });
    expect(t.draft.count).toBe(0);
  });

  it("carries negative owner balances", () => {
    const t = portalTotals([entry({ toOwner: -120.5 }), entry({ toOwner: 20.25 })]);
    expect(t.final.toOwner).toBe(-100.25);
  });
});

describe("selection helpers", () => {
  const groups = groupStatements(model([entry({})]));
  it("defaults to the newest month that has a statement", () => {
    expect(defaultSelection(groups)).toEqual({ year: 2026, month: 9 });
  });
  it("defaults to the newest month when nothing has a statement", () => {
    expect(defaultSelection(groupStatements(model([])))).toEqual({ year: 2026, month: 10 });
  });
  it("parses a valid deep link and rejects out-of-range ones", () => {
    expect(parseSelection("?year=2026&month=10", groups)).toEqual({ year: 2026, month: 10 });
    expect(parseSelection("?year=2026&month=8", groups)).toBeNull();
    expect(parseSelection("?year=abc&month=9", groups)).toBeNull();
    expect(parseSelection("", groups)).toBeNull();
  });
});

describe("nextTabIndex", () => {
  it("wraps arrows, jumps with Home/End, ignores other keys", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
    expect(nextTabIndex("a", 0, 3)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("validateModel", () => {
  it("flags a final or draft statement with no href, and out-of-range months", () => {
    const problems = validateModel(
      model([
        entry({ href: undefined }),
        entry({ month: 8 }),
        entry({ status: "waiting", href: undefined, month: 10 }),
      ]),
    );
    expect(problems.some((p) => p.includes("needs its href"))).toBe(true);
    expect(problems.some((p) => p.includes("outside"))).toBe(true);
    expect(problems).toHaveLength(2);
  });
  it("passes a sound model", () => {
    expect(validateModel(model([entry({})]))).toEqual([]);
  });
});
