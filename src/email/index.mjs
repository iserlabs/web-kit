/**
 * The shared email framework: one letterhead layout, one subject convention, one reference format,
 * one plain-text part, and one explicit on/off switch per kind of email.
 *
 * What lives here is general. Facts about a business (its name, colors, header artwork, sender
 * address, the words of each email) live in that business's own repo and are passed in.
 *
 * Layout: the paper letterhead from brand-pack/letterheads.mjs, the same renderer the drafts Jake
 * sends himself use, so a form confirmation and a hand-sent letter share one design source.
 *
 * Nothing in this file delivers mail. `deliver()` takes a transport the site already owns and
 * refuses unless the kind's switch is on.
 */

import {
  letterheadDocument,
  letterheadPlainText,
  renderLetterhead,
} from "../brand-pack/letterheads.mjs";

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
 * The blocks of a confirmation: greeting, what was received, a reference, what happens next, who
 * replies. Every part is optional except `lead`.
 */
export function confirmationBlocks({
  recipientName,
  lead,
  received,
  reference,
  referenceLabel = "Reference",
  next,
  nextIntro = "What happens next:",
  replyLine,
  close = "Thank you.",
}) {
  if (!lead) throw new Error("email: a confirmation needs a lead sentence");
  const greeting = first(recipientName) ? `Hello ${first(recipientName)},` : "Hello,";
  const rows = [
    ...(received ?? []).map(([label, value]) => ({ label, value })),
    ...(reference ? [{ label: referenceLabel, value: reference }] : []),
  ].filter((r) => r.value !== undefined && String(r.value).trim() !== "");
  return [
    { type: "p", text: greeting },
    { type: "lead", text: lead },
    ...(rows.length ? [{ type: "ledger", rows }] : []),
    ...(next?.length ? [{ type: "list", intro: nextIntro, items: next }] : []),
    ...(replyLine ? [{ type: "p", text: replyLine }] : []),
    { type: "close", text: close },
  ];
}

/**
 * Build one email, ready for a transport. `brand` is client data:
 *   { business, config (the brand-pack config), person, from, replyTo, fontsHref?, variant? }
 * `blocks` is the body (see confirmationBlocks). Returns { from, to, replyTo, subject, html, text,
 * reference, headers }.
 */
export function composeEmail({
  brand,
  to,
  kind,
  who,
  reference,
  date,
  timeZone,
  blocks,
  replyTo,
  from,
}) {
  if (!brand?.config || !brand?.person || !brand?.business) {
    throw new Error("email: brand needs business, config and person");
  }
  if (!to) throw new Error("email: no recipient");
  const subject = emailSubject({ business: brand.business, kind, who, reference, date, timeZone });
  const email = { subject, blocks };
  const variant = brand.variant ?? "paper";
  const body = renderLetterhead(variant, brand.config, brand.person, email, brand.signatureHtml);
  const html = letterheadDocument(body, { subject, fontsHref: brand.fontsHref });
  const text = letterheadPlainText(email, brand.person);
  return {
    from: from ?? brand.from,
    to,
    replyTo: replyTo ?? brand.replyTo,
    subject,
    html,
    text,
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
    blocks: confirmationBlocks({ recipientName, ...content }),
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
