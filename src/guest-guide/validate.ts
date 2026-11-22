import { type GuideModel, isUnknown, itemKey, type PhotoV2, RESERVED_REFS } from "./model";
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
  if (!g.contact.label.trim()) problems.push("contact.label: empty");
  if (g.contact.phone !== undefined && !g.contact.phone.trim())
    problems.push("contact.phone: empty");

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

export type ValidateModelOptions = {
  /** The build day (YYYY-MM-DD). Passed in, never read from a clock. */
  today: string;
  /** The brand's phone policy; "never" refuses any phone on the page. */
  phone?: "never" | "allowed";
  /** Per-site strings that may never appear (Yale: a phone line, a removed amenity). */
  forbidden?: string[];
  /** A portrait cover crop under this width needs a refine record. Default 1170. */
  minCoverWidth?: number;
  /** Days a guide may go unchecked. Default 60. */
  maxAgeDays?: number;
};

const NO_PLATE = new Set(["rules", "checkout", "help"]);
const CLOCK_TOKEN = /\{\{\s*(before|after)\b/i;

/** Whole days from a to b, both YYYY-MM-DD, counted on the calendar (no clock, no zone). */
function daysBetween(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** Why a photo may never be placed, or undefined when it may be. */
export function unplaceable(p: Pick<PhotoV2, "ai" | "rights" | "shows">): string | undefined {
  if (p.ai) return "AI imagery";
  if (p.rights === "unconfirmed") return "rights unconfirmed";
  if (p.shows?.length) return `shows ${p.shows.join(", ")}`;
  return undefined;
}

/**
 * Every problem with a v2 guide model, in plain words. Empty means it may
 * build. Covers the v1 rules (sources, dates, em dashes, entry codes) over the
 * whole model, plus the v2 contract: unique keys, quick-find refs, verbatim
 * figures, plates, cover sharpness and shade, time-bound rows, staleness.
 */
export function validateModel(m: GuideModel, opts: ValidateModelOptions): string[] {
  const problems: string[] = [];
  const minCover = opts.minCoverWidth ?? 1170;
  const maxAge = opts.maxAgeDays ?? 60;
  const dates: string[] = [];

  if (!SLUG.test(m.slug)) problems.push(`slug: "${m.slug}" is not lowercase-hyphenated`);
  if (m.iconText !== undefined && !/^[A-Za-z0-9]{1,4}$/.test(m.iconText))
    problems.push(`iconText: "${m.iconText}" must be 1 to 4 letters or digits`);

  const strings: [string, string][] = [];
  walk(m, "", (path, v) => {
    if (typeof v === "string") {
      strings.push([path, v]);
      if (v.includes(EM_DASH)) problems.push(`${path}: contains an em dash`);
      if (CLOCK_TOKEN.test(v))
        problems.push(
          `${path}: holds a clock token ({{before}}/{{after}}); the guide never prints time logic`,
        );
      const keys = path.split(".");
      if (keys.some((k) => NOT_COPY_KEYS.has(k) || k === "reason" || k === "why")) return;
      if (/^wifi\.(network|password)\.value$/.test(path)) return;
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
      } else dates.push(v.checked);
    }
  });

  const newest = dates.sort().at(-1);
  if (newest && daysBetween(newest, opts.today) > maxAge)
    problems.push(`guide: newest check ${newest} is older than ${maxAge} days on ${opts.today}`);

  for (const [k, slot] of [
    ["checkIn", m.checkIn],
    ["checkOut", m.checkOut],
  ] as const)
    if (!isUnknown(slot) && !TIME_12H.test(slot.value))
      problems.push(`${k}: "${slot.value}" is not a 12-hour time like 4:00 PM`);
  if (!m.address.mapUrl.startsWith("https://"))
    problems.push("address.mapUrl: must start with https://");
  if (m.address.appleMapUrl && !m.address.appleMapUrl.startsWith("https://"))
    problems.push("address.appleMapUrl: must start with https://");

  if (m.wifi.kind === "printed") {
    if (!m.wifi.network.value.trim()) problems.push("wifi.network: empty");
    if (!m.wifi.password.value.trim()) problems.push("wifi.password: empty");
  }
  if (m.entry.steps.value.length === 0) problems.push("entry.steps: needs at least one step");
  if (!m.entry.codeDelivery.value.trim()) problems.push("entry.codeDelivery: empty");
  if (!m.contact.label.trim()) problems.push("contact.label: empty");
  if (m.contact.phone !== undefined && !m.contact.phone.trim())
    problems.push("contact.phone: empty");
  if (opts.phone === "never" && (m.contact.phone || m.contact.sms))
    problems.push("contact.phone: this brand prints no phone");
  if (opts.phone === "never")
    for (const [path, v] of strings)
      if (
        !path.split(".").some((k) => NOT_COPY_KEYS.has(k)) &&
        /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(v)
      )
        problems.push(`${path}: holds a phone number; this brand prints none`);

  for (const f of opts.forbidden ?? [])
    for (const [path, v] of strings)
      if (v.toLowerCase().includes(f.toLowerCase()))
        problems.push(`${path}: holds the forbidden string "${f}"`);

  const next = m.entry.codeDeliveryNext;
  if (
    next?.guestyConfirmed &&
    !(ISO.test(next.guestyConfirmed.on) && isRealDate(next.guestyConfirmed.on))
  )
    problems.push(
      `entry.codeDeliveryNext.guestyConfirmed.on "${next.guestyConfirmed.on}" is not a real date`,
    );

  // Keys: every item and unknown row, unique across the guide.
  const items = new Map<string, { section: string; body: string; group?: string }>();
  const unknownKeys = new Set<string>();
  const linkKeys = new Set<string>();
  const ids = new Set<string>();
  m.sections.forEach((sec, i) => {
    if (ids.has(sec.id)) problems.push(`sections: duplicate id "${sec.id}"`);
    ids.add(sec.id);
    if (sec.items.length === 0 && !sec.unknowns?.length && !sec.links?.length)
      problems.push(`sections.${i} (${sec.id}): has no rows`);
    for (const it of sec.items) {
      const key = itemKey(sec.id, it);
      if (items.has(key) || unknownKeys.has(key))
        problems.push(`sections.${sec.id}: duplicate item key "${key}"`);
      items.set(key, { section: sec.id, body: it.body, group: it.group });
      if (it.validThrough) checkThrough(`${key}.validThrough`, it.validThrough);
      const v = it.video;
      if (v) {
        if (!v.src.trim() || !v.poster.trim())
          problems.push(`${key}.video: needs a src and a poster`);
        if (!v.alt.trim()) problems.push(`${key}.video: no alt text`);
        if (!v.type.startsWith("video/"))
          problems.push(`${key}.video: type "${v.type}" is not a video type`);
        if (!(v.width > 0 && v.height > 0))
          problems.push(`${key}.video: needs a width and a height`);
        const why = unplaceable(v);
        if (why) problems.push(`${key}.video: may not be placed (${why})`);
      }
    }
    for (const u of sec.unknowns ?? []) {
      const key = itemKey(sec.id, u);
      if (items.has(key) || unknownKeys.has(key))
        problems.push(`sections.${sec.id}: duplicate item key "${key}"`);
      unknownKeys.add(key);
    }
    for (const l of sec.links ?? []) {
      const key = itemKey(sec.id, l);
      if (items.has(key) || unknownKeys.has(key) || linkKeys.has(key))
        problems.push(`sections.${sec.id}: duplicate item key "${key}"`);
      linkKeys.add(key);
      if (!l.label.trim()) problems.push(`${key}: link has no label`);
      if (!/^https:\/\//.test(l.href) && !/^\/(?!\/)/.test(l.href))
        problems.push(`${key}: link "${l.href}" must be https:// or a path starting with /`);
    }
  });
  const isRef = (r: string) =>
    (RESERVED_REFS as readonly string[]).includes(r) ||
    items.has(r) ||
    unknownKeys.has(r) ||
    linkKeys.has(r);

  function checkThrough(where: string, day: string) {
    if (!ISO.test(day) || !isRealDate(day)) problems.push(`${where}: "${day}" is not a real date`);
    else if (day < opts.today)
      problems.push(`${where}: validThrough ${day} has passed on ${opts.today}`);
  }
  m.nearby.forEach((p, i) => {
    if (!p.url.startsWith("https://"))
      problems.push(`nearby.${i}: url must start with https:// ("${p.name}")`);
    if (p.mapUrl && !p.mapUrl.startsWith("https://"))
      problems.push(`nearby.${i}: mapUrl must start with https://`);
    if (p.validThrough) checkThrough(`nearby.${i}.validThrough`, p.validThrough);
  });
  if (m.notice) checkThrough("notice.validThrough", m.notice.validThrough);

  const look = m.look;
  const qf = look.quickFind ?? [];
  if (qf.length > 10) problems.push(`quickFind: ${qf.length} rows, at most 10`);
  const seenRef = new Set<string>();
  for (const r of qf) {
    if (!isRef(r)) problems.push(`quickFind: "${r}" is not an item key or a reserved ref`);
    if (seenRef.has(r)) problems.push(`quickFind: "${r}" is listed twice`);
    seenRef.add(r);
  }
  if (look.readFirst && !items.has(look.readFirst))
    problems.push(`readFirst: "${look.readFirst}" is not an item key`);
  for (const f of look.figures ?? []) {
    const it = items.get(f.key);
    if (!it) problems.push(`figures: "${f.key}" is not an item key`);
    else if (!f.value || !it.body.includes(f.value))
      problems.push(`figures: figure "${f.value}" is not in the live text of ${f.key}`);
  }
  for (const [group, keys] of Object.entries(look.order ?? {})) {
    const seen = new Set<string>();
    for (const k of keys) {
      const it = items.get(k);
      if (!it) problems.push(`order.${group}: "${k}" is not an item key`);
      else if (it.group !== group) problems.push(`order.${group}: "${k}" is not in that group`);
      if (seen.has(k)) problems.push(`order.${group}: "${k}" is listed twice`);
      seen.add(k);
    }
  }

  const photoBySrc = new Map(m.photos.map((p) => [p.src, p]));
  m.photos.forEach((ph, i) => {
    if (!ph.alt.trim()) problems.push(`photos.${i}: no alt text`);
  });
  for (const [chapter, plate] of Object.entries(look.plates ?? {})) {
    if (NO_PLATE.has(chapter)) problems.push(`plates.${chapter}: no plate on ${chapter}`);
    for (const src of Array.isArray(plate) ? plate : [plate])
      if (!photoBySrc.has(src)) problems.push(`plates.${chapter}: "${src}" is not in photos`);
  }

  const cover = look.cover;
  if (cover.kind === "photo") {
    const ph = photoBySrc.get(cover.src);
    if (!ph) problems.push(`cover: "${cover.src}" is not in photos`);
    else {
      const why = unplaceable(ph);
      if (why) problems.push(`cover: ${cover.src} may not be placed (${why})`);
    }
    if (cover.shade && cover.shade.max > 0.35)
      problems.push(`cover: shade max ${cover.shade.max} is above 0.35`);
    if (cover.shade && (cover.shade.from < 0 || cover.shade.from > 1))
      problems.push(`cover: shade from ${cover.shade.from} is outside 0 to 1`);
    for (const g of cover.fieldOn ?? [])
      if (!["phone", "tablet", "desktop"].includes(g))
        problems.push(`cover: fieldOn "${g}" is not phone, tablet or desktop`);
    if (cover.fieldOn?.length && cover.layout !== "low")
      problems.push(`cover: fieldOn is for a low cover, not ${cover.layout}`);
    if (cover.portrait.width < minCover && !cover.portrait.refined)
      problems.push(
        `cover: portrait crop is ${cover.portrait.width} px wide, under ${minCover} px, with no refine record`,
      );
    if (cover.portrait.refined && !ISO.test(cover.portrait.refined.checkedAt100))
      problems.push("cover: portrait.refined.checkedAt100 is not YYYY-MM-DD");
  } else if (cover.title.length === 0)
    problems.push("cover: a type cover needs at least one title line");

  const tables = new Map(m.tables.map((t) => [t.title, t]));
  m.tables.forEach((t, i) => {
    if (t.rows.length === 0) problems.push(`tables.${i} (${t.title}): has no rows`);
  });
  (m.drafts ?? []).forEach((d, i) => {
    const t = d.at;
    if (t.kind === "price-cell") {
      const table = tables.get(t.table);
      if (!table) problems.push(`drafts.${i}: no table "${t.table}"`);
      else if (!table.rows.some((r) => r.item === t.item))
        problems.push(`drafts.${i}: no row "${t.item}" in table "${t.table}"`);
    }
    if (t.kind === "quick-find" && !isRef(t.ref))
      problems.push(`drafts.${i}: "${t.ref}" is not an item key or a reserved ref`);
    if (t.kind === "item-body") {
      if (t.key !== "parking" && t.key !== "contact" && !items.has(t.key))
        problems.push(
          `drafts.${i}: item-body "${t.key}" is not an item key, "parking" or "contact"`,
        );
      if (!d.text.trim()) problems.push(`drafts.${i}: item-body for "${t.key}" is empty`);
    }
    if (
      t.kind === "subhead" &&
      !items.has(t.group) &&
      ![...items.values()].some((x) => x.group === t.group) &&
      t.group !== "parking" &&
      t.group !== "wifi"
    )
      problems.push(
        `drafts.${i}: subhead group "${t.group}" is not a group, an item key, "parking" or "wifi"`,
      );
    if (!ISO.test(d.writtenOn))
      problems.push(`drafts.${i}: writtenOn "${d.writtenOn}" is not YYYY-MM-DD`);
  });

  return problems;
}
