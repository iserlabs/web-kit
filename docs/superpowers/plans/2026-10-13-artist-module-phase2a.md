# Artist Module Phase 2a (Shows and Press Kit Logic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the framework-free logic for shows and the press kit to `@iserlabs/web-kit/artist` (status in the site's time zone, homepage notice, on-view, validation, stored-data sanitizing, exhibition schema, CV lines from shows, a shows store, a shows route handler, the press-kit assembler and press tokens), then wire Julian's studio to create, edit, publish and delete shows and his CV to print published shows, with nothing visible changing on any public page.

**Architecture:** One new kit unit `src/artist/shows.ts` owns the `Show` type and every rule about a show; `cv.ts` gains `cvFromShows` and `mergeCv`; `press-kit.ts` (new) assembles the press kit and owns the press token; `studio-store.ts` returns the existing `StudioStore` plus two sibling stores, `shows` and `press`, without widening `StudioStore`; `handlers.ts` gains `showsHandler` and an async-safe `onError`. Julian's site passes a time zone and a shows key from `src/artist.config.ts`, mounts `/api/studio/shows`, adds a Shows section and a "No store is connected" state to the studio, and builds `/cv` from his hand-entered CV merged with his published, opened shows.

**Tech Stack:** TypeScript (kit: TS 7, lib-oriented tsconfig with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`; Julian: TS 6, `tsconfig-next`), Vitest 4, Biome 2.5, pnpm 10, Next.js 16 and React 19 (Julian only), Web Crypto, `Intl.DateTimeFormat`, Web `Request`/`Response`, Upstash REST over `fetch`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-10-12-artist-module-design.md`, sections "Shows (new)", "Press kit (new)" and "Correctness". Phase 2a only: kit logic plus Julian's studio and CV wiring. OUT of scope: any public visible surface (the `/shows/[slug]` page, the homepage notice component, the `/press/[token]` page), because those wait on the design board; `web-kit artist init`; payments; a route that rotates the press token (it belongs with the press page).
- **Repos and branches:** kit worktree `/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`, branch `artist-module`, starting at `3b860d9`. Julian `/Users/macbook/Claude/julianpotulicki`, branch `artist-module`, starting at `760b4a8`. Never touch the kit's main checkout `~/Claude/_tools/web-kit`. Never push either repo. Publishing (phase 1 Task 12 style) is out of scope.
- **pnpm only.** Never `npm` or `yarn`.
- **Commits:** always `git -c commit.gpgsign=false commit -m "..."`. No `Co-Authored-By` line, no "Generated with" line, no mention of Claude or AI anywhere: commit messages, code, comments. Both repos are iserlabs client repos.
- **Staging:** add files by explicit path. Never `git add -A` or `git add .`. Julian's untracked `docs/boards/` must never be committed.
- **Writing:** American English only (catalog, fulfillment, behavior, color). No em dashes (U+2014) in any file, comment, test name or commit message. In shell checks match the em dash by its bytes, `$'\xe2\x80\x94'`. Studio copy for Julian is plain words: "held back", not "draft".
- **Kit rules:** `src/artist/` imports nothing from React or Next. Handlers take a Web `Request` and return a `Response`. Types are imported with `import type` or inline `type` specifiers. Indexed access is guarded (`noUncheckedIndexedAccess`). Kit code must also compile under Julian's `tsconfig-next`.
- **Public surface is additive.** `StudioStore` is never widened: `createStudioStore` returns `StudioStore & { shows: ShowsStore; press: PressStore }` (type name `StudioStores`), so every fake implementing `StudioStore` and every Julian call site keeps compiling. `ArtistConfig` gains only optional fields. New names are appended to `src/artist/index.test.ts`; no name is removed.
- **Dates:** a show's `startsOn`, `endsOn` and `opening.on` are calendar dates (`YYYY-MM-DD`) read in the site's time zone, default `America/New_York`, through `Intl.DateTimeFormat`. Never `new Date("2026-11-07")` (that parses as UTC midnight). `Date.UTC` appears only to check a date exists or to count days between two calendar dates, never to place a date on a clock.
- **Honest content:** never invent show facts or prices in anything that ships. Test fixtures use obviously fake values ("Test Gallery", "Test City", "Test Show", round test prices) and live only in `*.test.ts` files. Julian's `src/content/cv.ts` gains no entries.
- **No data moved, no Upstash writes.** Nothing in this plan writes to Upstash. Kit tests use injected fake `fetch`. Every Julian QA build and server runs with `KV_REST_API_URL=` and `KV_REST_API_TOKEN=` set empty (Next keeps an explicitly set empty value over `.env.local`), except the one end-to-end check in Task 11, which points at a local stand-in store on `127.0.0.1` and proves it is talking to the stand-in before any write.
- **Tailwind sees every word.** Julian's Tailwind scans source text, comments included, for class names (phase 1 lost a `.filter` rule because a comment stopped saying "filter"). New Julian code uses only class names already present in `src/app/studio/StudioClient.tsx`, and new comments and copy avoid bare utility words such as static, fixed, hidden, inline, contents, table, filter, blur, grow, shrink, truncate, italic, underline, uppercase, lowercase, capitalize, relative, absolute, sticky, isolate, collapse, invisible. Task 11 proves `css.txt` is byte-identical to `.qa/D`.
- **Julian after any kit edit:** `file:` copies the kit into `node_modules/.pnpm`, so run `pnpm install` in Julian's repo before testing (an online install; `--offline` fails here).
- **Test counts:** kit baseline 311 tests in 43 files at `3b860d9`. Julian baseline 45 tests in 7 files at `760b4a8`.
- **QA snapshots** live in Julian's gitignored `.qa/`. `.qa/A` is the untouched original site; `.qa/D` is the accepted phase-1 result, identical to A in pages, headers, studio API and route table, and different in `css.txt` only by the two accepted differences (the `.filter` rule absent, `.dark` gaining the kit token contract lines). This plan writes `.qa/E`.

---

## File Structure

**Kit** (`/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`)

| File | Change | Responsibility |
|---|---|---|
| `src/artist/shows.ts` | create | `Show`, `ShowRecord`, `ShowKind`, `ShowStatus`, `SHOW_KINDS`, `DEFAULT_TIME_ZONE`, `showStatus`, `noticeShow`, `onView`, `cleanShow`, `sanitizeStoredShows`, `showJsonLd` |
| `src/artist/shows.test.ts` | create | time-zone boundary, DST, notice, on-view, validation, stored-data, schema tests |
| `src/artist/cv.ts`, `cv.test.ts` | modify | `cvFromShows`, `mergeCv`, `ShowCvEntries` |
| `src/artist/bytes.ts` | create | internal `b64url` and `safeEqual`, shared by studio auth and press tokens; not in the barrel |
| `src/artist/studio-auth.ts` | modify | import `b64url` and `safeEqual` from `./bytes` instead of keeping private copies |
| `src/artist/press-kit.ts`, `press-kit.test.ts` | create | `pressKit`, price list, `generatePressToken`, `isPressToken`, `pressTokenMatches` |
| `src/artist/studio-store.ts`, `studio-store.test.ts` | modify | `showsKey`, `pressKey`, `ShowsStore`, `PressStore`, `StudioStores` |
| `src/artist/handlers.ts`, `handlers.test.ts` | modify | `showsHandler`, `StudioErrorContext`, `StudioErrorReporter` (async-safe), shared body reader |
| `src/artist/config.ts` | modify | optional `artistName`, `timeZone`, `series`, `studio.showsKey`, `press` |
| `src/artist/index.ts`, `index.test.ts` | modify | barrel and surface list |
| `CHANGELOG.md`, `README.md`, `CLAUDE.md` | modify | 0.11.0 notes, usage, Exports line |

**Julian** (`/Users/macbook/Claude/julianpotulicki`)

| File | Change |
|---|---|
| `src/artist.config.ts` | `timeZone: "America/New_York"`, `studio.showsKey: "studio:julian:shows"` |
| `src/lib/studio.ts`, `studio.test.ts` | pass `showsKey`; export `studioShows` |
| `src/app/api/studio/shows/route.ts` | create: `showsHandler` with Sentry `onError` |
| `src/content/cv.ts`, `cv.test.ts` | `cvWithShows(shows, now)` |
| `src/app/cv/page.tsx` | reads published shows and prints `cvWithShows` |
| `src/app/studio/page.tsx` | store state decided before Julian types; reads shows |
| `src/app/studio/StudioClient.tsx` | "No store is connected" and "store did not answer" states; Shows section |
| `scripts/qa/render-snapshot.mjs` | probes the shows API into a separate `shows-api.json` |
| `docs/superpowers/RESUME-julian.md` | status line |

---

### Task 1: Kit: the Show type and its status in the site's time zone

**Files:**
- Create: `src/artist/shows.ts`
- Test: `src/artist/shows.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (later tasks rely on these exact names):
  - `interface Show { slug; title; kind: "solo" | "group" | "two-person" | "event"; venue; address?; city; startsOn; endsOn; opening?: { on; from; to? }; workSlugs: string[]; href?; note?; publish: "published" | "draft" }`
  - `type ShowKind = Show["kind"]`, `type ShowRecord = Show & { updatedAt?: string; updatedBy?: string }`, `type ShowStatus = "upcoming" | "current" | "past"`
  - `const SHOW_KINDS: ReadonlySet<ShowKind>`, `const DEFAULT_TIME_ZONE = "America/New_York"`
  - `showStatus(show: Pick<Show, "startsOn" | "endsOn">, now: Date, timeZone?: string): ShowStatus`
  - `noticeShow<T extends Show>(shows: readonly T[], now: Date, timeZone?: string): T | undefined`
  - `onView<T extends Show>(workSlug: string, shows: readonly T[], now: Date, timeZone?: string): T | undefined`

- [ ] **Step 1: Write the failing tests**

Create `src/artist/shows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, noticeShow, onView, type Show, showStatus } from "./shows";

