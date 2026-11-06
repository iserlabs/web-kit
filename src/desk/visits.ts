/**
 * How people find the website, counted from what Vercel's own visitor counter sends us.
 *
 * Pure arithmetic: no store, no network, no Node-only imports, so a Desk's screen and the tests can
 * use it too. Hashing and the signature check need `node:crypto` and stay in each site.
 *
 * THE SITE'S OWN FACTS ARE HANDED IN: `createVisits` takes its addresses and hosting IDs and returns
 * the functions that depend on them. Nothing about any one site lives in this file.
 *
 * ONE SMALL RECORD PER NEW YORK DAY, counts and short top lists. Nothing names a person: no IP
 * address is ever read, and the counter's device number is kept only as a salted hash, only while
 * the day can still receive late page views, only so one person reading five pages counts once.
 *
 * "HOW THEY FOUND IT" COUNTS ARRIVALS, NOT PAGES. A page view whose referrer is this site is
 * somebody clicking around inside it, so only the first page of a visit says where they came from.
 */

export const TZ = "America/New_York";

/** What one site tells the counter about itself. */
export type VisitSite = {
  /** The site's own addresses. A referrer from one of these is a click inside the site. */
  hosts: readonly string[];
  /** This project and team on Vercel. */
  project: string;
  team: string;
  /** Pages that are staff, not visitors. Defaults to the Desk, the review tool, /brand and /api. */
  staffPrefixes?: readonly string[];
  /** More hosts to count as event and art listings: the site's own local calendars and press. */
  listingHosts?: RegExp;
  /** More `utm_source` tags the site uses, as [pattern, source name]. */
  utmSources?: ReadonlyArray<readonly [RegExp, string]>;
};

export const CAPS: Record<string, number> = {
  pages: 60,
  sites: 30,
  campaigns: 30,
  countries: 40,
  regions: 60,
  cities: 60,
  entries: 40,
  engines: 20,
  browsers: 20,
  systems: 20,
};
export const OTHER = "(everything else)";
export const BATCH_MEMORY = 3000;
export const VISITOR_MEMORY = 50000;

const STAFF_PREFIXES: readonly string[] = ["/desk", "/review", "/brand", "/api"];

export type Counts = Record<string, number>;

export type VercelEvent = {
  eventType?: string;
  projectId?: string;
  ownerId?: string;
  vercelEnvironment?: string;
  origin?: string;
  timestamp?: number | string;
  path?: string;
  queryParams?: string;
  referrer?: string;
  deviceId?: string | number;
  deviceType?: string;
  country?: string;
  region?: string;
  city?: string;
  clientName?: string;
  osName?: string;
  /** A custom event's name, and its data: Vercel sends the data as a JSON string. */
  eventName?: string;
  eventData?: unknown;
  [key: string]: unknown;
};

/** The one custom event the Desk reads: how long a page was on screen, in whole seconds. */
export const PAGE_TIME_EVENT = "page_time";
/** One timing is clamped to this many seconds (30 minutes). */
export const MAX_PAGE_SECONDS = 1800;
/** One visitor's timings for one day stop adding at this many seconds (4 hours). */
export const MAX_VISITOR_SECONDS = 4 * 3600;

export type DayRecord = {
  day: string;
  pageviews: number;
  visitors: number;
  arrivals: number;
  ids: string[];
  idsFull: boolean;
  closed: boolean;
  pages: Counts;
  sources: Counts;
  sites: Counts;
  campaigns: Counts;
  countries: Counts;
  regions: Counts;
  cities: Counts;
  devices: Counts;
  hours: Counts;
  entries: Counts;
  browsers: Counts;
  systems: Counts;
  batches: string[];
  firstAt: string | null;
  lastAt: string | null;
  /*
   * Added after the first records were stored, so every one is optional: a day written before
   * these existed has none of them, and reading or folding into it must still work.
   */
  /** Arrivals from AI assistants, per engine (ChatGPT, Perplexity, ...). */
  engines?: Counts;
  /** Per page: total seconds on screen, and how many timings made that total. */
  pageSeconds?: Counts;
  pageTimed?: Counts;
  /** Per visitor (salted hash, dropped when the day closes): seconds on the site that day. */
  visitorSeconds?: Counts;
  /** Seconds on the site across every visitor, and how many visitors sent a timing. */
  siteSeconds?: number;
  timedVisitors?: number;
};

