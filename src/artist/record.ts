/**
 * The artwork record.
 *
 * One shape, serving both the portfolio a curator reads and the transaction a
 * collector completes. Everything else on an artist's site reads from here, which
 * is why it is built first: a surface cannot render a field the record has no room
 * for.
 *
 * The field list is Carole 06 (title, date, medium, SUBSTRATE, height, width,
 * depth, units, edition, availability) plus what a site needs to sell and ship a
 * piece (catalog id, price with its own visibility, buyer, transaction, shipping).
 * It began as julianpotulicki.com's record, built as one model to serve both his
 * site and PLFA, and is now the model every artist site in the kit shares.
 *
 * Two rules are encoded here rather than in the surfaces:
 *
 * 1. DIMENSIONS ARE NUMBERS, NEVER A SENTENCE. Carole 06 asks for height before
 *    width everywhere. Stored as one free-text string, that ordering survives
 *    exactly as long as whoever types it remembers, and nothing can filter on size
 *    later.
 *
 * 2. AN ABSENT FIELD PRINTS NOTHING. Jake's ruling, 2026-08-09: a site ships
 *    before the metadata is complete, publishes everything, and shows only what
 *    exists. So the formatters below drop a line rather than emitting a blank, a
 *    placeholder, or "dimensions on request" on every work. Surfaces must not
 *    special-case this; they call the formatter and print what comes back.
 *
 * The series belongs to the site: `Artwork<S>` takes the site's own series ids as
 * its type parameter and accepts any string by default.
 */

export type Aspect = "portrait" | "landscape" | "square";

/** Carole 05: sold work must never read as available inventory. A state, not a label. */
export type Availability = "available" | "sold" | "reserved" | "not-for-sale";

/** Carole 05 again: older work stays visible without dominating the current practice. */
export type Lifecycle = "current" | "earlier" | "archived";

/** Julian: "not every page of a notebook dumped online." Draft is the default. */
export type PublishState = "published" | "draft";

export type Unit = "in" | "cm";

export interface Dimensions {
  /** Height first, always. Carole 06. */
  height: number;
  width: number;
  /** Only for work with real depth: a gallery-wrap canvas, a relief, an object. */
  depth?: number;
  unit: Unit;
}

export interface Price {
  amount: number;
  currency: "USD";
  /**
   * Session 05 wants price and its visibility as separate fields so public-price
   * and inquiry-only is a setting rather than a rebuild. Carole 14 leans toward
   * transparency where selling is a goal, but the decision is the artist's and this
   * flag is where the answer lands.
   */
  visibility: "public" | "on-request";
}

export interface Edition {
  number: number;
  of: number;
}

export interface Artwork<S extends string = string> {
  /** Stable public identifier and route segment. */
  slug: string;
  /**
   * Carole 06 and session 06 both want a catalog id: the thing a certificate, an
   * invoice and a shipping record all point at. Independent of the slug, which is
   * a URL and may be rewritten.
   */
  catalogId: string;

  /** Carole 06: title, and it precedes the date everywhere it is printed. */
  title?: string;
  year?: number;

  /**
   * Carole 06: name the materials. "Mixed media" is banned as a catch-all when the
   * actual materials can be stated, so this is a list and the formatter joins it.
   */
  medium?: string[];
  /** Carole 06: never "oil" alone when it is oil on linen. */
  substrate?: string;

  dimensions?: Dimensions;
  edition?: Edition;

  series: S;
  availability?: Availability;
  lifecycle: Lifecycle;
  publish: PublishState;
  price?: Price;

  /** Session 06's fulfillment chain. Absent until a piece actually sells. */
  buyerRef?: string;
  transactionRef?: string;
  shippingStatus?: "pending" | "packed" | "shipped" | "delivered" | "collected";
  certificateRef?: string;

  /** Carole 08: the master is kept separate from the web derivative. */
  masterSrc?: string;
  src: string;
  hi?: string;
  alt: string;
  aspect: Aspect;

  /** A short line in the artist's register, never art-world copy. */
  blurb?: string;
  feature?: boolean;
}

