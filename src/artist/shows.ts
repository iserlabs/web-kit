import type { StudioCatalog } from "./handlers";
import { cleanText, PUBLISH } from "./overlay";

/**
 * Shows: the exhibitions and evenings an artist's work hangs in.
 *
 * A show is typed once, in the studio, by the artist, because the facts are theirs:
 * a show goes live only once its venue and dates are entered, and nothing here
 * invents one. From that one record the site derives the rest: whether the show is
 * upcoming, on now or past, the homepage notice, which works are on view (and so not
 * for sale on the site), the CV line and the exhibition schema.
 *
 * Status is computed, never stored. A show's dates are calendar dates in the site's
 * own time zone, so "2026-11-07" means the whole of that day in New York (by
 * default). Parsed as UTC it would open a New York show at 7 PM the evening before.
 */

export interface Show {
  slug: string;
  title: string;
  kind: "solo" | "group" | "two-person" | "event";
  venue: string;
  address?: string;
  city: string;
  /** "2026-11-07", a calendar date in the site's time zone. */
  startsOn: string;
  /** The last day the show is open, inclusive. */
  endsOn: string;
  /** The opening reception: "2026-11-07", "18:00", "21:00". */
  opening?: { on: string; from: string; to?: string };
  workSlugs: string[];
  /** The gallery's own page for the show. */
  href?: string;
  /** One line in the artist's words, printed verbatim. */
  note?: string;
  publish: "published" | "draft";
}

export type ShowKind = Show["kind"];

/** A show as the studio stores it: the show, plus who saved it and when. */
export type ShowRecord = Show & { updatedAt?: string; updatedBy?: string };

export type ShowStatus = "upcoming" | "current" | "past";

/** The one list of show kinds. cleanShow and sanitizeStoredShows both read it. */
export const SHOW_KINDS: ReadonlySet<ShowKind> = new Set<ShowKind>([
  "solo",
  "two-person",
  "group",
  "event",
]);

/** Where show dates are read when a site names no time zone of its own. */
export const DEFAULT_TIME_ZONE = "America/New_York";

/** How far ahead the homepage notice looks for the next show. */
const NOTICE_WINDOW_DAYS = 45;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date `now` falls on in `timeZone`, as "YYYY-MM-DD". Intl applies the
    zone's real offset at that instant, daylight saving included. An unknown time zone
    throws a RangeError, so a misspelled config fails loudly rather than reading dates
    in the wrong place. */
function dateIn(now: Date, timeZone: string): string {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, format);
  }
  let year = "";
  let month = "";
  let day = "";
  for (const part of format.formatToParts(now)) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" calendar date. Calendar arithmetic only:
    Date.UTC counts days here and never places the date on a clock. */