/* ------------------------------------------------------------------ reading a delivery */

/**
 * The events in one delivery. Vercel sends either a JSON array or one JSON object per line
 * (NDJSON); both are read, and so is a single object. `unreadable` counts lines that were not JSON.
 */
export function parseBody(raw: string | null | undefined): {
  events: VercelEvent[];
  unreadable: number;
} {
  const text = String(raw ?? "").trim();
  if (!text) return { events: [], unreadable: 0 };
  const objects = (v: unknown[]) =>
    v.filter((e): e is VercelEvent => !!e && typeof e === "object" && !Array.isArray(e));
  if (text[0] === "[") {
    try {
      const arr = JSON.parse(text);
      return { events: Array.isArray(arr) ? objects(arr) : [], unreadable: 0 };
    } catch {
      /* fall through to line by line */
    }
  }
  const events: VercelEvent[] = [];
  let unreadable = 0;
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) events.push(...objects(v));
      else if (v && typeof v === "object") events.push(v as VercelEvent);
      else unreadable += 1;
    } catch {
      unreadable += 1;
    }
  }
  return { events, unreadable };
}

function hostOf(url: unknown): string {
  try {
    return new URL(String(url)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** A page address as one line: no ".html", no trailing slash, the home page as "/". */
export function cleanPath(p: unknown): string {
  let s = ((String(p ?? "/").split("?")[0] as string).split("#")[0] as string).trim() || "/";
  if (s[0] !== "/") s = `/${s}`;
  s = s.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "");
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s.slice(0, 160) || "/";
}

function isStaffPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/** The data a custom event carries, as an object: Vercel sends a JSON string, an object is fine. */
function eventDataOf(e: VercelEvent): Record<string, unknown> {
  let d: unknown = e.eventData;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return {};
    }
  }
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}

/** Whether an event is the page-time custom event, whatever else is wrong with it. */
export function isPageTime(e: VercelEvent | null | undefined): boolean {
  return !!e && e.eventType === "event" && e.eventName === PAGE_TIME_EVENT;
}

/**
 * The whole seconds a page_time event reports, clamped to 1..1800, or 0 when it reports none.
 * Anything that is not a positive finite number is no timing at all.
 */
export function pageSecondsOf(e: VercelEvent): number {
  const raw = eventDataOf(e).seconds;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_PAGE_SECONDS, Math.max(1, Math.round(n)));
}

/**
 * The page a timing belongs to. The browser names it in the data because, when somebody moves to
 * another page, the counter stamps the event with the page they arrived on, not the one they left.
 */
function timedPathOf(e: VercelEvent): string {
  const named = eventDataOf(e).path;
  return cleanPath(typeof named === "string" && named ? named : e.path);
}

/**
 * Whether one event is a page view on the production site, and if not, why not. "" keeps it.
 *
 * THE PROJECT TEST IS GENEROUS ON PURPOSE: an event is accepted when EITHER the project or the
 * team matches, and then only on the site's own address. A filter stricter than Vercel's real
 * payload would drop every visit in silence, which is worse than one that leans on the address.
 */
function skipReasonFor(e: VercelEvent | null | undefined, site: VisitSite): string {
  if (!e || typeof e !== "object") return "unreadable";
  const timing = isPageTime(e);
  if (e.eventType && e.eventType !== "pageview" && !timing) return "custom-event";
  if (timing && !pageSecondsOf(e)) return "bad-page-time";
  const p = String(e.projectId || "");
  const o = String(e.ownerId || "");
  if ((p || o) && p !== site.project && o !== site.team) return "other-project";
  if (e.vercelEnvironment && e.vercelEnvironment !== "production") return "not-production";
  const host = hostOf(e.origin);
  if (e.origin && !site.hosts.includes(host)) return "other-site";
  if (!e.origin && !e.vercelEnvironment) return "not-production";
  if (!Number.isFinite(Number(e.timestamp))) return "no-time";
  if (
    isStaffPath(cleanPath(e.path), site.staffPrefixes ?? STAFF_PREFIXES) ||
    (timing && isStaffPath(timedPathOf(e), site.staffPrefixes ?? STAFF_PREFIXES)) ||
    /(^|&)edit=1(&|$)/.test(String(e.queryParams || ""))
  )
    return "desk";
  return "";
}

/* ------------------------------------------------------------------ the day */

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The New York calendar day a moment falls on, as YYYY-MM-DD. */
export function nyDay(ms: number | string): string {
  return DAY_FMT.format(new Date(Number(ms)));
}

