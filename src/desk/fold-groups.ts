/**
 * Folding the groups of a grouped list: a group folds shut to one line that
 * keeps its count, and which are folded is remembered on this browser. Open is the default, so a
 * list nobody has touched shows everything.
 *
 * PURE. The list of folded groups is just a list of keys; the screen stores it.
 */

/** One group's key: the list it is in, then its own name, so two lists never share a fold. */
export const groupKey = (grouping: string, label: string) => `${grouping}:${label}`;

/** What was stored, made safe: a list of strings, each once, however it was damaged. */
export function closedGroups(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const k of raw) if (typeof k === "string" && k && !out.includes(k)) out.push(k);
  return out;
}

export function toggleGroup(closed: readonly string[], key: string): string[] {
  return closed.includes(key) ? closed.filter((k) => k !== key) : [...closed, key];
}

/** Close every group of one list, or open every group of it, leaving other lists' folds alone. */
export function setAllGroups(
  closed: readonly string[],
  grouping: string,
  labels: readonly string[],
  shut: boolean,
): string[] {
  const keys = new Set(labels.map((l) => groupKey(grouping, l)));
  const rest = closed.filter((k) => !keys.has(k));
  return shut ? [...rest, ...keys] : rest;
}

/** Two or more named groups is when "Close all" is worth offering. */
export const groupsFoldable = (labels: readonly string[]) => labels.filter(Boolean).length >= 2;