/** Obviously fake facts: nothing here describes a real show. */
const show = (over: Partial<Show> = {}): Show => ({
  slug: "test-show",
  title: "Test Show",
  kind: "solo",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "published",
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("showStatus reads dates in the site's time zone, never UTC", () => {
  it("defaults to New York", () => {
    expect(DEFAULT_TIME_ZONE).toBe("America/New_York");
  });

  it("has not opened at 10 PM in New York on the eve, when UTC is already on the first day", () => {
    // 2026-11-07T03:00Z is 10:00 PM on November 6 in New York.
    expect(showStatus(show(), at("2026-11-07T03:00:00Z"))).toBe("upcoming");
    expect(showStatus(show(), at("2026-11-07T03:00:00Z"), "UTC")).toBe("current");
  });

  it("opens at midnight New York time", () => {
    expect(showStatus(show(), at("2026-11-07T04:59:59Z"))).toBe("upcoming");
    expect(showStatus(show(), at("2026-11-07T05:00:00Z"))).toBe("current");
  });

  it("is still on at 11:59 PM in New York on its last day, when UTC is already on the next", () => {
    expect(showStatus(show(), at("2026-12-06T04:59:59Z"))).toBe("current");
    expect(showStatus(show(), at("2026-12-06T04:59:59Z"), "UTC")).toBe("past");
    expect(showStatus(show(), at("2026-12-06T05:00:00Z"))).toBe("past");
  });

  it("counts the last day as open all day", () => {
    expect(showStatus(show(), at("2026-12-05T17:00:00Z"))).toBe("current");
  });

  it("reads a time zone east of UTC on its own calendar", () => {
    // 2026-11-06T15:00Z is midnight on November 7 in Tokyo and 10 AM on November 6 in New York.
    expect(showStatus(show(), at("2026-11-06T14:59:59Z"), "Asia/Tokyo")).toBe("upcoming");
    expect(showStatus(show(), at("2026-11-06T15:00:00Z"), "Asia/Tokyo")).toBe("current");
    expect(showStatus(show(), at("2026-11-06T15:00:00Z"))).toBe("upcoming");
  });

  it("uses the real offset on the night the clocks fall back", () => {
    // Daylight saving ends 2026-11-01. A fixed EDT offset would call 04:59Z on Nov 2 the next day.
    const s = show({ startsOn: "2026-10-01", endsOn: "2026-11-01" });
    expect(showStatus(s, at("2026-11-02T04:59:59Z"))).toBe("current");
    expect(showStatus(s, at("2026-11-02T05:00:00Z"))).toBe("past");
  });

  it("uses the real offset on the night the clocks spring forward", () => {
    // Daylight saving starts 2027-03-14. A fixed EST offset would call 04:00Z on Mar 15 the day before.
    const closing = show({ startsOn: "2027-02-01", endsOn: "2027-03-13" });
    expect(showStatus(closing, at("2027-03-14T04:59:59Z"))).toBe("current");
    expect(showStatus(closing, at("2027-03-14T05:00:00Z"))).toBe("past");
    const opening = show({ startsOn: "2027-03-15", endsOn: "2027-04-15" });
    expect(showStatus(opening, at("2027-03-15T03:59:59Z"))).toBe("upcoming");
    expect(showStatus(opening, at("2027-03-15T04:00:00Z"))).toBe("current");
  });

  it("throws on a time zone that does not exist, rather than guessing", () => {
    expect(() => showStatus(show(), at("2026-11-07T17:00:00Z"), "Mars/Olympus")).toThrow(
      RangeError,
    );
  });
});

describe("noticeShow: what the homepage mentions", () => {
  it("names the show on now", () => {
    expect(noticeShow([show()], at("2026-11-20T17:00:00Z"))?.slug).toBe("test-show");
  });

  it("comes down the day after the show closes, with no manual step", () => {
    expect(noticeShow([show()], at("2026-12-05T17:00:00Z"))?.slug).toBe("test-show");
    expect(noticeShow([show()], at("2026-12-06T04:59:59Z"))?.slug).toBe("test-show");
    expect(noticeShow([show()], at("2026-12-06T05:00:00Z"))).toBeUndefined();
  });

  it("names the next show once it is 45 days out, and not before", () => {
    // In New York, November 7 is 46 days after September 22 and 45 days after September 23.
    expect(noticeShow([show()], at("2026-09-22T16:00:00Z"))).toBeUndefined();
    expect(noticeShow([show()], at("2026-09-23T16:00:00Z"))?.slug).toBe("test-show");
  });

  it("never mentions a held-back show", () => {
    expect(noticeShow([show({ publish: "draft" })], at("2026-11-20T17:00:00Z"))).toBeUndefined();
  });

  it("prefers the show on now over a sooner upcoming one", () => {
    const onNow = show({ slug: "on-now", startsOn: "2026-11-01", endsOn: "2026-11-30" });
    const next = show({ slug: "next", startsOn: "2026-11-10", endsOn: "2026-11-20" });
    expect(noticeShow([next, onNow], at("2026-11-05T17:00:00Z"))?.slug).toBe("on-now");
  });

  it("of two upcoming shows, names the one opening first", () => {
    const later = show({ slug: "later", startsOn: "2026-11-20", endsOn: "2026-12-20" });
    const sooner = show({ slug: "sooner", startsOn: "2026-11-10", endsOn: "2026-12-30" });
    expect(noticeShow([later, sooner], at("2026-11-01T17:00:00Z"))?.slug).toBe("sooner");
  });

  it("of two shows on now, names the one closing first", () => {
    const long = show({ slug: "long", startsOn: "2026-11-01", endsOn: "2026-12-31" });
    const short = show({ slug: "short", startsOn: "2026-11-05", endsOn: "2026-11-15" });
    expect(noticeShow([long, short], at("2026-11-10T17:00:00Z"))?.slug).toBe("short");
  });

  it("returns nothing when there are no shows", () => {
    expect(noticeShow([], at("2026-11-10T17:00:00Z"))).toBeUndefined();
  });
});

describe("onView: the show a work is hanging in", () => {
  const during = at("2026-11-20T17:00:00Z");

  it("returns the published show on now that lists the work", () => {
    expect(onView("waterscape-01", [show()], during)?.slug).toBe("test-show");
  });

  it("returns nothing for a work the show does not list", () => {
    expect(onView("floral-01", [show()], during)).toBeUndefined();
  });

  it("returns nothing before the show opens and after it closes", () => {
    expect(onView("waterscape-01", [show()], at("2026-11-07T04:59:59Z"))).toBeUndefined();
    expect(onView("waterscape-01", [show()], at("2026-12-06T05:00:00Z"))).toBeUndefined();
  });

  it("ignores a held-back show", () => {
    expect(onView("waterscape-01", [show({ publish: "draft" })], during)).toBeUndefined();
  });

  it("reads the day in the time zone it is given", () => {
    const midnightInTokyo = at("2026-11-06T15:00:00Z");
    expect(onView("waterscape-01", [show()], midnightInTokyo, "Asia/Tokyo")?.slug).toBe(
      "test-show",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | tail -8`
Expected: FAIL, "Failed to resolve import "./shows"" (the module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/artist/shows.ts`:

```ts
/**
 * Shows: the exhibitions and evenings an artist's work hangs in.
 *
 * A show is typed once, in the studio, by the artist, because the facts are theirs:
 * a show goes live only once its venue and dates are entered, and nothing here
 * invents one. From that one record the site derives the rest: whether the show is
 * upcoming, on now or past, the homepage notice, which works are on view (and so not
 * for sale on the site), the CV line and the exhibition schema.
 *
 * Status is computed, never stored. A show's dates are calendar dates in the site's
 * own time zone, so "2026-11-07" means the whole of that day in New York (by
 * default). Parsed as UTC it would open a New York show at 7 PM the evening before.
 */

export interface Show {
  slug: string;
  title: string;
  kind: "solo" | "group" | "two-person" | "event";
  venue: string;
  address?: string;
  city: string;
  /** "2026-11-07", a calendar date in the site's time zone. */
  startsOn: string;
  /** The last day the show is open, inclusive. */
  endsOn: string;
  /** The opening reception: "2026-11-07", "18:00", "21:00". */
  opening?: { on: string; from: string; to?: string };
  workSlugs: string[];
  /** The gallery's own page for the show. */
  href?: string;
  /** One line in the artist's words, printed verbatim. */
  note?: string;
  publish: "published" | "draft";
}

export type ShowKind = Show["kind"];

/** A show as the studio stores it: the show, plus who saved it and when. */
export type ShowRecord = Show & { updatedAt?: string; updatedBy?: string };

export type ShowStatus = "upcoming" | "current" | "past";

/** The one list of show kinds. cleanShow and sanitizeStoredShows both read it. */
export const SHOW_KINDS: ReadonlySet<ShowKind> = new Set<ShowKind>([
  "solo",
  "two-person",
  "group",
  "event",
]);

/** Where show dates are read when a site names no time zone of its own. */
export const DEFAULT_TIME_ZONE = "America/New_York";

/** How far ahead the homepage notice looks for the next show. */
const NOTICE_WINDOW_DAYS = 45;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date `now` falls on in `timeZone`, as "YYYY-MM-DD". Intl applies the
    zone's real offset at that instant, daylight saving included. An unknown time zone
    throws a RangeError, so a misspelled config fails loudly rather than reading dates
    in the wrong place. */
function dateIn(now: Date, timeZone: string): string {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, format);
  }
  let year = "";
  let month = "";
  let day = "";
  for (const part of format.formatToParts(now)) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" calendar date. Calendar arithmetic only:
    Date.UTC counts days here and never places the date on a clock. */
function dayNumber(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Closing soonest first, then opening first, then by slug, so the answer never
    depends on the order the store happened to list the shows in. */
function byClosing(a: Show, b: Show): number {
  return order(a.endsOn, b.endsOn) || order(a.startsOn, b.startsOn) || order(a.slug, b.slug);
}

function byOpening(a: Show, b: Show): number {
  return order(a.startsOn, b.startsOn) || order(a.endsOn, b.endsOn) || order(a.slug, b.slug);
}

/** Upcoming before its first day, current through its last day inclusive, past from
    the day after it closes. Every day is a day in `timeZone`. */
export function showStatus(
  show: Pick<Show, "startsOn" | "endsOn">,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): ShowStatus {
  const today = dateIn(now, timeZone);
  if (today < show.startsOn) return "upcoming";
  if (today > show.endsOn) return "past";
  return "current";
}

/** The show the homepage should mention: the published show on now (the one closing
    soonest, if two overlap), or else the next published show opening within 45 days,
    or nothing. The line comes down by itself the day after a show closes. */
export function noticeShow<T extends Show>(
  shows: readonly T[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): T | undefined {
  const published = shows.filter((s) => s.publish === "published");
  const current = published
    .filter((s) => showStatus(s, now, timeZone) === "current")
    .sort(byClosing);
  if (current[0]) return current[0];
  const today = dayNumber(dateIn(now, timeZone));
  return published
    .filter(
      (s) =>
        showStatus(s, now, timeZone) === "upcoming" &&
        dayNumber(s.startsOn) - today <= NOTICE_WINDOW_DAYS,
    )
    .sort(byOpening)[0];
}

/** The published show a work is hanging in today, or undefined. A work on view is
    never buyable on the site, so a gallery never has a piece sold out from under it. */
export function onView<T extends Show>(
  workSlug: string,
  shows: readonly T[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): T | undefined {
  return shows
    .filter(
      (s) =>
        s.publish === "published" &&
        s.workSlugs.includes(workSlug) &&
        showStatus(s, now, timeZone) === "current",
    )
    .sort(byClosing)[0];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | grep -E "Test Files|Tests "`
Expected: `Tests  22 passed (22)`.

- [ ] **Step 5: Format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/shows.ts src/artist/shows.test.ts && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/shows.ts src/artist/shows.test.ts
```

Expected: typecheck prints nothing after the script line, lint ends `Checked N files ... No fixes applied` with no errors, and both em dash counts are `0`.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/shows.ts src/artist/shows.test.ts && git -c commit.gpgsign=false commit -m "artist: shows, with status, homepage notice and on-view read in the site's time zone"
```

---
### Task 2: Kit: validating a show write, and sanitizing stored shows

**Files:**
- Modify: `src/artist/shows.ts` (new imports at the top, new code appended at the end)
- Test: `src/artist/shows.test.ts` (new imports, new tests appended)

**Interfaces:**
- Consumes: `Show`, `ShowRecord`, `ShowKind`, `SHOW_KINDS` (Task 1); `cleanText`, `PUBLISH` from `./overlay`; `StudioCatalog` (type) from `./handlers`.
- Produces:
  - `type CleanShowResult = { ok: true; show: Show } | { ok: false; problems: string[] }`
  - `cleanShow(body: Record<string, unknown>, catalog: StudioCatalog): CleanShowResult`
  - `sanitizeStoredShows(raw: unknown): Record<string, ShowRecord>` (keyed by slug, stored key order kept)
  - The exact problem strings below; Task 7's handler tests and Julian's studio print them.

- [ ] **Step 1: Write the failing tests**

In `src/artist/shows.test.ts`, replace the import line:

```ts
import { DEFAULT_TIME_ZONE, noticeShow, onView, type Show, showStatus } from "./shows";
```

with:

```ts
import {
  cleanShow,
  DEFAULT_TIME_ZONE,
  noticeShow,
  onView,
  type Show,
  type ShowRecord,
  sanitizeStoredShows,
  showStatus,
} from "./shows";
```

Append to the end of `src/artist/shows.test.ts`:

```ts
describe("cleanShow: what the studio may save", () => {
  const catalog = { has: (slug: string) => slug === "waterscape-01" || slug === "floral-01" };
  const valid: Record<string, unknown> = {
    slug: "test-show",
    title: "  Test Show  ",
    kind: "group",
    venue: "Test Gallery",
    address: "1 Test Street",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    opening: { on: "2026-11-07", from: "18:00", to: "21:00" },
    workSlugs: ["waterscape-01", "floral-01", "waterscape-01"],
    href: "https://gallery.example.test/test-show",
    note: "A line in the artist's words.",
    publish: "published",
    extra: "not a show field",
  };

  const NAME = "The show needs a short web name: lowercase letters, digits and single hyphens.";
  const FIRST_DAY = "The first day must be a real date, written 2026-11-07.";
  const LAST_DAY = "The last day must be a real date, written 2026-11-07.";
  const KIND = "Choose the kind of show: solo, two-person, group or event.";
  const OPENING_IN_RUN = "The opening reception must fall within the run of the show.";
  const OPENING_FROM = "The opening reception needs a start time, written 18:00.";
  const HREF =
    "The gallery's page must be a full web address starting with https:// or http://.";

  it("keeps a complete show, trimmed, with each work listed once and unknown fields dropped", () => {
    expect(cleanShow(valid, catalog)).toEqual({
      ok: true,
      show: {
        slug: "test-show",
        title: "Test Show",
        kind: "group",
        venue: "Test Gallery",
        address: "1 Test Street",
        city: "Test City",
        startsOn: "2026-11-07",
        endsOn: "2026-12-05",
        opening: { on: "2026-11-07", from: "18:00", to: "21:00" },
        workSlugs: ["waterscape-01", "floral-01"],
        href: "https://gallery.example.test/test-show",
        note: "A line in the artist's words.",
        publish: "published",
      },
    });
  });

  it("holds a show back unless it is marked published", () => {
    const { publish: _publish, ...rest } = valid;
    const result = cleanShow(rest, catalog);
    expect(result.ok && result.show.publish).toBe("draft");
  });

  it("drops blank optional fields and an opening left entirely blank", () => {
    const result = cleanShow(
      {
        ...valid,
        address: " ",
        href: "",
        note: "",
        opening: { on: "", from: "", to: "" },
        workSlugs: [],
      },
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.show).not.toHaveProperty("address");
    expect(result.show).not.toHaveProperty("href");
    expect(result.show).not.toHaveProperty("note");
    expect(result.show).not.toHaveProperty("opening");
    expect(result.show.workSlugs).toEqual([]);
  });

  it("keeps an opening with no end time", () => {
    const result = cleanShow({ ...valid, opening: { on: "2026-11-07", from: "18:00" } }, catalog);
    expect(result.ok && result.show.opening).toEqual({ on: "2026-11-07", from: "18:00" });
  });

  it("cuts long text to length, the way a work's fields are cut", () => {
    const result = cleanShow({ ...valid, title: "T".repeat(500), note: "N".repeat(1000) }, catalog);
    expect(result.ok && result.show.title.length).toBe(200);
    expect(result.ok && result.show.note?.length).toBe(300);
  });

  it("names every missing required fact at once", () => {
    const result = cleanShow({}, catalog);
    expect(result.ok ? [] : result.problems).toEqual([
      NAME,
      "Give the show a title.",
      KIND,
      "Name the venue.",
      "Name the city.",
      FIRST_DAY,
      LAST_DAY,
    ]);
  });

  const refusals: [string, Record<string, unknown>, string][] = [
    ["a day that does not exist", { startsOn: "2026-02-30" }, FIRST_DAY],
    ["a thirteenth month", { endsOn: "2026-13-01" }, LAST_DAY],
    ["a date written month first", { startsOn: "11/07/2026" }, FIRST_DAY],
    ["a last day before the first", { endsOn: "2026-11-06" }, "The last day cannot come before the first."],
    ["an opening before the run", { opening: { on: "2026-11-06", from: "18:00" } }, OPENING_IN_RUN],
    ["an opening after the run", { opening: { on: "2026-12-06", from: "18:00" } }, OPENING_IN_RUN],
    ["an opening with no start time", { opening: { on: "2026-11-07" } }, OPENING_FROM],
    ["an opening time in words", { opening: { on: "2026-11-07", from: "6pm" } }, OPENING_FROM],
    ["an hour past 23", { opening: { on: "2026-11-07", from: "24:00" } }, OPENING_FROM],
    [
      "a minute past 59",
      { opening: { on: "2026-11-07", from: "18:00", to: "21:60" } },
      "The opening reception's end time must be written 21:00.",
    ],
    [
      "an opening time with no date",
      { opening: { from: "18:00" } },
      "The opening reception needs a real date, written 2026-11-07.",
    ],
    [
      "a work not in the catalog",
      { workSlugs: ["waterscape-01", "not-a-work"] },
      '"not-a-work" is not a work on this site.',
    ],
    ["a work that is not a slug", { workSlugs: [7] }, "One of the works could not be read."],
    ["works that are not a list", { workSlugs: "waterscape-01" }, "Could not read the list of works."],
    ["a kind outside the four", { kind: "retrospective" }, KIND],
    ["a publish state outside the two", { publish: "live" }, "Choose published or held back."],
    ["a slug with spaces", { slug: "Test Show" }, NAME],
    ["a slug with a double hyphen", { slug: "test--show" }, NAME],
    ["a slug over 120 characters", { slug: "a".repeat(121) }, NAME],
    ["a gallery page that is not a web address", { href: "gallery.example.test" }, HREF],
    ["a gallery page that runs script", { href: "javascript:alert(1)" }, HREF],
    ["an opening that is not an object", { opening: "the first night" }, "Could not read the opening reception."],
  ];

  it.each(refusals)("refuses %s", (_label, change, problem) => {
    const result = cleanShow({ ...valid, ...change }, catalog);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems).toContain(problem);
  });
});

describe("sanitizeStoredShows: what is read back from the store", () => {
  const stored: ShowRecord = {
    slug: "test-show",
    title: "Test Show",
    kind: "solo",
    venue: "Test Gallery",
    address: "1 Test Street",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    opening: { on: "2026-11-07", from: "18:00", to: "21:00" },
    workSlugs: ["waterscape-01"],
    href: "https://gallery.example.test/test-show",
    note: "A line.",
    publish: "published",
    updatedAt: "2026-10-13T00:00:00.000Z",
    updatedBy: "artist",
  };

  it("reads a valid show back unchanged, nested key order included", () => {
    const reordered = {
      publish: "published",
      opening: { to: "21:00", from: "18:00", on: "2026-11-07" },
      endsOn: "2026-12-05",
      startsOn: "2026-11-07",
      updatedBy: "artist",
      city: "Test City",
      venue: "Test Gallery",
      kind: "solo",
      title: "Test Show",
      slug: "test-show",
      workSlugs: ["waterscape-01"],
    };
    const raw = { "test-show": reordered, "other-show": { ...stored, slug: "other-show" } };
    expect(JSON.stringify(sanitizeStoredShows(raw))).toBe(JSON.stringify(raw));
  });

  it("keeps the shows in stored order", () => {
    const raw = { b: { ...stored, slug: "b" }, a: { ...stored, slug: "a" } };
    expect(Object.keys(sanitizeStoredShows(raw))).toEqual(["b", "a"]);
  });

  const broken: [string, unknown][] = [
    ["a slug that does not match its key", { ...stored, slug: "another-show" }],
    ["no title", { ...stored, title: undefined }],
    ["a blank venue", { ...stored, venue: "  " }],
    ["an unknown kind", { ...stored, kind: "retrospective" }],
    ["a day that does not exist", { ...stored, startsOn: "2026-02-30" }],
    ["a last day before the first", { ...stored, endsOn: "2026-11-01" }],
    ["works that are not a list", { ...stored, workSlugs: "waterscape-01" }],
    ["works that are not slugs", { ...stored, workSlugs: [1] }],
    ["an unknown publish state", { ...stored, publish: "live" }],
    ["a string", "junk"],
    ["null", null],
  ];

  it.each(broken)("drops a whole show with %s", (_label, entry) => {
    expect(sanitizeStoredShows({ "test-show": entry })).toEqual({});
  });

  it("drops only the wrongly shaped optional fields, and keeps the show", () => {
    const raw = {
      "test-show": {
        ...stored,
        href: "javascript:alert(1)",
        note: 7,
        address: ["1 Test Street"],
        opening: { on: "2026-12-06", from: "18:00" },
        extra: "not a show field",
      },
    };
    const {
      href: _href,
      note: _note,
      address: _address,
      opening: _opening,
      ...expected
    } = stored;
    expect(sanitizeStoredShows(raw)).toEqual({ "test-show": expected });
  });

  it.each([[null], ["junk"], [[1, 2]], [42]])("treats stored %j as no shows", (raw) => {
    expect(sanitizeStoredShows(raw)).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | tail -8`
Expected: FAIL, `cleanShow is not a function` (or the equivalent "does not provide an export named" error).

- [ ] **Step 3: Write the implementation**

At the very top of `src/artist/shows.ts`, before the opening `/**` comment, add:

```ts
import type { StudioCatalog } from "./handlers";
import { cleanText, PUBLISH } from "./overlay";

```

Append to the end of `src/artist/shows.ts`:

```ts
/* ------------------------------------------------------------------ validation */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 120;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_WORKS = 100;
const MAX_HREF = 500;

const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isIn = <T>(set: ReadonlySet<T>, v: unknown): v is T => set.has(v as T);
const blank = (v: unknown): boolean =>
  v === undefined || v === null || (isStr(v) && v.trim() === "");
const filled = (v: unknown): v is string => isStr(v) && v.trim() !== "";
const isSlug = (v: unknown): v is string => isStr(v) && v.length <= MAX_SLUG && SLUG.test(v);
const isTime = (v: unknown): v is string => isStr(v) && TIME.test(v);

/** A real day on the calendar between 1900 and 2100, written "YYYY-MM-DD". Refuses
    "2026-02-30" and "11/07/2026". Date.UTC only checks that the day exists; nothing
    is placed on a clock. */
function isCalendarDate(v: unknown): v is string {
  if (!isStr(v)) return false;
  const m = DATE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** An http or https address, so a stored link can never run script. */
function isWebAddress(v: unknown): v is string {
  if (!isStr(v) || v.length > MAX_HREF) return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export type CleanShowResult = { ok: true; show: Show } | { ok: false; problems: string[] };

/**
 * The one validation every show write passes. Unlike a work's overlay, a show has
 * required facts, so a form missing one is refused with every problem named in plain
 * words rather than saved half-empty. An optional field left blank is dropped; an
 * optional field filled in wrongly is refused, because silently dropping what the
 * artist typed is how a show goes up without its opening.
 *
 * Every listed work must exist in the site's catalog, so a show cannot conjure a
 * painting. Text is trimmed and cut to length the way cleanOverlay cuts it.
 */
export function cleanShow(body: Record<string, unknown>, catalog: StudioCatalog): CleanShowResult {
  const problems: string[] = [];

  const slug = isStr(body.slug) ? body.slug.trim() : "";
  if (!isSlug(slug)) {
    problems.push("The show needs a short web name: lowercase letters, digits and single hyphens.");
  }
  const title = cleanText(body.title, 200);
  if (!title) problems.push("Give the show a title.");
  const kind = isIn(SHOW_KINDS, body.kind) ? body.kind : undefined;
  if (!kind) problems.push("Choose the kind of show: solo, two-person, group or event.");
  const venue = cleanText(body.venue, 200);
  if (!venue) problems.push("Name the venue.");
  const city = cleanText(body.city, 120);
  if (!city) problems.push("Name the city.");
  const address = cleanText(body.address, 300);

  const startsOn = isCalendarDate(body.startsOn) ? body.startsOn : undefined;
  if (!startsOn) problems.push("The first day must be a real date, written 2026-11-07.");
  const endsOn = isCalendarDate(body.endsOn) ? body.endsOn : undefined;
  if (!endsOn) problems.push("The last day must be a real date, written 2026-11-07.");
  if (startsOn && endsOn && endsOn < startsOn) {
    problems.push("The last day cannot come before the first.");
  }

  let opening: Show["opening"];
  if (!blank(body.opening)) {
    const o = body.opening;
    if (!isObj(o)) {
      problems.push("Could not read the opening reception.");
    } else if (!(blank(o.on) && blank(o.from) && blank(o.to))) {
      const on = isCalendarDate(o.on) ? o.on : undefined;
      if (!on) {
        problems.push("The opening reception needs a real date, written 2026-11-07.");
      } else if (startsOn && endsOn && (on < startsOn || on > endsOn)) {
        problems.push("The opening reception must fall within the run of the show.");
      }
      const from = isTime(o.from) ? o.from : undefined;
      if (!from) problems.push("The opening reception needs a start time, written 18:00.");
      const to = isTime(o.to) ? o.to : undefined;
      const toOk = blank(o.to) || to !== undefined;
      if (!toOk) problems.push("The opening reception's end time must be written 21:00.");
      if (on && from && toOk) opening = to ? { on, from, to } : { on, from };
    }
  }

  const workSlugs: string[] = [];
  if (!blank(body.workSlugs)) {
    const listed: unknown = body.workSlugs;
    if (!Array.isArray(listed)) {
      problems.push("Could not read the list of works.");
    } else {
      for (const entry of listed as unknown[]) {
        if (!isStr(entry)) {
          problems.push("One of the works could not be read.");
        } else if (!catalog.has(entry)) {
          problems.push(`"${entry.slice(0, 120)}" is not a work on this site.`);
        } else if (!workSlugs.includes(entry)) {
          workSlugs.push(entry);
        }
      }
      if (workSlugs.length > MAX_WORKS) {
        problems.push(`A show can list at most ${MAX_WORKS} works.`);
      }
    }
  }

  let href: string | undefined;
  if (!blank(body.href)) {
    const candidate = isStr(body.href) ? body.href.trim() : "";
    if (isWebAddress(candidate)) href = candidate;
    else {
      problems.push(
        "The gallery's page must be a full web address starting with https:// or http://.",
      );
    }
  }
  const note = cleanText(body.note, 300);

  let publish: Show["publish"] = "draft";
  if (!blank(body.publish)) {
    if (isIn(PUBLISH, body.publish)) publish = body.publish;
    else problems.push("Choose published or held back.");
  }

  if (problems.length > 0 || !title || !kind || !venue || !city || !startsOn || !endsOn) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    show: {
      slug,
      title,
      kind,
      venue,
      ...(address ? { address } : {}),
      city,
      startsOn,
      endsOn,
      ...(opening ? { opening } : {}),
      workSlugs,
      ...(href ? { href } : {}),
      ...(note ? { note } : {}),
      publish,
    },
  };
}

/**
 * Whatever is stored may be wrongly shaped (hand-edited, an older version, another
 * writer). A show missing any required fact is dropped whole, because half a show
 * cannot be printed honestly; a wrongly shaped optional field is dropped alone. The
 * stored slug must match its key. Valid data passes through unchanged, in the stored
 * key order, so re-saving never reshuffles it. The catalog is not checked here: a
 * page that prints a show links only the works that exist.
 */
export function sanitizeStoredShows(raw: unknown): Record<string, ShowRecord> {
  const out: Record<string, ShowRecord> = {};
  if (!isObj(raw)) return out;
  for (const key of Object.keys(raw)) {
    const show = storedShow(key, raw[key]);
    if (show) out[key] = show;
  }
  return out;
}

function storedShow(key: string, v: unknown): ShowRecord | undefined {
  if (!isObj(v) || v.slug !== key || !isSlug(v.slug)) return undefined;
  if (!filled(v.title) || !isIn(SHOW_KINDS, v.kind) || !filled(v.venue) || !filled(v.city)) {
    return undefined;
  }
  const startsOn = v.startsOn;
  const endsOn = v.endsOn;
  if (!isCalendarDate(startsOn) || !isCalendarDate(endsOn) || endsOn < startsOn) return undefined;
  if (!Array.isArray(v.workSlugs) || !(v.workSlugs as unknown[]).every(isStr)) return undefined;
  if (!isIn(PUBLISH, v.publish)) return undefined;

  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v)) {
    const x = v[k];
    switch (k) {
      case "slug":
      case "title":
      case "kind":
      case "venue":
      case "city":
      case "startsOn":
      case "endsOn":
      case "workSlugs":
      case "publish":
        out[k] = x;
        break;
      case "address":
      case "note":
      case "updatedAt":
      case "updatedBy":
        if (isStr(x)) out[k] = x;
        break;
      case "href":
        if (isWebAddress(x)) out.href = x;
        break;
      case "opening":
        if (
          isObj(x) &&
          isCalendarDate(x.on) &&
          x.on >= startsOn &&
          x.on <= endsOn &&
          isTime(x.from) &&
          (x.to === undefined || isTime(x.to))
        ) {
          const op: Record<string, unknown> = {};
          for (const ok of Object.keys(x)) {
            if (ok === "on" || ok === "from" || ok === "to") op[ok] = x[ok];
          }
          out.opening = op;
        }
        break;
    }
  }
  return out as ShowRecord;
}
```

`shows.ts` imports a type from `handlers.ts` while Task 7 makes `handlers.ts` import `cleanShow` from `shows.ts`; the type import is erased at compile time, so there is no runtime cycle.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | grep -E "Test Files|Tests "`
Expected: `Tests  68 passed (68)` (22 from Task 1, 28 for `cleanShow`, 18 for `sanitizeStoredShows`).

- [ ] **Step 5: Format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/shows.ts src/artist/shows.test.ts && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/shows.ts src/artist/shows.test.ts
```

Expected: typecheck and lint clean; both counts `0`. If Biome reports a style rule the `--write` pass cannot fix (for example a nested ternary), rewrite that line by hand to an `if` and rerun.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/shows.ts src/artist/shows.test.ts && git -c commit.gpgsign=false commit -m "artist: cleanShow names every problem with a show write, and stored shows degrade safely"
```

---

### Task 3: Kit: the exhibition schema

**Files:**
- Modify: `src/artist/shows.ts` (append)
- Test: `src/artist/shows.test.ts` (import, append)

**Interfaces:**
- Consumes: `Show` (Task 1).
- Produces:
  - `interface ShowSite { url: string; workPath?: (slug: string) => string; showPath?: (slug: string) => string }`
  - `showJsonLd(show: Show, site: ShowSite): Record<string, unknown>`, an `ExhibitionEvent` whose `workFeatured` entries carry the same `@id` the work page uses (`<origin>/work/<slug>#artwork` by default).

- [ ] **Step 1: Write the failing tests**

In `src/artist/shows.test.ts`, add `showJsonLd,` to the import list from `./shows` (after `sanitizeStoredShows,`). Append:

```ts
describe("showJsonLd: the exhibition, for search engines", () => {
  const site = { url: "https://artist.example.test/" };

  it("describes the show as an ExhibitionEvent with its place, dates and works", () => {
    const full = show({
      address: "1 Test Street",
      note: "A line.",
      href: "https://gallery.example.test/test-show",
      workSlugs: ["waterscape-01", "floral-01"],
    });
    expect(showJsonLd(full, site)).toEqual({
      "@context": "https://schema.org",
      "@type": "ExhibitionEvent",
      "@id": "https://artist.example.test/shows/test-show#exhibition",
      name: "Test Show",
      url: "https://artist.example.test/shows/test-show",
      startDate: "2026-11-07",
      endDate: "2026-12-05",
      location: {
        "@type": "Place",
        name: "Test Gallery",
        address: {
          "@type": "PostalAddress",
          streetAddress: "1 Test Street",
          addressLocality: "Test City",
        },
      },
      description: "A line.",
      sameAs: "https://gallery.example.test/test-show",
      workFeatured: [
        {
          "@type": "VisualArtwork",
          "@id": "https://artist.example.test/work/waterscape-01#artwork",
          url: "https://artist.example.test/work/waterscape-01",
        },
        {
          "@type": "VisualArtwork",
          "@id": "https://artist.example.test/work/floral-01#artwork",
          url: "https://artist.example.test/work/floral-01",
        },
      ],
    });
  });

  it("prints nothing for a fact the show does not have", () => {
    const ld = showJsonLd(show({ workSlugs: [] }), site);
    expect(ld).not.toHaveProperty("description");
    expect(ld).not.toHaveProperty("sameAs");
    expect((ld.location as { address: object }).address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Test City",
    });
    expect(ld.workFeatured).toEqual([]);
  });

  it("follows a site's own page addresses", () => {
    const ld = showJsonLd(show(), {
      url: "https://artist.example.test",
      workPath: (slug) => `/works/${slug}`,
      showPath: (slug) => `/exhibitions/${slug}`,
    });
    expect(ld.url).toBe("https://artist.example.test/exhibitions/test-show");
    expect(ld.workFeatured).toEqual([
      {
        "@type": "VisualArtwork",
        "@id": "https://artist.example.test/works/waterscape-01#artwork",
        url: "https://artist.example.test/works/waterscape-01",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | tail -6`
Expected: FAIL, `showJsonLd is not a function`.

- [ ] **Step 3: Write the implementation**

Append to the end of `src/artist/shows.ts`:

```ts
/* ------------------------------------------------------------------ schema */

export interface ShowSite {
  /** The site's origin, e.g. "https://julianpotulicki.com". A trailing slash is ignored. */
  url: string;
  /** Path of a work's page. Default `/work/<slug>`. */
  workPath?: (slug: string) => string;
  /** Path of a show's page. Default `/shows/<slug>`. */
  showPath?: (slug: string) => string;
}

/**
 * The show as schema.org's ExhibitionEvent, for the show's own page: its place, its
 * dates and the works hanging in it. Each work is referenced by the same @id its own
 * page gives its VisualArtwork, so search engines join the two. An absent fact
 * prints nothing.
 */
export function showJsonLd(show: Show, site: ShowSite): Record<string, unknown> {
  const origin = site.url.replace(/\/+$/, "");
  const workPath = site.workPath ?? ((slug: string) => `/work/${slug}`);
  const showPath = site.showPath ?? ((slug: string) => `/shows/${slug}`);
  const page = `${origin}${showPath(show.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    "@id": `${page}#exhibition`,
    name: show.title,
    url: page,
    startDate: show.startsOn,
    endDate: show.endsOn,
    location: {
      "@type": "Place",
      name: show.venue,
      address: {
        "@type": "PostalAddress",
        ...(show.address ? { streetAddress: show.address } : {}),
        addressLocality: show.city,
      },
    },
    ...(show.note ? { description: show.note } : {}),
    ...(show.href ? { sameAs: show.href } : {}),
    workFeatured: show.workSlugs.map((slug) => ({
      "@type": "VisualArtwork",
      "@id": `${origin}${workPath(slug)}#artwork`,
      url: `${origin}${workPath(slug)}`,
    })),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | grep -E "Test Files|Tests "`
Expected: `Tests  71 passed (71)`.

- [ ] **Step 5: Format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/shows.ts src/artist/shows.test.ts && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/shows.ts src/artist/shows.test.ts
```

Expected: clean; `0`, `0`.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/shows.ts src/artist/shows.test.ts && git -c commit.gpgsign=false commit -m "artist: ExhibitionEvent schema for a show, joined to each work's own record"
```

---

### Task 4: Kit: CV lines from shows

**Files:**
- Modify: `src/artist/cv.ts`
- Test: `src/artist/cv.test.ts`

**Interfaces:**
- Consumes: `Show`, `showStatus`, `DEFAULT_TIME_ZONE` (Task 1); `Cv`, `CvEntry`, `newestFirst` (phase 1).
- Produces:
  - `type ShowCvEntries = Pick<Cv, "soloExhibitions" | "groupExhibitions">`
  - `cvFromShows(shows: readonly Show[], now: Date, timeZone?: string): ShowCvEntries`
  - `mergeCv(cv: Cv, fromShows: ShowCvEntries): Cv`

- [ ] **Step 1: Write the failing tests**

In `src/artist/cv.test.ts`, replace the import line:

```ts
import { type Cv, cvGaps, cvSections, hasCvContent, newestFirst } from "./cv";
```

with:

```ts
import {
  type Cv,
  cvFromShows,
  cvGaps,
  cvSections,
  hasCvContent,
  mergeCv,
  newestFirst,
} from "./cv";
import type { Show } from "./shows";
```

Append to the end of `src/artist/cv.test.ts`:

```ts
/** Obviously fake facts: nothing here describes a real show. */
const testShow = (over: Partial<Show> = {}): Show => ({
  slug: "test-show",
  title: "Test Show",
  kind: "solo",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: [],
  publish: "published",
  ...over,
});

const later = new Date("2027-06-15T16:00:00Z");

describe("cvFromShows: a show typed once becomes its CV line", () => {
  it("turns a published show that has opened into a line", () => {
    const s = testShow({ href: "https://gallery.example.test/test-show", note: "A line." });
    expect(cvFromShows([s], later)).toEqual({
      soloExhibitions: [
        {
          year: "2026",
          title: "Test Show",
          venue: "Test Gallery",
          location: "Test City",
          href: "https://gallery.example.test/test-show",
          note: "A line.",
        },
      ],
      groupExhibitions: [],
    });
  });

  it("files solo shows and evenings under solo, two-person and group shows under group", () => {
    const lines = cvFromShows(
      [
        testShow({ slug: "a", title: "Solo", kind: "solo", startsOn: "2026-01-01", endsOn: "2026-01-31" }),
        testShow({ slug: "b", title: "Evening", kind: "event", startsOn: "2026-02-01", endsOn: "2026-02-01" }),
        testShow({ slug: "c", title: "Pair", kind: "two-person", startsOn: "2026-03-01", endsOn: "2026-03-31" }),
        testShow({ slug: "d", title: "Group", kind: "group", startsOn: "2026-04-01", endsOn: "2026-04-30" }),
      ],
      later,
    );
    expect(lines.soloExhibitions.map((e) => e.title)).toEqual(["Evening", "Solo"]);
    expect(lines.groupExhibitions.map((e) => e.title)).toEqual(["Group", "Pair"]);
  });

  it("lists newest first by the day each show opened", () => {
    const lines = cvFromShows(
      [
        testShow({ slug: "old", title: "Old", startsOn: "2025-03-01", endsOn: "2025-03-30" }),
        testShow({ slug: "new", title: "New", startsOn: "2026-05-01", endsOn: "2026-05-30" }),
        testShow({ slug: "mid", title: "Mid", startsOn: "2025-09-01", endsOn: "2025-09-30" }),
      ],
      later,
    );
    expect(lines.soloExhibitions.map((e) => e.title)).toEqual(["New", "Mid", "Old"]);
  });

  it("leaves off a show that has not opened, and a held-back show", () => {
    const lines = cvFromShows(
      [
        testShow({ slug: "soon", startsOn: "2027-09-01", endsOn: "2027-09-30" }),
        testShow({ slug: "held", publish: "draft" }),
      ],
      later,
    );
    expect(lines).toEqual({ soloExhibitions: [], groupExhibitions: [] });
  });

  it("puts a show on the CV from its first day in New York, not in UTC", () => {
    // 03:00Z on November 7 is still November 6 in New York.
    expect(cvFromShows([testShow()], new Date("2026-11-07T03:00:00Z")).soloExhibitions).toEqual([]);
    expect(cvFromShows([testShow()], new Date("2026-11-07T05:00:00Z")).soloExhibitions).toHaveLength(1);
  });

  it("reads the first day where the site is, east of UTC too", () => {
    // 15:00Z on November 6 is midnight on November 7 in Tokyo.
    const tokyo = cvFromShows([testShow()], new Date("2026-11-06T15:00:00Z"), "Asia/Tokyo");
    expect(tokyo.soloExhibitions).toHaveLength(1);
  });
});

describe("mergeCv: lines typed by hand and lines from shows, in one CV", () => {
  const hand: Cv = {
    education: [{ what: "Studied under a mentor" }],
    soloExhibitions: [
      { year: "2025", title: "Hand Show", venue: "Hand Venue", location: "Hand City", note: "Typed by hand" },
      { year: "2024", title: "Older Show" },
    ],
    groupExhibitions: [],
    press: [{ year: "2024", title: "A review" }],
    awards: [],
  };
  const none = { soloExhibitions: [], groupExhibitions: [] };

  it("leaves a CV with no shows exactly as typed", () => {
    expect(mergeCv(hand, none)).toEqual(hand);
  });

  it("adds show lines, newest first, among the lines typed by hand", () => {
    const merged = mergeCv(hand, {
      soloExhibitions: [{ year: "2026", title: "Test Show", venue: "Test Gallery", location: "Test City" }],
      groupExhibitions: [{ year: "2025", title: "Test Group", venue: "Test Gallery", location: "Test City" }],
    });
    expect(merged.soloExhibitions.map((e) => e.title)).toEqual(["Test Show", "Hand Show", "Older Show"]);
    expect(merged.groupExhibitions.map((e) => e.title)).toEqual(["Test Group"]);
  });

  it("prints a show entered in both places once, as it was typed by hand", () => {
    const merged = mergeCv(hand, {
      soloExhibitions: [{ year: "2025", title: "  hand show ", venue: "Test Gallery", location: "Test City" }],
      groupExhibitions: [],
    });
    expect(merged.soloExhibitions).toEqual(hand.soloExhibitions);
  });

  it("leaves education, press and awards untouched", () => {
    const merged = mergeCv(hand, {
      soloExhibitions: [{ year: "2026", title: "Test Show" }],
      groupExhibitions: [],
    });
    expect(merged.education).toEqual(hand.education);
    expect(merged.press).toEqual(hand.press);
    expect(merged.awards).toEqual(hand.awards);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/cv.test.ts 2>&1 | tail -6`
Expected: FAIL, `cvFromShows is not a function`.

- [ ] **Step 3: Write the implementation**

At the very top of `src/artist/cv.ts`, before the opening `/**` comment, add:

```ts
import { DEFAULT_TIME_ZONE, type Show, showStatus } from "./shows";

```

Append to the end of `src/artist/cv.ts`:

```ts
/** The CV lines a site's shows produce, in the Cv's own two exhibition lists. */
export type ShowCvEntries = Pick<Cv, "soloExhibitions" | "groupExhibitions">;

/**
 * One fact, typed once: every published show that has opened becomes a CV line,
 * newest first. Solo shows and evenings (`event`) go under solo exhibitions;
 * two-person and group shows go under group exhibitions. An upcoming show is not on
 * the CV until its first day, read in the site's time zone.
 */
export function cvFromShows(
  shows: readonly Show[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): ShowCvEntries {
  const started = shows
    .filter((s) => s.publish === "published" && showStatus(s, now, timeZone) !== "upcoming")
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.slug.localeCompare(b.slug));
  const out: ShowCvEntries = { soloExhibitions: [], groupExhibitions: [] };
  for (const s of started) {
    const entry: CvEntry = {
      year: s.startsOn.slice(0, 4),
      title: s.title,
      venue: s.venue,
      location: s.city,
      ...(s.href ? { href: s.href } : {}),
      ...(s.note ? { note: s.note } : {}),
    };
    if (s.kind === "solo" || s.kind === "event") out.soloExhibitions.push(entry);
    else out.groupExhibitions.push(entry);
  }
  return out;
}

const sameLine = (a: CvEntry, b: CvEntry): boolean =>
  a.year === b.year && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();

/**
 * The site's hand-entered CV with its shows' lines added, in the same Cv shape every
 * CV page already reads. A line typed by hand wins over a show with the same year and
 * title, so a show entered in both places prints once, as the artist wrote it. Both
 * exhibition lists come back newest first; everything else is untouched.
 */
export function mergeCv(cv: Cv, fromShows: ShowCvEntries): Cv {
  const add = (hand: readonly CvEntry[], shows: readonly CvEntry[]): CvEntry[] =>
    newestFirst([...shows.filter((s) => !hand.some((h) => sameLine(h, s))), ...hand]);
  return {
    ...cv,
    soloExhibitions: add(cv.soloExhibitions, fromShows.soloExhibitions),
    groupExhibitions: add(cv.groupExhibitions, fromShows.groupExhibitions),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/cv.test.ts 2>&1 | grep -E "Test Files|Tests "`
Expected: `Tests  17 passed (17)` (7 existing, 10 new).

- [ ] **Step 5: Format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/cv.ts src/artist/cv.test.ts && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/cv.ts src/artist/cv.test.ts
```

Expected: clean; `0`, `0`.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/cv.ts src/artist/cv.test.ts && git -c commit.gpgsign=false commit -m "artist: a published show joins the CV on its first day, merged with the lines typed by hand"
```

---
### Task 5: Kit: the press kit and its token

**Files:**
- Create: `src/artist/bytes.ts` (internal, not exported from the barrel)
- Modify: `src/artist/studio-auth.ts` (use `./bytes`, delete the two private copies)
- Create: `src/artist/press-kit.ts`
- Test: `src/artist/press-kit.test.ts`

**Interfaces:**
- Consumes: `Artwork`, `Price`, `formatTitleLine` (record); `Cv`, `cvFromShows`, `mergeCv` (Task 4); `Show`, `DEFAULT_TIME_ZONE` (Task 1).
- Produces:
  - `bytes.ts`: `b64url(bytes: ArrayBuffer | Uint8Array): string`, `safeEqual(a: string, b: string): boolean`
  - `interface PressKitInput<A extends Artwork> { works: readonly A[]; cv: Cv; shows: readonly Show[]; statement?: string; now: Date; timeZone?: string }`
  - `type PriceListStatus = "available" | "sold" | "reserved" | "not-for-sale" | "unstated"`
  - `interface PriceListEntry { slug: string; catalogId: string; title: string; status: PriceListStatus; price?: Price }`
  - `interface PressKitWork<A> { work: A; image: string }`, `interface PressKit<A> { statement?: string; cv: Cv; works: PressKitWork<A>[]; priceList: PriceListEntry[] }`
  - `pressKit<A extends Artwork>(input: PressKitInput<A>): PressKit<A>`
  - `generatePressToken(): string` (43 URL-safe characters, 256 random bits), `isPressToken(v: unknown): v is string`, `pressTokenMatches(candidate: string | null | undefined, current: string | null | undefined): boolean`

Decision recorded here: the press kit's image is `hi ?? src`. `masterSrc` is deliberately not used, because Carole 08 keeps the master apart from what the site serves and a site may not serve it at all.

- [ ] **Step 1: Write the failing tests**

Create `src/artist/press-kit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Cv } from "./cv";
import { generatePressToken, isPressToken, pressKit, pressTokenMatches } from "./press-kit";
import type { Artwork, Price } from "./record";
import type { Show } from "./shows";

/** Obviously fake works and prices: test fixtures only, nothing here ships. */
const work = (slug: string, over: Partial<Artwork> = {}): Artwork => ({
  slug,
  catalogId: `TT-${slug}`,
  series: "test-series",
  lifecycle: "current",
  publish: "published",
  src: `/works/${slug}.jpg`,
  alt: "A test work",
  aspect: "portrait",
  title: `Title ${slug}`,
  year: 2025,
  ...over,
});

const usd = (amount: number, visibility: Price["visibility"]): Price => ({
  amount,
  currency: "USD",
  visibility,
});

const works: Artwork[] = [
  work("public-price", {
    availability: "available",
    price: usd(4200, "public"),
    hi: "/works-hi/public-price.jpeg",
  }),
  work("on-request", { availability: "available", price: usd(6800, "on-request") }),
  work("no-price", { availability: "available" }),
  work("sold", { availability: "sold", price: usd(3000, "public") }),
  work("reserved", { availability: "reserved", price: usd(3100, "on-request") }),
  work("kept", { availability: "not-for-sale", price: usd(3200, "public") }),
  work("unrecorded", { price: usd(3300, "public") }),
  work("held-back", { publish: "draft", availability: "available", price: usd(9900, "public") }),
];

const cv: Cv = {
  education: [],
  soloExhibitions: [{ year: "2025", title: "Hand Show", venue: "Hand Venue", location: "Hand City" }],
  groupExhibitions: [],
  press: [],
  awards: [],
};

const opened: Show = {
  slug: "test-show",
  title: "Test Show",
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["public-price"],
  publish: "published",
};

const now = new Date("2026-11-20T17:00:00Z");
const kit = pressKit({ works, cv, shows: [opened], statement: "A statement.", now });

describe("pressKit: what a gallerist is sent", () => {
  it("lists every published work, priced only where the work can still be had", () => {
    expect(kit.priceList).toEqual([
      {
        slug: "public-price",
        catalogId: "TT-public-price",
        title: "Title public-price, 2025",
        status: "available",
        price: usd(4200, "public"),
      },
      {
        slug: "on-request",
        catalogId: "TT-on-request",
        title: "Title on-request, 2025",
        status: "available",
        price: usd(6800, "on-request"),
      },
      { slug: "no-price", catalogId: "TT-no-price", title: "Title no-price, 2025", status: "available" },
      { slug: "sold", catalogId: "TT-sold", title: "Title sold, 2025", status: "sold" },
      { slug: "reserved", catalogId: "TT-reserved", title: "Title reserved, 2025", status: "reserved" },
      { slug: "kept", catalogId: "TT-kept", title: "Title kept, 2025", status: "not-for-sale" },
      {
        slug: "unrecorded",
        catalogId: "TT-unrecorded",
        title: "Title unrecorded, 2025",
        status: "unstated",
      },
    ]);
  });

  it("never prints a price for a sold, reserved, kept or unrecorded work, whatever its visibility", () => {
    for (const slug of ["sold", "reserved", "kept", "unrecorded"]) {
      expect(kit.priceList.find((p) => p.slug === slug), slug).not.toHaveProperty("price");
    }
  });

  it("leaves held-back works out entirely", () => {
    expect(kit.works.map((w) => w.work.slug)).not.toContain("held-back");
    expect(kit.priceList.map((p) => p.slug)).not.toContain("held-back");
    expect(kit.works).toHaveLength(7);
  });

  it("offers each work's highest-resolution image the site serves", () => {
    expect(kit.works[0]?.image).toBe("/works-hi/public-price.jpeg");
    expect(kit.works[1]?.image).toBe("/works/on-request.jpg");
  });

  it("carries the CV with the shows that have opened", () => {
    expect(kit.cv.soloExhibitions.map((e) => e.title)).toEqual(["Hand Show"]);
    expect(kit.cv.groupExhibitions.map((e) => e.title)).toEqual(["Test Show"]);
  });

  it("prints the statement verbatim, and nothing when there is none", () => {
    expect(kit.statement).toBe("A statement.");
    const without = pressKit({ works, cv, shows: [], statement: "  ", now });
    expect(without).not.toHaveProperty("statement");
  });
});

describe("the press token", () => {
  it("is long, random and safe in a web address", () => {
    const a = generatePressToken();
    const b = generatePressToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
    expect(isPressToken(a)).toBe(true);
  });

  it("is recognized only in that exact shape", () => {
    expect(isPressToken("a".repeat(43))).toBe(true);
    for (const bad of [
      "",
      "short",
      "a".repeat(42),
      "a".repeat(44),
      `${"a".repeat(42)}=`,
      `${"a".repeat(42)}/`,
      42,
      undefined,
    ]) {
      expect(isPressToken(bad), String(bad)).toBe(false);
    }
  });

  it("opens only for the current token", () => {
    const current = generatePressToken();
    expect(pressTokenMatches(current, current)).toBe(true);
    expect(pressTokenMatches(generatePressToken(), current)).toBe(false);
  });

  it("opens for nothing when no token is set or either side is malformed", () => {
    const current = generatePressToken();
    expect(pressTokenMatches(current, undefined)).toBe(false);
    expect(pressTokenMatches(current, null)).toBe(false);
    expect(pressTokenMatches(undefined, undefined)).toBe(false);
    expect(pressTokenMatches("", "")).toBe(false);
    expect(pressTokenMatches("short", "short")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/press-kit.test.ts 2>&1 | tail -6`
Expected: FAIL, "Failed to resolve import "./press-kit"".

- [ ] **Step 3: Move the two byte helpers out of studio auth**

Create `src/artist/bytes.ts`:

```ts
/**
 * Small byte helpers shared inside the artist module: the studio cookie's signature
 * and the press token both need them. Not part of the public surface, so the barrel
 * does not export this file.
 */

/** base64url without padding, the form a cookie value or a web address carries. */
export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time over equal-length inputs. A length mismatch returns early, which is
    harmless wherever both sides always have the same public length: signatures, and
    press tokens checked for shape first. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

In `src/artist/studio-auth.ts`, delete this block exactly:

```ts
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

```

and delete this block exactly:

```ts
/** Constant-time over equal-length inputs. A length mismatch returns early, which is
    harmless for signatures because they are always the same length. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

```

Then add, as the first line of `src/artist/studio-auth.ts` (before its opening `/**` comment), followed by one blank line:

```ts
import { b64url, safeEqual } from "./bytes";
```

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/studio-auth.test.ts 2>&1 | grep -E "Test Files|Tests "`
Expected: every studio-auth test still passes (the count printed equals the count before the move; the cookie format did not change).

- [ ] **Step 4: Write the press kit**

Create `src/artist/press-kit.ts`:

```ts
import { b64url, safeEqual } from "./bytes";
import { type Cv, cvFromShows, mergeCv } from "./cv";
import { type Artwork, formatTitleLine, type Price } from "./record";
import { DEFAULT_TIME_ZONE, type Show } from "./shows";

/**
 * The press kit: what a gallerist is sent, at an unlisted address the artist can
 * retire at any time.
 *
 * It assembles the statement, the CV (shows included), every published work's full
 * record with the best image the site serves, and a price list. The price list
 * carries "on request" prices too (Jake's ruling, 2026-10-12): a gallery needs real
 * numbers to plan a show, and Carole's rule still holds, one price everywhere, only
 * who sees it differs. A work that cannot be had (sold, reserved, not for sale, or
 * never recorded) is listed without a price.
 *
 * Pure: the page that prints it, and that checks the token, belongs to the site.
 */

export interface PressKitInput<A extends Artwork> {
  /** The site's works, already merged with what the studio recorded. */
  works: readonly A[];
  /** The CV typed by hand; the shows' lines are added here. */
  cv: Cv;
  shows: readonly Show[];
  /** The artist's statement, printed verbatim. */
  statement?: string;
  now: Date;
  timeZone?: string;
}

export type PriceListStatus = "available" | "sold" | "reserved" | "not-for-sale" | "unstated";

export interface PriceListEntry {
  slug: string;
  catalogId: string;
  /** "Title, Year", the label's own first line. */
  title: string;
  status: PriceListStatus;
  /** Only for an available work with a recorded price, public or on request. */
  price?: Price;
}

export interface PressKitWork<A extends Artwork> {
  work: A;
  /** The highest-resolution image the site serves: `hi` when there is one, else `src`.
      `masterSrc` is never used, because a site keeps its master apart and may not
      serve it at all. */
  image: string;
}

export interface PressKit<A extends Artwork> {
  statement?: string;
  cv: Cv;
  works: PressKitWork<A>[];
  priceList: PriceListEntry[];
}

function priceLine(w: Artwork): PriceListEntry {
  const status: PriceListStatus = w.availability ?? "unstated";
  return {
    slug: w.slug,
    catalogId: w.catalogId,
    title: formatTitleLine(w),
    status,
    ...(status === "available" && w.price ? { price: w.price } : {}),
  };
}

export function pressKit<A extends Artwork>({
  works,
  cv,
  shows,
  statement,
  now,
  timeZone = DEFAULT_TIME_ZONE,
}: PressKitInput<A>): PressKit<A> {
  const published = works.filter((w) => w.publish === "published");
  return {
    ...(statement?.trim() ? { statement } : {}),
    cv: mergeCv(cv, cvFromShows(shows, now, timeZone)),
    works: published.map((work) => ({ work, image: work.hi ?? work.src })),
    priceList: published.map(priceLine),
  };
}

/* ------------------------------------------------------------------ the token */

const TOKEN_BYTES = 32;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** A new press token: 256 random bits as 43 URL-safe characters. Setting a new one
    retires the old link at once. */
export function generatePressToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

/** Whether a value has the exact shape generatePressToken makes. */
export function isPressToken(v: unknown): v is string {
  return typeof v === "string" && TOKEN.test(v);
}

/** Whether a press address's token is the current one. Both sides are checked for
    shape first, so the constant-time comparison only ever sees equal lengths, and an
    unset token opens nothing. */
export function pressTokenMatches(
  candidate: string | null | undefined,
  current: string | null | undefined,
): boolean {
  if (!isPressToken(candidate) || !isPressToken(current)) return false;
  return safeEqual(candidate, current);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist 2>&1 | grep -E "Test Files|Tests "`
Expected: every artist test passes; `press-kit.test.ts` contributes 10.

- [ ] **Step 6: Format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/bytes.ts src/artist/studio-auth.ts src/artist/press-kit.ts src/artist/press-kit.test.ts && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/bytes.ts src/artist/press-kit.ts src/artist/press-kit.test.ts && grep -c "function safeEqual\|function b64url" src/artist/studio-auth.ts
```

Expected: clean; three `0`s; and `0` for the last count (both helpers now live only in `bytes.ts`).

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/bytes.ts src/artist/studio-auth.ts src/artist/press-kit.ts src/artist/press-kit.test.ts && git -c commit.gpgsign=false commit -m "artist: press kit with on-request prices for galleries, and a retirable press token"
```

---

### Task 6: Kit: shows and the press token in the studio store

**Files:**
- Modify: `src/artist/studio-store.ts` (full replacement below)
- Test: `src/artist/studio-store.test.ts` (imports, new tests appended)

**Interfaces:**
- Consumes: `Show`, `ShowRecord`, `sanitizeStoredShows` (Tasks 1 and 2); `isPressToken` (Task 5).
- Produces:
  - `StudioStoreOptions` gains `showsKey?: string` and `pressKey?: string`.
  - `interface ShowsStore { readonly key: string | undefined; configured(): boolean; readShows(fresh?: boolean): Promise<ShowRecord[] | null>; writeShow(show: Show, by: string): Promise<boolean>; deleteShow(slug: string): Promise<boolean> }`
  - `interface PressStore { readonly key: string | undefined; configured(): boolean; readToken(fresh?: boolean): Promise<string | null | undefined>; writeToken(token: string, by: string): Promise<boolean> }`
  - `type StudioStores = StudioStore & { shows: ShowsStore; press: PressStore }`; `createStudioStore(options): StudioStores`. `StudioStore` itself is unchanged.

Decision recorded here: the press token gets its own tiny `PressStore` on its own key, beside `shows`, rather than a general settings store. It is one value with one rule (it must be a token the kit made), and a settings bag would invite unvalidated values.

- [ ] **Step 1: Write the failing tests**

In `src/artist/studio-store.test.ts`, replace the import block:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArtworkOverlay } from "./overlay";
import type { Artwork } from "./record";
import { formatAvailability } from "./record";
import { createStudioStore, merge, mergeAll } from "./studio-store";
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArtworkOverlay } from "./overlay";
import { generatePressToken } from "./press-kit";
import type { Artwork } from "./record";
import { formatAvailability } from "./record";
import type { ShowRecord } from "./shows";
import { createStudioStore, merge, mergeAll } from "./studio-store";
```

Append to the end of `src/artist/studio-store.test.ts`:

```ts
/** Upstash's REST shape over several keys: GET answers { result }, SET stores the body.
    `failSet` makes every SET answer 503. */
function fakeKv(initial: Record<string, string> = {}, failSet = false) {
  const values = new Map<string, string>(Object.entries(initial));
  const calls: FakeCall[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const match = /\/(get|set)\/(.+)$/.exec(url);
    const key = match?.[2] ?? "";
    if (match?.[1] === "set") {
      if (failSet) return new Response("down", { status: 503 });
      values.set(key, String(init?.body));
      return Response.json({ result: "OK" });
    }
    return Response.json({ result: values.get(key) ?? null });
  }) as typeof fetch;
  return { fetchFn, calls, values };
}

const OVERLAYS_KEY = "studio:test:overlays";
const SHOWS_KEY = "studio:test:shows";
const PRESS_KEY = "studio:test:press";

function storesWith(
  kv: ReturnType<typeof fakeKv>,
  keys: { showsKey?: string; pressKey?: string } = { showsKey: SHOWS_KEY, pressKey: PRESS_KEY },
) {
  return createStudioStore({
    key: OVERLAYS_KEY,
    ...keys,
    urlEnv: URL_ENV,
    tokenEnv: TOKEN_ENV,
    cachedRead: { next: { revalidate: 60 } },
    fetch: kv.fetchFn,
  });
}

/** Obviously fake facts: nothing here describes a real show. */
const testShow = (slug: string, over: Partial<ShowRecord> = {}): ShowRecord => ({
  slug,
  title: `Test Show ${slug}`,
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "published",
  ...over,
});

describe("the shows store", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("reads null and writes nothing when the site names no shows key", async () => {
    const kv = fakeKv();
    const { shows } = storesWith(kv, {});
    expect(shows.key).toBeUndefined();
    expect(shows.configured()).toBe(false);
    expect(await shows.readShows()).toBeNull();
    expect(await shows.writeShow(testShow("a"), "artist")).toBe(false);
    expect(await shows.deleteShow("a")).toBe(false);
    expect(kv.calls).toEqual([]);
  });

  it("reads null, never an empty list, when no store is connected", async () => {
    delete process.env[URL_ENV];
    const kv = fakeKv();
    const { shows } = storesWith(kv);
    expect(shows.key).toBe(SHOWS_KEY);
    expect(shows.configured()).toBe(false);
    expect(await shows.readShows()).toBeNull();
    expect(await shows.writeShow(testShow("a"), "artist")).toBe(false);
    expect(kv.calls).toEqual([]);
  });

  it("reads every valid show from its own key, in stored order", async () => {
    const kv = fakeKv({
      [SHOWS_KEY]: JSON.stringify({ b: testShow("b"), a: testShow("a"), junk: { slug: "junk" } }),
    });
    const back = await storesWith(kv).shows.readShows();
    expect(back?.map((s) => s.slug)).toEqual(["b", "a"]);
    expect(kv.calls[0]?.url).toBe(`https://kv.example.test/get/${SHOWS_KEY}`);
  });

  it("reports nothing saved, or a corrupted blob, as no shows", async () => {
    expect(await storesWith(fakeKv()).shows.readShows()).toEqual([]);
    expect(await storesWith(fakeKv({ [SHOWS_KEY]: "{not json" })).shows.readShows()).toEqual([]);
  });

  it("keeps public reads cacheable and studio reads fresh", async () => {
    const kv = fakeKv();
    const { shows } = storesWith(kv);
    await shows.readShows();
    await shows.readShows(true);
    const [publicRead, studioRead] = kv.calls;
    expect(publicRead?.init.next).toEqual({ revalidate: 60 });
    expect(publicRead?.init.cache).toBeUndefined();
    expect(studioRead?.init.cache).toBe("no-store");
    expect(studioRead?.init.next).toBeUndefined();
  });

  it("saves a show whole, so a field cleared in the studio stays cleared", async () => {
    const kv = fakeKv({
      [SHOWS_KEY]: JSON.stringify({ a: testShow("a", { note: "Old line." }), b: testShow("b") }),
    });
    expect(await storesWith(kv).shows.writeShow(testShow("a"), "artist")).toBe(true);
    const saved = JSON.parse(kv.values.get(SHOWS_KEY) ?? "{}") as Record<string, ShowRecord>;
    expect(Object.keys(saved)).toEqual(["a", "b"]);
    expect(saved.a?.note).toBeUndefined();
    expect(saved.a?.updatedBy).toBe("artist");
    expect(Number.isNaN(Date.parse(saved.a?.updatedAt ?? ""))).toBe(false);
    expect(saved.b).toEqual(testShow("b"));
    const write = kv.calls.at(-1);
    expect(write?.url).toBe(`https://kv.example.test/set/${SHOWS_KEY}`);
    expect(write?.init.method).toBe("POST");
    expect(kv.values.has(OVERLAYS_KEY)).toBe(false);
  });

  it("adds a new show after the ones already saved", async () => {
    const kv = fakeKv({ [SHOWS_KEY]: JSON.stringify({ a: testShow("a") }) });
    await storesWith(kv).shows.writeShow(testShow("c"), "operator");
    expect(Object.keys(JSON.parse(kv.values.get(SHOWS_KEY) ?? "{}"))).toEqual(["a", "c"]);
  });

  it("deletes one show and keeps the rest", async () => {
    const kv = fakeKv({ [SHOWS_KEY]: JSON.stringify({ a: testShow("a"), b: testShow("b") }) });
    expect(await storesWith(kv).shows.deleteShow("a")).toBe(true);
    expect(JSON.parse(kv.values.get(SHOWS_KEY) ?? "{}")).toEqual({ b: testShow("b") });
  });

  it("throws when the store refuses the write, so a save never looks done", async () => {
    const kv = fakeKv({ [SHOWS_KEY]: JSON.stringify({ a: testShow("a") }) }, true);
    await expect(storesWith(kv).shows.writeShow(testShow("b"), "artist")).rejects.toThrow(
      "store 503",
    );
    await expect(storesWith(kv).shows.deleteShow("a")).rejects.toThrow("store 503");
  });
});

describe("the press token store", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("reads null and writes nothing when the site names no press key", async () => {
    const kv = fakeKv();
    const { press } = storesWith(kv, { showsKey: SHOWS_KEY });
    expect(press.key).toBeUndefined();
    expect(press.configured()).toBe(false);
    expect(await press.readToken()).toBeNull();
    expect(await press.writeToken(generatePressToken(), "operator")).toBe(false);
    expect(kv.calls).toEqual([]);
  });

  it("reads null when no store is connected", async () => {
    delete process.env[TOKEN_ENV];
    expect(await storesWith(fakeKv()).press.readToken()).toBeNull();
  });

  it("reads undefined until a token is set, then that token", async () => {
    const kv = fakeKv();
    const { press } = storesWith(kv);
    expect(await press.readToken()).toBeUndefined();
    const token = generatePressToken();
    expect(await press.writeToken(token, "operator")).toBe(true);
    expect(await press.readToken(true)).toBe(token);
    const saved = JSON.parse(kv.values.get(PRESS_KEY) ?? "{}") as Record<string, unknown>;
    expect(saved.token).toBe(token);
    expect(saved.updatedBy).toBe("operator");
  });

  it("refuses a token it did not make, and writes nothing", async () => {
    const kv = fakeKv();
    await expect(storesWith(kv).press.writeToken("short", "operator")).rejects.toThrow(
      "not a press token",
    );
    expect(kv.calls).toEqual([]);
  });

  it("treats a stored token of the wrong shape, or a corrupted blob, as none", async () => {
    const wrong = fakeKv({ [PRESS_KEY]: JSON.stringify({ token: "short" }) });
    expect(await storesWith(wrong).press.readToken()).toBeUndefined();
    const corrupted = fakeKv({ [PRESS_KEY]: "{not json" });
    expect(await storesWith(corrupted).press.readToken()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/studio-store.test.ts 2>&1 | tail -6`
Expected: FAIL, `Cannot destructure property 'shows'` or `Cannot read properties of undefined (reading 'key')` (the store has no `shows` or `press` yet).

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/artist/studio-store.ts` with:

```ts
import { type ArtworkOverlay, sanitizeStoredOverlay } from "./overlay";
import { isPressToken } from "./press-kit";
import type { Artwork } from "./record";
import { type Show, type ShowRecord, sanitizeStoredShows } from "./shows";

/**
 * The studio store: what the artist and the operator edit, kept apart from what
 * the repo ships.
 *
 * Carole 05 requires that adding work, changing availability or moving a piece to
 * sold must not need a developer. A site's catalog is code, so it can only be the
 * BASE. Everything editable is written here as a per-slug OVERLAY, and the site
 * renders base + overlay. That keeps three properties worth having:
 *
 *   1. Nothing the artist edits can break a build. A malformed overlay degrades to
 *      the base record rather than failing a deploy.
 *   2. The repo stays the source of truth for what EXISTS; the store owns what is
 *      KNOWN about it. A work cannot be conjured or deleted from the studio.
 *   3. When a catalog eventually moves wholesale into the store, the merge below is
 *      the only thing that has to change.
 *
 * Shows and the press token live beside the overlays, each under its own key, as
 * two sibling stores (`shows`, `press`). The overlay store's own shape never grows,
 * so everything written against `StudioStore` keeps compiling.
 *
 * Talks to Upstash over its REST API with plain fetch. No client library, so no
 * dependency for what is a handful of HTTP calls.
 *
 * Unconfigured returns null everywhere, never an empty object. A caller must be able
 * to tell "no store" from "nothing saved", or the studio will cheerfully show an
 * empty form and lose whatever was typed into it.
 */

export interface StudioStoreOptions {
  /** The Upstash key holding every overlay, e.g. "studio:julian:overlays". */
  key: string;
  /** The Upstash key holding the site's shows, e.g. "studio:julian:shows". Unset means
      the site keeps no shows: `shows` reads null and writes nothing. */
  showsKey?: string;
  /** The Upstash key holding the press kit's current token. Unset means no press kit. */
  pressKey?: string;
  /** Env var holding the Upstash REST URL. Default "KV_REST_API_URL". */
  urlEnv?: string;
  /** Env var holding the Upstash REST token. Default "KV_REST_API_TOKEN". */
  tokenEnv?: string;
  /**
   * Extra fetch options for reads that are not `fresh`, which are the reads a public
   * page performs. On Next, `{ next: { revalidate: 60 } }` keeps those pages static
   * and still lands a studio edit within the minute: an uncached (`no-store`) read is
   * what turned 34 static artwork pages into dynamic ones on julianpotulicki.com.
   * The kit passes this through untouched and imports nothing from any framework.
   */
  cachedRead?: Record<string, unknown>;
  /** The fetch to use. Default: the global fetch, looked up at call time so a
      framework that patches it (Next does) is honored. */
  fetch?: typeof fetch;
}

export interface StudioStore {
  readonly key: string;
  configured(): boolean;
  /** Every overlay, by slug. null means no store, which is not the same as none saved.
      `fresh` skips every cache: writes and the studio's own screens pass it. */
  readOverlays(fresh?: boolean): Promise<Record<string, ArtworkOverlay> | null>;
  /** Writes one slug's overlay, preserving the rest. Returns false when unconfigured. */
  writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean>;
  /** Drops a slug's overlay entirely, so the work falls back to its base record. */
  clearOverlay(slug: string): Promise<boolean>;
}

export interface ShowsStore {
  /** The key the shows live under, or undefined when the site keeps none. */
  readonly key: string | undefined;
  /** True when a store is connected and the site names a shows key. */
  configured(): boolean;
  /** Every valid show, in stored order. null means no store, which is not the same as
      no shows. `fresh` skips every cache. */
  readShows(fresh?: boolean): Promise<ShowRecord[] | null>;
  /** Saves one show whole, replacing any earlier version with the same slug in its
      place and keeping the rest. Returns false when unconfigured. */
  writeShow(show: Show, by: string): Promise<boolean>;
  /** Removes one show. Returns false when unconfigured. */
  deleteShow(slug: string): Promise<boolean>;
}

export interface PressStore {
  /** The key the press token lives under, or undefined when the site has no press kit. */
  readonly key: string | undefined;
  configured(): boolean;
  /** The current press token. null: no store. undefined: none has been set. */
  readToken(fresh?: boolean): Promise<string | null | undefined>;
  /** Replaces the token, which retires the old press address at once. Throws on a
      token generatePressToken would not make. Returns false when unconfigured. */
  writeToken(token: string, by: string): Promise<boolean>;
}

/** What createStudioStore returns: the overlay store, with shows and the press token
    beside it. */
export type StudioStores = StudioStore & { shows: ShowsStore; press: PressStore };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function createStudioStore(options: StudioStoreOptions): StudioStores {
  const { key, showsKey, pressKey } = options;
  const urlEnv = options.urlEnv ?? "KV_REST_API_URL";
  const tokenEnv = options.tokenEnv ?? "KV_REST_API_TOKEN";

  function creds(): { url: string; token: string } | null {
    const url = process.env[urlEnv];
    const token = process.env[tokenEnv];
    return url && token ? { url: url.replace(/\/$/, ""), token } : null;
  }

  function configured(): boolean {
    return creds() !== null;
  }

  async function call(
    path: string,
    init: RequestInit | undefined,
    fresh: boolean,
  ): Promise<unknown> {
    const c = creds();
    if (!c) return null;
    const doFetch = options.fetch ?? globalThis.fetch;
    const res = await doFetch(`${c.url}/${path}`, {
      ...(fresh ? { cache: "no-store" as const } : (options.cachedRead ?? {})),
      method: init?.method ?? "GET",
      body: init?.body,
      headers: { Authorization: `Bearer ${c.token}`, ...(init?.headers ?? {}) },
    } as RequestInit);
    if (!res.ok) throw new Error(`store ${res.status}`);
    const body = (await res.json()) as { result?: unknown };
    return body.result ?? null;
  }

  /** A stored JSON blob, parsed. undefined when nothing is stored or it is corrupted:
      a broken blob must not take a public page down with it. */
  async function readJson(k: string, fresh: boolean): Promise<unknown> {
    const raw = await call(`get/${k}`, undefined, fresh);
    if (raw === null || raw === undefined) return undefined;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return undefined;
    }
  }

  async function writeJson(k: string, value: unknown): Promise<void> {
    await call(`set/${k}`, { method: "POST", body: JSON.stringify(value) }, true);
  }

  /* -------------------------------------------------------------- overlays */

  async function readOverlays(fresh = false): Promise<Record<string, ArtworkOverlay> | null> {
    if (!configured()) return null;
    const parsed = await readJson(key, fresh);
    if (!isPlainObject(parsed)) return {};
    const out: Record<string, ArtworkOverlay> = {};
    for (const [slug, entry] of Object.entries(parsed)) {
      if (isPlainObject(entry)) out[slug] = sanitizeStoredOverlay(entry);
    }
    return out;
  }

  async function writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = {
      ...current,
      [slug]: { ...current[slug], ...overlay, updatedAt: new Date().toISOString(), updatedBy: by },
    };
    await writeJson(key, next);
    return true;
  }

  async function clearOverlay(slug: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = { ...current };
    delete next[slug];
    await writeJson(key, next);
    return true;
  }

  /* -------------------------------------------------------------- shows */

  const showsConfigured = (): boolean => Boolean(showsKey) && configured();

  async function readShowMap(fresh: boolean): Promise<Record<string, ShowRecord> | null> {
    if (!showsKey || !configured()) return null;
    return sanitizeStoredShows(await readJson(showsKey, fresh));
  }

  const shows: ShowsStore = {
    key: showsKey,
    configured: showsConfigured,
    async readShows(fresh = false) {
      const map = await readShowMap(fresh);
      return map === null ? null : Object.values(map);
    },
    async writeShow(show, by) {
      const current = await readShowMap(true);
      if (current === null || !showsKey) return false;
      // Whole, never merged: a field the artist cleared must stay cleared.
      const next = {
        ...current,
        [show.slug]: { ...show, updatedAt: new Date().toISOString(), updatedBy: by },
      };
      await writeJson(showsKey, next);
      return true;
    },
    async deleteShow(slug) {
      const current = await readShowMap(true);
      if (current === null || !showsKey) return false;
      const next = { ...current };
      delete next[slug];
      await writeJson(showsKey, next);
      return true;
    },
  };

  /* -------------------------------------------------------------- press token */

  const press: PressStore = {
    key: pressKey,
    configured: () => Boolean(pressKey) && configured(),
    async readToken(fresh = false) {
      if (!pressKey || !configured()) return null;
      const parsed = await readJson(pressKey, fresh);
      return isPlainObject(parsed) && isPressToken(parsed.token) ? parsed.token : undefined;
    },
    async writeToken(token, by) {
      if (!isPressToken(token)) throw new Error("not a press token");
      if (!pressKey || !configured()) return false;
      await writeJson(pressKey, { token, updatedAt: new Date().toISOString(), updatedBy: by });
      return true;
    },
  };

  return { key, configured, readOverlays, writeOverlay, clearOverlay, shows, press };
}

/**
 * base + overlay. An overlay only ever adds or corrects what is known; it cannot
 * remove a work, repoint its image, or rewrite its alt text.
 */
export function merge<A extends Artwork>(base: A, overlay: ArtworkOverlay | undefined): A {
  if (!overlay) return base;
  const { updatedAt: _a, updatedBy: _b, ...fields } = overlay;
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return { ...base, ...clean } as A;
}

export function mergeAll<A extends Artwork>(
  base: A[],
  overlays: Record<string, ArtworkOverlay> | null,
): A[] {
  if (!overlays) return base;
  return base.map((w) => merge(w, overlays[w.slug]));
}
```

The overlay behavior is unchanged: `readJson` reproduces the old parse-or-empty rule (a corrupted blob reads as `{}` because `isPlainObject(undefined)` is false), and every phase-1 store test must still pass unedited.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/studio-store.test.ts 2>&1 | grep -E "Test Files|Tests "`
Expected: all pass, 14 more than before this task (9 shows, 5 press).

- [ ] **Step 5: Full suite, format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/studio-store.ts src/artist/studio-store.test.ts && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/studio-store.ts src/artist/studio-store.test.ts
```

Expected: the whole kit suite passes (the handler tests' `StudioStore` fakes still compile, proving `StudioStore` did not widen); clean; `0`, `0`.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/studio-store.ts src/artist/studio-store.test.ts && git -c commit.gpgsign=false commit -m "artist: shows and the press token kept in the studio store under their own keys"
```

---
### Task 7: Kit: the shows route handler, and an error reporter that may be async

**Files:**
- Modify: `src/artist/handlers.ts` (full replacement below)
- Test: `src/artist/handlers.test.ts` (two existing lines edited, imports, new tests appended)

**Interfaces:**
- Consumes: `cleanShow` (Task 2), `ShowsStore` (Task 6), `ShowRecord` (Task 1), the phase-1 `StudioAuth`, `StudioStore`, `cleanOverlay`, `cleanText`.
- Produces:
  - `interface StudioErrorContext { method: "GET" | "PUT" | "DELETE"; slug?: string }`; `type WorkErrorContext = StudioErrorContext` (kept for existing imports).
  - `type StudioErrorReporter = (error: unknown, context: StudioErrorContext) => void | Promise<void>`; `WorkHandlerOptions.onError` takes it.
  - `interface ShowsHandlerOptions<R> { auth: StudioAuth<R>; store: ShowsStore; catalog: StudioCatalog; maxBodyLength?: number; onError?: StudioErrorReporter }`
  - `showsHandler(options): { GET(request): Promise<Response>; PUT(request): Promise<Response>; DELETE(request): Promise<Response> }`
  - Answers: GET `{ configured: false, shows: [] }` or `{ configured: true, shows: ShowRecord[] }`; PUT `{ ok: true, show }`, or 400 `{ error: "That show is not ready to save.", problems: string[] }`; DELETE `{ ok: true }`, or 404 `{ error: "That is not a show on this site." }`; 401 `{ error: "locked" }`; 413 `{ error: "That is too long." }`; 503 `{ error: "No store is connected, so nothing would be saved." }` or `{ error: "The store did not accept that." }`.

Decision recorded here: **any signed-in role may delete a show**, because a show is a fact the artist typed himself and removing a cancelled or mistaken one is routine editing that touches no work's record, unlike resetting a work, which discards history only the operator may discard.

Decision recorded here: the handler **awaits** `onError`, inside a try/catch. Awaiting means a serverless runtime cannot freeze an async report half sent after the answer goes out; the try/catch means a reporter that throws or rejects never changes the 503 and never surfaces as an unhandled rejection.

- [ ] **Step 1: Make the existing onError tests fit the new reporter type, and write the failing tests**

The reporter type becomes `void | Promise<void>`, and an arrow whose body is `calls.push(...)` returns a number, which TypeScript refuses for that type. In `src/artist/handlers.test.ts`, replace:

```ts
    const onError = (error: unknown, context: unknown) => calls.push({ error, context });
```

with:

```ts
    const onError = (error: unknown, context: unknown) => {
      calls.push({ error, context });
    };
```

and replace:

```ts
    const handler = workHandler({ auth, store, catalog, onError: (e) => calls.push(e) });
```

with:

```ts
    const handler = workHandler({
      auth,
      store,
      catalog,
      onError: (e) => {
        calls.push(e);
      },
    });
```

Replace the import block at the top:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loginHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import { createStudioAuth } from "./studio-auth";
import type { StudioStore } from "./studio-store";
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loginHandler, showsHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import type { ShowRecord } from "./shows";
import { createStudioAuth } from "./studio-auth";
import type { ShowsStore, StudioStore } from "./studio-store";
```

Inside the existing `describe("workHandler onError", ...)` block, after its last `it(...)`, add:

```ts
  it("waits for an async reporter, and one that rejects never changes the 503", async () => {
    const { store } = memoryStore();
    store.readOverlays = async () => {
      throw new Error("network down");
    };
    let finished = 0;
    const waits = workHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        await Promise.resolve();
        finished += 1;
      },
    });
    expect((await waits.GET(await getReq())).status).toBe(503);
    expect(finished).toBe(1);
    const rejects = workHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        throw new Error("reporter down");
      },
    });
    const res = await rejects.GET(await getReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });
```

Append to the end of `src/artist/handlers.test.ts`:

```ts
/** Obviously fake facts: nothing here describes a real show. */
const fakeShow = (over: Partial<ShowRecord> = {}): ShowRecord => ({
  slug: "test-show",
  title: "Test Show",
  kind: "solo",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "draft",
  ...over,
});

function memoryShows({ connected = true, accepts = true } = {}) {
  const data: Record<string, ShowRecord> = { "test-show": fakeShow() };
  const writes: { show: ShowRecord; by: string }[] = [];
  const store: ShowsStore = {
    key: "test:shows",
    configured: () => connected,
    readShows: async () => (connected ? Object.values(data) : null),
    writeShow: async (show, by) => {
      if (!connected || !accepts) return false;
      writes.push({ show, by });
      data[show.slug] = show;
      return true;
    },
    deleteShow: async (slug) => {
      if (!connected || !accepts) return false;
      delete data[slug];
      return true;
    },
  };
  return { store, data, writes };
}

const showBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    slug: "new-show",
    title: "New Show",
    kind: "group",
    venue: "Test Gallery",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    workSlugs: ["waterscape-01"],
    publish: "published",
    ...over,
  });

const savedNewShow = {
  slug: "new-show",
  title: "New Show",
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "published",
};

const NO_STORE = { error: "No store is connected, so nothing would be saved." };
const REFUSED = { error: "The store did not accept that." };

describe("showsHandler", () => {
  it("locks every method to no cookie and to a forged cookie, and changes nothing", async () => {
    const { store, data, writes } = memoryShows();
    const handler = showsHandler({ auth, store, catalog });
    for (const cookie of [undefined, "kit_studio=operator.9999999999.forged"]) {
      const answers = [
        await handler.GET(request("GET", "/api/studio/shows", { cookie })),
        await handler.PUT(request("PUT", "/api/studio/shows", { cookie, body: showBody() })),
        await handler.DELETE(request("DELETE", "/api/studio/shows?slug=test-show", { cookie })),
      ];
      for (const res of answers) {
        expect(res.status, String(cookie)).toBe(401);
        expect(await res.json()).toEqual({ error: "locked" });
      }
    }
    expect(writes).toEqual([]);
    expect(Object.keys(data)).toEqual(["test-show"]);
  });

  it("GET says plainly when no store is connected", async () => {
    const { store } = memoryShows({ connected: false });
    const res = await showsHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/shows", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, shows: [] });
  });

  it("GET lists the saved shows", async () => {
    const { store } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/shows", { cookie: await cookieFor("artist") }),
    );
    expect(await res.json()).toEqual({ configured: true, shows: [fakeShow()] });
  });

  it("PUT saves a valid show, signed by whoever is in, and answers with what was saved", async () => {
    const { store, writes } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", {
        cookie: await cookieFor("artist"),
        body: showBody({ title: "  New Show  ", extra: "dropped" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, show: savedNewShow });
    expect(writes).toEqual([{ show: savedNewShow, by: "artist" }]);
  });

  it("PUT refuses a show with problems, naming each one, and saves nothing", async () => {
    const { store, writes } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", {
        cookie: await cookieFor("artist"),
        body: showBody({ endsOn: "2026-11-01", workSlugs: ["not-a-work"] }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "That show is not ready to save.",
      problems: [
        "The last day cannot come before the first.",
        '"not-a-work" is not a work on this site.',
      ],
    });
    expect(writes).toEqual([]);
  });

  it("PUT answers 503 in plain words when no store is connected", async () => {
    const { store } = memoryShows({ connected: false });
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NO_STORE);
  });

  it("PUT refuses a body over the cap with 413", async () => {
    const { store, writes } = memoryShows();
    const res = await showsHandler({ auth, store, catalog, maxBodyLength: 50 }).PUT(
      request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "That is too long." });
    expect(writes).toEqual([]);
  });

  it("PUT answers 400 to a body it cannot read, or JSON that is not an object", async () => {
    const { store } = memoryShows();
    const handler = showsHandler({ auth, store, catalog });
    for (const body of ["not json", "[1]", "null"]) {
      const res = await handler.PUT(
        request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body }),
      );
      expect(res.status, body).toBe(400);
      expect(await res.json()).toEqual({ error: "Could not read that." });
    }
  });

  it("PUT answers 503 when the store does not accept the show", async () => {
    const { store } = memoryShows({ accepts: false });
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
  });

  it("DELETE is open to any signed-in role, since a show is the artist's own fact", async () => {
    const { store, data } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/shows?slug=test-show", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(data["test-show"]).toBeUndefined();
  });

  it("DELETE answers 404 for a show that is not saved, or no slug at all", async () => {
    const { store, data } = memoryShows();
    const handler = showsHandler({ auth, store, catalog });
    for (const path of ["/api/studio/shows?slug=not-a-show", "/api/studio/shows"]) {
      const res = await handler.DELETE(
        request("DELETE", path, { cookie: await cookieFor("operator") }),
      );
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: "That is not a show on this site." });
    }
    expect(Object.keys(data)).toEqual(["test-show"]);
  });

  it("DELETE answers 503 in plain words when no store is connected", async () => {
    const { store } = memoryShows({ connected: false });
    const res = await showsHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/shows?slug=test-show", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NO_STORE);
  });
});

describe("showsHandler onError", () => {
  function failingShows() {
    const { store } = memoryShows();
    const boom = new Error("network down");
    store.readShows = async () => {
      throw boom;
    };
    store.writeShow = async () => {
      throw boom;
    };
    return { store, boom };
  }

  const getReq = async () =>
    request("GET", "/api/studio/shows", { cookie: await cookieFor("artist") });
  const putReq = async () =>
    request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() });
  const delReq = async () =>
    request("DELETE", "/api/studio/shows?slug=test-show", { cookie: await cookieFor("artist") });

  it("is called once with the error and the method (and slug) on each store failure", async () => {
    const { store, boom } = failingShows();
    const calls: { error: unknown; context: unknown }[] = [];
    const handler = showsHandler({
      auth,
      store,
      catalog,
      onError: (error, context) => {
        calls.push({ error, context });
      },
    });
    expect((await handler.GET(await getReq())).status).toBe(503);
    expect((await handler.PUT(await putReq())).status).toBe(503);
    expect((await handler.DELETE(await delReq())).status).toBe(503);
    expect(calls).toEqual([
      { error: boom, context: { method: "GET" } },
      { error: boom, context: { method: "PUT", slug: "new-show" } },
      { error: boom, context: { method: "DELETE", slug: "test-show" } },
    ]);
  });

  it("waits for an async reporter, and one that rejects never changes the 503", async () => {
    const { store } = failingShows();
    let finished = 0;
    const waits = showsHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        await Promise.resolve();
        finished += 1;
      },
    });
    expect((await waits.PUT(await putReq())).status).toBe(503);
    expect(finished).toBe(1);
    const rejects = showsHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        throw new Error("reporter down");
      },
    });
    for (const req of [await getReq(), await putReq(), await delReq()]) {
      const method = req.method as "GET" | "PUT" | "DELETE";
      const res = await rejects[method](req);
      expect(res.status, method).toBe(503);
      expect(await res.json()).toEqual(REFUSED);
    }
  });

  it("does not change the 503 answer when onError itself throws", async () => {
    const { store } = failingShows();
    const handler = showsHandler({
      auth,
      store,
      catalog,
      onError: () => {
        throw new Error("reporter down");
      },
    });
    const res = await handler.GET(await getReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/handlers.test.ts 2>&1 | tail -8`
Expected: FAIL, `showsHandler is not a function` for the new blocks, and the new workHandler test fails (or reports an unhandled rejection) because the current `report` neither awaits nor catches a rejected promise.

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/artist/handlers.ts` with:

```ts
import { cleanOverlay, cleanText } from "./overlay";
import { cleanShow } from "./shows";
import type { StudioAuth } from "./studio-auth";
import type { ShowsStore, StudioStore } from "./studio-store";

/**
 * The studio's routes, framework-free: each handler takes a Web Request and
 * returns a Response, so a site's route file only wires them up.
 *
 * Every handler verifies the signed cookie itself. A hidden studio link is never
 * the gate.
 */

/** What the handlers need to know about the site's catalog: whether a slug is a work
    on this site. An overlay can only describe a work that exists, and a show can only
    list works that exist, so a studio route cannot be used to conjure a painting or
    to point one at someone else's image. */
export interface StudioCatalog {
  has(slug: string): boolean;
}

export interface LoginHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  /** How long a wrong passphrase waits for its answer. Default 600 ms. */
  wrongKeyDelayMs?: number;
}

export interface LoginHandler {
  POST(request: Request): Promise<Response>;
  DELETE(request?: Request): Promise<Response>;
}

/** Where a store failure happened, for whoever reports it. */
export interface StudioErrorContext {
  method: "GET" | "PUT" | "DELETE";
  slug?: string;
}

/** The work handler's earlier name for the same context. */
export type WorkErrorContext = StudioErrorContext;

/** Called with the error whenever the store fails, just before the 503 answer, so a
    site can report it (Sentry, a log). It may be async: the handler waits for it, so
    a serverless runtime does not freeze a report half sent, and a reporter that throws
    or rejects never changes the answer. */
export type StudioErrorReporter = (
  error: unknown,
  context: StudioErrorContext,
) => void | Promise<void>;

export interface WorkHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  store: StudioStore;
  catalog: StudioCatalog;
  /** The longest request body accepted, in characters. Default 8000. */
  maxBodyLength?: number;
  onError?: StudioErrorReporter;
}

export interface WorkHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

export interface ShowsHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  /** The store's `shows`, for example `studioStore.shows`. */
  store: ShowsStore;
  /** Every work a show lists must be one of these. */
  catalog: StudioCatalog;
  /** The longest request body accepted, in characters. Default 8000. */
  maxBodyLength?: number;
  onError?: StudioErrorReporter;
}

export interface ShowsHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers });
}

const locked = () => json({ error: "locked" }, 401);
const notAWork = () => json({ error: "That is not a work on this site." }, 404);
const notAShow = () => json({ error: "That is not a show on this site." }, 404);
const refused = () => json({ error: "The store did not accept that." }, 503);
const noStore = () => json({ error: "No store is connected, so nothing would be saved." }, 503);
const unreadable = () => json({ error: "Could not read that." }, 400);

/** Hands a store failure to the site's reporter, if it has one, and waits for it. A
    reporter that throws or rejects must not turn a clean 503 into an unhandled error. */
async function report(
  onError: StudioErrorReporter | undefined,
  error: unknown,
  context: StudioErrorContext,
): Promise<void> {
  if (!onError) return;
  try {
    await onError(error, context);
  } catch {
    // Swallowed on purpose: the answer is already decided.
  }
}

/** A request body that is a JSON object no longer than `max` characters, or the
    answer refusing it. */
async function readObject(
  request: Request,
  max: number,
): Promise<Record<string, unknown> | Response> {
  const raw = await request.text();
  if (raw.length > max) return json({ error: "That is too long." }, 413);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return unreadable();
    }
    return parsed as Record<string, unknown>;
  } catch {
    return unreadable();
  }
}

/**
 * The door. One passphrase in, one signed role cookie out.
 *
 * Deliberately slow to answer a wrong key: the only way in is guessing, so the
 * cheapest useful defense is making guesses expensive. Says "That passphrase is not
 * right." either way rather than distinguishing one role's key from another's,
 * because naming which key was close is help for exactly one kind of visitor.
 */
export function loginHandler<R extends string>({
  auth,
  wrongKeyDelayMs = 600,
}: LoginHandlerOptions<R>): LoginHandler {
  async function POST(request: Request): Promise<Response> {
    if (!auth.configured()) {
      return json({ error: "The studio is not configured yet." }, 503);
    }

    let passphrase = "";
    try {
      const body = (await request.json()) as { passphrase?: unknown };
      passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
    } catch {
      return unreadable();
    }

    const role = auth.roleFor(passphrase);
    if (!role) {
      await new Promise((resolve) => setTimeout(resolve, wrongKeyDelayMs));
      return json({ error: "That passphrase is not right." }, 401);
    }

    const token = await auth.issue(role);
    if (!token) {
      return json({ error: "The studio is not configured yet." }, 503);
    }
    return json({ ok: true, role }, 200, { "Set-Cookie": auth.setCookie(token) });
  }

  async function DELETE(): Promise<Response> {
    return json({ ok: true }, 200, { "Set-Cookie": auth.clearCookie() });
  }

  return { POST, DELETE };
}

/**
 * Reading and writing what is KNOWN about a work.
 *
 * Every field passes `cleanOverlay` rather than being trusted from the form, and the
 * slug is checked against the site's catalog.
 */
export function workHandler<R extends string>({
  auth,
  store,
  catalog,
  maxBodyLength = 8000,
  onError,
}: WorkHandlerOptions<R>): WorkHandler {
  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, overlays: {} });
    try {
      return json({ configured: true, overlays: (await store.readOverlays(true)) ?? {} });
    } catch (error) {
      await report(onError, error, { method: "GET" });
      return refused();
    }
  }

  async function PUT(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) return noStore();

    const body = await readObject(request, maxBodyLength);
    if (body instanceof Response) return body;

    const slug = cleanText(body.slug, 120);
    if (!slug || !catalog.has(slug)) return notAWork();

    try {
      const ok = await store.writeOverlay(slug, cleanOverlay(body), who);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      await report(onError, error, { method: "PUT", slug });
      return refused();
    }
  }

  async function DELETE(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    // Only a role marked canReset may reset a record to its base state. The artist
    // editing their own work is routine; discarding everything recorded about a
    // piece is not.
    if (!auth.canReset(who)) {
      return json({ error: "Not permitted." }, 403);
    }
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug || !catalog.has(slug)) return notAWork();
    try {
      const ok = await store.clearOverlay(slug);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      await report(onError, error, { method: "DELETE", slug });
      return refused();
    }
  }

  return { GET, PUT, DELETE };
}

/**
 * Reading and writing the artist's shows.
 *
 * Every write passes `cleanShow`, which refuses an incomplete or impossible show and
 * names each problem, and checks every listed work against the site's catalog. Any
 * signed-in role may delete a show: a show is the artist's own fact, and removing a
 * cancelled one touches no work's record.
 */
export function showsHandler<R extends string>({
  auth,
  store,
  catalog,
  maxBodyLength = 8000,
  onError,
}: ShowsHandlerOptions<R>): ShowsHandler {
  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, shows: [] });
    try {
      return json({ configured: true, shows: (await store.readShows(true)) ?? [] });
    } catch (error) {
      await report(onError, error, { method: "GET" });
      return refused();
    }
  }

  async function PUT(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) return noStore();

    const body = await readObject(request, maxBodyLength);
    if (body instanceof Response) return body;

    const result = cleanShow(body, catalog);
    if (!result.ok) {
      return json({ error: "That show is not ready to save.", problems: result.problems }, 400);
    }

    try {
      const ok = await store.writeShow(result.show, who);
      return ok ? json({ ok: true, show: result.show }) : refused();
    } catch (error) {
      await report(onError, error, { method: "PUT", slug: result.show.slug });
      return refused();
    }
  }

  async function DELETE(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return noStore();
    const slug = cleanText(new URL(request.url).searchParams.get("slug"), 120);
    if (!slug) return notAShow();
    try {
      const saved = await store.readShows(true);
      if (saved === null) return noStore();
      if (!saved.some((s) => s.slug === slug)) return notAShow();
      const ok = await store.deleteShow(slug);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      await report(onError, error, { method: "DELETE", slug });
      return refused();
    }
  }

  return { GET, PUT, DELETE };
}
```

What changed for existing behavior: `workHandler` PUT now reads the body through `readObject` (same 413 and 400 answers as before) and answers through `noStore()` (same text as before), and every `report` call is awaited. Every phase-1 handler test must pass unedited apart from the two arrow bodies above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/handlers.test.ts 2>&1 | grep -E "Test Files|Tests |Unhandled"`
Expected: all pass, 16 more than before this task (12 `showsHandler`, 3 `showsHandler onError`, 1 workHandler async reporter), and no line containing `Unhandled`.

- [ ] **Step 5: Full suite, format, typecheck, lint, commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist/handlers.ts src/artist/handlers.test.ts && pnpm test 2>&1 | grep -E "Test Files|Tests |Unhandled" && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist/handlers.ts src/artist/handlers.test.ts
```

Expected: whole suite passes with no `Unhandled`; clean; `0`, `0`.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/handlers.ts src/artist/handlers.test.ts && git -c commit.gpgsign=false commit -m "artist: shows route handler, and an error reporter that may be async without ever changing the answer"
```

---

### Task 8: Kit: public surface, config fields, release notes

**Files:**
- Modify: `src/artist/index.ts`, `src/artist/index.test.ts`, `src/artist/config.ts`
- Modify: `CHANGELOG.md`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: every name from Tasks 1 to 7.
- Produces: `@iserlabs/web-kit/artist` exporting `shows` and `press-kit` (not `bytes`); `ArtistConfig` with optional `artistName`, `timeZone`, `series`, `studio.showsKey`, `press: { tokenKey }`. Julian's tasks import from here.

- [ ] **Step 1: Write the failing surface test**

In `src/artist/index.test.ts`, replace the `FUNCTIONS` array with:

```ts
const FUNCTIONS = [
  "catalogIds",
  "cleanOverlay",
  "cleanShow",
  "cleanText",
  "createStudioAuth",
  "createStudioStore",
  "currentFirst",
  "cvFromShows",
  "cvGaps",
  "cvSections",
  "forDisplay",
  "formatAvailability",
  "formatDimensionsLine",
  "formatEdition",
  "formatLabel",
  "formatMediumLine",
  "formatTitleLine",
  "generatePressToken",
  "groupByAvailability",
  "hasAvailabilityData",
  "hasCvContent",
  "isFullyDocumented",
  "isPressToken",
  "isPurchasable",
  "loginHandler",
  "merge",
  "mergeAll",
  "mergeCv",
  "missingFields",
  "newestFirst",
  "noticeShow",
  "onView",
  "pressKit",
  "pressTokenMatches",
  "readCookie",
  "sanitizeStoredOverlay",
  "sanitizeStoredShows",
  "showJsonLd",
  "showStatus",
  "showsHandler",
  "workHandler",
];
```

Replace the `VALUES` array with:

```ts
const VALUES = [
  "AVAILABILITY",
  "DEFAULT_TIME_ZONE",
  "LIFECYCLE",
  "PRICE_CURRENCY",
  "PRICE_VISIBILITY",
  "PUBLISH",
  "SHOW_KINDS",
  "UNITS",
];
```

Replace the last test (`it("takes a site's config as written, ...`) with:

```ts
  it("takes a site's config as written, its cookie, store and shows names included", () => {
    const config = {
      catalogPrefix: "JP-",
      artistName: "Test Artist",
      timeZone: "America/New_York",
      series: [{ id: "test-series", title: "Test Series" }],
      studio: {
        cookieName: "jp_studio",
        secretEnv: "STUDIO_SECRET",
        roles: [
          { id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" },
          { id: "jake", passphraseEnv: "STUDIO_PASS_JAKE", canReset: true },
        ],
        storeKey: "studio:julian:overlays",
        showsKey: "studio:julian:shows",
      },
      press: { tokenKey: "studio:julian:press" },
    } as const satisfies artist.ArtistConfig;
    const auth = artist.createStudioAuth(config.studio);
    const store = artist.createStudioStore({
      key: config.studio.storeKey,
      showsKey: config.studio.showsKey,
      pressKey: config.press.tokenKey,
    });
    expect(auth.cookieName).toBe("jp_studio");
    expect(store.key).toBe("studio:julian:overlays");
    expect(store.shows.key).toBe("studio:julian:shows");
    expect(store.press.key).toBe("studio:julian:press");
    expect(auth.canReset("jake")).toBe(true);
    expect(auth.canReset("julian")).toBe(false);
  });

  it("still takes a phase-1 config with none of the new fields", () => {
    const config = {
      catalogPrefix: "JP-",
      studio: {
        cookieName: "jp_studio",
        secretEnv: "STUDIO_SECRET",
        roles: [{ id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" }],
        storeKey: "studio:julian:overlays",
      },
    } as const satisfies artist.ArtistConfig;
    const store = artist.createStudioStore({ key: config.studio.storeKey });
    expect(store.shows.key).toBeUndefined();
    expect(store.press.key).toBeUndefined();
  });
```

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/index.test.ts 2>&1 | tail -12`
Expected: FAIL, the function list lacks the new names (they are not in the barrel yet).

- [ ] **Step 2: Export the new units and widen the config with optional fields only**

Replace the whole of `src/artist/index.ts` with:

```ts
/**
 * @iserlabs/web-kit/artist: the parts of an artist's portfolio site that are the
 * same on every artist's site. Framework-free `.ts`: no React, no Next imports, and
 * every server handler takes a Web Request and returns a Response.
 */
export * from "./availability";
export * from "./config";
export * from "./cv";
export * from "./handlers";
export * from "./overlay";
export * from "./press-kit";
export * from "./record";
export * from "./shows";
export * from "./studio-auth";
export * from "./studio-store";
```

Replace the whole of `src/artist/config.ts` with:

```ts
import type { StudioAuthOptions } from "./studio-auth";

/**
 * One artist site's settings for the module. A site keeps them in
 * `src/artist.config.ts`, written `as const satisfies ArtistConfig` so role ids stay
 * literal types.
 *
 * Every name here is the site's own, so a site that already has a studio keeps its
 * cookie, its store key and its catalog numbers when it adopts the module. New
 * settings are only ever added as optional fields.
 */
export interface ArtistConfig<R extends string = string> {
  /** Prefix for generated catalog ids: "JP-" gives "JP-0001". */
  catalogPrefix: string;
  /** The artist's name as printed on the site, for schema and the press kit. */
  artistName?: string;
  /** The IANA time zone show dates are read in. Default "America/New_York". */
  timeZone?: string;
  /** The site's series, in the order the site lists them. */
  series?: readonly { id: string; title: string }[];
  studio: StudioAuthOptions<R> & {
    /** The Upstash key holding the studio's per-work overlays. */
    storeKey: string;
    /** The Upstash key holding the site's shows. Unset means the site keeps no shows. */
    showsKey?: string;
  };
  /** The press kit, when the site has one. */
  press?: {
    /** The Upstash key holding the press kit's current token. */
    tokenKey: string;
  };
}
```

- [ ] **Step 3: Run the surface test and the full suite**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm test 2>&1 | grep -E "Test Files|Tests |Unhandled" && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3`
Expected: `Test Files  45 passed (45)` and `Tests  433 passed (433)` (311 baseline + 22 + 46 + 3 + 10 + 10 + 14 + 16 + 1 new surface test); typecheck and lint clean. If the total differs, count the new tests per file with `pnpm exec vitest run src/artist --reporter=verbose 2>&1 | grep -c "✓"` and reconcile against the per-task counts above before going on; do not edit the expectation to fit.

- [ ] **Step 4: Release notes and docs**

In `CHANGELOG.md`, insert directly above the line `## 0.10.0`:

```markdown
## 0.11.0
- **`@iserlabs/web-kit/artist`: shows.** A show (`Show`: title, kind, venue, address, city, first and last day, opening reception, the works hanging, the gallery's page, one line in the artist's words, published or held back) is typed once in the studio. `showStatus(show, now, timeZone)` reads its dates as calendar days in the site's time zone (default `America/New_York`, `DEFAULT_TIME_ZONE`), never as UTC, with the last day inclusive and daylight saving handled by `Intl`. `noticeShow` picks the homepage line (the show on now, else the next one within 45 days, gone the day after close); `onView` names the show a work is hanging in. `cleanShow(body, catalog)` refuses an incomplete or impossible show and names every problem in plain words (real calendar dates, last day not before first, opening within the run, 24-hour times, every listed work in the catalog, an http or https gallery link). `sanitizeStoredShows` drops a stored show missing a required fact and keeps valid data in stored key order. `showJsonLd(show, site)` builds the `ExhibitionEvent` schema, joined to each work's own `@id`.
- **CV from shows.** `cvFromShows(shows, now, timeZone)` turns every published show that has opened into a CV line, newest first (`solo` and `event` under solo exhibitions, `two-person` and `group` under group). `mergeCv(cv, lines)` adds them to the hand-entered CV in the same `Cv` shape; a line typed by hand wins over a show with the same year and title.
- **Press kit.** `pressKit({ works, cv, shows, statement, now, timeZone })` assembles the statement, the CV with its shows, every published work with its highest-resolution served image (`hi`, else `src`), and a price list that carries on-request prices for galleries and lists sold, reserved, not-for-sale and unrecorded works without a price. `generatePressToken`, `isPressToken` and `pressTokenMatches` make and check the unlisted press address's token (256 random bits, constant-time compare).
- **Studio store.** `createStudioStore` takes optional `showsKey` and `pressKey` and returns the overlay store plus `shows` (`readShows`, `writeShow`, `deleteShow`) and `press` (`readToken`, `writeToken`), each under its own Upstash key and each reading null when unconfigured. `StudioStore` itself is unchanged.
- **Handlers.** `showsHandler({ auth, store, catalog, onError })` serves GET, PUT and DELETE for shows with the same cookie check, body cap and 503 answers as `workHandler`; a refused show answers 400 with its `problems`; any signed-in role may delete a show. `onError` (both handlers) may now be async: it is awaited, and a reporter that throws or rejects never changes the answer.
- **Config.** `ArtistConfig` gains optional `artistName`, `timeZone`, `series`, `studio.showsKey` and `press.tokenKey`. A phase-1 config still satisfies it unchanged.
```

In `README.md`, insert after the paragraph that ends "(for example to Sentry). A throwing `onError` never changes the answer." (the last paragraph of the Artist module section):

```markdown
Shows are typed in the studio and kept under their own store key. Pass
`showsKey` to `createStudioStore` and mount `showsHandler` the same way as
`workHandler`, with `store: studioStore.shows`. `showStatus`, `noticeShow` and
`onView` read show dates as calendar days in the site's time zone (default
`America/New_York`), and `cvFromShows` plus `mergeCv` put every published show
that has opened on the CV. `pressKit` assembles a gallerist's press kit (on-request
prices included); `generatePressToken` and `pressTokenMatches` guard its unlisted
address. `onError` may be async; it is awaited and can never change an answer.
```

In `CLAUDE.md`, replace:

```markdown
- `artist` is the artist-site module (artwork record, availability, CV, studio
  auth, studio store, studio route handlers), first used by julianpotulicki.com.
```

with:

```markdown
- `artist` is the artist-site module (artwork record, availability, CV, shows,
  press kit, studio auth, studio store, studio route handlers), first used by
  julianpotulicki.com.
```

Do not change `package.json`'s version; it moves to 0.11.0 at release.

- [ ] **Step 5: Writing checks and commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git diff 3b860d9 -- . | grep '^+' | grep -c $'\xe2\x80\x94'; git diff 3b860d9 -- src CHANGELOG.md README.md CLAUDE.md | grep '^+' | grep -inE 'catalogue|fulfilment|behaviour|colour|honour|favour|defence|artefact|organis|recognis|centre'; grep -n '"version"' package.json
```

Expected: `0`; no spelling lines; `"version": "0.10.0",`.

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/index.ts src/artist/index.test.ts src/artist/config.ts CHANGELOG.md README.md CLAUDE.md && git -c commit.gpgsign=false commit -m "artist: shows and press kit on the public surface, optional config fields, 0.11.0 notes"
```

---
### Task 9: Julian: his time zone, his shows key, the shows route, and the CV

**Files:**
- Modify: `src/artist.config.ts`, `src/lib/studio.ts`, `src/lib/studio.test.ts`
- Create: `src/app/api/studio/shows/route.ts`
- Modify: `src/content/cv.ts`, `src/content/cv.test.ts`, `src/app/cv/page.tsx`

**Interfaces:**
- Consumes: the kit at this worktree (Tasks 1 to 8) through the existing `file:` dependency: `createStudioStore` with `showsKey`, `showsHandler`, `cvFromShows`, `mergeCv`, `Show`, `ShowRecord`.
- Produces:
  - `artistConfig.timeZone === "America/New_York"`, `artistConfig.studio.showsKey === "studio:julian:shows"`
  - `studioShows: ShowsStore` exported from `src/lib/studio.ts`
  - `/api/studio/shows` with GET, PUT, DELETE
  - `cvWithShows(shows: readonly Show[], now: Date): Cv` exported from `src/content/cv.ts`

- [ ] **Step 1: Install the kit as it now stands**

```bash
cd /Users/macbook/Claude/julianpotulicki && git status -sb | head -3 && pnpm install 2>&1 | tail -3 && diff -r node_modules/@iserlabs/web-kit/src/artist /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail/src/artist && echo "INSTALLED KIT MATCHES THE WORKTREE" && git status --short
```

Expected: branch `artist-module`; `INSTALLED KIT MATCHES THE WORKTREE`; `git status --short` shows only `?? docs/boards/`. If `pnpm-lock.yaml` shows as modified, keep it and add it to this task's commit.

- [ ] **Step 2: Write the failing tests**

In `src/lib/studio.test.ts`, replace:

```ts
import { studioAuth, studioStore } from "./studio";
```

with:

```ts
import { studioAuth, studioShows, studioStore } from "./studio";
```

Append to the end of `src/lib/studio.test.ts`:

```ts
describe("Julian's shows", () => {
  it("live under their own key, apart from his overlays, read in New York", () => {
    expect(studioShows.key).toBe("studio:julian:shows");
    expect(studioStore.key).toBe("studio:julian:overlays");
    expect(artistConfig.timeZone).toBe("America/New_York");
  });

  it("read as null, never an empty list, when no store is connected", async () => {
    process.env.KV_REST_API_URL = "";
    process.env.KV_REST_API_TOKEN = "";
    const fetchSpy = vi.fn(async () => Response.json({ result: null }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(studioShows.configured()).toBe(false);
    expect(await studioShows.readShows()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reach the public pages through the same 60-second cache, from their own key", async () => {
    process.env.KV_REST_API_URL = "https://store.test";
    process.env.KV_REST_API_TOKEN = "token";
    const fetchSpy = vi.fn(async () => Response.json({ result: null }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await studioShows.readShows()).toEqual([]);
    const call = fetchSpy.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(call[0]).toBe("https://store.test/get/studio:julian:shows");
    expect(call[1].next).toEqual({ revalidate: 60 });
  });
});
```

In `src/content/cv.test.ts`, replace:

```ts
import { cvGaps, cvSections } from "@iserlabs/web-kit/artist";
import { describe, expect, it } from "vitest";
import { cv } from "./cv";
```

with:

```ts
import { cvGaps, cvSections, type Show } from "@iserlabs/web-kit/artist";
import { describe, expect, it } from "vitest";
import { cv, cvWithShows } from "./cv";
```

Append to the end of `src/content/cv.test.ts`:

```ts
describe("shows Julian publishes in the studio join his CV", () => {
  /** Obviously fake facts: nothing here describes a real show. */
  const testShow: Show = {
    slug: "test-show",
    title: "Test Show",
    kind: "group",
    venue: "Test Gallery",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    workSlugs: [],
    publish: "published",
  };
  const during = new Date("2026-11-20T17:00:00Z");

  it("leaves his CV exactly as typed when there are no shows", () => {
    expect(cvWithShows([], during)).toEqual(cv);
  });

  it("adds a published group show under group exhibitions once it has opened", () => {
    const merged = cvWithShows([testShow], during);
    expect(merged.groupExhibitions).toEqual([
      { year: "2026", title: "Test Show", venue: "Test Gallery", location: "Test City" },
    ]);
    expect(merged.soloExhibitions).toEqual(cv.soloExhibitions);
  });

  it("keeps an upcoming or held-back show off his CV", () => {
    expect(cvWithShows([testShow], new Date("2026-10-20T16:00:00Z")).groupExhibitions).toEqual([]);
    expect(cvWithShows([{ ...testShow, publish: "draft" }], during).groupExhibitions).toEqual([]);
  });

  it("reads the first day in New York, where he shows", () => {
    // 03:00Z on November 7 is 10 PM on November 6 in New York.
    expect(cvWithShows([testShow], new Date("2026-11-07T03:00:00Z")).groupExhibitions).toEqual([]);
    expect(cvWithShows([testShow], new Date("2026-11-07T05:00:00Z")).groupExhibitions).toHaveLength(1);
  });
});
```

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | tail -8`
Expected: FAIL, `studioShows` is undefined (its tests throw on `.key`) and `cvWithShows is not a function`.

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/artist.config.ts` with:

```ts
import type { ArtistConfig } from "@iserlabs/web-kit/artist";

/**
 * Julian's settings for the kit's artist module (`@iserlabs/web-kit/artist`).
 *
 * Every name here is the one already in production: the `jp_studio` cookie, the
 * Upstash key his studio edits live under, the `JP-` catalog numbers and the two
 * passphrase variables. Changing any of them logs everyone out, orphans his saved
 * edits or renumbers his works, so they stay exactly as they are.
 *
 * The time zone and the shows key arrived with shows: his show dates are New York
 * calendar days, and his shows live under their own key beside his overlays.
 */
export const artistConfig = {
  catalogPrefix: "JP-",
  // "2026-11-07" on a show means that whole day in New York, where he shows.
  timeZone: "America/New_York",
  studio: {
    cookieName: "jp_studio",
    secretEnv: "STUDIO_SECRET",
    // Two people hold keys and they are not the same person: Julian owns the
    // currency of his own portfolio, Jake owns the schema and the publish
    // decisions, so only Jake may reset a record to its base state.
    roles: [
      { id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" },
      { id: "jake", passphraseEnv: "STUDIO_PASS_JAKE", canReset: true },
    ],
    storeKey: "studio:julian:overlays",
    // His shows, typed in the studio, kept apart from the per-work overlays.
    showsKey: "studio:julian:shows",
  },
} as const satisfies ArtistConfig;
```

Replace the whole of `src/lib/studio.ts` with:

```ts
import { createStudioAuth, createStudioStore } from "@iserlabs/web-kit/artist";
import { artistConfig } from "@/artist.config";

/**
 * Julian's studio door and store, built by the kit from his own names
 * (`src/artist.config.ts`), so every cookie already issued stays valid and every
 * saved edit is read where it already is.
 */
export const studioAuth = createStudioAuth(artistConfig.studio);

export const studioStore = createStudioStore({
  key: artistConfig.studio.storeKey,
  showsKey: artistConfig.studio.showsKey,
  // The public artwork pages read through this. A timed revalidate keeps those 34
  // pages static and still lands a studio edit within the minute; an uncached read
  // would turn every one of them dynamic. The studio's own screens read fresh.
  cachedRead: { next: { revalidate: 60 } },
});

/** Julian's shows, typed in the studio. Public pages read them through the same
    one-minute cache as his overlays; the studio reads them fresh. */
export const studioShows = studioStore.shows;
```

(The comment block above `studioStore` is unchanged from phase 1, so its words are already in the CSS scan; the new comment adds none of the utility words listed in the Global Constraints.)

Create `src/app/api/studio/shows/route.ts`:

```ts
import { showsHandler } from "@iserlabs/web-kit/artist";
import * as Sentry from "@sentry/nextjs";
import { artworkBySlug } from "@/content/artworks";
import { studioAuth, studioShows } from "@/lib/studio";

/**
 * Reading and writing Julian's shows. The handler (cookie check, validation of
 * every fact, plain-words problems) lives in the kit; this file says which works
 * exist. A show can only list works in the repo catalog.
 */
const shows = showsHandler({
  auth: studioAuth,
  store: studioShows,
  catalog: { has: (slug) => artworkBySlug(slug) !== undefined },
  // A store failure answers the studio with a plain 503; this is how it also reaches Sentry.
  onError: (error, { method, slug }) => {
    Sentry.captureException(error, {
      tags: { route: "studio-shows", method },
      extra: { slug },
    });
  },
});

export const GET = shows.GET;
export const PUT = shows.PUT;
export const DELETE = shows.DELETE;
```

In `src/content/cv.ts`, replace:

```ts
import type { Cv } from "@iserlabs/web-kit/artist";
import { site } from "./site";
```

with:

```ts
import { type Cv, cvFromShows, mergeCv, type Show } from "@iserlabs/web-kit/artist";
import { artistConfig } from "@/artist.config";
import { site } from "./site";
```

and append to the end of `src/content/cv.ts`:

```ts

/** His CV as printed: the record above, plus a line for every show he has published
    in the studio, from its first day, read in New York. One fact, typed once. */
export function cvWithShows(shows: readonly Show[], now: Date): Cv {
  return mergeCv(cv, cvFromShows(shows, now, artistConfig.timeZone));
}
```

Replace the whole of `src/app/cv/page.tsx` with:

```tsx
import { cvSections, newestFirst, type ShowRecord } from "@iserlabs/web-kit/artist";
import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import DFoot from "@/components/DFoot";
import { cvWithShows } from "@/content/cv";
import { site } from "@/content/site";
import { studioShows } from "@/lib/studio";

/**
 * The CV, in the direction Julian chose.
 *
 * Carole 10 makes this a primary destination, separate from About: the bio is a
 * short third-person line, the complete exhibition record lives here.
 *
 * Carole 13 governs what it may show. A curator reads a stale or empty section as
 * an abandoned practice, so this page renders only sections that have real
 * entries, and it invents nothing. Today that is the two exhibitions on record,
 * plus any show Julian has published in the studio, from its first day.
 * Education, group shows, press and awards appear the moment Julian supplies them
 * and not a day before.
 *
 * The rows are the same record the About page sets under his exhibitions: name,
 * detail, year, on one hairline. A CV is a list of facts and the direction is
 * built for exactly that.
 */

export const metadata: Metadata = {
  title: "CV",
  description: `Exhibition record and professional history for Julian Potulicki, oil painter in ${site.location}.`,
  alternates: { canonical: "/cv" },
};

/** Every show Julian has saved, read through the store's one-minute cache. With no
    store connected this reads nothing and the page is built once, exactly as it was
    before shows existed. A store failure must not take the CV down: the page falls
    back to the record typed by hand, and Sentry hears about it. */
async function savedShows(): Promise<ShowRecord[]> {
  try {
    return (await studioShows.readShows()) ?? [];
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "cv" } });
    return [];
  }
}

export default async function CvPage() {
  const cv = cvWithShows(await savedShows(), new Date());
  const sections = cvSections(cv);

  return (
    <div data-ground="stark" className="d-page">
      <header className="d-head">
        <h1 className="d-name">CV</h1>
        <p className="d-locator">
          {site.name}, oil painter, {site.location}
        </p>
      </header>

      <section className="d-column">
        {cv.education.length > 0 ? (
          <>
            <p className="d-label">Education</p>
            <div className="d-records d-records-stacked">
              {cv.education.map((e) => (
                <div className="d-record" key={`${e.what}-${e.where ?? ""}`}>
                  <span className="d-record-name">{e.what}</span>
                  {e.where ? <span className="d-record-detail">{e.where}</span> : null}
                  {e.year ? <span className="d-record-year">{e.year}</span> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {sections.map((section) => (
          <div key={section.id}>
            <p className="d-label">{section.heading}</p>
            <div className="d-records d-records-stacked">
              {newestFirst(section.entries).map((entry) => {
                const detail = [
                  entry.note,
                  [entry.venue, entry.location].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(". ");
                const inner = (
                  <>
                    <span className="d-record-name">{entry.title}</span>
                    {detail ? <span className="d-record-detail">{detail}.</span> : null}
                    <span className="d-record-year">{entry.year}</span>
                  </>
                );
                return entry.href ? (
                  <a
                    className="d-record"
                    href={entry.href}
                    key={`${entry.year}-${entry.title}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="d-record" key={`${entry.year}-${entry.title}`}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <DFoot current="/cv" />
    </div>
  );
}
```

No `export const revalidate` is added to `/cv`, on purpose. The shows read carries the store's own 60-second revalidate, so with the store connected Next makes `/cv` revalidate every minute (a show reaches the CV within a minute of its first day), and with the store blank nothing is fetched and the page is built once, which is why Task 11's snapshot of `/cv` stays identical to `.qa/A`.

- [ ] **Step 4: Run the tests to verify they pass, then the gate**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/artist.config.ts src/lib/studio.ts src/lib/studio.test.ts src/app/api/studio/shows/route.ts src/content/cv.ts src/content/cv.test.ts src/app/cv/page.tsx
```

Expected: `Test Files  7 passed (7)`, `Tests  52 passed (52)`; typecheck and lint clean; every em dash count `0`. If Biome reports formatting only, run `pnpm exec biome check --write` on the files listed above and rerun.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/artist.config.ts src/lib/studio.ts src/lib/studio.test.ts src/app/api/studio/shows/route.ts src/content/cv.ts src/content/cv.test.ts src/app/cv/page.tsx && git status --short && git -c commit.gpgsign=false commit -m "Shows: his time zone and shows key, the shows route, and published shows on the CV from their first day"
```

Expected `git status --short` before the commit: the seven files staged (`M ` or `A `), `?? docs/boards/` untouched, nothing else.

---
### Task 10: Julian: the studio says when nothing can be saved, and gains a Shows section

**Files:**
- Modify: `src/app/studio/page.tsx` (full replacement)
- Modify: `src/app/studio/StudioClient.tsx` (full replacement)

**Interfaces:**
- Consumes: `studioStore`, `studioShows` (Task 9); `/api/studio/shows` answers (Task 7): PUT 400 carries `problems: string[]`; `ShowRecord` type from the kit.
- Produces: `StudioClient` props `{ role: string | null; configured: boolean; records: Record[]; shows: ShowRecord[]; storeState: StoreState }`, where `export type StoreState = "ready" | "none" | "down"`. The dead `storeReady` prop is gone.

What the desk does after this task:
1\) **Store ready:** the works list exactly as before, then a Shows section: a "New show" button, one row per saved show (title, venue and dates, "published" or "held back"), and a form per show in the existing studio form style, with a checkbox list of every work in his catalog.
2\) **No store connected:** the heading and the "Signed in as" line, then one notice, "No store is connected, so nothing typed here could be saved. The works and shows open for editing once it is." No form renders, so nothing can be typed and lost.
3\) **Store did not answer:** the same, with "The store did not answer, so nothing typed here could be saved. Reload the page in a minute." The failure also goes to Sentry.

Styling rule for this task: every class name in the new markup already appears in the current `StudioClient.tsx`, so Tailwind emits no new CSS (Task 11 proves `css.txt` unchanged). The single British spelling in this file ("centimetres" in the units menu) becomes "centimeters" under the American English rule; that menu renders only after a work is opened, so no snapshot changes.

- [ ] **Step 1: Replace the studio page**

Replace the whole of `src/app/studio/page.tsx` with:

```tsx
import {
  type ArtworkOverlay,
  mergeAll,
  missingFields,
  type ShowRecord,
} from "@iserlabs/web-kit/artist";
import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { artworks } from "@/content/artworks";
import { studioAuth, studioShows, studioStore } from "@/lib/studio";
import StudioClient, { type StoreState } from "./StudioClient";

/**
 * The studio: where the portfolio stays current without a developer.
 *
 * Carole 05 is explicit that adding work, changing availability and moving a piece
 * to sold must not require one, and Jake chose this over a studio visit as the way
 * the missing metadata actually arrives. So the list leads with what each record is
 * MISSING rather than what it has: the gap is the work.
 *
 * Never indexed, and never linked from the public site.
 */

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false, nocache: true },
};

