/**
 * Which entry codes appear in served HTML, masked so the report itself never
 * repeats a code. A code counts only as a standalone token, so the same digits
 * inside a hash or a longer number do not raise a false alarm.
 *
 * Codes are passed in at run time (from the Ops Hub and Hospitable), never
 * read from a committed file.
 */
export function findLeaks(html: string, codes: string[]): string[] {
  const found: string[] = [];
  for (const raw of new Set(codes.map((c) => c.trim()).filter(Boolean))) {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![\\w])${escaped}(?![\\w])`).test(html)) found.push(`${raw[0]}***`);
  }
  return found;
}
