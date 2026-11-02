/**
 * SEARCH FIRST, THEN THE FIRST TWENTY-FIVE.
 *
 * Lists in the Desk are search-first. This is the whole mechanism,
 * kept pure so every list can share one behavior and one set of words.
 *
 * The measurement that made it necessary, taken 2026-09-25 against a store holding 506 people:
 * the People screen rendered every one of them, 77,527px tall on a phone and 72,077px on a
 * laptop. A list that long is not a list, it is a document nobody reads to the end, and on a
 * phone it is about forty full screens of thumb travel to reach the last name.
 *
 * Capping alone would be worse than the problem, because a cap with no way past it hides
 * records the person came to find. So the cap always travels with two things: a search that
 * reaches the whole set rather than the visible part of it, and a plain count saying how many
 * were left out and how to see them.
 */

/** How many rows a list shows before it asks to be searched. */
export const TOP = 25;

/**
 * Every word in the query must appear somewhere in the row, in any order.
 *
 * "ellery marta" finds Marta Ellery, and so does "marta ellery", because nobody reliably
 * remembers which way round a name was filed. Matching the whole query as one string would
 * fail both of those, which is the commonest way a search feels broken.
 */
export function matches(text: string, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The rows a query matches, in the order they arrived. */
export function search<T>(rows: T[], text: (row: T) => string, q: string): T[] {
  if (!q.trim()) return rows;
  return rows.filter((row) => matches(text(row), q));
}

/**
 * What to say under a list, in words rather than a row count nobody can act on.
 *
 * Returns null when there is nothing worth saying, which is the common case: a short list that
 * is showing all of itself needs no footnote, and adding one to every list in the building is
 * how a screen fills up with text about itself.
 */
export function summarize(
  matched: number,
  total: number,
  showingAll: boolean,
  noun: [one: string, many: string],
  searching: boolean,
): string | null {
  const word = (n: number) => (n === 1 ? noun[0] : noun[1]);
  if (matched > TOP && !showingAll) {
    return searching
      ? `Showing the first ${TOP} of ${matched} matching ${word(matched)}.`
      : `Showing the first ${TOP} of ${total} ${word(total)}. Search to narrow it down.`;
  }
  if (searching) {
    return matched === 0
      ? `Nothing matches that, out of ${total} ${word(total)}.`
      : `${matched} of ${total} ${word(total)}.`;
  }
  /* Showing everything, unsearched. The list speaks for itself. */
  return showingAll && total > TOP ? `All ${total} ${word(total)}.` : null;
}

/**
 * The open row first, then the capped list, and only when the cap would have hidden it.
 *
 * Without this the cap quietly hides the very row somebody just asked for: the record still
 * opens beside the list, but its line is not in the list, so the screen shows an open record
 * with nothing selected next to it.
 *
 * The first attempt at this un-capped the whole list instead, and it was wrong in a way worth
 * recording. Every one of these screens opens with a record already selected, so the un-cap
 * fired on mount, every time, and the Events pane came back at 44,614px with all 303 rows on
 * it. A rule that fires on the common case is not an escape hatch, it is the behavior.
 */
export function pinOpen<T>(
  capped: T[],
  matched: T[],
  showAll: boolean,
  isOpen?: (row: T) => boolean,
): T[] {
  if (showAll || !isOpen) return capped;
  if (capped.some(isOpen)) return capped;
  const one = matched.find(isOpen);
  return one ? [one, ...capped] : capped;
}
