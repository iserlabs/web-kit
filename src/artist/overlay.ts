import type { Artwork, Availability, Lifecycle, PublishState, Unit } from "./record";

/**
 * What the studio may record about a work, and the one function that decides what
 * survives from a submitted form.
 *
 * Every field is validated here rather than trusted from the form, because the
 * form is not the only thing that can call a studio route. A pure function, so
 * every artist site validates edits identically and the rules are tested once.
 */

/** The fields the studio may set. Deliberately a subset: slug, series, image and alt
    text stay with the repo, because they decide what the work IS rather than what we
    know about it. */
export type ArtworkOverlay = Partial<
  Pick<
    Artwork,
    | "title"
    | "year"
    | "medium"
    | "substrate"
    | "dimensions"
    | "edition"
    | "availability"
    | "lifecycle"
    | "publish"
    | "price"
    | "certificateRef"
    | "blurb"
  >
> & { updatedAt?: string; updatedBy?: string };

/** The one list of allowed values. cleanOverlay (a submitted form) and
    sanitizeStoredOverlay (what was stored) both read these, so they cannot drift. */
export const AVAILABILITY = new Set<Availability>([
  "available",
  "sold",
  "reserved",
  "not-for-sale",
]);
export const LIFECYCLE = new Set<Lifecycle>(["current", "earlier", "archived"]);
export const PUBLISH = new Set<PublishState>(["published", "draft"]);
export const UNITS = new Set<Unit>(["in", "cm"]);
type PriceVisibility = NonNullable<Artwork["price"]>["visibility"];
export const PRICE_VISIBILITY = new Set<PriceVisibility>(["public", "on-request"]);
export const PRICE_CURRENCY = "USD";

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Trimmed text cut to `max` characters, or undefined when there is none. */
export function cleanText(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

/** Only the fields the studio owns survive this. Anything else is dropped silently. */
export function cleanOverlay(body: Record<string, unknown>): ArtworkOverlay {
  const out: ArtworkOverlay = {};

  const title = cleanText(body.title);
  if (title !== undefined) out.title = title;

  const year = num(body.year);
  if (year !== undefined && year >= 1900 && year <= 2100) out.year = Math.trunc(year);

  if (Array.isArray(body.medium)) {
    const media = body.medium.map((m) => cleanText(m, 60)).filter((m): m is string => Boolean(m));
    if (media.length) out.medium = media.slice(0, 8);
  } else {
    const medium = cleanText(body.medium, 200);
    // Carole 06 bans a single "mixed media" blob, so a typed string is split into
    // the materials it names rather than stored as one opaque phrase.
    if (medium)
      out.medium = medium
        .split(/,| and /i)
        .map((m) => m.trim())
        .filter(Boolean)
        .slice(0, 8);
  }

  const substrate = cleanText(body.substrate, 60);
  if (substrate !== undefined) out.substrate = substrate;

  const height = num(body.height);
  const width = num(body.width);
  const depth = num(body.depth);
  const unit =
    typeof body.unit === "string" && UNITS.has(body.unit as Unit) ? (body.unit as Unit) : "in";
  // Height and width travel together or not at all: half a measurement is worse
  // than none, because it prints as a complete-looking line.
  if (height !== undefined && width !== undefined) {
    out.dimensions = { height, width, unit, ...(depth !== undefined ? { depth } : {}) };
  }

  if (
    typeof body.availability === "string" &&
    AVAILABILITY.has(body.availability as Availability)
  ) {
    out.availability = body.availability as Availability;
  }
  if (typeof body.lifecycle === "string" && LIFECYCLE.has(body.lifecycle as Lifecycle)) {
    out.lifecycle = body.lifecycle as Lifecycle;
  }
  if (typeof body.publish === "string" && PUBLISH.has(body.publish as PublishState)) {
    out.publish = body.publish as PublishState;
  }

  const amount = num(body.priceAmount);
  if (amount !== undefined) {
    out.price = {
      amount,
      currency: PRICE_CURRENCY,
      visibility: PRICE_VISIBILITY.has(body.priceVisibility as PriceVisibility)
        ? (body.priceVisibility as PriceVisibility)
        : "on-request",
    };
  }

  const blurb = cleanText(body.blurb, 400);
  if (blurb !== undefined) out.blurb = blurb;

  return out;
}

const posNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isIn = <T>(set: Set<T>, v: unknown): v is T => set.has(v as T);

/**
 * Whatever is stored may be wrongly shaped (hand-edited, an older version, another
 * writer). Keeps only the ArtworkOverlay keys, each only when its value is valid, so
 * junk can neither reach the page nor be written back on the next save. Valid data
 * passes through unchanged, in the stored key order, so re-saving never reshuffles it.
 */
export function sanitizeStoredOverlay(raw: unknown): ArtworkOverlay {
  const out: Record<string, unknown> = {};
  if (!isObj(raw)) return out as ArtworkOverlay;
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    switch (k) {
      case "title":
      case "substrate":
      case "certificateRef":
      case "blurb":
      case "updatedAt":
      case "updatedBy":
        if (isStr(v)) out[k] = v;
        break;
      case "year":
        if (typeof v === "number" && Number.isFinite(v)) out.year = v;
        break;
      case "medium":
        if (Array.isArray(v) && v.every(isStr)) out.medium = v;
        break;
      case "dimensions":
        if (isObj(v) && posNum(v.height) && posNum(v.width) && isIn(UNITS, v.unit)) {
          const dims: Record<string, unknown> = {};
          for (const dk of Object.keys(v)) {
            if (dk === "height" || dk === "width" || dk === "unit") dims[dk] = v[dk];
            else if (dk === "depth" && posNum(v.depth)) dims.depth = v.depth;
          }
          out.dimensions = dims;
        }
        break;
      case "edition":
        if (isObj(v) && posNum(v.number) && posNum(v.of)) {
          const ed: Record<string, unknown> = {};
          for (const ek of Object.keys(v)) if (ek === "number" || ek === "of") ed[ek] = v[ek];
          out.edition = ed;
        }
        break;
      case "price":
        if (
          isObj(v) &&
          posNum(v.amount) &&
          v.currency === PRICE_CURRENCY &&
          isIn(PRICE_VISIBILITY, v.visibility)
        ) {
          const pr: Record<string, unknown> = {};
          for (const pk of Object.keys(v))
            if (pk === "amount" || pk === "currency" || pk === "visibility") pr[pk] = v[pk];
          out.price = pr;
        }
        break;
      case "availability":
        if (isIn(AVAILABILITY, v)) out.availability = v;
        break;
      case "lifecycle":
        if (isIn(LIFECYCLE, v)) out.lifecycle = v;
        break;
      case "publish":
        if (isIn(PUBLISH, v)) out.publish = v;
        break;
    }
  }
  return out as ArtworkOverlay;
}