/** The day before or after a YYYY-MM-DD day, by calendar, with no clock involved. */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = String(day).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Every day from `from` to `to`, inclusive, oldest first. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = shiftDay(d, 1)) out.push(d);
  return out;
}

/** The hour of day, "00" to "23", on the New York clock. */
export function nyHour(ms: number | string): string {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(Number(ms)))
    .find((p) => p.type === "hour");
  return h ? h.value.padStart(2, "0") : "";
}

/* ------------------------------------------------------------------ sources */

/** The plain-word groups for "How people found the site", in tie-break order. */
export const SOURCES = [
  "Google search",
  "Bing and other search engines",
  "AI assistants",
  "Instagram",
  "Facebook",
  "Other social media",
  "Newsletter",
  "Other email",
  "Event and art listings",
  "Other websites",
  "Typed or bookmarked",
] as const;

const SEARCH =
  /(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|baidu\.com|yandex\.[a-z.]+|search\.brave\.com|startpage\.com|kagi\.com|aol\.com|ask\.com|qwant\.com|naver\.com)$/;
/**
 * The AI assistants a visit can be traced to, by the address or app they came from. The group
 * "AI assistants" stays the headline; the engine is the detail beneath it.
 *
 * WHAT CANNOT BE SEPARATED: Google's AI Overviews and AI Mode send people with the same referrer
 * as ordinary Google search (google.com), so those visits are counted under "Google search" and
 * never guessed into an AI group. The same holds for Grok inside x.com and Duck.ai when it is
 * opened from duckduckgo.com: only an address that belongs to the assistant alone is counted.
 *
 * Android app ids (checked against the Play Store listing): ChatGPT com.openai.chatgpt, Gemini
 * com.google.android.apps.bard, Claude com.anthropic.claude, Perplexity ai.perplexity.app.android,
 * DeepSeek com.deepseek.chat, Grok ai.x.grok.
 */
const ENGINE_HOSTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$|^com\.openai\.chatgpt$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$|^ai\.perplexity\.app\.android$/, "Perplexity"],
  [/(^|\.)claude\.ai$|^com\.anthropic\.claude$/, "Claude"],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$|^com\.google\.android\.apps\.bard$/, "Gemini"],
  [/(^|\.)(copilot\.microsoft\.com|copilot\.cloud\.microsoft)$/, "Copilot"],
  [/(^|\.)chat\.deepseek\.com$|^com\.deepseek\.chat$/, "DeepSeek"],
  [/(^|\.)grok\.com$|^ai\.x\.grok$/, "Grok"],
  [/(^|\.)meta\.ai$/, "Meta AI"],
  [/(^|\.)poe\.com$/, "Poe"],
  [/(^|\.)chat\.mistral\.ai$/, "Mistral"],
  [/(^|\.)you\.com$/, "You.com"],
  [/(^|\.)phind\.com$/, "Phind"],
  [/(^|\.)duck\.ai$/, "Duck.ai"],
];

/** The engine names, in the order the Desk breaks ties. */
export const AI_ENGINES: readonly string[] = ENGINE_HOSTS.map(([, name]) => name);

/** The engine a link's own tag names (`utm_source=chatgpt.com`), or "". */
const UTM_ENGINES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(chatgpt\.com|chatgpt|openai)$/, "ChatGPT"],
  [/^(perplexity|perplexity\.ai)$/, "Perplexity"],
  [/^(claude|claude\.ai)$/, "Claude"],
  [/^gemini$/, "Gemini"],
  [/^copilot$/, "Copilot"],
];

function engineOfHost(host: string): string {
  for (const [re, name] of ENGINE_HOSTS) if (re.test(host)) return name;
  return "";
}
const INSTAGRAM = /(^|\.)instagram\.com$/;
const FACEBOOK = /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/;
const SOCIAL =
  /(^|\.)(t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|pinterest\.[a-z.]+|pin\.it|threads\.net|threads\.com|tiktok\.com|reddit\.com|youtube\.com|youtu\.be|bsky\.app|nextdoor\.com|tumblr\.com|snapchat\.com|whatsapp\.com|wa\.me)$/;
const MAIL =
  /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com|mail\.aol\.com|icloud\.com|mail\.proton\.me|resend\.com|resend\.dev)$/;
