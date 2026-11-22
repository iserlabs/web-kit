/**
 * The leak check's core, in plain JavaScript so the CLI runs under bare Node
 * (consumers have no TypeScript loader for files inside node_modules).
 * `leaks.ts` re-exports `findLeaks` from here, so there is one implementation.
 */

/**
 * Which entry codes appear in served HTML. Each hit is reported as
 * "code N of M" (N is the code's 1-based position in the caller's array,
 * blank entries included, M the array length), so no digit of a real code
 * ever reaches a report or a log. A code counts only as a standalone token,
 * so the same digits inside a hash or a longer number do not raise a false
 * alarm.
 *
 * @param {string} html
 * @param {string[]} codes
 * @returns {string[]}
 */
export function findLeaks(html, codes) {
  const found = [];
  const seen = new Set();
  codes.forEach((raw, i) => {
    const code = raw.trim();
    if (!code || seen.has(code)) return;
    seen.add(code);
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![\\w])${escaped}(?![\\w])`).test(html))
      found.push(`code ${i + 1} of ${codes.length}`);
  });
  return found;
}

/**
 * The exit decision. `results` has one entry per page: { route, html } when it
 * was read, { route, error } when it could not be. It can never pass on
 * nothing: exit 0 only when every page was scanned and none holds a code;
 * 1 on a leak; 2 when a page could not be read or no page was scanned.
 *
 * @param {{ route: string, html?: string, error?: string }[]} results
 * @param {(html: string) => string[]} find
 * @returns {{ lines: string[], code: 0 | 1 | 2 }}
 */
export function decide(results, find) {
  const lines = [];
  let errored = false;
  let leaked = false;
  let scanned = 0;
  for (const r of results) {
    if (r.error) {
      errored = true;
      lines.push(`ERROR ${r.route} ${r.error}`);
      continue;
    }
    scanned += 1;
    for (const label of find(r.html ?? "")) {
      leaked = true;
      lines.push(`LEAK ${r.route} ${label}`);
    }
  }
  if (scanned === 0) {
    lines.push("no guide pages scanned");
    return { lines, code: 2 };
  }
  if (errored) return { lines, code: 2 };
  if (leaked) return { lines, code: 1 };
  lines.push(`no code on any of ${scanned} guide pages`);
  return { lines, code: 0 };
}

/**
 * Strings that must never appear on a page (a held line, a removed amenity, a
 * phone line). Matching is case-insensitive on the text with tags removed.
 *
 * @param {string} html
 * @param {string[]} strings
 * @returns {string[]} the strings found
 */
export function findForbidden(html, strings) {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return strings.filter((s) => s.trim() && text.includes(s.toLowerCase()));
}