// The overlays change whenever Julian saves, so this page is never cached.
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const jar = await cookies();
  const role = await studioAuth.verify(jar.get(studioAuth.cookieName)?.value);
  const configured = studioAuth.configured();

  // Whether anything typed here can be kept, decided before Julian types. No store,
  // and a store that does not answer, each get their own plain notice on the desk,
  // never a form that would lose what was typed into it.
  let storeState: StoreState =
    studioStore.configured() && studioShows.configured() ? "ready" : "none";
  let overlays: Record<string, ArtworkOverlay> = {};
  let shows: ShowRecord[] = [];
  if (role && storeState === "ready") {
    try {
      overlays = (await studioStore.readOverlays(true)) ?? {};
      shows = (await studioShows.readShows(true)) ?? [];
    } catch (error) {
      Sentry.captureException(error, { tags: { route: "studio-page" } });
      storeState = "down";
    }
  }
  const merged = mergeAll(artworks, overlays);

  const records = merged.map((w) => ({
    slug: w.slug,
    catalogId: w.catalogId,
    series: w.series,
    title: w.title ?? "",
    year: w.year ?? "",
    medium: (w.medium ?? []).join(", "),
    substrate: w.substrate ?? "",
    height: w.dimensions?.height ?? "",
    width: w.dimensions?.width ?? "",
    depth: w.dimensions?.depth ?? "",
    unit: w.dimensions?.unit ?? "in",
    availability: w.availability ?? "",
    lifecycle: w.lifecycle,
    publish: w.publish,
    priceAmount: w.price?.amount ?? "",
    priceVisibility: w.price?.visibility ?? "on-request",
    src: w.src,
    missing: missingFields(w),
  }));

  // Newest first, the order his CV reads them in.
  const showList = [...shows].sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  return (
    <StudioClient
      role={role}
      configured={configured}
      records={records}
      shows={showList}
      storeState={storeState}
    />
  );
}
```

- [ ] **Step 2: Replace the studio client**

Replace the whole of `src/app/studio/StudioClient.tsx` with:

```tsx
"use client";

