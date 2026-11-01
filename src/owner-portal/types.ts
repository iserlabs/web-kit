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

export type OwnerPortalModel = {
  owner: string;
  brand: string;
  properties: string[];
  from: YearMonth;
  through: YearMonth;
  statements: StatementEntry[];
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
