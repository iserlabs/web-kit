import type { GuestGuide } from "./types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Built from its code point so the character itself never sits in source. */
const EM_DASH = String.fromCharCode(0x2014);
const ENTRY_WORD = /\b(?:code|pin|passcode|lockbox|lock box|combo|combination|keypad)\b/gi;
const NOT_ENTRY = /\b(?:zip|area|postal|promo|qr|dress) code\b/gi;
const PHONE_LOCAL = /\b\d{3}[-.\s]\d{4}\b/g;
const SENTENCE_END = /[.!?]\s|\n/;
const PHONE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
/** 4 to 8 digits, optionally split by single spaces, hyphens or dots. */
const DIGIT_RUN = /(?<![\d-])\d(?:[ .-]?\d){3,7}(?!\d)/g;
const TIME_12H = /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/;
/** Keys that hold links, citations and dates rather than guest copy. */
const NOT_COPY_KEYS = new Set(["source", "checked", "url", "mapUrl", "src"]);
/** Wi-Fi values print as typed and may be plain digits. */
const WIFI_VALUES = new Set(["wifi.network.value", "wifi.password.value"]);

/**
 * Whether a string reads like an entry code: an entry word, then within 40
 * characters a 4 to 8 digit run (separators allowed). Phone numbers and
 * phrases like "zip code" are removed first, and a bare 1900-2099 is a year.
 * This is a backstop; the served-HTML leak check with real values is the gate.
 */
function looksLikeEntryCode(text: string): boolean {
  const s = text.replace(PHONE, " ").replace(PHONE_LOCAL, " ").replace(NOT_ENTRY, " ");
  for (const m of s.matchAll(ENTRY_WORD)) {
    const after = s.slice((m.index ?? 0) + m[0].length);
    // The window ends at a sentence boundary, a newline, or 40 characters.
    const window = (after.split(SENTENCE_END)[0] ?? "").slice(0, 40);
    for (const run of window.matchAll(DIGIT_RUN)) {
      const digits = run[0];
      // A code that is itself 1900 to 2099 is not caught here by design; the
      // served-HTML leak check with real values is the gate for that case.
      if (/^\d{4}$/.test(digits) && Number(digits) >= 1900 && Number(digits) <= 2099) continue;
      return true;
    }
  }
  return false;
}

function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

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
      if (path.split(".").some((k) => NOT_COPY_KEYS.has(k))) return;
      if (WIFI_VALUES.has(path)) return;
      if (v.includes("!")) problems.push(`${path}: contains an exclamation mark`);
      if (looksLikeEntryCode(v)) problems.push(`${path}: looks like an entry code`);
      return;
    }
    if (isSourcedLike(v)) {
      const where = path || "guide";
      if (typeof v.source !== "string" || v.source.trim() === "")
        problems.push(`${where}: no source`);
      if (typeof v.checked !== "string" || !ISO.test(v.checked)) {
        problems.push(`${where}: checked "${String(v.checked)}" is not YYYY-MM-DD`);
      } else if (!isRealDate(v.checked)) {
        problems.push(`${where}: checked "${v.checked}" is not a real date`);
      } else if (v.checked > opts.today) {
        problems.push(`${where}: checked "${v.checked}" is after today`);
      }
    }
  });

  for (const [k, v] of [
    ["checkIn", g.checkIn.value],
    ["checkOut", g.checkOut.value],
  ] as const) {
    if (!TIME_12H.test(v)) problems.push(`${k}: "${v}" is not a 12-hour time like 4:00 PM`);
  }
  if (!g.address.mapUrl.startsWith("https://"))
    problems.push("address.mapUrl: must start with https://");

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
