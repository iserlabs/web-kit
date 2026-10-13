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