function dayNumber(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Closing soonest first, then opening first, then by slug, so the answer never
    depends on the order the store happened to list the shows in. */
function byClosing(a: Show, b: Show): number {
  return order(a.endsOn, b.endsOn) || order(a.startsOn, b.startsOn) || order(a.slug, b.slug);
}

function byOpening(a: Show, b: Show): number {
  return order(a.startsOn, b.startsOn) || order(a.endsOn, b.endsOn) || order(a.slug, b.slug);
}

/** Upcoming before its first day, current through its last day inclusive, past from
    the day after it closes. Every day is a day in `timeZone`. */
export function showStatus(
  show: Pick<Show, "startsOn" | "endsOn">,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): ShowStatus {
  const today = dateIn(now, timeZone);
  if (today < show.startsOn) return "upcoming";
  if (today > show.endsOn) return "past";
  return "current";
}

/** The show the homepage should mention: the published show on now (the one closing
    soonest, if two overlap), or else the next published show opening within 45 days,
    or nothing. The line comes down by itself the day after a show closes. */
export function noticeShow<T extends Show>(
  shows: readonly T[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): T | undefined {
  const published = shows.filter((s) => s.publish === "published");
  const current = published
    .filter((s) => showStatus(s, now, timeZone) === "current")
    .sort(byClosing);
  if (current[0]) return current[0];
  const today = dayNumber(dateIn(now, timeZone));
  return published
    .filter(
      (s) =>
        showStatus(s, now, timeZone) === "upcoming" &&
        dayNumber(s.startsOn) - today <= NOTICE_WINDOW_DAYS,
    )
    .sort(byOpening)[0];
}

/** The published show a work is hanging in today, or undefined. A work on view is
    never buyable on the site, so a gallery never has a piece sold out from under it. */
export function onView<T extends Show>(
  workSlug: string,
  shows: readonly T[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): T | undefined {
  return shows
    .filter(
      (s) =>
        s.publish === "published" &&
        s.workSlugs.includes(workSlug) &&
        showStatus(s, now, timeZone) === "current",
    )
    .sort(byClosing)[0];
}

/* ------------------------------------------------------------------ validation */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 120;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_WORKS = 100;
const MAX_HREF = 500;

const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isIn = <T>(set: ReadonlySet<T>, v: unknown): v is T => set.has(v as T);
const blank = (v: unknown): boolean =>
  v === undefined || v === null || (isStr(v) && v.trim() === "");
const filled = (v: unknown): v is string => isStr(v) && v.trim() !== "";
const isSlug = (v: unknown): v is string => isStr(v) && v.length <= MAX_SLUG && SLUG.test(v);
const isTime = (v: unknown): v is string => isStr(v) && TIME.test(v);

/** A real day on the calendar between 1900 and 2100, written "YYYY-MM-DD" exactly
    (zero padded, nothing before or after). Refuses "2026-02-30", "2026-11-7" and
    "2026-11-07T00:00". Dates are compared as text elsewhere, so only this exact
    shape may be stored. Date.UTC only checks that the day exists; nothing is placed
    on a clock. */
function isCalendarDate(v: unknown): v is string {
  if (!isStr(v)) return false;
  const m = DATE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** An http or https address, so a stored link can never run script. */
function isWebAddress(v: unknown): v is string {
  if (!isStr(v) || v.length > MAX_HREF) return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export type CleanShowResult = { ok: true; show: Show } | { ok: false; problems: string[] };

/**
 * The one validation every show write passes. Unlike a work's overlay, a show has
 * required facts, so a form missing one is refused with every problem named in plain
 * words rather than saved half-empty. An optional field left blank is dropped; an
 * optional field filled in wrongly is refused, because silently dropping what the
 * artist typed is how a show goes up without its opening.
 *
 * Every listed work must exist in the site's catalog, so a show cannot conjure a
 * painting. Text is trimmed and cut to length the way cleanOverlay cuts it.
 */
export function cleanShow(body: Record<string, unknown>, catalog: StudioCatalog): CleanShowResult {
  const problems: string[] = [];

  const slug = isStr(body.slug) ? body.slug.trim() : "";
  if (!isSlug(slug)) {
    problems.push("The show needs a short web name: lowercase letters, digits and single hyphens.");
  }
  const title = cleanText(body.title, 200);
  if (!title) problems.push("Give the show a title.");
  const kind = isIn(SHOW_KINDS, body.kind) ? body.kind : undefined;
  if (!kind) problems.push("Choose the kind of show: solo, two-person, group or event.");
  const venue = cleanText(body.venue, 200);
  if (!venue) problems.push("Name the venue.");
  const city = cleanText(body.city, 120);
  if (!city) problems.push("Name the city.");
  const address = cleanText(body.address, 300);

  const startsOn = isCalendarDate(body.startsOn) ? body.startsOn : undefined;
  if (!startsOn) problems.push("The first day must be a real date, written 2026-11-07.");
  const endsOn = isCalendarDate(body.endsOn) ? body.endsOn : undefined;
  if (!endsOn) problems.push("The last day must be a real date, written 2026-11-07.");
  if (startsOn && endsOn && endsOn < startsOn) {
    problems.push("The last day cannot come before the first.");
  }

  let opening: Show["opening"];
  if (!blank(body.opening)) {
    const o = body.opening;
    if (!isObj(o)) {
      problems.push("Could not read the opening reception.");
    } else if (!(blank(o.on) && blank(o.from) && blank(o.to))) {
      const on = isCalendarDate(o.on) ? o.on : undefined;
      if (!on) {
        problems.push("The opening reception needs a real date, written 2026-11-07.");
      } else if (startsOn && endsOn && (on < startsOn || on > endsOn)) {
        problems.push("The opening reception must fall within the run of the show.");
      }
      const from = isTime(o.from) ? o.from : undefined;
      if (!from) problems.push("The opening reception needs a start time, written 18:00.");
      const to = isTime(o.to) ? o.to : undefined;
      const toOk = blank(o.to) || to !== undefined;
      if (!toOk) problems.push("The opening reception's end time must be written 21:00.");
      if (on && from && toOk) opening = to ? { on, from, to } : { on, from };
    }
  }

  const workSlugs: string[] = [];
  if (!blank(body.workSlugs)) {
    const listed: unknown = body.workSlugs;
    if (!Array.isArray(listed)) {
      problems.push("Could not read the list of works.");
    } else {
      for (const entry of listed as unknown[]) {
        if (!isStr(entry)) {
          problems.push("One of the works could not be read.");
        } else if (!catalog.has(entry)) {
          problems.push(`"${entry.slice(0, 120)}" is not a work on this site.`);
        } else if (!workSlugs.includes(entry)) {
          workSlugs.push(entry);
        }
      }
      if (workSlugs.length > MAX_WORKS) {
        problems.push(`A show can list at most ${MAX_WORKS} works.`);
      }
    }
  }

  let href: string | undefined;
  if (!blank(body.href)) {
    const candidate = isStr(body.href) ? body.href.trim() : "";
    if (isWebAddress(candidate)) href = candidate;
    else {
      problems.push(
        "The gallery's page must be a full web address starting with https:// or http://.",
      );
    }
  }
  const note = cleanText(body.note, 300);

  let publish: Show["publish"] = "draft";
  if (!blank(body.publish)) {
    if (isIn(PUBLISH, body.publish)) publish = body.publish;
    else problems.push("Choose published or held back.");
  }

  if (problems.length > 0 || !title || !kind || !venue || !city || !startsOn || !endsOn) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    show: {
      slug,
      title,
      kind,
      venue,
      ...(address ? { address } : {}),
      city,
      startsOn,
      endsOn,
      ...(opening ? { opening } : {}),
      workSlugs,
      ...(href ? { href } : {}),
      ...(note ? { note } : {}),
      publish,
    },
  };
}

/**
 * Whatever is stored may be wrongly shaped (hand-edited, an older version, another
 * writer). A show missing any required fact is dropped whole, because half a show
 * cannot be printed honestly; a wrongly shaped optional field is dropped alone. The
 * stored slug must match its key. Valid data passes through unchanged, in the stored
 * key order, so re-saving never reshuffles it. The catalog is not checked here: a
 * page that prints a show links only the works that exist.
 */
export function sanitizeStoredShows(raw: unknown): Record<string, ShowRecord> {
  const out: Record<string, ShowRecord> = {};
  if (!isObj(raw)) return out;
  for (const key of Object.keys(raw)) {
    const show = storedShow(key, raw[key]);
    if (show) out[key] = show;
  }
  return out;
}

function storedShow(key: string, v: unknown): ShowRecord | undefined {
  if (!isObj(v) || v.slug !== key || !isSlug(v.slug)) return undefined;
  if (!filled(v.title) || !isIn(SHOW_KINDS, v.kind) || !filled(v.venue) || !filled(v.city)) {
    return undefined;
  }
  const startsOn = v.startsOn;
  const endsOn = v.endsOn;
  if (!isCalendarDate(startsOn) || !isCalendarDate(endsOn) || endsOn < startsOn) return undefined;
  if (!Array.isArray(v.workSlugs) || !(v.workSlugs as unknown[]).every(isStr)) return undefined;
  if (!isIn(PUBLISH, v.publish)) return undefined;

  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v)) {
    const x = v[k];
    switch (k) {
      case "slug":
      case "title":
      case "kind":
      case "venue":
      case "city":
      case "startsOn":
      case "endsOn":
      case "workSlugs":
      case "publish":
        out[k] = x;
        break;
      case "address":
      case "note":
      case "updatedAt":
      case "updatedBy":
        if (isStr(x)) out[k] = x;
        break;
      case "href":
        if (isWebAddress(x)) out.href = x;
        break;
      case "opening":
        if (
          isObj(x) &&
          isCalendarDate(x.on) &&
          x.on >= startsOn &&
          x.on <= endsOn &&
          isTime(x.from) &&
          (x.to === undefined || isTime(x.to))
        ) {
          const op: Record<string, unknown> = {};
          for (const ok of Object.keys(x)) {
            if (ok === "on" || ok === "from" || ok === "to") op[ok] = x[ok];
          }
          out.opening = op;
        }
        break;
    }
  }
  return out as unknown as ShowRecord;
}

/* ------------------------------------------------------------------ schema */

export interface ShowSite {
  /** The site's origin, e.g. "https://julianpotulicki.com". A trailing slash is ignored. */
  url: string;
  /** Path of a work's page. Default `/work/<slug>`. */
  workPath?: (slug: string) => string;
  /** Path of a show's page. Default `/shows/<slug>`. */
  showPath?: (slug: string) => string;
  /** The artist the show presents, printed as the event's performer. `id` is the @id
      the site's own Person carries, so search engines join the two. */
  artist?: { name: string; id?: string };
  /** Path of an image of each work, e.g. `/board/<slug>-1280.jpg`, so the show carries
      the pictures of what hangs in it. */
  workImage?: (slug: string) => string;
}

/**
 * The show as schema.org's ExhibitionEvent, for the show's own page: its place, its
 * dates and the works hanging in it. Each work is referenced by the same @id its own
 * page gives its VisualArtwork, so search engines join the two. An absent fact
 * prints nothing.
 *
 * A show always hangs in a room (venue and city are required facts), so it is always
 * in person. No eventStatus is stated: the site cannot know a show went ahead as
 * planned, and a canceled show is deleted rather than marked.
 *
 * Pass only a published show, with only the works its page actually shows.
 */
export function showJsonLd(show: Show, site: ShowSite): Record<string, unknown> {
  const origin = site.url.replace(/\/+$/, "");
  const workPath = site.workPath ?? ((slug: string) => `/work/${slug}`);
  const showPath = site.showPath ?? ((slug: string) => `/shows/${slug}`);
  const workImage = site.workImage;
  const page = `${origin}${showPath(show.slug)}`;
  const images = workImage ? show.workSlugs.map((slug) => `${origin}${workImage(slug)}`) : [];
  return {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    "@id": `${page}#exhibition`,
    name: show.title,
    url: page,
    startDate: show.startsOn,
    endDate: show.endsOn,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: show.venue,
      address: {
        "@type": "PostalAddress",
        ...(show.address ? { streetAddress: show.address } : {}),
        addressLocality: show.city,
      },
    },
    ...(images.length > 0 ? { image: images } : {}),
    ...(site.artist
      ? {
          performer: {
            "@type": "Person",
            ...(site.artist.id ? { "@id": site.artist.id } : {}),
            name: site.artist.name,
          },
        }
      : {}),
    ...(show.note ? { description: show.note } : {}),
    ...(show.href ? { sameAs: show.href } : {}),
    workFeatured: show.workSlugs.map((slug) => ({
      "@type": "VisualArtwork",
      "@id": `${origin}${workPath(slug)}#artwork`,
      url: `${origin}${workPath(slug)}`,
    })),
  };
}
