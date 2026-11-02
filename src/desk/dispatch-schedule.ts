/**
 * Choosing when a Dispatch goes out.
 *
 * The house lives in New York, so a time is typed as New York wall-clock time on a 12-hour clock
 * and turned into one exact moment here. A calendar time with no zone is never guessed at, and
 * the daylight-saving change is handled by asking the clock which New York times exist rather than
 * by adding a fixed number of hours: 9:00 AM in July and 9:00 AM in January are different moments
 * in UTC, and 2:30 AM on the night the clocks jump forward does not exist at all.
 *
 * THE RULES, each refused with a sentence :
 *   1) not in the past, and not under 5 minutes from now (the mailing service needs the moment to
 *      take the request; a time that close would be missed or sent at once);
 *   2) not more than 30 days ahead (the longest the mailing service holds a scheduled mailing).
 */

export const MIN_LEAD_MS = 5 * 60_000;
export const MAX_LEAD_MS = 30 * 86_400_000;
const NY = "America/New_York";

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: NY,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The New York wall clock at an instant. */
export function nyParts(ms: number): { y: number; mo: number; d: number; h: number; mi: number } {
  const get: Record<string, number> = {};
  for (const p of parts.formatToParts(new Date(ms))) {
    if (p.type !== "literal") get[p.type] = Number(p.value);
  }
  return { y: get.year, mo: get.month, d: get.day, h: get.hour % 24, mi: get.minute };
}

export type Resolved = { ok: true; at: Date; ambiguous: boolean } | { ok: false; error: string };

/** "2026-11-10" and 9:30 PM (hour 1-12, minute, pm) to a moment. */
export function nyWallToInstant(date: string, hour24: number, minute: number): Resolved {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || "").trim());
  if (!m) return { ok: false, error: "Choose a day to send it." };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (
    !Number.isInteger(hour24) ||
    hour24 < 0 ||
    hour24 > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return { ok: false, error: "Choose a time of day to send it." };
  }
  const calendar = new Date(Date.UTC(y, mo - 1, d));
  if (
    calendar.getUTCFullYear() !== y ||
    calendar.getUTCMonth() !== mo - 1 ||
    calendar.getUTCDate() !== d
  ) {
    return { ok: false, error: "That day is not on the calendar." };
  }
  const wall = Date.UTC(y, mo - 1, d, hour24, minute);
  const found: number[] = [];
  /* New York is five hours behind UTC in winter and four in summer; try both and keep the moments
     whose New York wall clock reads what was typed. */
  for (const offsetMin of [-240, -300]) {
    const at = wall - offsetMin * 60_000;
    const p = nyParts(at);
    if (p.y === y && p.mo === mo && p.d === d && p.h === hour24 && p.mi === minute) found.push(at);
  }
  if (found.length === 0) {
    return {
      ok: false,
      error:
        "That time does not exist in New York: the clocks jump forward that night. Choose a time an hour later.",
    };
  }
  found.sort((a, b) => a - b);
  return { ok: true, at: new Date(found[0]), ambiguous: found.length > 1 };
}

/** 12-hour clock to 24-hour. 12:00 AM is midnight, 12:00 PM is noon. */
export function to24(hour12: number, pm: boolean): number {
  const h = Math.trunc(hour12) % 12;
  return pm ? h + 12 : h;
}

/** "9:30 AM" for a New York time. */
export function clock12(h24: number, mi: number): string {
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mi).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
}

const DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: NY,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "Tuesday, November 10, 2026 at 9:30 AM" in New York time. */
export function sayWhen(at: Date | string): string {
  const d = at instanceof Date ? at : new Date(at);
  const p = nyParts(d.getTime());
  return `${DAY.format(d)} at ${clock12(p.h, p.mi)}`;
}

/** The sentence a time that breaks a rule gets, or "" when the time is allowed. */
export function scheduleProblem(at: Date, now: Date): string {
  const lead = at.getTime() - now.getTime();
  if (lead < 0) return "That time has already passed. Choose a time in the future.";
  if (lead < MIN_LEAD_MS) {
    return "That is less than 5 minutes from now. Choose a time at least 5 minutes ahead, or press Send now.";
  }
  if (lead > MAX_LEAD_MS) {
    return `That is more than 30 days away, which is as far ahead as a mailing can be set. The latest is ${sayWhen(new Date(now.getTime() + MAX_LEAD_MS))}.`;
  }
  return "";
}

/** The whole check in one call, from what the boxes hold. */
export function planSend(
  input: { date: string; hour12: number; minute: number; pm: boolean },
  now: Date,
): { ok: true; at: Date; iso: string; said: string; note: string } | { ok: false; error: string } {
  if (!(input.hour12 >= 1 && input.hour12 <= 12)) {
    return { ok: false, error: "Choose an hour from 1 to 12." };
  }
  const r = nyWallToInstant(input.date, to24(input.hour12, input.pm), input.minute);
  if (!r.ok) return r;
  const bad = scheduleProblem(r.at, now);
  if (bad) return { ok: false, error: bad };
  return {
    ok: true,
    at: r.at,
    iso: r.at.toISOString(),
    said: sayWhen(r.at),
    note: r.ambiguous
      ? "That time happens twice that night, when the clocks go back. The first one is used."
      : "",
  };
}
