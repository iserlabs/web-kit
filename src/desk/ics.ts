/**
 * A one-event calendar file (.ics) for an "Add to calendar" link on an event's page.
 *
 * WHY A FILE: Google Calendar takes an address with the facts in it; Apple Calendar and Outlook
 * take a file, and most readers are on an iPhone.
 *
 * TIMES ARE NEW YORK'S. An event has a day and a 24-hour time with no zone; they are turned
 * into UTC here with the zone rules for that date (asked of the platform, never hand-derived), so
 * an October event and a January one are both right across the clock change. A time with no zone
 * is never guessed at elsewhere: these are always New York times, written down in this one place.
 */

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Minutes New York is behind UTC at a given instant (240 in summer, 300 in winter). */
function nyOffsetMinutes(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((utcMs - asUtc) / 60000);
}

/** "2026-11-01T15:00" read as New York wall time, as a UTC instant, or null when not a real time. */
export function nyWallToUtc(wall: string): Date | null {
  const m = String(wall ?? "").match(WALL);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let t = naive + nyOffsetMinutes(naive) * 60000;
  t = naive + nyOffsetMinutes(t) * 60000; // a second pass settles a guess that crossed the change
  /* A date like Feb 31 rolls over; refuse it rather than publish a different day. */
  const check = new Date(naive);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(t);
}

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
/* RFC 5545 text: escape the characters it reserves, and keep it on one short line. */
const icsText = (s: unknown) =>
  String(s ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/([;,])/g, "\\$1")
    .slice(0, 160);

export type IcsInput = {
  /** Who the calendar entry is from: the site's name, its domain, and a word for what it lists. */
  calendar: { name: string; domain: string; product?: string };
  title: string;
  /** `YYYY-MM-DDTHH:MM`, New York wall time. */
  start: string;
  end?: string;
  where?: string;
  url?: string;
  now?: Date;
  uid?: string;
};

/** The file, or null when the start is not a real time. The end defaults to an hour later. */
export function icsFor({
  calendar,
  title,
  start,
  end,
  where,
  url,
  now = new Date(),
  uid,
}: IcsInput): string | null {
  const a = nyWallToUtc(start);
  if (!a) return null;
  let b = end ? nyWallToUtc(end) : null;
  if (!b || b <= a) b = new Date(a.getTime() + 3600000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${calendar.name}//${calendar.product ?? "Events"}//EN`,
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stamp(a)}-${icsText(uid || title)
      .replace(/[^A-Za-z0-9-]/g, "")
      .slice(0, 40)}@${calendar.domain}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(a)}`,
    `DTEND:${stamp(b)}`,
    `SUMMARY:${icsText(title) || calendar.name}`,
    `LOCATION:${icsText(where)}`,
    ...(url ? [`URL:${String(url).slice(0, 200)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
