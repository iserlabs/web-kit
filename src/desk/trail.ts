import { cleanPath, nyDay, nyHour, type Source } from "./visits";

/**
 * How a person found the site, kept only when they write to the business.
 *
 * The visit counter is daily totals with no person in them, on purpose. So the browser keeps a small
 * trail for the site's own pages only: where this device first arrived from, where this visit began,
 * and the pages read in it. Nothing is sent anywhere while someone browses. The trail travels with
 * the inquiry the person chooses to send, is cleaned here to a short fixed shape (it is a visitor's
 * own input, so it is untrusted), and is stored beside that inquiry. A visitor who never writes to
 * the business is never recorded as a person.
 *
 * NO FREE TEXT: every field is a closed shape (a host name, a site path, a number, one of three
 * device words, a short tag), matching a closed-event analytics rule.
 */

export type SourceReader = (referrer: unknown, queryParams: unknown) => Source | null;

export type Leg = {
  t: number;
  land: string;
  ref: string;
  utm: { source?: string; medium?: string; campaign?: string };
};

export type Trail = {
  first: Leg | null;
  visit: Leg | null;
  pages: string[];
  seen: number;
  device: "Phone" | "Tablet" | "Computer" | "";
  lang: string;
};

const HOST = /^[a-z0-9][a-z0-9.-]{0,98}[a-z0-9]$/;
const DEVICES = new Set(["Phone", "Tablet", "Computer"]);
const TAG = /[^A-Za-z0-9 _.-]/g;

function when(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 1.5e12 && n < 4.1e12 ? Math.round(n) : null;
}
function host(v: unknown): string {
  const s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return HOST.test(s) ? s : "";
}
function path(v: unknown): string {
  const s = String(v ?? "");
  return s.startsWith("/") ? cleanPath(s) : "";
}
function utm(v: unknown): Leg["utm"] {
  const out: Leg["utm"] = {};
  const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  for (const k of ["source", "medium", "campaign"] as const) {
    const s = String(src[k] ?? "")
      .replace(TAG, "")
      .trim()
      .slice(0, 80);
    if (s) out[k] = s;
  }
  return out;
}
function leg(v: unknown): Leg | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const t = when(o.t);
  if (!t) return null;
  return { t, land: path(o.land) || "/", ref: host(o.ref), utm: utm(o.utm) };
}

/** The trail as stored, or null when the browser sent nothing usable. */
export function cleanTrail(raw: unknown): Trail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const first = leg(o.first);
  const visit = leg(o.visit);
  if (!first && !visit) return null;
  const pages = Array.isArray(o.pages) ? o.pages.slice(0, 25).map(path).filter(Boolean) : [];
  return {
    first,
    visit,
    pages,
    seen: Math.max(0, Math.min(500, Math.round(Number(o.seen) || 0))),
    device: DEVICES.has(String(o.device)) ? (o.device as Trail["device"]) : "",
    lang: String(o.lang ?? "")
      .replace(TAG, "")
      .slice(0, 12),
  };
}

function sourceLine(l: Leg | null, sourceOf: SourceReader): string {
  if (!l) return "";
  const q = new URLSearchParams();
  if (l.utm.source) q.set("utm_source", l.utm.source);
  if (l.utm.medium) q.set("utm_medium", l.utm.medium);
  const s = sourceOf(l.ref ? `https://${l.ref}/` : "", q.toString());
  /* Inside the site with no tag is not a source: it is a click, and the first leg says more. */
  if (!s) return "";
  return s.site && s.source === "Other websites" ? `a link on ${s.site}` : s.source;
}

/** "10/27/2026", the shape the rest of the Desk prints, on the New York calendar. */
function usDate(ms: number): string {
  const [y, m, d] = nyDay(ms).split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

function clock(ms: number): string {
  const h = Number(nyHour(ms));
  return `${usDate(ms)}, ${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

export type TrailWords = {
  how: string;
  source: string;
  landing: string;
  pages: string[];
  returning: boolean;
  firstSeen: string;
  visitStarted: string;
  device: string;
};

/**
 * The trail in plain words: where they came from, when, what they read, what they used. `sourceOf`
 * comes from the site's `createVisits`, so a click inside the site is not read as a source.
 */
export function describeTrail(
  t: Trail | null | undefined,
  sourceOf: SourceReader,
): TrailWords | null {
  if (!t) return null;
  const v = t.visit || t.first;
  const source = sourceLine(v, sourceOf) || sourceLine(t.first, sourceOf) || "Typed or bookmarked";
  const returning = Boolean(t.first && t.visit && t.first.t < t.visit.t - 30 * 60 * 1000);
  const parts = [source];
  if (v?.land) parts.push(`landed on ${v.land === "/" ? "the home page" : v.land}`);
  if (t.pages.length > 1) parts.push(`${t.pages.length} pages read`);
  if (returning && t.first) parts.push(`first seen ${usDate(t.first.t)}`);
  if (t.device) parts.push(t.device.toLowerCase());
  return {
    how: parts.join(" · "),
    source,
    landing: v ? v.land : "",
    pages: t.pages,
    returning,
    firstSeen: t.first ? usDate(t.first.t) : "",
    visitStarted: v ? clock(v.t) : "",
    device: t.device,
  };
}