const LISTINGS = /(^|\.)(eventbrite\.com|allevents\.in|patch\.com)$/;
const GOOGLE = /(^|\.)google\.[a-z.]+$|^com\.google\.android\.googlequicksearchbox$/;

const UTM_SOURCES: Array<[RegExp, string]> = [
  [/^(newsletter|dispatch|resend)$/, "Newsletter"],
  [/^(ig|instagram)$/, "Instagram"],
  [/^(fb|facebook|meta)$/, "Facebook"],
  [/^google$/, "Google search"],
  [/^(bing|duckduckgo|yahoo)$/, "Bing and other search engines"],
  [/^(eventbrite|allevents)$/, "Event and art listings"],
  [/^(email|mail)$/, "Other email"],
];

/** The query string of an event, as a map, tolerating a leading "?" and junk. */
export function queryOf(qs: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const s = String(qs ?? "").replace(/^\?/, "");
  if (!s) return out;
  for (const part of s.split("&")) {
    const at = part.indexOf("=");
    const k = (at === -1 ? part : part.slice(0, at)).trim().toLowerCase();
    if (!k) continue;
    let v = at === -1 ? "" : part.slice(at + 1).replace(/\+/g, " ");
    try {
      v = decodeURIComponent(v);
    } catch {
      /* keep as sent */
    }
    if (!(k in out)) out[k] = v.trim();
  }
  return out;
}

/** `engine` is set only for "AI assistants": which one. */
export type Source = { source: string; site: string; engine?: string };

/**
 * Where one page view came from, or null when it is a click inside the site (not an arrival).
 * The site's own tagging wins over the referrer: a newsletter link opened in Gmail's web page has
 * Gmail as its referrer, and it is still the newsletter that brought them.
 */
