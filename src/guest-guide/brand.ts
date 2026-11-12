/**
 * Brand tokens for the Alpenglow guide. Each site holds its own values; the kit
 * holds the type, the checks and the CSS writer. `validateBrand` refuses a
 * brand that would print low-contrast text, a dark field, a banned face, or
 * (for the Xenia lock) any blue.
 */
import type { TemplateLabelId } from "./copy";

/** The eight fields, in the order the chapters meet them. `paper` is Help and the colophon. */
export type FieldId = "arrival" | "first" | "house" | "know" | "rules" | "out" | "near" | "paper";

export const FIELD_IDS: readonly FieldId[] = [
  "arrival",
  "first",
  "house",
  "know",
  "rules",
  "out",
  "near",
  "paper",
];

/** A typeface. `family` is the CSS family name (a next/font variable works too). */
export type Face = { family: string; fallback: string; weight: number; opsz?: boolean };

export type BrandId =
  | "sun-mountain"
  | "columbus"
  | "palisade"
  | "euclid"
  | "peak"
  | "grand-colorado"
  | "bluebill"
  | "fixture";

export type GuideBrand = {
  id: BrandId;
  name: string;
  wordmark:
    | { kind: "text"; text: string; face: "wordmark" | "display"; sub?: string }
    | { kind: "image"; src: string; width: number; height: number; alt: string };
  /** Small mark in the sky (the Sun Mountain roundel, mono ink). */
  mark?: { src: string; width: number; height: number };
  faces: {
    /** House name, 80 px. */
    display: Face;
    /** Chapter heads 30 px and index questions 22 px (display family at 400). */
    head: Face;
    /** Body 18/1.6; labels at the strong weight, 15 px. */
    text: Face & { strong: number };
    /**
     * Times, Wi-Fi, large answers 64 px and hanging numerals 36 px (at `large`).
     * `numeric` is the CSS font-variant-numeric for every figure (default
     * "tabular-nums"); a serif whose default figures are old-style sets
     * "lining-nums tabular-nums".
     */
    figure: Face & { large: number; numeric?: string };
    /** Cinzel, Sun Mountain only. */
    wordmark?: Face;
  };
  ink: string;
  sec: string;
  /** Hanging numerals 36 px and large figures (3:1 floor). */
  accent: string;
  /** Labels 15 px and up (4.5:1 floor). */
  accentText: string;
  onPhoto: string;
  button: { fill: string; ink: string; doneFill: string; doneInk: string };
  fields: Record<FieldId, string>;
  phone: "never" | "allowed";
  /** Xenia lock: refuse blue and navy hues. */
  noBlue?: boolean;
  /** Service-worker cache prefix, e.g. "sms-guides". */
  cachePrefix: string;
  /** This brand's live (v1) labels, where they differ from the kit defaults. */
  labels?: Partial<Record<TemplateLabelId, string>>;
};

/** Faces never allowed as a primary face (design standard 2.2). Kept lowercase for matching. */
export const BANNED_FACES: readonly string[] = [
  "inter",
  "system-ui",
  // Built from parts: the ban list itself is the only place these names may appear.
  ["fra", "unces"].join(""),
  ["instrument", "serif"].join(" "),
  ["bodoni", "moda"].join(" "),
];

const HEX = /^#([0-9a-f]{6})$/i;

function rgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex.trim());
  if (!m?.[1]) throw new Error(`not a #rrggbb color: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2 relative luminance of a #rrggbb color. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(linear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two flat colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The lowest contrast of one color across every field. */
export function worstContrast(color: string, fields: Record<FieldId, string>): number {
  return Math.min(...Object.values(fields).map((f) => contrast(color, f)));
}

/** CIE LCh (D50, Bradford-adapted, as culori and CSS lch() compute it): lightness, chroma, hue in degrees. */
export function lch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = rgb(hex).map(linear) as [number, number, number];
  const x = (0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / 0.96422;
  const y = 0.2225045 * r + 0.7168786 * g + 0.0606169 * b;
  const z = (0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / 0.82521;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  const L = 116 * fy - 16;
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/**
 * Blue and navy for the noBlue lock: chroma over 8 and hue 190 to 290 degrees.
 * The spec wrote 190 to 260, but navy measures 266 to 270 in LCh (#16273d is
 * 265.9, #233755 is 268.8), so 260 would let the very color the lock exists to
 * refuse through. Purple starts past 290.
 */
const isBlue = (hex: string) => {
  const { c, h } = lch(hex);
  return c > 8 && h >= 190 && h <= 290;
};

const r2 = (n: number) => n.toFixed(2);

/**
 * Every problem with a brand's tokens, in plain words. Empty means it may ship.
 * Ink, sec and accentText need 4.5:1 on every field, the accent 3:1, the
 * button ink 4.5:1 on its fill (both states); every field stays a pale tint.
 */
export function validateBrand(b: GuideBrand): string[] {
  const p: string[] = [];
  const colors: [string, string][] = [
    ["ink", b.ink],
    ["sec", b.sec],
    ["accent", b.accent],
    ["accentText", b.accentText],
    ["onPhoto", b.onPhoto],
    ["button.fill", b.button.fill],
    ["button.ink", b.button.ink],
    ["button.doneFill", b.button.doneFill],
    ["button.doneInk", b.button.doneInk],
    ...Object.entries(b.fields).map(([k, v]): [string, string] => [`fields.${k}`, v]),
  ];
  for (const [name, c] of colors)
    if (!HEX.test(c)) {
      p.push(`${name} "${c}" is not a #rrggbb color`);
      return p;
    }

  for (const [field, f] of Object.entries(b.fields)) {
    for (const role of ["ink", "sec", "accentText"] as const) {
      const r = contrast(b[role], f);
      if (r < 4.5) p.push(`${role} ${b[role]} is ${r2(r)}:1 on fields.${field} ${f}, under 4.5:1`);
    }
    const a = contrast(b.accent, f);
    if (a < 3) p.push(`accent ${b.accent} is ${r2(a)}:1 on fields.${field} ${f}, under 3:1`);
    const lum = luminance(f);
    if (lum <= 0.55)
      p.push(`fields.${field} ${f} has luminance ${r2(lum)}, at or below 0.55 (light page only)`);
  }
  for (const [ink, fill] of [
    [b.button.ink, b.button.fill],
    [b.button.doneInk, b.button.doneFill],
  ] as const) {
    const r = contrast(ink, fill);
    if (r < 4.5) p.push(`button ink ${ink} is ${r2(r)}:1 on its fill ${fill}, under 4.5:1`);
  }

  const faces: [string, Face | undefined][] = [
    ["faces.display", b.faces.display],
    ["faces.head", b.faces.head],
    ["faces.text", b.faces.text],
    ["faces.figure", b.faces.figure],
  ];
  for (const [name, face] of faces) {
    const family = face?.family
      .trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase();
    if (family && BANNED_FACES.includes(family))
      p.push(`${name} "${face?.family}" is a banned primary face`);
  }

  if (b.noBlue)
    for (const [name, c] of colors)
      if (isBlue(c)) p.push(`${name} ${c} is a blue or navy hue, refused by the noBlue lock`);

  return p;
}

/** A CSS value with no way out of its declaration: no ; { } < > or backslash, and balanced quotes. */
function safe(k: string, v: string | number): string {
  const s = String(v);
  const quotes = s.match(/"/g)?.length ?? 0;
  if (/[;{}<>\\]/.test(s) || quotes % 2 !== 0)
    throw new Error(`brand value for --${k} is not a safe CSS value`);
  return s;
}

const fam = (f: Face) => {
  if (/["]/.test(f.family)) throw new Error(`face family "${f.family}" may not hold a quote`);
  const family = f.family.startsWith("var(") ? f.family : `"${f.family}"`;
  return `${family},${f.fallback}`;
};

/** The brand's custom properties on `.gg[data-brand="<id>"]`, and nothing else. */
export function brandCss(b: GuideBrand): string {
  if (!/^[a-z0-9-]+$/.test(b.id)) throw new Error(`brand id "${b.id}" is not a slug`);
  const wordmark = b.faces.wordmark ?? b.faces.display;
  const vars: [string, string | number][] = [
    ["ink", b.ink],
    ["sec", b.sec],
    ["accent", b.accent],
    ["accent-text", b.accentText],
    ["on-photo", b.onPhoto],
    ["btn", b.button.fill],
    ["btn-ink", b.button.ink],
    ["btn-done", b.button.doneFill],
    ["btn-done-ink", b.button.doneInk],
    ...FIELD_IDS.map((id): [string, string] => [
      id === "paper" ? "paper" : `f-${id}`,
      b.fields[id],
    ]),
    ["display", fam(b.faces.display)],
    ["display-w", b.faces.display.weight],
    ["head", fam(b.faces.head)],
    ["head-w", b.faces.head.weight],
    ["text", fam(b.faces.text)],
    ["text-w", b.faces.text.weight],
    ["strong", b.faces.text.strong],
    ["fig", fam(b.faces.figure)],
    ["fig-w", b.faces.figure.weight],
    ["fig-large", b.faces.figure.large],
    ["fig-num", b.faces.figure.numeric ?? "tabular-nums"],
    ["wordmark", fam(wordmark)],
    ["wordmark-w", wordmark.weight],
  ];
  return `.gg[data-brand="${b.id}"]{${vars.map(([k, v]) => `--${k}:${safe(k, v)};`).join("")}}`;
}
