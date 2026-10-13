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
 * Pure: the page that prints it, and that checks the token, belongs to the site.
 */

export interface PressKitInput<A extends Artwork> {
  /** The site's works, already merged with what the studio recorded. */
  works: readonly A[];
  /** The CV typed by hand; the shows' lines are added here. */
  cv: Cv;
  shows: readonly Show[];
  /** The artist's statement, printed verbatim. */
  statement?: string;
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
  work: A;
  /** The highest-resolution image the site serves: `hi` when there is one, else `src`.
      `masterSrc` is never used, because a site keeps its master apart and may not
      serve it at all. */
  image: string;
}

export interface PressKit<A extends Artwork> {
  statement?: string;
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

export function pressKit<A extends Artwork>({
  works,
  cv,
  shows,
  statement,
  now,
  timeZone = DEFAULT_TIME_ZONE,
}: PressKitInput<A>): PressKit<A> {
  const published = works.filter((w) => w.publish === "published");
  return {
    ...(statement?.trim() ? { statement } : {}),
    cv: mergeCv(cv, cvFromShows(shows, now, timeZone)),
    works: published.map((work) => ({ work, image: work.hi ?? work.src })),
    priceList: published.map(priceLine),
  };
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
