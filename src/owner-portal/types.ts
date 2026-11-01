export type StatementStatus = "final" | "draft" | "waiting";

export type StatementEntry = {
  year: number;
  /** 1 to 12. */
  month: number;
  /** e.g. "September 2026" or "September 2026, Aspen Glen". */
  label: string;
  /** Set when an owner has several statements in one month. */
  property?: string;
  status: StatementStatus;
  /** The real statement URL. Required unless status is "waiting". */
  href?: string;
  /** Dollars, read from the statement itself, never recomputed. */
  bookedRevenue?: number;
  managementFee?: number;
  toOwner?: number;
  /** e.g. "To you", "You owe Sun Mountain", "Earned (Airbnb paid you directly)". */
  toOwnerLabel?: string;
  /** What a draft or waiting month is waiting on. */
  note?: string;
};

export type YearMonth = { year: number; month: number };

/** Optional wording overrides. Anything left out keeps the default. */
export type StatementLabels = {
  /** Default "Booked revenue". */
  bookedRevenue?: string;
  /** Default "Management fee". */
  managementFee?: string;
  /** Default "To you". An entry's own `toOwnerLabel` still wins. */
  toOwner?: string;
  /** Default "There is no statement for {monthLabel}." */
  emptyMonth?: (monthLabel: string) => string;
};

export type OwnerPortalModel = {
  owner: string;
  brand: string;
  properties: string[];
  from: YearMonth;
  through: YearMonth;
  statements: StatementEntry[];
  /**
   * Why a month has no statement, keyed "YYYY-MM" (e.g. "2026-09": "No statement: operations
   * began September 28, 2026."). Shown instead of the default empty-month sentence.
   */
  emptyMonthNotes?: Record<string, string>;
};

export type MonthGroup = {
  month: number;
  label: string;
  entries: StatementEntry[];
};

export type YearGroup = { year: number; months: MonthGroup[] };

export type Totals = {
  bookedRevenue: number;
  managementFee: number;
  toOwner: number;
  count: number;
};
