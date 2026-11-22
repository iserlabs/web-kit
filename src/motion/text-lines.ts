/** Group measured words into visual lines. `tops` are each word's offsetTop, in order. */
export function groupIntoLines(words: string[], tops: number[], tolerance = 3): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  let lineTop: number | null = null;
  words.forEach((w, i) => {
    const top = tops[i] ?? 0;
    if (lineTop === null || Math.abs(top - lineTop) <= tolerance) {
      lineTop = lineTop ?? top;
      current.push(w);
    } else {
      lines.push(current.join(" "));
      current = [w];
      lineTop = top;
    }
  });
  if (current.length) lines.push(current.join(" "));
  return lines;
}

export const splitWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