import type { ShowRecord } from "@iserlabs/web-kit/artist";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * The studio, client side.
 *
 * Two screens: a door, and a desk. The desk lists works ordered by how incomplete
 * they are. Leading with the gap is the point. Carole 15 asks whether every
 * published work carries complete metadata, and today none of them do, so a list
 * sorted by "what is missing" is a worklist rather than an inventory.
 *
 * Saving one work writes one overlay. There is no bulk edit, deliberately: the
 * fields being filled in are measurements of physical objects, and a form that
 * makes it easy to apply a value to many works at once is a form that will.
 *
 * Shows sit below the works. Julian types each show's facts himself, because they
 * are his: a show stays held back until he publishes it, and it can list only works
 * in his catalog.
 *
 * When no store is connected, or the store does not answer, the desk says so before
 * anything can be typed, rather than offering forms that would lose what was typed.
 */

type Record = {
  slug: string;
  catalogId: string;
  series: string;
  title: string | number;
  year: string | number;
  medium: string;
  substrate: string;
  height: string | number;
  width: string | number;
  depth: string | number;
  unit: string;
  availability: string;
  lifecycle: string;
  publish: string;
  priceAmount: string | number;
  priceVisibility: string;
  src: string;
  missing: string[];
};

/** Whether anything typed on the desk can be kept. */
export type StoreState = "ready" | "none" | "down";

