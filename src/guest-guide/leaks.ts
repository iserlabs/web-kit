/**
 * Which entry codes appear in served HTML. Each hit is reported as
 * "code N of M" (N is the code's 1-based position in the caller's array,
 * blank entries included, M the array length), so no digit of a real code
 * ever reaches a report or a log. A code counts only as a standalone token,
 * so the same digits inside a hash or a longer number do not raise a false
 * alarm.
 *
 * Codes are passed in at run time (from the Ops Hub and Hospitable), never
 * read from a committed file.
 */
export function findLeaks(html: string, codes: string[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
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
