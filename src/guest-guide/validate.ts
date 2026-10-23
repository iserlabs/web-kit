import type { GuestGuide } from "./types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Built from its code point so the character itself never sits in source. */
const EM_DASH = String.fromCharCode(0x2014);
/**
 * A 4 to 8 digit number shortly after an entry word reads as a code. The
 * look-arounds skip digits joined by a hyphen, so "555-0100" is not a code.
 * This is a backstop; the served-HTML leak check with real values is the gate.
 */
const CODE_SHAPED =
  /\b(?:code|pin|passcode|lockbox|lock box|combo|combination|keypad)\b[^.\n]{0,25}?(?<![\d-])\d{4,8}(?![\d-])/i;

export type ValidateOptions = { today: string; minPhotoLongSide?: number };

function isSourcedLike(v: unknown): v is { source: unknown; checked: unknown } {
  return typeof v === "object" && v !== null && "source" in v && "checked" in v;
}

function walk(v: unknown, path: string, visit: (path: string, v: unknown) => void): void {
  visit(path, v);
  if (Array.isArray(v))
    v.forEach((x, i) => {
      walk(x, path ? `${path}.${i}` : String(i), visit);
    });
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, visit);
  }
}

/**
 * Every problem with a guide, as human-readable lines. Empty means valid.
 * Reports all problems at once so a content edit is fixed in one pass.
 */
export function validateGuide(g: GuestGuide, opts: ValidateOptions): string[] {
  const problems: string[] = [];
  const minLong = opts.minPhotoLongSide ?? 2000;

  if (!SLUG.test(g.slug)) problems.push(`slug: "${g.slug}" is not lowercase-hyphenated`);

  walk(g, "", (path, v) => {
    if (typeof v === "string") {
      if (v.includes(EM_DASH)) problems.push(`${path}: contains an em dash`);
      if (CODE_SHAPED.test(v)) problems.push(`${path}: looks like an entry code`);
      return;
    }
    if (isSourcedLike(v)) {
      const where = path || "guide";
      if (typeof v.source !== "string" || v.source.trim() === "")
        problems.push(`${where}: no source`);
      if (typeof v.checked !== "string" || !ISO.test(v.checked)) {
        problems.push(`${where}: checked "${String(v.checked)}" is not YYYY-MM-DD`);
      } else if (v.checked > opts.today) {
        problems.push(`${where}: checked "${v.checked}" is after today`);
      }
    }
  });

  if (!g.wifi.network.value.trim()) problems.push("wifi.network: empty");
  if (!g.wifi.password.value.trim()) problems.push("wifi.password: empty");
  if (g.entry.steps.value.length === 0) problems.push("entry.steps: needs at least one step");
  if (!g.contact.phone.trim()) problems.push("contact.phone: empty");

  const ids = new Set<string>();
  g.sections.forEach((sec, i) => {
    if (ids.has(sec.id)) problems.push(`sections: duplicate id "${sec.id}"`);
    ids.add(sec.id);
    if (sec.items.length === 0) problems.push(`sections.${i}: has no items`);
  });

  g.nearby.forEach((p, i) => {
    if (!p.url.startsWith("https://"))
      problems.push(`nearby.${i}: url must start with https:// ("${p.name}")`);
  });

  g.photos.forEach((ph, i) => {
    if (!ph.alt.trim()) problems.push(`photos.${i}: no alt text`);
    const long = Math.max(ph.width, ph.height);
    if (long < minLong) problems.push(`photos.${i}: long side ${long} px is under ${minLong} px`);
  });

  return problems;
}