function sourceOfFor(referrer: unknown, queryParams: unknown, site: VisitSite): Source | null {
  const q = queryOf(queryParams);
  const utmSource = String(q.utm_source || "").toLowerCase();
  const utmMedium = String(q.utm_medium || "").toLowerCase();
  if (utmSource) {
    for (const [re, engine] of UTM_ENGINES)
      if (re.test(utmSource)) return { source: "AI assistants", site: "", engine };
    for (const [re, name] of [...(site.utmSources ?? []), ...UTM_SOURCES])
      if (re.test(utmSource)) return { source: name, site: "" };
  }
  const ref = String(referrer ?? "").trim();
  let host = "";
  if (ref) {
    host = hostOf(ref) || hostOf(`https://${ref.replace(/^[a-z-]+:\/\//i, "")}`);
    if (/^android-app:\/\//i.test(ref))
      host = (ref.replace(/^android-app:\/\//i, "").split("/")[0] as string).toLowerCase();
  }
  if (host && site.hosts.includes(host)) {
    if (utmSource)
      return {
        source: utmMedium === "email" ? "Newsletter" : "Other websites",
        site: utmSource.slice(0, 60),
      };
    return null;
  }
  if (utmMedium === "email") return { source: "Other email", site: "" };
  if (!host) {
    if (utmSource) return { source: "Other websites", site: utmSource.slice(0, 60) };
    return { source: "Typed or bookmarked", site: "" };
  }
  const engine = engineOfHost(host);
  if (engine) return { source: "AI assistants", site: "", engine };
  if (LISTINGS.test(host) || site.listingHosts?.test(host))
    return { source: "Event and art listings", site: host.replace(/^www\./, "") };
  if (MAIL.test(host)) return { source: "Other email", site: "" };
  if (GOOGLE.test(host)) return { source: "Google search", site: "" };
  if (SEARCH.test(host)) return { source: "Bing and other search engines", site: "" };
  if (INSTAGRAM.test(host)) return { source: "Instagram", site: "" };
  if (FACEBOOK.test(host)) return { source: "Facebook", site: "" };
  if (SOCIAL.test(host)) return { source: "Other social media", site: "" };
  return { source: "Other websites", site: host.replace(/^www\./, "").slice(0, 80) };
}

/* ------------------------------------------------------------------ pieces of one view */

function decodeSafe(s: unknown): string {
  const v = String(s ?? "").trim();
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** The device in words the Desk would use. */
export function deviceOf(t: unknown): string {
  const s = String(t ?? "").toLowerCase();
  if (s === "mobile" || s === "smartphone" || s === "phone") return "Phone";
  if (s === "tablet") return "Tablet";
  if (s === "desktop") return "Computer";
  return s ? "Other" : "Not known";
}

export function plainName(v: unknown): string {
  return (
    String(v ?? "")
      .trim()
      .slice(0, 40) || "Not known"
  );
}

/* ------------------------------------------------------------------ folding */

export function emptyDay(day: string): DayRecord {
  return {
    day,
    pageviews: 0,
    visitors: 0,
    arrivals: 0,
    ids: [],
    idsFull: false,
    closed: false,
    pages: {},
    sources: {},
    sites: {},
    campaigns: {},
    countries: {},
    regions: {},
    cities: {},
    devices: {},
    hours: {},
    entries: {},
    browsers: {},
    systems: {},
    batches: [],
    firstAt: null,
    lastAt: null,
    engines: {},
    pageSeconds: {},
    pageTimed: {},
    visitorSeconds: {},
    siteSeconds: 0,
    timedVisitors: 0,
  };
}

function bump(map: Counts, key: string, n = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + n;
}

/** Cut a count map down to its top `cap` keys, adding the rest into one OTHER line. */
export function capMap(map: Counts, cap: number): Counts {
  const keys = Object.keys(map || {});
  if (keys.length <= cap) return map;
  const sorted = keys
    .filter((k) => k !== OTHER)
    .sort((a, b) => (map[b] as number) - (map[a] as number) || a.localeCompare(b));
  const out: Counts = {};
  let rest = map[OTHER] || 0;
  sorted.forEach((k, i) => {
    if (i < cap - 1) out[k] = map[k] as number;
    else rest += map[k] as number;
  });
  if (rest) out[OTHER] = rest;
  return out;
}

/**
 * Cut a pair of maps that share their keys (seconds and how many timings made them) to the top
 * `cap` keys by timings, folding the rest into one OTHER line in both, so the pair stays whole.
 */
export function capPairs(
  seconds: Counts,
  timed: Counts,
  cap: number,
): { seconds: Counts; timed: Counts } {
  const keys = Object.keys(timed || {});
  if (keys.length <= cap) return { seconds, timed };
  const sorted = keys
    .filter((k) => k !== OTHER)
    .sort((a, b) => (timed[b] as number) - (timed[a] as number) || a.localeCompare(b));
  const outS: Counts = {};
  const outT: Counts = {};
  let restS = seconds[OTHER] || 0;
  let restT = timed[OTHER] || 0;
  sorted.forEach((k, i) => {
    if (i < cap - 1) {
      outS[k] = seconds[k] || 0;
      outT[k] = timed[k] as number;
    } else {
      restS += seconds[k] || 0;
      restT += timed[k] as number;
    }
  });
  if (restT || restS) {
    outS[OTHER] = restS;
    outT[OTHER] = restT;
  }
  return { seconds: outS, timed: outT };
}

/**
 * Add one page_time event to a day. The page gets its seconds; the visitor (by the same salted
 * hash as the visit, never a raw id) gets the same seconds toward their time on the site, up to
 * four hours a day so one script cannot lift the average. Mutates `base`, which is already a copy.
 */
function foldTiming(base: DayRecord, e: VercelEvent, hash: string) {
  let seconds = pageSecondsOf(e);
  if (!seconds) return;
  base.visitorSeconds ??= {};
  const perVisitor = base.visitorSeconds;
  let counts = true;
  if (hash && !base.closed) {
    const have = perVisitor[hash] || 0;
    if (have === 0 && Object.keys(perVisitor).length >= VISITOR_MEMORY) {
      base.idsFull = true;
      counts = false;
    } else {
      seconds = Math.min(seconds, MAX_VISITOR_SECONDS - have);
      if (seconds <= 0) return;
      if (have === 0) base.timedVisitors = (base.timedVisitors || 0) + 1;
      perVisitor[hash] = have + seconds;
    }
  } else if (!hash) {
    /* No device number: its own visitor, as a page view with no number is. */
    base.timedVisitors = (base.timedVisitors || 0) + 1;
  } else {
    /* A closed day keeps no hashes, so this visitor cannot be told from one already counted. */
    counts = false;
  }
  if (counts) base.siteSeconds = (base.siteSeconds || 0) + seconds;
  const path = timedPathOf(e);
  base.pageSeconds ??= {};
  base.pageTimed ??= {};
  bump(base.pageSeconds, path, seconds);
  /* A continuation (the page was hidden, then shown again) adds time to a page view already counted. */
  bump(base.pageTimed, path, eventDataOf(e).more === true ? 0 : 1);
}

/**
 * Fold the accepted events of one day into that day's record. Returns a new record; the one
 * passed in is not changed. A delivery already folded into this day (same fingerprint) changes
 * nothing, so Vercel sending a batch again after a failure cannot count it twice.
 * `hasher` turns the counter's device number into a one-way stand-in, supplied by the site.
 */
function foldDayFor(
  record: DayRecord | null,
  events: VercelEvent[],
  site: VisitSite,
  { batch = "", hasher = (_id: unknown, _day: string) => "" as string } = {},
): { record: DayRecord; folded: number; repeat: boolean } {
  const base: DayRecord = record
    ? JSON.parse(JSON.stringify(record))
    : emptyDay(events.length ? nyDay((events[0] as VercelEvent).timestamp as number) : "");
  const day = base.day;
  if (batch && base.batches.includes(batch)) return { record: base, folded: 0, repeat: true };
  const ids = new Set(base.ids || []);
  let folded = 0;
  for (const e of events) {
    folded += 1;
    if (isPageTime(e)) {
      foldTiming(base, e, hasher(e.deviceId, day));
      continue;
    }
    base.pageviews += 1;
    const at = new Date(Number(e.timestamp)).toISOString();
    if (!base.firstAt || at < base.firstAt) base.firstAt = at;
    if (!base.lastAt || at > base.lastAt) base.lastAt = at;
    bump(base.pages, cleanPath(e.path));
    const h = hasher(e.deviceId, day);
    if (h && !base.closed && !ids.has(h)) {
      if (ids.size < VISITOR_MEMORY) {
        ids.add(h);
        base.visitors += 1;
      } else base.idsFull = true;
    } else if (!h) {
      /* No device number at all: count the view as its own visitor rather than as nobody. */
      base.visitors += 1;
    }
    const src = sourceOfFor(e.referrer, e.queryParams, site);
    if (src) {
      base.arrivals += 1;
      bump(base.sources, src.source);
      if (src.site) bump(base.sites, src.site);
      if (src.engine) {
        base.engines ??= {};
        bump(base.engines, src.engine);
      }
      const q = queryOf(e.queryParams);
      if (q.utm_campaign) bump(base.campaigns, String(q.utm_campaign).slice(0, 80));
      const country = String(e.country || "")
        .toUpperCase()
        .slice(0, 2);
      bump(base.countries, country || "Not known");
      if (country === "US" && e.region)
        bump(base.regions, String(e.region).toUpperCase().slice(0, 3));
      const city = decodeSafe(e.city).slice(0, 60);
      if (city)
        bump(
          base.cities,
          country === "US" && e.region
            ? `${city}, ${String(e.region).toUpperCase()}`
            : country
              ? `${city}, ${country}`
              : city,
        );
      bump(base.devices, deviceOf(e.deviceType));
      bump(base.hours, nyHour(e.timestamp as number));
      bump(base.entries, cleanPath(e.path));
      bump(base.browsers, plainName(e.clientName));
      bump(base.systems, plainName(e.osName));
    }
  }
  base.ids = base.closed ? [] : Array.from(ids);
  for (const k of [
    "pages",
    "sites",
    "campaigns",
    "countries",
    "regions",
    "cities",
    "entries",
    "browsers",
    "systems",
  ] as const)
    base[k] = capMap(base[k], CAPS[k] as number);
  if (base.engines) base.engines = capMap(base.engines, CAPS.engines as number);
  if (base.pageSeconds && base.pageTimed) {
    const capped = capPairs(base.pageSeconds, base.pageTimed, CAPS.pages as number);
    base.pageSeconds = capped.seconds;
    base.pageTimed = capped.timed;
  }
  if (batch) base.batches = base.batches.concat([batch]).slice(-BATCH_MEMORY);
  return { record: base, folded, repeat: false };
}

/** A day nobody can add to any more: its hashes and fingerprints go, its counts stay. */
export function closeDay(record: DayRecord): DayRecord {
  return {
    ...record,
    ids: [],
    batches: [],
    closed: true,
    ...(record.visitorSeconds ? { visitorSeconds: {} } : {}),
  };
}

/** Sort one delivery out by day: `{ byDay, skipped: {reason: n}, accepted }`. */
function sortBatchFor(events: VercelEvent[], site: VisitSite) {
  const byDay: Record<string, VercelEvent[]> = {};
  const skipped: Counts = {};
  let accepted = 0;
  for (const e of events || []) {
    const why = skipReasonFor(e, site);
    if (why) {
      skipped[why] = (skipped[why] || 0) + 1;
      continue;
    }
    const d = nyDay(e.timestamp as number);
    byDay[d] = byDay[d] || [];
    byDay[d].push(e);
    accepted += 1;
  }
  return { byDay, skipped, accepted };
}

/* ------------------------------------------------------------------ the Desk's view */

function addInto(into: Counts, map: Counts | undefined) {
  for (const k of Object.keys(map || {})) into[k] = (into[k] || 0) + ((map as Counts)[k] as number);
}

export type Row = { name: string; n: number; share: number | null };
export type Ranked = { rows: Row[]; rest: number };

function ranked(map: Counts, total: number, limit: number): Ranked {
  const rows = Object.keys(map || {})
    .filter((k) => k !== OTHER)
    .sort((a, b) => (map[b] as number) - (map[a] as number) || a.localeCompare(b))
    .map((k) => ({
      name: k,
      n: map[k] as number,
      share: total > 0 ? Math.round(((map[k] as number) / total) * 100) : null,
    }));
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((n, r) => n + r.n, 0) + (map[OTHER] || 0);
  return { rows: shown, rest };
}

export type Summary = ReturnType<typeof summarize>;

/**
 * What the Visitors view shows for a stretch of days ending `today`: totals, one bar per day, and
 * the ranked lists. Days with no record after the first day with data are real zeros (the counter
 * was connected and nobody came); days before it are "not counted yet" and are left off.
 */
export function summarize(
  records: Array<DayRecord | null | undefined>,
  { today, days = 30, firstDay = null as string | null } = { today: "" },
) {
  const have = new Map(
    (records || []).filter((r): r is DayRecord => !!r && !!r.day).map((r) => [r.day, r]),
  );
  const first = firstDay || (have.size ? Array.from(have.keys()).sort()[0] : null);
  const from = shiftDay(today, -(days - 1));
  const span = daysBetween(from, today);
  const totals = { pageviews: 0, visitors: 0, arrivals: 0 };
  const site = { seconds: 0, visitors: 0 };
  const mapKeys = [
    "pages",
    "sources",
    "sites",
    "campaigns",
    "countries",
    "regions",
    "cities",
    "devices",
    "hours",
    "entries",
    "browsers",
    "systems",
    "engines",
    "pageSeconds",
    "pageTimed",
  ] as const;
  const maps = {} as Record<(typeof mapKeys)[number], Counts>;
  for (const k of mapKeys) maps[k] = {};
  const byDay: Array<{ day: string; pageviews: number; visitors: number }> = [];
  const weekdayVisitors = [0, 0, 0, 0, 0, 0, 0];
  for (const d of span) {
    if (!first || d < first) continue;
    const r = have.get(d);
    byDay.push({ day: d, pageviews: r ? r.pageviews : 0, visitors: r ? r.visitors : 0 });
    if (!r) continue;
    totals.pageviews += r.pageviews;
    totals.visitors += r.visitors;
    totals.arrivals += r.arrivals;
    site.seconds += r.siteSeconds || 0;
    site.visitors += r.timedVisitors || 0;
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    weekdayVisitors[weekday] = (weekdayVisitors[weekday] as number) + r.visitors;
    for (const k of mapKeys) addInto(maps[k], (r as unknown as Record<string, Counts>)[k]);
  }
  /* Averages use finished days only: today is still filling. */
  const done = byDay.filter((r) => r.day < today);
  const mean = (rows: Array<{ visitors: number }>) =>
    rows.length ? Math.round(rows.reduce((a, r) => a + r.visitors, 0) / rows.length) : null;
  const busiest = byDay.reduce<{ day: string; visitors: number } | null>(
    (best, r) =>
      r.visitors > (best ? best.visitors : 0) ? { day: r.day, visitors: r.visitors } : best,
    null,
  );
  const average = mean(done);
  /* The same number of days straight before, but only when every one of them was counted. */
  let previous: { average: number; change: number | null } | null = null;
  const prevFrom = shiftDay(from, -days);
  if (first && prevFrom >= first) {
    const prevRows = daysBetween(prevFrom, shiftDay(from, -1))
      .map((d) => have.get(d))
      .filter((r): r is DayRecord => !!r);
    const prevAvg = mean(prevRows);
    if (prevRows.length === days && prevAvg != null) {
      previous = {
        average: prevAvg,
        change:
          average != null && prevAvg > 0 ? Math.round(((average - prevAvg) / prevAvg) * 100) : null,
      };
    }
  }
  const sourceRows = SOURCES.map((s) => ({ name: s as string, n: maps.sources[s] || 0 }))
    .filter((r) => r.n > 0)
    .sort(
      (a, b) =>
        b.n - a.n ||
        (SOURCES as readonly string[]).indexOf(a.name) -
          (SOURCES as readonly string[]).indexOf(b.name),
    )
    .map((r) => ({
      ...r,
      share: totals.arrivals ? Math.round((r.n / totals.arrivals) * 100) : null,
    }));
  const aiArrivals = maps.sources["AI assistants"] || 0;
  const named = Object.values(maps.engines).reduce((a, b) => a + b, 0);
  const pages = ranked(maps.pages, totals.pageviews, 20);
  const average1 = (secs: number, n: number) => (n > 0 ? Math.round(secs / n) : null);
  const pageTimes: Record<string, { average: number; n: number }> = {};
  const timedNames = new Set([
    ...pages.rows.map((r) => r.name),
    ...ranked(maps.pageTimed, 0, 30).rows.map((r) => r.name),
  ]);
  for (const name of timedNames) {
    const n = maps.pageTimed[name] || 0;
    const avg = average1(maps.pageSeconds[name] || 0, n);
    if (avg != null) pageTimes[name] = { average: avg, n };
  }
  return {
    connected: Boolean(first),
    firstDay: first,
    average,
    busiest,
    previous,
    from: first && first > from ? first : from,
    to: today,
    days,
    ...totals,
    byDay,
    sources: sourceRows,
    sites: ranked(maps.sites, totals.arrivals, 15),
    pages,
    /** Average seconds on screen per page, for the listed pages; none until a timing arrives. */
    pageTimes,
    /** Average seconds on the site per visitor who sent a timing, and how many did. */
    timeOnSite: { average: average1(site.seconds, site.visitors), visitors: site.visitors },
    /** AI assistants: arrivals in the group, how many of them name the engine, and the engines. */
    aiArrivals,
    aiUnnamed: Math.max(0, aiArrivals - named),
    aiEngines: ranked(maps.engines, aiArrivals, 13),
    countries: ranked(maps.countries, totals.arrivals, 12),
    regions: ranked(maps.regions, totals.arrivals, 15),
    cities: ranked(maps.cities, totals.arrivals, 15),
    devices: ranked(maps.devices, totals.arrivals, 5),
    campaigns: ranked(maps.campaigns, totals.arrivals, 30),
    entries: ranked(maps.entries, totals.arrivals, 15),
    hours: Array.from({ length: 24 }, (_, i) => {
      const h = String(i).padStart(2, "0");
      return { hour: h, n: maps.hours[h] || 0 };
    }),
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
      (name, i) => ({ name, n: weekdayVisitors[i] as number }),
    ),
    pagesPerVisitor: totals.visitors
      ? Math.round((totals.pageviews / totals.visitors) * 10) / 10
      : null,
  };
}

/**
 * A newsletter's tag is its id, which means nothing to a reader. Swap each id for the letter's own
 * subject where the Desk knows it, and leave an id it does not know exactly as it came.
 */
export function nameCampaigns(ranked: Ranked, subjects: ReadonlyMap<string, string>): Ranked {
  return {
    ...ranked,
    rows: ranked.rows.map((r) => ({ ...r, name: subjects.get(r.name) || r.name })),
  };
}

/**
 * The functions that depend on the site, bound to it. Each site calls this once, in its own
 * `visits` file, with its addresses and hosting IDs.
 */
export function createVisits(site: VisitSite) {
  return {
    skipReason: (e: VercelEvent | null | undefined) => skipReasonFor(e, site),
    sourceOf: (referrer: unknown, queryParams: unknown) => sourceOfFor(referrer, queryParams, site),
    foldDay: (
      record: DayRecord | null,
      events: VercelEvent[],
      opts?: { batch?: string; hasher?: (id: unknown, day: string) => string },
    ) => foldDayFor(record, events, site, opts),
    sortBatch: (events: VercelEvent[]) => sortBatchFor(events, site),
  };
}
