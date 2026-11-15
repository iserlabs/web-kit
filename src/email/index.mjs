/**
 * The shared email framework: one design (the Specimen), one subject convention, one reference
 * format, one plain-text part, and one explicit on/off switch per kind of email.
 *
 * What lives here is general. Facts about a business (its name, colors, header artwork, sender
 * address, the words of each email) live in that business's own repo and are passed in.
 *
 * Layout: the Specimen (./specimen.mjs, generated from the sign-kit so the signing emails and the
 * form receipts are one design): the business's logo, one large sentence, a sheet of what was
 * received and the reference, and the person who answers. Hand-sent letters keep the paper
 * letterhead in brand-pack/letterheads.mjs.
 *
 * Nothing in this file delivers mail. `deliver()` takes a transport the site already owns and
 * refuses unless the kind's switch is on.
 */

import { DEFAULT_FACES, makePalette, renderReceiptEmail } from "./specimen.mjs";

/** Gmail clips a message body over about 102KB. Stay well under it. */
export const GMAIL_CLIP_BYTES = 102 * 1024;
export const GMAIL_SAFE_BYTES = 90 * 1024;

const DEFAULT_TZ = "America/New_York";
const EM_DASH = String.fromCharCode(8212);
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Year, month (1-12) and day of `date` in `timeZone`. A bare YYYY-MM-DD string is a calendar date and is never shifted. */
function dayParts(date, timeZone = DEFAULT_TZ) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return { y, m, d };
  }
  const when = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(when.getTime())) throw new Error(`email: not a date: ${String(date)}`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(when);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** "November 14, 2026": American, long month, in the business's time zone (Eastern by default). */
export function formatLongDate(date, timeZone = DEFAULT_TZ) {
  const { y, m, d } = dayParts(date, timeZone);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * "<Business> | <what it is> | <name or reference>, <Month D, YYYY>". Searchable in Gmail by any of
 * the three parts and skimmable in a list. Pipes inside a part are removed so the shape holds.
 */
export function emailSubject({ business, kind, who, reference, date, timeZone }) {
  const clean = (v) =>
    String(v ?? "")
      .replace(/[|\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const label = clean(who) || clean(reference);
  if (!clean(business) || !clean(kind) || !label) {
    throw new Error("email: subject needs a business, a kind, and a name or reference");
  }
  return `${clean(business)} | ${clean(kind)} | ${label}, ${formatLongDate(date, timeZone)}`;
}

/* Crockford base32 without I, L, O, U, so a reference read aloud is not misheard. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * A short reference a person can quote: PREFIX-YYMMDD-XXXXX. The same seed on the same day always
 * gives the same reference, so a retried request never mints a second one.
 */
export function makeReference(prefix, date, seed, timeZone) {
  const { y, m, d } = dayParts(date, timeZone);
  const stamp = `${String(y).slice(-2)}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  let n = fnv1a(`${prefix}|${stamp}|${seed}`);
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code = ALPHABET[n & 31] + code;
    n >>>= 5;
  }
  return `${String(prefix).toUpperCase()}-${stamp}-${code}`;
}

/**
 * The switch for one kind of email. On only when the variable is exactly 1, true, on or yes.
 * Unset, empty and anything else is off, so a missing variable can never turn mail on.
 */
export function mailSwitch(env, name) {
  const raw = String(env?.[name] ?? "")
    .trim()
    .toLowerCase();
  return { name, on: ["1", "true", "on", "yes"].includes(raw) };
}

const first = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)[0];

/**
 * What a confirmation says, as the Specimen's content: a headline (the kind, as a sentence), the
 * lead paragraphs, a sheet of what was received and the reference, then what happens next and who
 * replies. Every part is optional except `lead`.
 */
export function confirmationContent({
  recipientName,
  headline,
  kind,
  lead,
  sheetTitle = "What you sent",
  caption,
  received,
  reference,
  referenceLabel = "Reference",
  next,
  nextIntro = "What happens next:",
  replyLine,
  close,
}) {
  if (!lead) throw new Error("email: a confirmation needs a lead sentence");
  const name = first(recipientName);
  const rows = (received ?? [])
    .map(([label, value]) => ({ label, value }))
    .filter((r) => r.value !== undefined && String(r.value).trim() !== "");
  const after = [];
  if (next?.length) {
    after.push(nextIntro);
    for (const [i, item] of next.entries()) after.push(`${i + 1}) ${item}`);
  }
  if (replyLine) after.push(replyLine);
  if (close) after.push(close);
  return {
    headline: headline ?? `${kind}.`,
    lead: [...(name ? [`Hello ${name},`] : []), lead],
    sheetTitle,
    caption,
    received: rows,
    reference: reference ? { label: referenceLabel, value: String(reference) } : undefined,
    after,
  };
}

/**
 * The Specimen's palette, faces and logo for a business, drawn from its brand-pack config. A site
 * may refine any of them with `brand.specimen`:
 *   { deep, gold, logo: { src, width, height, alt, markOnly? }, faces: { serif, sans, wordmark } }
 * Without a logo the business name is set as live text, so there is never a hole.
 */
export function specimenLook(brand) {
  const c = brand.config;
  const l = c.letterhead ?? {};
  const s = brand.specimen ?? {};
  const palette = makePalette({
    paper: l.paper ?? c.ground ?? "#ffffff",
    ground: l.surround ?? "#f4f3f1",
    ink: c.ink,
    muted: l.soft,
    rule: l.line ?? l.rule ?? "#d5cdc3",
    band: s.deep ?? c.ink,
    accent: s.gold ?? c.brand,
  });
  const faces = s.faces ?? {
    serif: c.displayFont ?? DEFAULT_FACES.serif,
    sans: c.bodyFont ?? DEFAULT_FACES.sans,
    wordmark: c.displayFont ?? DEFAULT_FACES.wordmark,
  };
  return { palette, faces, logo: s.logo, fontsHref: brand.fontsHref ?? s.fontsHref };
}

/**
 * Build one email, ready for a transport. `brand` is client data:
 *   { business, config (the brand-pack config), person, from, replyTo, fontsHref?, specimen? }
 * `content` is the Specimen's content (see confirmationContent). Returns { from, to, replyTo,
 * subject, html, text, reference, headers }.
 */
export function composeEmail({
  brand,
  to,
  kind,
  who,
  reference,
  date,
  timeZone,
  content,
  replyTo,
  from,
}) {
  if (!brand?.config || !brand?.person || !brand?.business) {
    throw new Error("email: brand needs business, config and person");
  }
  if (!to) throw new Error("email: no recipient");
  if (!content?.headline || !content?.lead?.length) {
    throw new Error("email: content needs a headline and a lead");
  }
  const subject = emailSubject({ business: brand.business, kind, who, reference, date, timeZone });
  const look = specimenLook(brand);
  const built = renderReceiptEmail({
    ...look,
    brandName: brand.business,
    subject,
    headline: content.headline,
    lead: content.lead,
    sheetTitle: content.sheetTitle ?? "What you sent",
    caption: content.caption,
    received: content.received ?? [],
    reference: content.reference,
    after: content.after,
    signoff:
      brand.person?.name && brand.person.name !== brand.business
        ? { name: brand.person.name, title: brand.person.title }
        : undefined,
    legalLine: brand.legalLine ?? brand.business,
    status: content.status,
  });
  return {
    from: from ?? brand.from,
    to,
    replyTo: replyTo ?? brand.replyTo,
    subject,
    html: built.html,
    text: built.text,
    reference,
    headers: reference ? { "X-Entity-Ref-ID": reference } : {},
  };
}

/** The common case in one call: a confirmation to the person who just filled in a form. */
export function composeConfirmation({
  brand,
  to,
  kind,
  recipientName,
  date,
  timeZone,
  ...content
}) {
  return composeEmail({
    brand,
    to,
    kind,
    who: recipientName,
    reference: content.reference,
    date,
    timeZone,
    replyTo: content.replyTo,
    from: content.from,
    content: confirmationContent({ recipientName, kind, ...content }),
  });
}

/**
 * Hand a composed message to the site's own transport, but only when the kind's switch is on and
 * the mail key is present. Never throws. Returns { status } where status is one of
 * "off" (switch off: nothing was handed over), "not_configured" (switch on, no key: loud, never a
 * silent success), "delivered", or "failed" (with `error`).
 */
export async function deliver(message, { switchOn, configured = true, transport }) {
  if (!switchOn) return { status: "off" };
  if (!configured || typeof transport !== "function") return { status: "not_configured" };
  try {
    const result = await transport(message);
    return { status: "delivered", result };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

/*
 * Words the standard forbids, stored as stem + ending so this file itself stays clean.
 * Each pair is joined and matched as a whole word.
 */
const join = (pairs) => pairs.map((pair) => pair.join(""));
const BRITISH = join([
  ["colo", "ur"],
  ["favo", "ur"],
  ["neighbo", "ur"],
  ["organi", "se"],
  ["organi", "sation"],
  ["cent", "re"],
  ["program", "me"],
  ["che", "que"],
  ["hono", "ur"],
  ["behavio", "ur"],
  ["recogni", "se"],
  ["apologi", "se"],
  ["reali", "se"],
  ["lice", "nce"],
  ["gr", "ey"],
]);
const STOCK_WORDS = join([
  ["del", "ve"],
  ["seam", "less(ly)?"],
  ["lever", "age"],
  ["un", "lock"],
  ["rob", "ust"],
  ["trans", "formative"],
  ["emp", "ower"],
]).map((w) => new RegExp(`\\b${w}\\b`, "i"));
const AI_TELLS = [
  ...STOCK_WORDS,
  /hope this (message |email )?finds you/i,
  /reach(ing)? out/i,
  /we('| a)re (thrilled|delighted|excited)/i,
  /not just .{1,40}, but/i,
];
const SUBJECT_SHAPE =
  /^[^|]+ \| [^|]+ \| [^|]+, (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}$/;

/**
 * Check a composed message against the standard. Returns an array of { code, message }; empty
 * means it passes. `allow` can list codes a specific email is excused from.
 */
export function lintMessage(message, { allow = [], bannedPhones = [] } = {}) {
  const found = [];
  const add = (code, text) => {
    if (!allow.includes(code)) found.push({ code, message: text });
  };
  const { subject = "", html = "", text = "" } = message;
  const all = `${subject}\n${html}\n${text}`;
  if (!SUBJECT_SHAPE.test(subject)) {
    add("subject-shape", `subject is not "Business | what | name, Month D, YYYY": ${subject}`);
  }
  if (all.includes(EM_DASH)) add("em-dash", "contains an em dash");
  if (/!/.test(`${subject}\n${text}`)) add("exclamation", "contains an exclamation mark");
  if (!text.trim()) add("no-text-part", "no plain-text part");
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes >= GMAIL_SAFE_BYTES) {
    add("gmail-clip", `html is ${bytes} bytes, Gmail clips at ${GMAIL_CLIP_BYTES}`);
  }
  if (!/color-scheme" content="light only"/.test(html)) {
    add("not-light-only", "does not declare light only");
  }
  if (/prefers-color-scheme\s*:\s*dark/i.test(html)) add("dark-mode", "ships a dark-mode style");
  if (!/max-width:600px/.test(html)) add("width", "no 600px column cap, so no 320px safety");
  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt="[^"]+"/.test(img)) {
      add("img-alt", "an image has no alt text, so images-off shows a hole");
    }
  }
  const lower = text.toLowerCase();
  for (const word of BRITISH) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) add("british", `British spelling: ${word}`);
  }
  for (const re of AI_TELLS) {
    if (re.test(text)) add("ai-tell", `AI copy tell: ${re}`);
  }
  for (const phone of bannedPhones) {
    if (all.replace(/\D/g, "").includes(String(phone).replace(/\D/g, ""))) {
      add("banned-phone", "contains a phone number that must never appear");
    }
  }
  if (/\b(1\s?[-.]?\s?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/.test(text)) {
    add("phone", "contains a phone number; confirm it is the business line, never a personal cell");
  }
  return found;
}
