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

/** The text the icon carries: the house number, or the first word of the name. */
export function iconText(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length <= 4 ? first : first.slice(0, 2);
}

/**
 * A square SVG icon: the arrival field, the house's number or first letters
 * in the brand's display face and ink. 512 px; sites rasterize it for iPhone.
 */
export function guideIconSvg(plan: Plan, brand: GuideBrand): string {
  const text = iconText(plan.name);
  const size = text.length <= 2 ? 260 : text.length === 3 ? 210 : 170;
  const family = brand.faces.display.family.replace(/["<>&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${esc(brand.fields.arrival)}"/><text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="${esc(family)}, ${esc(brand.faces.display.fallback)}" font-weight="${brand.faces.display.weight}" font-size="${size}" fill="${esc(brand.ink)}">${esc(text)}</text></svg>`;
}
