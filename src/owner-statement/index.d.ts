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
  /** Optional short name for the link preview (og:site_name, the card's mark alt); the sign-off keeps `business`. */
  businessShort?: string;
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
  /** Size of figures against the body text (1 = the same size). Kept at 0.93 or more so no figure drops under 13px. */
  figureScale: number;
  /** Width of one printed figure character, in em of the figures' own face. Sizes the money columns. */
  figureAdvance: number;
  /** Height of the masthead logo in CSS pixels. */
  logoHeight: number;
  /** Use tabular figures. Off where the face's tabular digits look mechanical. */
  tabular: boolean;
  fontsHref: string;
  /** The link preview card (option 1, photo and seal). */
  card: ShareCardTokens;
}

/** The link preview card's per-brand tokens (option 1, photo and seal). */
export interface ShareCardTokens {
  /** Scrim and ground color as an "r,g,b" triple. */
  scrim: string;
  /** Darkest scrim alpha, at the bottom edge. */
  scrimMax: number;
  /** The light ink printed over the photo. */
  light: string;
  /** The accent for the "Owner statement" line. */
  accent: string;
  monthFont: string;
  monthWeight: number;
  monthSize: number;
  subFont: string;
  subWeight: number;
  subSize: number;
  subUpper: boolean;
  labelFont: string;
  seal: {
    radius: number;
    ground: string | null;
    ring: string | null;
    mark: { width: number; height: number };
  };
}

/** One node of a share card: a plain tree a Next.js route turns into elements for `next/og`. */
export interface ShareCardTree {
  tag: string;
  style: Record<string, string | number>;
  children: (ShareCardTree | string)[];
  src?: string;
  alt?: string;
  /** What the node is (photo, scrim, stripe, seal, mark, text, month, label, sub, no-photo). */
  role?: string;
}

export interface StatementShareOptions {
  /** "{city, state}" as the brand writes it, for example "Englewood, New Jersey". */
  place: string;
  /** The street, required when the property is the brand itself (the hotel). */
  street?: string;
  /** The card's public address; when given, `image` comes back ready for page metadata. */
  imageUrl?: string;
}

export interface StatementShareMeta {
  /** "{Month YYYY} owner statement · {property}" */
  title: string;
  /** "{brand} · {city, state}", or "{street} · {city, state}" when the property is the brand. */
  description: string;
  siteName: string;
  imageAlt: string;
  imageWidth: 1200;
  imageHeight: 630;
  image?: { url: string; width: 1200; height: 630; alt: string };
}

export interface StatementShareCardOptions {
  /** The owner's home photo, an absolute address or data URI. Missing renders "No photo supplied". */
  photoUrl?: string;
  /** The brand's mark for the seal. Missing renders "No mark supplied". */
  markUrl?: string;
  /** Required when the property is the brand: it fills the address slot. */
  place?: string;
  /** Places the photo at an explicit size and offset; otherwise it covers the card. */
  photoCrop?: { width: number; height: number; left?: number; top?: number };
  /** Family names the route loaded the faces under, when they differ from the brand tokens. */
  fonts?: { display?: string; text?: string };
}

export const BRANDS: Record<StatementBrand, BrandTokens>;

export const SHARE_CARD_SIZE: { width: 1200; height: 630 };
/** The center box (x 315 to 885) every word and the seal stay inside, so square crops keep them. */
export const SHARE_CARD_SAFE: { left: 315; width: 570 };

/**
 * The link preview tags for a statement page. Never carries a figure, the owner's name or a stay
 * count; throws when the model does not validate or a handed-in string would carry money or the
 * owner's name.
 */
export function statementShareMeta(
  model: StatementModel,
  options: StatementShareOptions,
): StatementShareMeta;

/** The option-1 share card (photo and seal) for one statement, as a Satori-safe tree. */
export function renderStatementShareCard(
  model: StatementModel,
  options?: StatementShareCardOptions,
): ShareCardTree;

export function validate(model: unknown): string[];
export function formatCents(cents: number, opts?: { parens?: boolean }): string;
export function renderStatement(model: StatementModel, options: RenderOptions): RenderedStatement;
export const STATEMENT_SCHEMA: "owner-statement/1";
export const BANNED_WORDS: readonly string[];
