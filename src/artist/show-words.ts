import type { Show } from "./shows";

/**
 * A show's dates and opening in plain words, for its page, the homepage line and
 * anywhere else a site prints them.
 *
 * Show dates are calendar days in the site's own time zone, stored "YYYY-MM-DD".
 * They are printed exactly as written: nothing here puts a date on a clock, so no
 * time zone can move "2026-11-01" to October 31. Times are printed on a 12-hour
 * clock, the way an American invitation reads.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Between two dates, the way a printed range reads: a spaced en dash. */
const RANGE = " – ";

interface Day {
  year: number;
  month: number;
  day: number;
}

function dayOf(date: string): Day {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}

const monthName = (month: number): string => MONTHS[month - 1] ?? "";

/** The day of the week, by counting days from Thursday, January 1, 1970. Date.UTC
    only counts the days here; it never places the date on a clock. */
function weekday({ year, month, day }: Day): string {
  const days = Date.UTC(year, month - 1, day) / 86_400_000;
  return WEEKDAYS[(((days + 4) % 7) + 7) % 7] ?? "";
}

const calendarDate = (d: Day): string => `${monthName(d.month)} ${d.day}, ${d.year}`;

/** "November 7 – December 5, 2026". The month or the year is said once when both
    ends of the run share it, and a one-day show prints its date once. */
export function formatShowDates(show: Pick<Show, "startsOn" | "endsOn">): string {
  const a = dayOf(show.startsOn);
  const b = dayOf(show.endsOn);
  if (show.startsOn === show.endsOn) return calendarDate(a);
  if (a.year !== b.year) return `${calendarDate(a)}${RANGE}${calendarDate(b)}`;
  if (a.month !== b.month) {
    return `${monthName(a.month)} ${a.day}${RANGE}${monthName(b.month)} ${b.day}, ${b.year}`;
  }
  return `${monthName(a.month)} ${a.day}${RANGE}${b.day}, ${b.year}`;
}

function clock(time: string): { text: string; half: "AM" | "PM" } {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return {
    text: minutes === 0 ? String(hour) : `${hour}:${String(minutes).padStart(2, "0")}`,
    half: hours < 12 ? "AM" : "PM",
  };
}

/** "Saturday, November 7, 6 to 9 PM". The half of the day is said once when both
    times share it. The reception falls inside the show's run, so its year is left
    to the dates printed beside it. */
export function formatOpening(opening: NonNullable<Show["opening"]>): string {
  const d = dayOf(opening.on);
  const from = clock(opening.from);
  let time = `${from.text} ${from.half}`;
  if (opening.to) {
    const to = clock(opening.to);
    time =
      from.half === to.half
        ? `${from.text} to ${to.text} ${to.half}`
        : `${time} to ${to.text} ${to.half}`;
  }
  return `${weekday(d)}, ${monthName(d.month)} ${d.day}, ${time}`;
}
