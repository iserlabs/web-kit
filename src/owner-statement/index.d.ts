/** `owner-statement/1`: one statement model per owner per month. All money is integer cents. */

export type StatementBrand = "sun-mountain" | "palisade" | "columbus" | "xenia";
export type MoveDirection = "to_owner" | "from_owner" | "to_partner" | "none";
export type SummaryRole =
  | "in"
  | "cost"
  | "fee"
  | "set_aside"
  | "subtotal"
  | "moves"
  | "balance"
  | "share";
export type ColumnKind = "text" | "money" | "int";

export interface StatementMoves {
  direction: MoveDirection;
  /** Always the size of the move, never negative. */
  cents: number;
  /** Small-caps label over the big number. */
  headline: string;
  /** The words under the big number. */
  line: string;
  method: string | null;
  /** ISO date, or null while it is not set. */
  date: string | null;
  /** Required when `date` is null and the direction is not "none". */
  dateUnknown: string | null;
  /** The first line of the email. */
  sentence: string;
}

export interface SummaryRow {
  label: string;
  role: SummaryRole;
  /** Signed: money out of the owner's side is negative. */
  month: number;
  /** Null when year to date is unknown. */
  ytd: number | null;
}

/** One foot: the rows of these roles (above the target) add up to the last row of the target role. */
export type SummaryFoot = [SummaryRole[], SummaryRole];

export interface StatementSummary {
  title: string;
  columns: { month: string; ytd: string };
  ytd: { known: boolean; reason: string | null; from: string | null };
  rows: SummaryRow[];
  /** One foot, or a list of feet. Optional. */
  foot?: SummaryFoot | SummaryFoot[];
}

export interface GroupColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

export interface DetailLine {
  label: string;
  cents: number;
  strong?: boolean;
}

export interface GroupRow {
  ref: string;
  cells: Record<string, string | number>;
  /** The opened row: gross-to-net lines. Optional. */
  detail?: DetailLine[];
  /** A short line under the row (for example a stay still running at close). Optional. */
  note?: string;
}

export interface StatementGroup {
  title: string;
  property: string;
  columns: GroupColumn[];
  rows: GroupRow[];
  subtotal: { label: string; cells: Record<string, number> };
  /** A charge that repeats on every row, shown once. */
  note?: string | null;
}

export interface CostRow {
  ref: string;
  label: string;
  payee?: string | null;
  number?: string | null;
  /** ISO date of the invoice or payment. */
  date: string | null;
  note?: string | null;
  cents: number;
  href: string | null;
}

export interface StatementCosts {
  title: string;
  rows: CostRow[];
  /** Optional. When present it must equal the sum of the rows. */
  subtotal?: { label: string; cents: number };
}

export interface SettlementRow {
  ref: string;
  label: string;
  cents: number;
  role: "balance" | null;
}

export interface StatementSettlement {
  title: string;
  rows: SettlementRow[];
}

export interface EmailSummaryRow {
  label: string;
  month?: number | null;
  last?: number | null;
  /** Percent rows (occupancy) use `pct` and `lastPct` in place of `month` and `last`. */
  pct?: number | null;
  lastPct?: number | null;
}

export interface StatementModel {
  schema: "owner-statement/1";
  brand: StatementBrand;
  /** The sender's name, printed in the masthead. The only business name that reaches the HTML. */
  business: string;
  month: string;
  monthLabel: string;
  monthShort: string;
  status: "final";
  owner: { key: string; name: string; greeting: string };
  property: { label: string; line: string };
  prepared: { by: string; date: string };
  moves: StatementMoves;
  summary: StatementSummary;
  groups: StatementGroup[];
  costs: StatementCosts | null;
  settlement: StatementSettlement | null;
  attention: string[];
  stats: {
    stays: number;
    nights: number;
    occupancyPct: number | null;
    last: { monthLabel: string; stays: number; nights: number; occupancyPct: number | null } | null;
  };
  sources: { label: string; file: string | null; href: string | null }[];
  email: {
    subject: string;
    summary: EmailSummaryRow[];
    button: string;
    password: string;
  };
  links: { page: string; pdf: string };
  /** The call-booking page, for example https://jakejjlee.com/meet */
  calls: string;
}

export interface StatementLogo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface FontStacks {
  display?: string;
  text?: string;
  figures?: string;
}

export interface RenderOptions {
  logo: StatementLogo;
  /** Where the Download PDF button points. No button when absent. */
  pdfHref?: string;
  /** Override the font-family stacks. Default stacks read the site's own font variables. */
  fonts?: FontStacks;
}

export interface RenderedStatement {
  /** One root element, class `os`. Everything inside is escaped. */
  html: string;
  /** Screen and print CSS, every rule under `.os`. */
  css: string;
  /** For the document `<title>`. */
  title: string;
  /** A Google Fonts stylesheet URL for the brand's faces, for a standalone file. */
  fontsHref: string;
}

export interface BrandTokens {
  display: string;
  text: string;
  figures: string;
  paper: string;
  ground: string;
  ink: string;
  soft: string;
  accent: string;
  gold: string;
  rule: string;
  tint: string;
  /** Palisade keeps a gold stripe down the left edge of the sheet. */
  stripe: string | null;
  /** Height of the masthead logo in CSS pixels. */
  logoHeight: number;
  fontsHref: string;
}

export const BRANDS: Record<StatementBrand, BrandTokens>;

export function validate(model: unknown): string[];
export function formatCents(cents: number, opts?: { parens?: boolean }): string;
export function renderStatement(model: StatementModel, options: RenderOptions): RenderedStatement;
export const STATEMENT_SCHEMA: "owner-statement/1";
export const BANNED_WORDS: readonly string[];
