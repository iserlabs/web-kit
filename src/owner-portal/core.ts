import type {
  MonthGroup,
  OwnerPortalModel,
  StatementEntry,
  Totals,
  YearGroup,
  YearMonth,
} from "./types";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

const index = (ym: YearMonth) => ym.year * 12 + (ym.month - 1);

/**
 * Every month from `from` through `through` (inclusive), grouped by year, newest first.
 * A month with no statement is present with `entries: []`. Statements outside the range
 * are not shown. Entries inside a month keep the order of `properties`, then input order.
 */
export function groupStatements(m: OwnerPortalModel): YearGroup[] {
  const start = index(m.from);
  const end = index(m.through);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const rank = (e: StatementEntry) => {
    const i = e.property ? m.properties.indexOf(e.property) : -1;
    return i === -1 ? m.properties.length : i;
  };
  const byYear = new Map<number, MonthGroup[]>();
  for (let i = end; i >= start; i--) {
    const year = Math.floor(i / 12);
    const month = (i % 12) + 1;
    const entries = m.statements
      .map((e, order) => ({ e, order }))
      .filter(({ e }) => e.year === year && e.month === month)
      .sort((a, b) => rank(a.e) - rank(b.e) || a.order - b.order)
      .map(({ e }) => e);
    const list = byYear.get(year) ?? [];
    list.push({ month, label: `${monthName(month)} ${year}`, entries });
    byYear.set(year, list);
  }
  return [...byYear.entries()].map(([year, months]) => ({ year, months }));
}

const cents = (n: number | undefined) => (typeof n === "number" ? Math.round(n * 100) : 0);

/**
 * Sums of the figures printed on the statements, final and draft kept apart. Waiting
 * entries carry no counted figures. Adds in whole cents so 0.1 + 0.2 stays 0.30.
 */
export function portalTotals(entries: StatementEntry[]): { final: Totals; draft: Totals } {
  const acc = {
    final: { r: 0, f: 0, o: 0, count: 0 },
    draft: { r: 0, f: 0, o: 0, count: 0 },
  };
  for (const e of entries) {
    if (e.status !== "final" && e.status !== "draft") continue;
    const a = acc[e.status];
    a.r += cents(e.bookedRevenue);
    a.f += cents(e.managementFee);
    a.o += cents(e.toOwner);
    a.count += 1;
  }
  const out = (a: { r: number; f: number; o: number; count: number }): Totals => ({
    bookedRevenue: a.r / 100,
    managementFee: a.f / 100,
    toOwner: a.o / 100,
    count: a.count,
  });
  return { final: out(acc.final), draft: out(acc.draft) };
}

/** Plain-words problems with a model; empty means it is sound. A final or draft entry needs an href. */
export function validateModel(m: OwnerPortalModel): string[] {
  const problems: string[] = [];
  const start = index(m.from);
  const end = index(m.through);
  if (end < start) problems.push("through is before from");
  m.statements.forEach((e, i) => {
    const where = `statement ${i + 1} (${e.label})`;
    if (!Number.isInteger(e.month) || e.month < 1 || e.month > 12)
      problems.push(`${where}: month must be 1 to 12`);
    if (e.status !== "waiting" && !e.href)
      problems.push(`${where}: a ${e.status} statement needs its href`);
    const at = e.year * 12 + (e.month - 1);
    if (at < start || at > end) problems.push(`${where}: outside the from/through range`);
  });
  return problems;
}

export function formatDollars(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/**
 * Roving-tabindex keyboard rule for a horizontal tab list. Returns the index to move to,
 * or null when the key is not a tab-navigation key. Arrow keys wrap.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Parse ?year=&month= against the groups; null unless that month exists in range. */
export function parseSelection(search: string, groups: YearGroup[]): YearMonth | null {
  const p = new URLSearchParams(search);
  const year = Number(p.get("year"));
  const month = Number(p.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  const g = groups.find((x) => x.year === year);
  return g?.months.some((x) => x.month === month) ? { year, month } : null;
}

/** The month shown first: the newest month that has a statement, else the newest month. */
export function defaultSelection(groups: YearGroup[]): YearMonth | null {
  for (const g of groups)
    for (const mo of g.months) if (mo.entries.length) return { year: g.year, month: mo.month };
  const g = groups[0];
  const mo = g?.months[0];
  return g && mo ? { year: g.year, month: mo.month } : null;
}

/** The statuses shown on a month tab, as words. */
export function monthStatusWord(entries: StatementEntry[]): string {
  if (entries.length === 0) return "None";
  const has = (s: string) => entries.some((e) => e.status === s);
  if (has("draft")) return "Draft";
  if (has("waiting")) return "Waiting";
  return "Final";
}
