/** Placeholder art for the demo: flat SVG scenes, clearly not photographs. */
export const scene = (bg: string, fg: string, n: number): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="${bg}"/><rect x="0" y="640" width="1600" height="260" fill="${fg}" opacity=".35"/>${"x".repeat(n).split("").map((_, i) => `<rect x="${220 + i * 200}" y="${520 - i * 40}" width="140" height="${120 + i * 40}" fill="${fg}"/>`).join("")}</svg>`,
  )}`;
