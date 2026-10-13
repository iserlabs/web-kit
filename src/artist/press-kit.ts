import { forDisplay } from "./availability";
import { b64url, safeEqual } from "./bytes";
import { type Cv, cvFromShows, mergeCv } from "./cv";
import { type Artwork, formatTitleLine, type Price } from "./record";
import { DEFAULT_TIME_ZONE, type Show } from "./shows";

/**
 * The press kit: what a gallerist is sent, at an unlisted address the artist can
 * retire at any time.
 *
 * It assembles the statement, the CV (shows included), every published work's full
 * record with the best image the site serves, and a price list. The price list
 * carries "on request" prices too (Jake's ruling, 2026-10-12): a gallery needs real
 * numbers to plan a show, and Carole's rule still holds, one price everywhere, only
 * who sees it differs. A work that cannot be had (sold, reserved, not for sale, or
 * never recorded) is listed without a price.
 *
 * Works come in the order a visitor meets them (`forDisplay`): current work first,
 * then earlier, then archived, and within each the available pieces first. Ordering,
 * not exclusion, so a gallerist sees the whole published record, archive included,
 * with the current practice leading. The price list follows the same order, entry
 * for entry.
 *
 * Pure: the page that prints it, and that checks the token, belongs to the site.
 */

export interface PressKitInput<A extends Artwork> {
  /** The site's works, already merged with what the studio recorded. */
  works: readonly A[];
  /** The CV typed by hand; the shows' lines are added here. */
  cv: Cv;
  shows: readonly Show[];
  /** The artist's statement, printed verbatim: one string, or its paragraphs in order. */
  statement?: string | readonly string[];
  now: Date;
  timeZone?: string;
}

export type PriceListStatus = "available" | "sold" | "reserved" | "not-for-sale" | "unstated";

export interface PriceListEntry {
  slug: string;
  catalogId: string;
  /** "Title, Year", the label's own first line. */
  title: string;
  status: PriceListStatus;
  /** Only for an available work with a recorded price, public or on request. */
  price?: Price;
}

export interface PressKitWork<A extends Artwork> {
  /** The work's record without its master file, and without a price unless the work
      is available, the same rule the price list follows. */
  work: Omit<A, "masterSrc">;
  /** The highest-resolution image the site serves: `hi` when there is one, else `src`.
      `masterSrc` is never used, because a site keeps its master apart and may not
      serve it at all. */
  image: string;
}

export interface PressKit<A extends Artwork> {
  /** The statement's paragraphs, verbatim, blank ones dropped. Absent when there is none. */
  statement?: string[];
  cv: Cv;
  works: PressKitWork<A>[];
  priceList: PriceListEntry[];
}

function priceLine(w: Artwork): PriceListEntry {
  const status: PriceListStatus = w.availability ?? "unstated";
  return {
    slug: w.slug,
    catalogId: w.catalogId,
    title: formatTitleLine(w),
    status,
    ...(status === "available" && w.price ? { price: w.price } : {}),
  };
}

/** The record a gallerist sees: no master file ever, and a price only where the work
    can still be had. */
function publicRecord<A extends Artwork>(w: A): Omit<A, "masterSrc"> {
  const { masterSrc: _master, price, ...rest } = w;
  const keepsPrice = w.availability === "available" && price;
  return (keepsPrice ? { ...rest, price } : rest) as Omit<A, "masterSrc">;
}

export function pressKit<A extends Artwork>({
  works,
  cv,
  shows,
  statement,
  now,
  timeZone = DEFAULT_TIME_ZONE,
}: PressKitInput<A>): PressKit<A> {
  const published = forDisplay(works.filter((w) => w.publish === "published"));
  const given: readonly string[] = typeof statement === "string" ? [statement] : (statement ?? []);
  const paragraphs = given.filter((p) => p.trim() !== "");
  return {
    ...(paragraphs.length > 0 ? { statement: paragraphs } : {}),
    cv: mergeCv(cv, cvFromShows(shows, now, timeZone)),
    works: published.map((work) => ({ work: publicRecord(work), image: work.hi ?? work.src })),
    priceList: published.map(priceLine),
  };
}

/** One price list line in plain words. An available work prints its price, public or
    on request; one with no recorded price says so, rather than leave a blank that
    reads like a mistake. */
export function formatPriceLine(entry: PriceListEntry): string {
  switch (entry.status) {
    case "available": {
      if (!entry.price) return "Available, not priced yet";
      const amount = `$${entry.price.amount.toLocaleString("en-US")}`;
      return entry.price.visibility === "on-request" ? `${amount} · on request` : amount;
    }
    case "sold":
      return "Sold";
    case "reserved":
      return "Reserved";
    case "not-for-sale":
      return "Not for sale";
    default:
      return "Availability not recorded yet";
  }
}

/* ------------------------------------------------------------------ the token */

const TOKEN_BYTES = 32;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** A new press token: 256 random bits as 43 URL-safe characters. Setting a new one
    retires the old link at once. */
export function generatePressToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

/** Whether a value has the exact shape generatePressToken makes. */
export function isPressToken(v: unknown): v is string {
  return typeof v === "string" && TOKEN.test(v);
}

/** Whether a press address's token is the current one. Both sides are checked for
    shape first, so the constant-time comparison only ever sees equal lengths, and an
    unset token opens nothing. */
export function pressTokenMatches(
  candidate: string | null | undefined,
  current: string | null | undefined,
): boolean {
  if (!isPressToken(candidate) || !isPressToken(current)) return false;
  return safeEqual(candidate, current);
}
