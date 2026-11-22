/**
 * The per-house Home Screen manifest and icon. The icon is cut from the
 * house's own arrival field and its name: no stock glyph, no brand redraw.
 */
import type { GuideBrand } from "./brand";
import type { Plan } from "./plan";

export type GuideManifestInput = {
  plan: Plan;
  brand: GuideBrand;
  /** The guide's own path, e.g. "/guides/yale". */
  startUrl: string;
  /** The worker's scope, e.g. "/guides/". */
  scope: string;
  /** Icon files the site serves (PNG for iPhone; the SVG below works on Android). */
  icons: { src: string; sizes: string; type: string; purpose?: "any" | "maskable" }[];
};

/** A Web App Manifest object; the site serves it as JSON at the manifest link. */
export function guideManifest(i: GuideManifestInput) {
  if (!i.startUrl.startsWith(i.scope))
    throw new Error(`startUrl "${i.startUrl}" is outside the scope "${i.scope}"`);
  return {
    name: `${i.plan.name} guest guide`,
    short_name: i.plan.shortName,
    start_url: i.startUrl,
    scope: i.scope,
    display: "standalone",
    background_color: i.brand.fields.arrival,
    theme_color: i.brand.fields.arrival,
    icons: i.icons,
  };
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * The initials the icon carries, from the name, in this order:
 * 1) a house or unit number standing as its own word, the last one wins
 *    ("135 Yale" is 135, "Apartment 202" is 202, "Unit 12B" is 12B);
 * 2) a unit code of one or two letters and digits ("2nd floor A2" is A2,
 *    "M02" is M02); ordinals like "2nd" are never a unit;
 * 3) else the first letters of the first two words that start with a letter
 *    ("Crown Ridge Cottage" is CR, "Lark" is L).
 * A site that wants other initials sets `GuideModel.iconText`.
 */
export function iconText(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const numbers = words.filter(
    (w) => /^\d{1,4}[A-Za-z]?$/.test(w) && !/^\d+(st|nd|rd|th)$/i.test(w),
  );
  const last = numbers.at(-1);
  if (last) return last.toUpperCase();
  const unit = words.filter((w) => /^[A-Za-z]{1,2}\d{1,3}$/.test(w)).at(-1);
  if (unit) return unit.toUpperCase();
  return words
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** Everything a renderer needs to draw the icon in the brand face (next/og, a canvas, the SVG below). */
export function guideIconSpec(plan: Plan, brand: GuideBrand) {
  const text = plan.iconText ?? iconText(plan.name);
  return {
    text,
    background: brand.fields.arrival,
    color: brand.ink,
    fontFamily: brand.faces.display.family,
    fallback: brand.faces.display.fallback,
    fontWeight: brand.faces.display.weight,
    /** On a 512 px square. */
    fontSize: text.length <= 2 ? 280 : text.length === 3 ? 210 : 170,
  };
}

export type IconFont = {
  /** The brand display face file (the site's own self-hosted woff2), as bytes or base64. */
  data: Uint8Array | string;
  format?: "woff2" | "woff" | "truetype" | "opentype";
};

/** Base64 without Node's Buffer, so it also runs in an edge or browser runtime. */
function base64(d: Uint8Array | string): string {
  if (typeof d === "string") return d;
  let bin = "";
  for (let i = 0; i < d.length; i += 0x8000)
    bin += String.fromCharCode(...d.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * A square SVG icon: the arrival field and the house initials in the brand's
 * display face and ink, 512 px. Pass the face file and it is embedded, so the
 * icon draws in the brand face on a phone that does not have the font; sites
 * rasterize it to PNG for iPhone (next/og with the same face, or a browser).
 */
export function guideIconSvg(
  plan: Plan,
  brand: GuideBrand,
  opts: { font?: IconFont } = {},
): string {
  const s = guideIconSpec(plan, brand);
  const family = s.fontFamily.replace(/["'<>&;{}\\]/g, "");
  const face = opts.font
    ? `<style>@font-face{font-family:"${family}";src:url(data:font/${opts.font.format ?? "woff2"};base64,${base64(opts.font.data)}) format("${opts.font.format ?? "woff2"}");font-weight:${s.fontWeight}}</style>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${face}<rect width="512" height="512" fill="${esc(s.background)}"/><text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="&quot;${esc(family)}&quot;, ${esc(s.fallback)}" font-weight="${s.fontWeight}" font-size="${s.fontSize}" fill="${esc(s.color)}">${esc(s.text)}</text></svg>`;
}