export default function StudioClient({
  role,
  configured,
  records,
  shows,
  storeState,
}: {
  role: string | null;
  configured: boolean;
  records: Record[];
  shows: ShowRecord[];
  storeState: StoreState;
}) {
  if (!role) return <Door configured={configured} />;
  return <Desk role={role} records={records} shows={shows} storeState={storeState} />;
}

function Door({ configured }: { configured: boolean }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "That did not work.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-32">
      <h1 className="display-m">Studio</h1>
      {configured ? (
        <form onSubmit={submit} className="mt-8">
          <label htmlFor="passphrase" className="block text-[0.95rem] font-medium">
            Passphrase
          </label>
          <input
            id="passphrase"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="mt-2 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn mt-6 min-h-[48px] w-full disabled:opacity-60"
          >
            {busy ? "Checking" : "Enter"}
          </button>
          {error ? (
            <p className="mt-4 text-[0.9rem] text-[var(--color-code-red)]" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="mt-6 text-[0.95rem]">
          The studio is not configured yet, so there is nothing to sign in to.
        </p>
      )}
    </main>
  );
}

function Desk({
  role,
  records,
  shows,
  storeState,
}: {
  role: string;
  records: Record[];
  shows: ShowRecord[];
  storeState: StoreState;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Most incomplete first: the list is a worklist, not an inventory.
  const ordered = useMemo(
    () => [...records].sort((a, b) => b.missing.length - a.missing.length),
    [records],
  );
  const complete = records.filter((r) => r.missing.length === 0).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="display-m">Studio</h1>
        <p className="text-[0.9rem] text-[var(--color-ink-faint)]">
          Signed in as {role}. {complete} of {records.length} works fully documented.
        </p>
      </div>

      {storeState === "ready" ? (
        <>
          <p className="mt-4 max-w-2xl text-[0.95rem] text-[var(--color-ink-faint)]">
            Most incomplete first. A work goes out with whatever is filled in; a blank field
            simply does not print. Nothing here changes which paintings exist, only what is known
            about them.
          </p>

          <ul className="mt-10 space-y-3">
            {ordered.map((r) => (
              <li key={r.slug} className="border-t border-[var(--color-line)] pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(open === r.slug ? null : r.slug)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-4 text-left"
                  aria-expanded={open === r.slug}
                >
                  <span>
                    <span className="font-medium">{r.title || "Untitled"}</span>
                    <span className="ml-2 text-[0.85rem] text-[var(--color-ink-faint)]">
                      {r.catalogId} · {r.series}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.8rem] text-[var(--color-ink-faint)]">
                    {r.missing.length === 0 ? "complete" : `${r.missing.length} missing`}
                  </span>
                </button>
                {open === r.slug ? (
                  <WorkForm record={r} role={role} onSaved={() => setSaved(r.slug)} />
                ) : null}
                {saved === r.slug ? (
                  <p className="pb-3 text-[0.85rem] text-[var(--color-code-green,#3c6b4a)]">
                    Saved.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <Shows shows={shows} works={records} />
        </>
      ) : (
        <p className="mt-4 max-w-2xl text-[0.95rem]" role="status">
          {storeState === "none"
            ? "No store is connected, so nothing typed here could be saved. The works and shows open for editing once it is."
            : "The store did not answer, so nothing typed here could be saved. Reload the page in a minute."}
        </p>
      )}
    </main>
  );
}

function WorkForm({
  record,
  role,
  onSaved,
}: {
  record: Record;
  role: string;
  onSaved: () => void;
}) {
  const [v, setV] = useState(record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof Record, value: string) => setV((p) => ({ ...p, [k]: value }));

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/work", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, slug: record.slug }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof Record, label: string, type = "text") => (
    <label className="block">
      <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : "text"}
        value={String(v[k] ?? "")}
        onChange={(e) => set(k, e.target.value)}
        className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
      />
    </label>
  );

  return (
    <div className="grid gap-4 pb-6 pt-4 sm:grid-cols-2">
      {field("title", "Title")}
      {field("year", "Year", "number")}
      {field("medium", "Medium, comma separated")}
      {field("substrate", "Substrate")}
      {field("height", "Height", "number")}
      {field("width", "Width", "number")}
      {field("depth", "Depth, if any", "number")}
      <label className="block">
        <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">Units</span>
        <select
          value={String(v.unit)}
          onChange={(e) => set("unit", e.target.value)}
          className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
        >
          <option value="in">inches</option>
          <option value="cm">centimeters</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">Availability</span>
        <select
          value={String(v.availability)}
          onChange={(e) => set("availability", e.target.value)}
          className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
        >
          <option value="">not recorded</option>
          <option value="available">available</option>
          <option value="sold">sold</option>
          <option value="reserved">reserved</option>
          <option value="not-for-sale">not for sale</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">On the site</span>
        <select
          value={String(v.publish)}
          onChange={(e) => set("publish", e.target.value)}
          className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
        >
          <option value="published">published</option>
          <option value="draft">held back</option>
        </select>
      </label>
      {field("priceAmount", "Price, USD", "number")}
      <label className="block">
        <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">Price shown</span>
        <select
          value={String(v.priceVisibility)}
          onChange={(e) => set("priceVisibility", e.target.value)}
          className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
        >
          <option value="on-request">on request</option>
          <option value="public">shown publicly</option>
        </select>
      </label>

      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn min-h-[48px] disabled:opacity-60"
        >
          {busy ? "Saving" : "Save"}
        </button>
        {role === "jake" ? (
          <span className="ml-3 text-[0.8rem] text-[var(--color-ink-faint)]">
            {record.missing.length ? `missing: ${record.missing.join(", ")}` : "complete"}
          </span>
        ) : null}
        {error ? (
          <p className="mt-3 text-[0.9rem] text-[var(--color-code-red)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shows */

/** The open-row key for the new-show form. A "+" can never appear in a show's slug. */
const NEW_SHOW = "+new";

const KINDS: [string, string][] = [
  ["solo", "solo show"],
  ["two-person", "two-person show"],
  ["group", "group show"],
  ["event", "an evening or event"],
];

type ShowDraft = {
  title: string;
  kind: string;
  venue: string;
  address: string;
  city: string;
  startsOn: string;
  endsOn: string;
  openingOn: string;
  openingFrom: string;
  openingTo: string;
  href: string;
  note: string;
  publish: string;
  workSlugs: string[];
};

type DraftText = Exclude<keyof ShowDraft, "workSlugs">;

function draftOf(s: ShowRecord | undefined): ShowDraft {
  return {
    title: s?.title ?? "",
    kind: s?.kind ?? "solo",
    venue: s?.venue ?? "",
    address: s?.address ?? "",
    city: s?.city ?? "",
    startsOn: s?.startsOn ?? "",
    endsOn: s?.endsOn ?? "",
    openingOn: s?.opening?.on ?? "",
    openingFrom: s?.opening?.from ?? "",
    openingTo: s?.opening?.to ?? "",
    href: s?.href ?? "",
    note: s?.note ?? "",
    publish: s?.publish ?? "draft",
    workSlugs: s?.workSlugs ?? [],
  };
}

/** A web name for a new show, from its title: "Light Codes" gives "light-codes". It
    never reuses a name already taken, so a new show can never overwrite another. */
function slugFor(d: ShowDraft, taken: readonly string[]): string {
  const fromTitle = d.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  const base = fromTitle || `show-${d.startsOn || "new"}`;
  let slug = base;
  for (let n = 2; taken.includes(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

function Shows({ shows, works }: { shows: ShowRecord[]; works: Record[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const taken = shows.map((s) => s.slug);

  return (
    <section className="mt-10" aria-labelledby="shows-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="shows-heading" className="display-m">
          Shows
        </h2>
        <button
          type="button"
          onClick={() => setOpen(open === NEW_SHOW ? null : NEW_SHOW)}
          className="btn min-h-[48px]"
          aria-expanded={open === NEW_SHOW}
        >
          New show
        </button>
      </div>

      <p className="mt-4 max-w-2xl text-[0.95rem] text-[var(--color-ink-faint)]">
        A held-back show stays here. A published show joins the CV on its first day. A show can
        list only works that are already in the catalog.
      </p>

      {open === NEW_SHOW ? (
        <ShowForm
          works={works}
          taken={taken}
          onSaved={(slug) => {
            setOpen(null);
            setSaved(slug);
          }}
        />
      ) : null}

      {shows.length === 0 && open !== NEW_SHOW ? (
        <p className="mt-4 max-w-2xl text-[0.95rem] text-[var(--color-ink-faint)]">
          No shows yet.
        </p>
      ) : null}

      <ul className="mt-10 space-y-3">
        {shows.map((s) => (
          <li key={s.slug} className="border-t border-[var(--color-line)] pt-3">
            <button
              type="button"
              onClick={() => setOpen(open === s.slug ? null : s.slug)}
              className="flex min-h-[44px] w-full items-center justify-between gap-4 text-left"
              aria-expanded={open === s.slug}
            >
              <span>
                <span className="font-medium">{s.title}</span>
                <span className="ml-2 text-[0.85rem] text-[var(--color-ink-faint)]">
                  {s.venue} · {s.startsOn} to {s.endsOn}
                </span>
              </span>
              <span className="shrink-0 text-[0.8rem] text-[var(--color-ink-faint)]">
                {s.publish === "published" ? "published" : "held back"}
              </span>
            </button>
            {open === s.slug ? (
              <ShowForm
                show={s}
                works={works}
                taken={taken}
                onSaved={(slug) => setSaved(slug)}
                onDeleted={() => setOpen(null)}
              />
            ) : null}
            {saved === s.slug ? (
              <p className="pb-3 text-[0.85rem] text-[var(--color-code-green,#3c6b4a)]">Saved.</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShowForm({
  show,
  works,
  taken,
  onSaved,
  onDeleted,
}: {
  show?: ShowRecord;
  works: Record[];
  taken: string[];
  onSaved: (slug: string) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(() => draftOf(show));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const set = (k: DraftText, value: string) => setV((p) => ({ ...p, [k]: value }));
  const toggle = (slug: string) =>
    setV((p) => ({
      ...p,
      workSlugs: p.workSlugs.includes(slug)
        ? p.workSlugs.filter((s) => s !== slug)
        : [...p.workSlugs, slug],
    }));

  /** One call to the shows route. On success the page's data is read again, so the
      list shows exactly what the store now holds. */
  async function send(method: "PUT" | "DELETE", url: string, body?: string): Promise<boolean> {
    setBusy(true);
    setError("");
    setProblems([]);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body,
      });
      const data = (await res.json()) as { error?: string; problems?: string[] };
      if (!res.ok) {
        setProblems(data.problems ?? []);
        throw new Error(data.error ?? "That did not work.");
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const slug = show?.slug ?? slugFor(v, taken);
    const opening =
      v.openingOn || v.openingFrom || v.openingTo
        ? { on: v.openingOn, from: v.openingFrom, to: v.openingTo }
        : undefined;
    const body = JSON.stringify({
      slug,
      title: v.title,
      kind: v.kind,
      venue: v.venue,
      address: v.address,
      city: v.city,
      startsOn: v.startsOn,
      endsOn: v.endsOn,
      opening,
      workSlugs: v.workSlugs,
      href: v.href,
      note: v.note,
      publish: v.publish,
    });
    if (await send("PUT", "/api/studio/shows", body)) onSaved(slug);
  }

  async function remove() {
    if (!show || !window.confirm(`Delete "${show.title}"? This cannot be undone.`)) return;
    if (await send("DELETE", `/api/studio/shows?slug=${encodeURIComponent(show.slug)}`)) {
      onDeleted?.();
    }
  }

  const field = (k: DraftText, label: string, type = "text") => (
    <label className="block">
      <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">{label}</span>
      <input
        type={type}
        value={v[k]}
        onChange={(e) => set(k, e.target.value)}
        className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
      />
    </label>
  );

  return (
    <div className="grid gap-4 pb-6 pt-4 sm:grid-cols-2">
      {field("title", "Title")}
      <label className="block">
        <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">Kind</span>
        <select
          value={v.kind}
          onChange={(e) => set("kind", e.target.value)}
          className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
        >
          {KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {field("venue", "Venue")}
      {field("city", "City")}
      {field("address", "Street address, if any")}
      {field("href", "The gallery's page for the show, if any", "url")}
      {field("startsOn", "First day", "date")}
      {field("endsOn", "Last day", "date")}
      {field("openingOn", "Opening reception, date", "date")}
      {field("openingFrom", "Opening reception, from", "time")}
      {field("openingTo", "Opening reception, until", "time")}
      {field("note", "One line in your words, if any")}
      <label className="block">
        <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">On the site</span>
        <select
          value={v.publish}
          onChange={(e) => set("publish", e.target.value)}
          className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
        >
          <option value="draft">held back</option>
          <option value="published">published</option>
        </select>
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="block text-[0.85rem] text-[var(--color-ink-faint)]">
          Works in the show
        </legend>
        <div className="mt-1 grid gap-4 sm:grid-cols-2">
          {works.map((w) => (
            <label key={w.slug} className="flex min-h-[44px] items-center gap-4">
              <input
                type="checkbox"
                checked={v.workSlugs.includes(w.slug)}
                onChange={() => toggle(w.slug)}
              />
              <span>
                <span className="font-medium">{w.title || "Untitled"}</span>
                <span className="ml-2 text-[0.85rem] text-[var(--color-ink-faint)]">
                  {w.catalogId} · {w.series}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn min-h-[48px] disabled:opacity-60"
        >
          {busy ? "Saving" : "Save"}
        </button>
        {show ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="btn ml-3 min-h-[48px] disabled:opacity-60"
          >
            Delete
          </button>
        ) : null}
        {error ? (
          <p className="mt-3 text-[0.9rem] text-[var(--color-code-red)]" role="alert">
            {error}
          </p>
        ) : null}
        {problems.length > 0 ? (
          <ul className="mt-3 space-y-3 text-[0.9rem] text-[var(--color-code-red)]">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Prove no new class name entered the file**

Every class token used after this task must have been in the file before it. Run:

```bash
cd /Users/macbook/Claude/julianpotulicki && tok() { grep -oE 'className="[^"]*"' "$1" | sed -E 's/className="//; s/"$//' | tr ' ' '\n' | sort -u; }; diff <(git show HEAD:src/app/studio/StudioClient.tsx > .qa/studio-before.tsx && tok .qa/studio-before.tsx) <(tok src/app/studio/StudioClient.tsx) | grep '^>' || echo "NO NEW CLASS NAMES"
```

Expected: `NO NEW CLASS NAMES`. Any `>` line names a class to replace with one already in the file.

- [ ] **Step 4: Gate**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src/app/studio/page.tsx src/app/studio/StudioClient.tsx && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' src/app/studio/page.tsx src/app/studio/StudioClient.tsx && grep -c "storeReady" src/app/studio/page.tsx src/app/studio/StudioClient.tsx
```

Expected: `Tests  52 passed (52)`; typecheck and lint clean; em dash counts `0`, `0`; `storeReady` counts `0`, `0`. If Biome flags the long notice strings for line length, leave them as single strings (Biome does not split strings) and accept the formatter's wrapping of the surrounding JSX.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/app/studio/page.tsx src/app/studio/StudioClient.tsx && git status --short && git -c commit.gpgsign=false commit -m "Studio: says plainly when nothing can be saved, and Julian can create, edit, publish and delete his shows"
```

Expected `git status --short` before the commit: the two files staged, `?? docs/boards/` untouched.

---
### Task 11: Julian: prove nothing public changed, and prove the studio round trip

**Files:**
- Modify: `scripts/qa/render-snapshot.mjs`
- Create (gitignored, never committed): `.qa/stand-in-kv.mjs`, `.qa/shows-e2e.mjs`
- Modify: `docs/superpowers/RESUME-julian.md` (status line)

**Interfaces:**
- Consumes: everything from Tasks 9 and 10; snapshots `.qa/A` (original site) and `.qa/D` (accepted phase-1 result).
- Produces: snapshot `.qa/E`, `E/shows-api.json`, the comparison verdict, the end-to-end verdict, the green gate.

What "nothing public changed" means here, exactly:
1\) `pages/` in E equals A file for file, except `studio-desk.html` (the signed-in desk, which now shows the no-store notice because the QA store is blank). The signed-out `studio.html` must be identical.
2\) `headers.json` and `api.json` (the work and login API) equal A.
3\) `css.txt` equals D byte for byte (D already carries the two accepted phase-1 differences from A).
4\) `routes.txt` equals A plus exactly one line, `ƒ /api/studio/shows`.
5\) In `studio-desk.html`, everything outside the desk's own `<main class="mx-auto max-w-4xl px-6 py-24">...</main>` equals A; inside it, A lists 34 works and E lists none and carries the no-store notice.

- [ ] **Step 1: Probe the shows API in the snapshot, in a file of its own**

In `scripts/qa/render-snapshot.mjs`, replace:

```js
 *   api.json            every studio API answer, cookie values redacted
```

with:

```js
 *   api.json            every studio API answer, cookie values redacted
 *   shows-api.json      every shows API answer, kept apart so api.json still compares
```

Replace:

```js
// Every page, and the cache policy it is served with: a page that turns dynamic shows up here.
```

with:

```js
// The shows API, in a file of its own so api.json still compares with earlier builds.
const showsCall = (method, token, { query = "", body } = {}) =>
  fetch(new URL(`/api/studio/shows${query}`, base), {
    method,
    redirect: "manual",
    headers: { "content-type": "application/json", ...cookieHeader(token) },
    body,
  });
const showsApi = [];
showsApi.push(await record("shows GET, no cookie", await showsCall("GET")));
const showsGetJulian = await showsCall("GET", julian);
// The same refusal as the work probe: the next two calls would write to a live store.
{
  const probe = await showsGetJulian
    .clone()
    .json()
    .catch(() => null);
  if (probe?.configured !== false) {
    console.error(
      "The shows store is live (shows GET says configured: " +
        `${probe?.configured ?? "unreadable"}). ` +
        "This script writes and deletes shows, so the store must be blanked: " +
        "start the server with KV_REST_API_URL= and KV_REST_API_TOKEN= set empty.",
    );
    process.exit(1);
  }
}
showsApi.push(await record("shows GET, julian", showsGetJulian));
showsApi.push(
  await record(
    "shows PUT, julian, store off",
    await showsCall("PUT", julian, { body: JSON.stringify({ slug: "qa-show", title: "QA" }) }),
  ),
);
showsApi.push(
  await record(
    "shows DELETE, julian, store off",
    await showsCall("DELETE", julian, { query: "?slug=qa-show" }),
  ),
);

// Every page, and the cache policy it is served with: a page that turns dynamic shows up here.
```

Replace:

```js
await writeFile(join(out, "api.json"), `${JSON.stringify(api, null, 2)}\n`);
```

with:

```js
await writeFile(join(out, "api.json"), `${JSON.stringify(api, null, 2)}\n`);
await writeFile(join(out, "shows-api.json"), `${JSON.stringify(showsApi, null, 2)}\n`);
```

Replace:

```js
  `snapshot ${out}: ${ROUTES.length + 1} pages, ${api.length} studio API answers, ${stylesheets.length} stylesheets`,
```

with:

```js
  `snapshot ${out}: ${ROUTES.length + 1} pages, ${api.length} studio API answers, ${showsApi.length} shows API answers, ${stylesheets.length} stylesheets`,
```

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write scripts/qa/render-snapshot.mjs && pnpm lint 2>&1 | tail -3`
Expected: clean.

- [ ] **Step 2: Build E with the store blanked, and snapshot it**

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/E && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/E/build.log 2>&1; tail -30 .qa/E/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/E/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/E/routes.txt && cat .qa/E/routes.txt
```

Expected: the build succeeds and `routes.txt` lists `ƒ /api/studio/shows` between `ƒ /api/studio/login` and `ƒ /api/studio/work`, with `/cv` still `○`. If the build fails on `new Date()` in `/cv`, read `node_modules/next/dist/docs/` for the current-time rule in this Next version (AGENTS.md) and report it rather than changing the page's caching.

After `lsof -ti tcp:3111 || echo free` prints `free`, start the server in the background (`run_in_background: true`):

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3111
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/E; kill -9 $(lsof -ti tcp:3111); node -e 'for (const r of require("./.qa/E/shows-api.json")) console.log(r.status, r.name, JSON.stringify(r.body))'
```

Expected: `snapshot .qa/E: 8 pages, 11 studio API answers, 4 shows API answers, ...`, every page `200`, then exactly:

```
401 shows GET, no cookie {"error":"locked"}
200 shows GET, julian {"configured":false,"shows":[]}
503 shows PUT, julian, store off {"error":"No store is connected, so nothing would be saved."}
503 shows DELETE, julian, store off {"error":"No store is connected, so nothing would be saved."}
```

- [ ] **Step 3: Compare E with A and D**

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && diff -r -x studio-desk.html A/pages E/pages && diff A/headers.json E/headers.json && diff A/api.json E/api.json && diff D/css.txt E/css.txt && diff <(LC_ALL=en_US.UTF-8 grep -vx 'ƒ /api/studio/shows' E/routes.txt) A/routes.txt && LC_ALL=en_US.UTF-8 grep -qx 'ƒ /api/studio/shows' E/routes.txt && echo "UNCHANGED OUTSIDE THE STUDIO: pages, cache policy, work API, CSS, and the route table plus one new API route"
```

Expected: the final line prints and nothing else does. If `css.txt` differs, the added or removed rule names a word that entered or left the source (a class or a bare utility word in a comment); rephrase it and rebuild. Any other difference: stop and use superpowers:systematic-debugging.

Then the one expected difference, the signed-in desk:

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && desk='s#<main class="mx-auto max-w-4xl px-6 py-24">.*?</main>#DESK#' && diff <(perl -pe "$desk" A/pages/studio-desk.html) <(perl -pe "$desk" E/pages/studio-desk.html) && echo "DESK SURROUNDINGS UNCHANGED" && for s in A E; do printf '%s works listed: ' "$s"; perl -ne 'print $1 if m#(<main class="mx-auto max-w-4xl px-6 py-24">.*?</main>)#' "$s/pages/studio-desk.html" | grep -o 'aria-expanded' | wc -l | tr -d ' '; done && grep -o 'No store is connected[^<]*' E/pages/studio-desk.html && grep -o 'Signed in as' E/pages/studio-desk.html | wc -l | tr -d ' '
```

Expected:

```
DESK SURROUNDINGS UNCHANGED
A works listed: 34
E works listed: 0
No store is connected, so nothing typed here could be saved. The works and shows open for editing once it is.
1
```

- [ ] **Step 4: Prove the studio round trip against a local stand-in store**

This is the only step that runs with a store, and the store is a 30-line local process: nothing reaches Upstash, and the check refuses to write until it has proven the server is reading the stand-in.

Create `.qa/stand-in-kv.mjs` (gitignored):

```js
// A stand-in for Upstash's REST API, for one local check. Never deployed, never committed.
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const [port = "8079", log = ".qa/stand-in-kv.log"] = process.argv.slice(2);
const values = new Map();

createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  appendFileSync(log, `${req.method} ${req.url}\n`);
  res.setHeader("content-type", "application/json");
  const match = /^\/(get|set)\/(.+)$/.exec(req.url ?? "");
  if (!match) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "unknown" }));
    return;
  }
  const key = decodeURIComponent(match[2]);
  if (match[1] === "set") {
    values.set(key, body);
    res.end(JSON.stringify({ result: "OK" }));
    return;
  }
  res.end(JSON.stringify({ result: values.get(key) ?? null }));
}).listen(Number(port), "127.0.0.1", () => console.log(`stand-in store on ${port}`));
```

Create `.qa/shows-e2e.mjs` (gitignored):

```js
// One local round trip through the studio's shows, against the stand-in store.
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3112";
const log = process.argv[3] ?? ".qa/stand-in-kv.log";
const say = (label, value) =>
  console.log(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

const login = await fetch(`${base}/api/studio/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ passphrase: "qa-julian-pass" }),
});
const cookie = (login.headers.getSetCookie().find((c) => c.startsWith("jp_studio=")) ?? "").split(
  ";",
)[0];
if (!cookie) {
  console.error("no studio cookie: was the server started with the QA passphrases?");
  process.exit(1);
}
const api = (method, { query = "", body } = {}) =>
  fetch(`${base}/api/studio/shows${query}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body,
  });

say("GET before", await (await api("GET")).json());
if (!readFileSync(log, "utf8").includes("GET /get/studio:julian:shows")) {
  console.error("The server did not read the stand-in store. Stop: it may be connected to a real one.");
  process.exit(1);
}

// Obviously fake facts, held only in the stand-in's memory.
const show = {
  slug: "qa-test-show",
  title: "QA Test Show",
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  opening: { on: "2026-10-01", from: "18:00", to: "21:00" },
  workSlugs: ["light-language-red"],
  publish: "published",
};
const put = await api("PUT", { body: JSON.stringify(show) });
say("PUT valid", `${put.status} ${(await put.json()).ok}`);
const after = (await (await api("GET")).json()).shows;
say("GET after", after.map((s) => `${s.slug} ${s.publish} by ${s.updatedBy}`));
const desk = await (await fetch(`${base}/studio`, { headers: { cookie } })).text();
say("desk lists it", desk.includes("QA Test Show") && desk.includes("Test Gallery"));
const bad = await api("PUT", {
  body: JSON.stringify({ ...show, endsOn: "2026-09-01", workSlugs: ["not-a-work"] }),
});
say("PUT invalid", `${bad.status} ${JSON.stringify(await bad.json())}`);
const del = await api("DELETE", { query: "?slug=qa-test-show" });
say("DELETE", `${del.status} ${JSON.stringify(await del.json())}`);
say("GET end", await (await api("GET")).json());
```

Check both ports are free (`lsof -ti tcp:8079 || echo free` and `lsof -ti tcp:3112 || echo free` each print `free`), then `rm -f .qa/stand-in-kv.log`, then start two background processes (`run_in_background: true`), first:

```bash
cd /Users/macbook/Claude/julianpotulicki && node .qa/stand-in-kv.mjs 8079 .qa/stand-in-kv.log
```

then, on the build from Step 2 (no rebuild; every studio route reads the store settings when it runs):

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL=http://127.0.0.1:8079 KV_REST_API_TOKEN=qa-stand-in STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3112
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node .qa/shows-e2e.mjs http://localhost:3112 .qa/stand-in-kv.log; kill -9 $(lsof -ti tcp:3112) $(lsof -ti tcp:8079); grep -c 'studio:julian:overlays' .qa/stand-in-kv.log; grep -v '/studio:julian:' .qa/stand-in-kv.log | head -3
```

Expected:

```
GET before: {"configured":true,"shows":[]}
PUT valid: 200 true
GET after: ["qa-test-show published by julian"]
desk lists it: true
PUT invalid: 400 {"error":"That show is not ready to save.","problems":["The last day cannot come before the first.","The opening reception must fall within the run of the show.","\"not-a-work\" is not a work on this site."]}
DELETE: 200 {"ok":true}
GET end: {"configured":true,"shows":[]}
```

then a count of at least `1` (the desk read his overlays key through the stand-in too) and no lines from the last `grep` (every store call went to one of his two keys). If the script stops with "The server did not read the stand-in store", kill both processes at once and report it: never retry a write against an unproven store.

- [ ] **Step 5: Full gate**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && (lsof -ti tcp:3100 || echo "3100 free") && pnpm wk:audit > .qa/E/wk-audit.txt 2>&1; tail -5 .qa/E/wk-audit.txt; diff <(grep -iE 'pass|fail|error|ok' .qa/C/wk-audit.txt) <(grep -iE 'pass|fail|error|ok' .qa/E/wk-audit.txt) && echo "AUDIT VERDICT UNCHANGED"
```

Expected: `Tests  52 passed (52)`; typecheck and lint clean; `web-kit audit (required): OK` and `AUDIT VERDICT UNCHANGED`.

And the kit, once more, since Julian ran against it:

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && git status --short
```

Expected: `Tests  433 passed (433)`; clean; no uncommitted kit files except this plan if it is not yet committed.

- [ ] **Step 6: Writing checks on everything both branches added**

```bash
cd /Users/macbook/Claude/julianpotulicki && git diff 760b4a8 -- . ':!pnpm-lock.yaml' | grep '^+' | grep -c $'\xe2\x80\x94'; git diff 760b4a8 -- src scripts | grep '^+' | grep -inE 'catalogue|fulfilment|behaviour|colour|honour|favour|defence|artefact|organis|recognis|centre|centimetre'; git log 760b4a8..HEAD --format='%B' | grep -icE 'claude|co-authored|generated with'; cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git log 3b860d9..HEAD --format='%B' | grep -icE 'claude|co-authored|generated with'
```

Expected: `0`, no spelling lines, `0`, `0`.

- [ ] **Step 7: Update the RESUME and commit**

In `docs/superpowers/RESUME-julian.md`, replace:

```
), 2) shows + press kit, 3) payments.
```

with:

```
), 2) shows + press kit: phase 2a DONE locally on branch `artist-module` (kit plan `docs/superpowers/plans/2026-10-13-artist-module-phase2a.md`): the studio creates, edits, publishes and deletes shows, says plainly when no store is connected, and /cv prints a published show from its first day. The show page, homepage notice and press page wait on the design board, 3) payments.
```

```bash
cd /Users/macbook/Claude/julianpotulicki && git add scripts/qa/render-snapshot.mjs docs/superpowers/RESUME-julian.md && git status --short && git -c commit.gpgsign=false commit -m "QA: the snapshot probes the shows API on its own; resume notes phase 2a done locally"
```

Expected `git status --short` before the commit: the two files staged, `?? docs/boards/` untouched, nothing under `.qa/` (it is ignored).

Report in the handback: the snapshot verdict lines from Step 3, the seven end-to-end lines from Step 4, both test totals, and that nothing was pushed.

---

## Self-Review

**Spec coverage** (sections "Shows (new)", "Press kit (new)", "Correctness", phase 2a only):

| Requirement | Task |
|---|---|
| `Show` type exactly as the spec writes it | 1 |
| Status computed, never stored; date-only strings in the site time zone, default New York, never UTC; endsOn inclusive | 1 |
| Tests at an hour where UTC and New York differ, a zone east of UTC, DST both ways | 1 (and 4, 9 for the CV) |
| `noticeShow`: current, else next within 45 days, gone the day after close, published only | 1 |
| `onView`: the published current show a work hangs in | 1 |
| `cleanShow`: real dates, endsOn not before startsOn, opening in the run, HH:MM times, every work in the catalog, text caps, kind and publish sets, slug format | 2 |
| `sanitizeStoredShows`: degrade safely, key order kept | 2 |
| `ExhibitionEvent` with location, startDate, endDate, workFeatured | 3 |
| `cvFromShows`: published and started only, solo/event and two-person/group split, newest first, merged with hand entries in the Cv shape | 4 |
| Press kit: statement, CV, each published work with its highest-resolution image, price list with public AND on-request amounts, sold/reserved/not-for-sale/unstated without price | 5 |
| Long random press token (Web Crypto), constant-time compare, stored under its own key without widening `StudioStore` | 5, 6 |
| `ShowsStore` and optional `showsKey`; `createStudioStore` returns `StudioStore & { shows }` | 6 |
| `showsHandler` GET/PUT/DELETE, same auth, cap, error bodies and 503 pattern; delete open to any signed-in role, justified | 7 |
| `onError` typed `void \| Promise<void>`, rejection caught, both handlers | 7 |
| Surface test lists every new name; `ArtistConfig` gains only optional fields; CHANGELOG 0.11.0 with no version bump | 8 |
| Correctness 1: every handler checks the cookie itself | 7 (lock tests per method) |
| Correctness 2: unconfigured store reads null and the studio says so before typing; dead `storeReady` removed | 6, 10, 11 |
| Correctness 3: show writes validated by a pure `cleanShow` | 2, 7 |
| Correctness 4: nothing invented; absent fields print nothing | 2, 3, 4, 5 (fixtures are obviously fake and test-only) |
| Julian: `timeZone`, `showsKey`, `studioShows`, shows route with Sentry, Shows section in the existing form style with a works multi-select, no-store state, CV from shows | 9, 10 |
| Nothing public changes; snapshot equals A except the studio desk, with the exact comparison | 11 |

Deliberately not in this plan, per the brief: the show page, the homepage notice component, the press page and a press-token rotation route (all wait on the design board), `web-kit artist init`, payments, publishing either repo.

**Placeholder scan:** every code step carries complete code; every command has its expected output. No "TBD", no "similar to".

**Type consistency:** `Show`, `ShowRecord`, `ShowKind`, `ShowStatus`, `SHOW_KINDS`, `DEFAULT_TIME_ZONE` (Task 1) are the names used in Tasks 2 to 10. `cleanShow` returns `CleanShowResult` with `problems` (Task 2), which Task 7 sends as `problems` and Task 10 reads as `data.problems`. `ShowsStore.readShows/writeShow/deleteShow` (Task 6) are what Task 7's handler and fakes call. `StudioStores` (Task 6) is what Task 8's surface test and Task 9's `studioStore.shows` rely on. `StudioErrorReporter` and `StudioErrorContext` (Task 7) are what Julian's two routes pass. `cvFromShows(shows, now, timeZone)` and `mergeCv(cv, lines)` (Task 4) are what `pressKit` (Task 5) and `cvWithShows` (Task 9) call. `StoreState` is defined in `StudioClient.tsx` and imported as a type by `page.tsx` (Task 10).
