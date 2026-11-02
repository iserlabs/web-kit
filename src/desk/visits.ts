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
  [key: string]: unknown;
};

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

/**
 * Whether one event is a page view on the production site, and if not, why not. "" keeps it.
 *
 * THE PROJECT TEST IS GENEROUS ON PURPOSE: an event is accepted when EITHER the project or the
 * team matches, and then only on the site's own address. A filter stricter than Vercel's real
 * payload would drop every visit in silence, which is worse than one that leans on the address.
 */
function skipReasonFor(e: VercelEvent | null | undefined, site: VisitSite): string {
  if (!e || typeof e !== "object") return "unreadable";
  if (e.eventType && e.eventType !== "pageview") return "custom-event";
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
const AI =
  /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com|bard\.google\.com|you\.com|phind\.com)$/;
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
  [/^(chatgpt\.com|chatgpt|openai|perplexity|claude)$/, "AI assistants"],
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

export type Source = { source: string; site: string };

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
  if (AI.test(host)) return { source: "AI assistants", site: "" };
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
  if (batch) base.batches = base.batches.concat([batch]).slice(-BATCH_MEMORY);
  return { record: base, folded, repeat: false };
}

/** A day nobody can add to any more: its hashes and fingerprints go, its counts stay. */
export function closeDay(record: DayRecord): DayRecord {
  return { ...record, ids: [], batches: [], closed: true };
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
    pages: ranked(maps.pages, totals.pageviews, 20),
    countries: ranked(maps.countries, totals.arrivals, 12),
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