/* ------------------------------------------------------------------ formatting

   Carole 06's display block, exactly:

     Title, Year
     Medium on substrate
     H × W [× D] unit

   Each line is independent. A record with a title and nothing else prints one
   line, not three with two blanks. */

/** "Untitled" is the honest label for an untitled work; it is not a missing title. */
export function formatTitleLine(w: Artwork): string {
  const title = w.title?.trim() || "Untitled";
  return w.year ? `${title}, ${w.year}` : title;
}

/** "Oil and graphite on linen". Empty when we know neither material nor substrate. */
export function formatMediumLine(w: Artwork): string {
  const media = (w.medium ?? []).map((m) => m.trim()).filter(Boolean);
  const list =
    media.length > 1 ? `${media.slice(0, -1).join(", ")} and ${media[media.length - 1]}` : media[0];
  if (list && w.substrate) return `${list} on ${w.substrate}`;
  if (list) return list;
  if (w.substrate) return w.substrate;
  return "";
}

/** "36 × 24 in" or "36 × 24 × 2 in". Height first. Empty when unmeasured. */
export function formatDimensionsLine(w: Artwork): string {
  const d = w.dimensions;
  if (!d) return "";
  const n = (v: number) => (Number.isInteger(v) ? String(v) : String(v));
  const parts = [n(d.height), n(d.width)];
  if (d.depth !== undefined) parts.push(n(d.depth));
  return `${parts.join(" × ")} ${d.unit}`;
}

/** The whole block, absent lines dropped. Surfaces render this and nothing else. */
export function formatLabel(w: Artwork): string[] {
  return [formatTitleLine(w), formatMediumLine(w), formatDimensionsLine(w)].filter(
    (line) => line.length > 0,
  );
}

/** Carole 06: "Edition 2 of 10", only where editions exist. */
export function formatEdition(w: Artwork): string {
  return w.edition ? `Edition ${w.edition.number} of ${w.edition.of}` : "";
}

/**
 * What a visitor is told about getting the piece. Carole 05 is the constraint:
 * sold work must never read as available inventory, so a sold piece says sold
 * plainly rather than falling through to an inquiry prompt.
 */
export function formatAvailability(w: Artwork): string {
  switch (w.availability) {
    case "sold":
      return "Sold";
    case "reserved":
      return "Reserved";
    case "not-for-sale":
      return "Not for sale";
    case "available":
      return w.price?.visibility === "public" && w.price
        ? `$${w.price.amount.toLocaleString("en-US")}`
        : "Price on request";
    default:
      // Availability unrecorded. Say nothing rather than imply it can be bought.
      return "";
  }
}

/** Only a published, available work may be offered for sale on the site. */
export function isPurchasable(w: Artwork): boolean {
  return w.publish === "published" && w.availability === "available";
}

/**
 * Carole 15 asks whether every published work carries complete metadata. This
 * reports the gaps rather than hiding them, so the studio can show the artist
 * exactly what a record is missing.
 */
export function missingFields(w: Artwork): string[] {
  const gaps: string[] = [];
  if (!w.title) gaps.push("title");
  if (!w.year) gaps.push("year");
  if (!w.medium?.length) gaps.push("medium");
  if (!w.substrate) gaps.push("substrate");
  if (!w.dimensions) gaps.push("dimensions");
  if (!w.availability) gaps.push("availability");
  return gaps;
}

export function isFullyDocumented(w: Artwork): boolean {
  return missingFields(w).length === 0;
}

/**
 * Provisional catalog numbers, assigned by sorted slug so the mapping is stable
 * regardless of the order a site lists its works in: prefix "JP-" gives "JP-0001".
 * The studio takes over issuance; a number that has been printed on a certificate
 * must never be reassigned.
 */
export function catalogIds(slugs: readonly string[], prefix: string): Map<string, string> {
  return new Map(
    [...slugs]
      .sort()
      .map((slug, i): [string, string] => [slug, `${prefix}${String(i + 1).padStart(4, "0")}`]),
  );
}
