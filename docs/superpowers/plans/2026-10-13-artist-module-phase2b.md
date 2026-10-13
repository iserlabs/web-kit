# Artist Module Phase 2b (The Public Show, Notice and Press Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Julian's public show page (`/shows/[slug]`), the homepage show line, the artwork page's "On view at" line and the unlisted press page (`/press/[token]`) in the direction Jake picked on 2026-10-13 (round 1, option 3, "The homepage's viewer"), plus the studio control that makes or replaces the press link, with the kit gaining the plain-words date helpers, a richer exhibition schema, the press kit's paragraphs and ordering, a press link route and a store timeout; then prove nothing else changed and stop for Jake's look.

**Architecture:** The kit stays framework-free: `show-words.ts` (new) prints a show's run and opening in plain words, `showJsonLd` gains the facts Google's event check reads that a show can state honestly, `pressKit` returns the statement as paragraphs and orders works with `forDisplay`, `formatPriceLine` words a price list line, `pressHandler` serves the press token, and every store call is abandoned after `timeoutMs`. Julian's repo gets one pure module (`src/lib/shows.ts`) holding every rule about what a public page may print, one reader module (`src/lib/public-shows.ts`) that never lets a store failure take a page down, the show page and its client viewer, the homepage line generated into the board document only when a show qualifies (so the homepage is byte for byte unchanged otherwise), the artwork page line, the press page and the studio Press section.

**Tech Stack:** TypeScript (kit: TS 7 with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`; Julian: TS 6 on `tsconfig-next`), Vitest 4, Biome 2.5, pnpm 10, Next.js 16.2 and React 19.2 (Julian only), `next/image`, Web `Request`/`Response`, `AbortController`, Upstash REST over `fetch`, headless Chrome for the screenshot harness.

## Global Constraints

- **Spec and decisions:** spec `docs/superpowers/specs/2026-10-12-artist-module-design.md` ("Shows (new)", "Press kit (new)", "Correctness"); ledger `.superpowers/sdd/progress.md` (every decision and Minor finding; its "Phase 2b needs" list is covered by Tasks 4, 5, 6, 7, 10 and 11). Design: round-1 board `/Users/macbook/Claude/julianpotulicki/docs/boards/2026-10-13-shows-press-checkout/`, option 3 source `d3.html` (surfaces A show page, B homepage notice, C press kit). Surface D (checkout) is OUT: it waits for the payments rail, phase 3.
- **Design standard:** `~/.claude/docs/design-standard.md` is THE standard; its section 12 self-check runs in Task 14 before Jake sees anything. `~/.claude/docs/artist-site-standard.md` applies (complete artwork inside the window, correct aspect, never cropped, thumbnail strip, counts stated).
- **Faithful to option 3, adapted to the real site:** build from the site's own parts (white wall, Space Grotesk, small uppercase record line, hairline rules, his colored marks, paintings hung whole) and add no new visual ingredient (no color band, card chrome, banner or second typeface). Adaptations made in this plan, each for a stated reason: 1) the new pages set their record type, locator, sign and footer links at 13px (`.d-viewer` scope), the size the board drew, because the live atoms fall to about 10.9px on a phone and design standard 8.1 floors text at 13px; existing pages are not touched. 2) The separator between facts is the board's 3px dot (`.d-dot`), not the live gray middot, because the middot is text at 1.6:1 contrast. 3) On the show page the strip's thumbnails bring that painting into the viewer, the way the homepage strip does, while every painting in the viewer links to its own artwork page; the static board drew the thumbnails as links only because a static page has no viewer to drive. 4) The homepage line for a show that has not opened yet reads "Upcoming at <venue>"; the board drew only the current case, "On view at <venue>".
- **Repos and branches:** kit worktree `/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`, branch `artist-module`, starting at `e81c946` (505 tests). Julian `/Users/macbook/Claude/julianpotulicki`, branch `artist-module`, starting at `a7c150c` (59 tests). Julian consumes the kit through the existing `file:` dependency. Never touch `~/Claude/_tools/web-kit`. Never push either repo. Nothing deploys.
- **pnpm only.** Never `npm` or `yarn`. After any kit edit, run `pnpm install` in Julian's repo before testing there (an online install; `--offline` fails here).
- **Commits:** always `git -c commit.gpgsign=false commit -m "..."`. No `Co-Authored-By` line, no "Generated with" line, no mention of Claude or AI in commit messages, code or comments. Both repos are iserlabs client repos.
- **Staging:** add files by explicit path. Never `git add -A` or `git add .`. Never stage either repo's `.gitignore` (both carry uncommitted edits), Julian's `docs/superpowers/RESUME-julian.md`, or Julian's untracked `docs/boards/`.
- **Writing:** American English only (catalog, color, behavior). No em dashes (U+2014) in any file, comment, test name, copy or commit message; in shell checks match it by its bytes, `$'\xe2\x80\x94'`. A date range uses a spaced en dash, written in code as `–`. Copy is plain words; studio copy says "held back", never "draft".
- **Honest content:** nothing that ships invents a show fact, price, title or date. Test fixtures are obviously fake ("Test Gallery", "Test City", "QA Current Show", round prices like 1000) and live only in `*.test.ts` files and in the gitignored `.qa/` stand-in. Julian's `src/content/` gains no entries.
- **No Upstash writes, ever.** Julian's `.env.local` holds real store credentials. Every Julian build, server and audit runs with `KV_REST_API_URL=` and `KV_REST_API_TOKEN=` set empty (Next keeps an explicitly set empty value over `.env.local`), except Task 13 and Task 14, which point both at the local stand-in on `http://127.0.0.1:8079`; the seed script refuses any other address, and the end-to-end check proves the server read the stand-in before it writes anything.
- **Kit rules:** `src/artist/` imports nothing from React or Next. Handlers take a Web `Request` and return a `Response`. Types are imported with `import type` or inline `type`. Indexed access is guarded. Kit code must also compile under Julian's `tsconfig-next`. `ArtistConfig` and the public surface only grow; every new exported function is appended to `src/artist/index.test.ts`.
- **Dates:** show dates are calendar dates (`YYYY-MM-DD`) in the site's time zone, `America/New_York` for Julian. Never `new Date("2026-11-07")`. Status, the homepage line and "On view" are computed through the kit's `showStatus`, `noticeShow` and `onView` with `artistConfig.timeZone`. Printing a date never puts it on a clock (`show-words.ts`).
- **Tailwind sees every word.** Julian's Tailwind scans source text, comments included. New TSX outside the studio uses only the site's own `d-` classes; new studio TSX uses only class names already present in `src/app/studio/StudioClient.tsx`. New comments and copy avoid bare utility words: static, fixed, hidden, inline, contents, table, filter, blur, grow, shrink, truncate, italic, underline, uppercase, lowercase, capitalize, relative, absolute, sticky, isolate, collapse, invisible, visible, transition, shadow, container, outline, rounded. Task 12 proves `css.txt` changes only by the new `d-` rules.
- **Settled surfaces:** the artwork page layout is settled (centered). It gains only the "On view at" line inside its record. Paintings are never cropped or redrawn: every image is the site's own render at its measured width and height, held whole with `max-width`/`max-height`.
- **Next 16 (AGENTS.md):** read the relevant guide in `node_modules/next/dist/docs/` before writing page code. Facts this plan already relies on, checked in those docs: `params` is a Promise; the `priority` image prop is deprecated (use `loading="eager"` with `fetchPriority="high"`); an empty `generateStaticParams` array plus a `revalidate` renders paths on first visit and keeps them current; a `fetch` with a lower `revalidate` raises a route's revalidation frequency even under `revalidate = false`; `alternates.canonical` accepts `null`; `referrer` is a metadata field. Cache Components is not enabled in this repo.
- **QA snapshots** live in Julian's gitignored `.qa/`. `.qa/E` is the accepted phase-2a result. This plan writes `.qa/E2` (baseline at the start of Julian's work), `.qa/F` (after, store blank) and `.qa/G` (after, stand-in store).

---

## File Structure

**Kit** (`/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`)

| File | Change | Responsibility |
|---|---|---|
| `src/artist/studio-store.ts`, `studio-store.test.ts` | modify | `timeoutMs` option: every store call abandoned and failed after it (default 4000) |
| `src/artist/show-words.ts`, `show-words.test.ts` | create | `formatShowDates`, `formatOpening`: a show's run and reception in plain words |
| `src/artist/shows.ts`, `shows.test.ts` | modify | `showJsonLd` adds `eventAttendanceMode`, optional `performer` and `image` |
| `src/artist/press-kit.ts`, `press-kit.test.ts` | modify | statement as paragraphs, `forDisplay` order (archived last), `formatPriceLine` |
| `src/artist/handlers.ts`, `handlers.test.ts` | modify | `pressHandler` (GET token, POST new token); `"POST"` in `StudioErrorContext` |
| `src/artist/index.ts`, `index.test.ts` | modify | barrel exports `show-words`; surface list gains four names |
| `CHANGELOG.md` | modify | five lines under 0.11.0 |

**Julian** (`/Users/macbook/Claude/julianpotulicki`)

| File | Change | Responsibility |
|---|---|---|
| `src/artist.config.ts` | modify | `press.tokenKey: "studio:julian:press"` |
| `src/lib/studio.ts`, `studio.test.ts` | modify | `pressKey` wired, `studioPress` exported |
| `src/lib/public-shows.ts` | create | `savedShows(route)`, `savedOverlays(route)`: cached public reads that never take a page down |
| `src/lib/shows.ts`, `shows.test.ts` | create | what a public page may print: published show, works hanging, homepage line, on-view line, titles, description, sitemap entries |
| `src/components/ShowViewer.tsx` | create | the homepage's viewer for a show: track, record line, strip (client) |
| `src/app/shows/[slug]/page.tsx` | create | the show page |
| `src/app/sitemap.ts` | modify | published shows appended |
| `src/lib/board/document.ts`, `styles.ts`, `document.test.ts` | modify | the homepage line and its styles, emitted only when a show qualifies |
| `src/app/route.ts` | modify | the homepage reads the shows and passes the line |
| `src/app/work/[slug]/page.tsx` | modify | the "On view at" line in the record |
| `src/components/SideScroll.tsx` | create | the press page's two step buttons (client) |
| `src/app/press/[token]/page.tsx` | create | the unlisted press page |
| `src/app/api/studio/press/route.ts` | create | the press link route, wired to the kit's `pressHandler` |
| `src/app/studio/page.tsx`, `StudioClient.tsx` | modify | the Press section: make or replace the link, show it whole, copy it |
| `src/app/globals.css` | modify | new rules, all under `.d-viewer`, `.d-dot`, `.d-show-*`, `.d-onview`, `.d-press-*` |
| `scripts/qa/render-snapshot.mjs` | modify | press API probes and the unlisted routes, each in a file of its own |
| `.qa/stand-in-kv.mjs` (exists), `.qa/seed-stand-in.mjs`, `.qa/public-e2e.mjs`, `.qa/frame.html` | create (gitignored) | stand-in seeding, the end-to-end check, the screenshot harness |

---

### Task 1: Kit: a store that never answers is abandoned after a few seconds

**Files:**
- Modify: `src/artist/studio-store.ts`
- Test: `src/artist/studio-store.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StudioStoreOptions.timeoutMs?: number` (default 4000). Every store call (overlays, shows, press token; reads and writes) rejects with `Error("store timed out after <n> ms")` once `timeoutMs` passes, after aborting its request. `createStudioStore` throws `createStudioStore: timeoutMs must be a positive number, not <value>` for 0, negatives, NaN or Infinity.

- [ ] **Step 1: Write the failing tests**

In `src/artist/studio-store.test.ts`, replace the first line:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

Append to the end of the file:

```ts
describe("a store that does not answer", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...original };
  });

  const storeOver = (fetchFn: typeof fetch, timeoutMs?: number) =>
    createStudioStore({
      key: "studio:test:overlays",
      showsKey: "studio:test:shows",
      pressKey: "studio:test:press",
      urlEnv: URL_ENV,
      tokenEnv: TOKEN_ENV,
      fetch: fetchFn,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });

  /** Never answers; fails only when its request is aborted, the way fetch does. */
  const hangsUntilAborted = (seen: AbortSignal[] = []) =>
    ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          seen.push(signal);
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }
      })) as typeof fetch;

  it("gives up after its timeout, aborts the request, and says it timed out", async () => {
    const seen: AbortSignal[] = [];
    await expect(storeOver(hangsUntilAborted(seen), 20).readOverlays()).rejects.toThrow(
      "store timed out after 20 ms",
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.aborted).toBe(true);
  });

  it("gives up even on a fetch that ignores the abort", async () => {
    const ignores = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    await expect(storeOver(ignores, 20).shows.readShows()).rejects.toThrow(
      "store timed out after 20 ms",
    );
  });

  it("gives up on an answer whose body never finishes", async () => {
    const stalls = (async () =>
      ({
        ok: true,
        status: 200,
        json: () => new Promise(() => undefined),
      }) as unknown as Response) as typeof fetch;
    await expect(storeOver(stalls, 20).press.readToken()).rejects.toThrow(
      "store timed out after 20 ms",
    );
  });

  it("makes a save that times out fail loudly rather than look done", async () => {
    await expect(
      storeOver(hangsUntilAborted(), 20).writeOverlay("a", { title: "A" }, "artist"),
    ).rejects.toThrow("store timed out after 20 ms");
  });

  it("passes its signal on every call and leaves no timer behind when the store answers", async () => {
    vi.useFakeTimers();
    const signals: unknown[] = [];
    const answers = (async (_input: string | URL | Request, init?: RequestInit) => {
      signals.push(init?.signal);
      return Response.json({ result: null });
    }) as typeof fetch;
    const store = storeOver(answers);
    expect(await store.readOverlays()).toEqual({});
    expect(await store.shows.readShows(true)).toEqual([]);
    expect(signals).toHaveLength(2);
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits four seconds by default", async () => {
    vi.useFakeTimers();
    const pending = storeOver(hangsUntilAborted()).readOverlays();
    let settled = false;
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).rejects.toThrow("store timed out after 4000 ms");
  });

  it("refuses a timeout that is not a positive number of milliseconds", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => storeOver(hangsUntilAborted(), bad), String(bad)).toThrow(
        "timeoutMs must be a positive number",
      );
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/studio-store.test.ts 2>&1 | tail -15`
Expected: FAIL. The hanging tests fail on Vitest's 5-second test timeout and the last one with "expected function to throw".

- [ ] **Step 3: Implement the timeout**

In `src/artist/studio-store.ts`, replace:

```ts
  cachedRead?: Record<string, unknown>;
  /** The fetch to use. Default: the global fetch, looked up at call time so a
      framework that patches it (Next does) is honored. */
  fetch?: typeof fetch;
}
```

with:

```ts
  cachedRead?: Record<string, unknown>;
  /** The fetch to use. Default: the global fetch, looked up at call time so a
      framework that patches it (Next does) is honored. */
  fetch?: typeof fetch;
  /** The longest one store call may take, in milliseconds, before it is abandoned
      and fails with "store timed out". Default 4000. A store that never answers must
      not leave a page loading until the platform gives up on it. */
  timeoutMs?: number;
}

/** How long a store call may take when the site names no limit of its own. */
const DEFAULT_TIMEOUT_MS = 4000;
```

Replace:

```ts
  const urlEnv = options.urlEnv ?? "KV_REST_API_URL";
  const tokenEnv = options.tokenEnv ?? "KV_REST_API_TOKEN";
```

with:

```ts
  const urlEnv = options.urlEnv ?? "KV_REST_API_URL";
  const tokenEnv = options.tokenEnv ?? "KV_REST_API_TOKEN";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`createStudioStore: timeoutMs must be a positive number, not ${timeoutMs}`);
  }
```

Replace the whole `call` function:

```ts
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
```

with:

```ts
  async function call(
    path: string,
    init: RequestInit | undefined,
    fresh: boolean,
  ): Promise<unknown> {
    const c = creds();
    if (!c) return null;
    const doFetch = options.fetch ?? globalThis.fetch;
    // A store that never answers is abandoned after timeoutMs: the request is
    // aborted, and the call fails even if the fetch ignores the abort, so a page is
    // never left waiting on it. The timeout is decided before the abort, so the
    // caller always reads "store timed out", never an abort error.
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`store timed out after ${timeoutMs} ms`));
        controller.abort();
      }, timeoutMs);
      // Never keep a Node process alive for the sake of a store call.
      (timer as { unref?: () => void }).unref?.();
    });
    // The races below consume the rejection; this keeps a late one from being reported
    // as unhandled.
    expired.catch(() => undefined);
    try {
      const res = await Promise.race([
        doFetch(`${c.url}/${path}`, {
          ...(fresh ? { cache: "no-store" as const } : (options.cachedRead ?? {})),
          method: init?.method ?? "GET",
          body: init?.body,
          headers: { Authorization: `Bearer ${c.token}`, ...(init?.headers ?? {}) },
          signal: controller.signal,
        } as RequestInit),
        expired,
      ]);
      if (!res.ok) throw new Error(`store ${res.status}`);
      const body = (await Promise.race([res.json(), expired])) as { result?: unknown };
      return body.result ?? null;
    } finally {
      clearTimeout(timer);
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist 2>&1 | grep -E "Test Files|Tests |FAIL"`
Expected: every artist test passes, 7 more than before. Then `pnpm typecheck 2>&1 | tail -3 && pnpm exec biome check --write src/artist && pnpm lint 2>&1 | tail -3`: clean.

Note for Julian: Next's patched `fetch` accepts a `signal` without opting out of the data cache (it drops the signal only when revalidating a stale entry in the background), so the one-minute cached reads stay cached. Task 13 proves it on a real build: every store-reading page is still prerendered with a 60-second revalidate.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/studio-store.ts src/artist/studio-store.test.ts && git -c commit.gpgsign=false commit -m "artist: a store that never answers is abandoned after a few seconds, never left holding a page"
```

---

### Task 2: Kit: a show's dates and opening in plain words

**Files:**
- Create: `src/artist/show-words.ts`
- Test: `src/artist/show-words.test.ts`
- Modify: `src/artist/index.ts`, `src/artist/index.test.ts`

**Interfaces:**
- Consumes: `Show` from `./shows`.
- Produces: `formatShowDates(show: Pick<Show, "startsOn" | "endsOn">): string` ("November 7 – December 5, 2026"; same-day, same-month and cross-year forms) and `formatOpening(opening: NonNullable<Show["opening"]>): string` ("Saturday, November 7, 6 to 9 PM"). Both exported from `@iserlabs/web-kit/artist`.

- [ ] **Step 1: Write the failing tests**

Create `src/artist/show-words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatOpening, formatShowDates } from "./show-words";

const run = (startsOn: string, endsOn: string) => formatShowDates({ startsOn, endsOn });

describe("formatShowDates: a show's run in plain words", () => {
  it("says a one-day show's date once", () => {
    expect(run("2026-11-07", "2026-11-07")).toBe("November 7, 2026");
  });

  it("says the month once when the run stays inside it", () => {
    expect(run("2026-11-07", "2026-11-29")).toBe("November 7 – 29, 2026");
  });

  it("names both months when the run crosses one", () => {
    expect(run("2026-11-07", "2026-12-05")).toBe("November 7 – December 5, 2026");
  });

  it("names both years when the run crosses the new year", () => {
    expect(run("2026-12-12", "2027-01-09")).toBe("December 12, 2026 – January 9, 2027");
  });

  it("prints the first of a month as the first, never the evening before", () => {
    // Parsed as UTC midnight and read in New York, "2026-11-01" would print October 31.
    expect(run("2026-11-01", "2026-11-30")).toBe("November 1 – 30, 2026");
  });
});

describe("formatOpening: the reception in plain words", () => {
  const at = (on: string, from: string, to?: string) =>
    formatOpening(to ? { on, from, to } : { on, from });

  it("says the weekday and the date, and the half of the day once", () => {
    expect(at("2026-11-07", "18:00", "21:00")).toBe("Saturday, November 7, 6 to 9 PM");
  });

  it("prints minutes only when there are some, and the start alone when there is no end", () => {
    expect(at("2026-11-07", "18:30")).toBe("Saturday, November 7, 6:30 PM");
  });

  it("names both halves when the reception crosses noon", () => {
    expect(at("2026-11-07", "11:00", "13:00")).toBe("Saturday, November 7, 11 AM to 1 PM");
  });

  it("calls noon 12 PM and midnight 12 AM", () => {
    expect(at("2026-11-07", "12:00", "14:00")).toBe("Saturday, November 7, 12 to 2 PM");
    expect(at("2026-11-07", "00:00")).toBe("Saturday, November 7, 12 AM");
  });

  it("counts the weekday right across a leap day and before 1970", () => {
    expect(at("2028-02-29", "18:00")).toBe("Tuesday, February 29, 6 PM");
    expect(at("1969-12-31", "18:00")).toBe("Wednesday, December 31, 6 PM");
  });

  it("names a Sunday", () => {
    expect(at("2026-11-01", "15:00", "17:00")).toBe("Sunday, November 1, 3 to 5 PM");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/show-words.test.ts 2>&1 | tail -5`
Expected: FAIL, "Failed to resolve import ./show-words".

- [ ] **Step 3: Implement**

Create `src/artist/show-words.ts`:

```ts
import type { Show } from "./shows";

/**
 * A show's dates and opening in plain words, for its page, the homepage line and
 * anywhere else a site prints them.
 *
 * Show dates are calendar days in the site's own time zone, stored "YYYY-MM-DD".
 * They are printed exactly as written: nothing here puts a date on a clock, so no
 * time zone can move "2026-11-01" to October 31. Times are printed on a 12-hour
 * clock, the way an American invitation reads.
 */

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
] as const;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Between two dates, the way a printed range reads: a spaced en dash. */
const RANGE = " – ";

interface Day {
  year: number;
  month: number;
  day: number;
}

function dayOf(date: string): Day {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}

const monthName = (month: number): string => MONTHS[month - 1] ?? "";

/** The day of the week, by counting days from Thursday, January 1, 1970. Date.UTC
    only counts the days here; it never places the date on a clock. */
function weekday({ year, month, day }: Day): string {
  const days = Date.UTC(year, month - 1, day) / 86_400_000;
  return WEEKDAYS[(((days + 4) % 7) + 7) % 7] ?? "";
}

const calendarDate = (d: Day): string => `${monthName(d.month)} ${d.day}, ${d.year}`;

/** "November 7 – December 5, 2026". The month or the year is said once when both
    ends of the run share it, and a one-day show prints its date once. */
export function formatShowDates(show: Pick<Show, "startsOn" | "endsOn">): string {
  const a = dayOf(show.startsOn);
  const b = dayOf(show.endsOn);
  if (show.startsOn === show.endsOn) return calendarDate(a);
  if (a.year !== b.year) return `${calendarDate(a)}${RANGE}${calendarDate(b)}`;
  if (a.month !== b.month) {
    return `${monthName(a.month)} ${a.day}${RANGE}${monthName(b.month)} ${b.day}, ${b.year}`;
  }
  return `${monthName(a.month)} ${a.day}${RANGE}${b.day}, ${b.year}`;
}

function clock(time: string): { text: string; half: "AM" | "PM" } {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return {
    text: minutes === 0 ? String(hour) : `${hour}:${String(minutes).padStart(2, "0")}`,
    half: hours < 12 ? "AM" : "PM",
  };
}

/** "Saturday, November 7, 6 to 9 PM". The half of the day is said once when both
    times share it. The reception falls inside the show's run, so its year is left
    to the dates printed beside it. */
export function formatOpening(opening: NonNullable<Show["opening"]>): string {
  const d = dayOf(opening.on);
  const from = clock(opening.from);
  let time = `${from.text} ${from.half}`;
  if (opening.to) {
    const to = clock(opening.to);
    time =
      from.half === to.half
        ? `${from.text} to ${to.text} ${to.half}`
        : `${time} to ${to.text} ${to.half}`;
  }
  return `${weekday(d)}, ${monthName(d.month)} ${d.day}, ${time}`;
}
```

In `src/artist/index.ts`, replace:

```ts
export * from "./record";
export * from "./shows";
```

with:

```ts
export * from "./record";
export * from "./show-words";
export * from "./shows";
```

In `src/artist/index.test.ts`, replace:

```ts
  "formatMediumLine",
  "formatTitleLine",
```

with:

```ts
  "formatMediumLine",
  "formatOpening",
  "formatShowDates",
  "formatTitleLine",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist 2>&1 | grep -E "Test Files|Tests |FAIL" && pnpm typecheck 2>&1 | tail -3 && pnpm exec biome check --write src/artist && pnpm lint 2>&1 | tail -3`
Expected: all artist tests pass (11 new); typecheck and lint clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/show-words.ts src/artist/show-words.test.ts src/artist/index.ts src/artist/index.test.ts && git -c commit.gpgsign=false commit -m "artist: a show's dates and opening in plain words"
```

---

### Task 3: Kit: the exhibition schema names the artist, the works' images and an in-person show

**Files:**
- Modify: `src/artist/shows.ts` (the schema section)
- Test: `src/artist/shows.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ShowSite` gains optional `artist?: { name: string; id?: string }` and `workImage?: (slug: string) => string`. `showJsonLd` always adds `eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode"`, adds `performer` (a `Person`, with `@id` when given) only with `artist`, and `image` (absolute URLs, one per listed work) only with `workImage` and at least one work. It never states `eventStatus`. Julian's show page (Task 7) passes `{ url: site.url, artist: { name: site.name, id: `${site.url}/#person` }, workImage: (slug) => boardSrc(slug, 1280) }`.

- [ ] **Step 1: Write the failing tests**

In `src/artist/shows.test.ts`, inside the test "describes the show as an ExhibitionEvent with its place, dates and works", replace:

```ts
      endDate: "2026-12-05",
      location: {
```

with:

```ts
      endDate: "2026-12-05",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
```

(This pair of lines occurs once in the file. If the replacement reports more than one match, apply it only inside that test.)

Append to the end of the file:

```ts
describe("showJsonLd: what else a show can state honestly", () => {
  const site = { url: "https://artist.example.test/" };

  it("names the artist as performer and carries each work's image when the site gives them", () => {
    const ld = showJsonLd(show({ workSlugs: ["waterscape-01", "floral-01"] }), {
      ...site,
      artist: { name: "Test Artist", id: "https://artist.example.test/#person" },
      workImage: (slug) => `/board/${slug}-1280.jpg`,
    });
    expect(ld.performer).toEqual({
      "@type": "Person",
      "@id": "https://artist.example.test/#person",
      name: "Test Artist",
    });
    expect(ld.image).toEqual([
      "https://artist.example.test/board/waterscape-01-1280.jpg",
      "https://artist.example.test/board/floral-01-1280.jpg",
    ]);
  });

  it("claims no performer, image or event status it was not given", () => {
    const ld = showJsonLd(show({ workSlugs: [] }), {
      ...site,
      workImage: (slug) => `/board/${slug}.jpg`,
    });
    expect(ld).not.toHaveProperty("performer");
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("eventStatus");
    expect(ld.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/shows.test.ts 2>&1 | grep -E "Tests |FAIL|✗|×" | head -10`
Expected: 3 failures (the edited test and the two new ones).

- [ ] **Step 3: Implement**

In `src/artist/shows.ts`, replace everything from `export interface ShowSite {` to the end of the file with:

```ts
export interface ShowSite {
  /** The site's origin, e.g. "https://julianpotulicki.com". A trailing slash is ignored. */
  url: string;
  /** Path of a work's page. Default `/work/<slug>`. */
  workPath?: (slug: string) => string;
  /** Path of a show's page. Default `/shows/<slug>`. */
  showPath?: (slug: string) => string;
  /** The artist the show presents, printed as the event's performer. `id` is the @id
      the site's own Person carries, so search engines join the two. */
  artist?: { name: string; id?: string };
  /** Path of an image of each work, e.g. `/board/<slug>-1280.jpg`, so the show carries
      the pictures of what hangs in it. */
  workImage?: (slug: string) => string;
}

/**
 * The show as schema.org's ExhibitionEvent, for the show's own page: its place, its
 * dates and the works hanging in it. Each work is referenced by the same @id its own
 * page gives its VisualArtwork, so search engines join the two. An absent fact
 * prints nothing.
 *
 * A show always hangs in a room (venue and city are required facts), so it is always
 * in person. No eventStatus is stated: the site cannot know a show went ahead as
 * planned, and a canceled show is deleted rather than marked.
 *
 * Pass only a published show, with only the works its page actually shows.
 */
export function showJsonLd(show: Show, site: ShowSite): Record<string, unknown> {
  const origin = site.url.replace(/\/+$/, "");
  const workPath = site.workPath ?? ((slug: string) => `/work/${slug}`);
  const showPath = site.showPath ?? ((slug: string) => `/shows/${slug}`);
  const workImage = site.workImage;
  const page = `${origin}${showPath(show.slug)}`;
  const images = workImage ? show.workSlugs.map((slug) => `${origin}${workImage(slug)}`) : [];
  return {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    "@id": `${page}#exhibition`,
    name: show.title,
    url: page,
    startDate: show.startsOn,
    endDate: show.endsOn,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: show.venue,
      address: {
        "@type": "PostalAddress",
        ...(show.address ? { streetAddress: show.address } : {}),
        addressLocality: show.city,
      },
    },
    ...(images.length > 0 ? { image: images } : {}),
    ...(site.artist
      ? {
          performer: {
            "@type": "Person",
            ...(site.artist.id ? { "@id": site.artist.id } : {}),
            name: site.artist.name,
          },
        }
      : {}),
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

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist 2>&1 | grep -E "Test Files|Tests |FAIL" && pnpm typecheck 2>&1 | tail -3 && pnpm exec biome check --write src/artist && pnpm lint 2>&1 | tail -3`
Expected: all artist tests pass (2 new); clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/shows.ts src/artist/shows.test.ts && git -c commit.gpgsign=false commit -m "artist: the exhibition schema names the artist, the works' images and an in-person show"
```

---

### Task 4: Kit: the press kit keeps the statement's paragraphs, leads with current work, and words its price lines

**Files:**
- Modify: `src/artist/press-kit.ts` (whole file below)
- Test: `src/artist/press-kit.test.ts`
- Modify: `src/artist/index.test.ts`

**Interfaces:**
- Consumes: `forDisplay` from `./availability`.
- Produces: `PressKitInput.statement?: string | readonly string[]`; `PressKit.statement?: string[]` (paragraphs verbatim, blank ones dropped, absent when none). `PressKit.works` and `PressKit.priceList` both in `forDisplay` order (current, earlier, archived; within each, available, then unrecorded, then sold, reserved and not for sale), entry for entry. `formatPriceLine(entry: PriceListEntry): string`.

Decisions recorded here (from the ledger's "Phase 2b needs" list):
1\) **Statement: widen the type, do not join.** Julian's statement is four paragraphs (`site.statementLong: string[]`). Joining them with blank lines and splitting them again on the page would make the kit's "printed verbatim" promise depend on a text convention; a list of paragraphs is the honest shape of what he wrote. A single string still works (it becomes one paragraph). Version 0.11.0 is not released, so changing the output type breaks no site.
2\) **Archived works appear, last.** The kit's own rule for lifecycle is "ordering, not exclusion, so nothing disappears from the record" (`currentFirst`, Carole 05). The press kit is the record a gallerist plans from: current work leads, earlier work follows, archived work closes it, and one record is the same everywhere (Carole's consistency rule). A gallery that wants only current work stops reading where it ends; a gallery planning a survey still finds the rest.

- [ ] **Step 1: Write the failing tests**

In `src/artist/press-kit.test.ts`, replace the import line:

```ts
import { generatePressToken, isPressToken, pressKit, pressTokenMatches } from "./press-kit";
```

with:

```ts
import {
  formatPriceLine,
  generatePressToken,
  isPressToken,
  type PriceListEntry,
  pressKit,
  pressTokenMatches,
} from "./press-kit";
```

In the test "lists every published work, priced only where the work can still be had", the unrecorded work now follows the available ones. Replace:

```ts
      {
        slug: "no-price",
        catalogId: "TT-no-price",
        title: "Title no-price, 2025",
        status: "available",
      },
      { slug: "sold", catalogId: "TT-sold", title: "Title sold, 2025", status: "sold" },
```

with:

```ts
      {
        slug: "no-price",
        catalogId: "TT-no-price",
        title: "Title no-price, 2025",
        status: "available",
      },
      {
        slug: "unrecorded",
        catalogId: "TT-unrecorded",
        title: "Title unrecorded, 2025",
        status: "unstated",
      },
      { slug: "sold", catalogId: "TT-sold", title: "Title sold, 2025", status: "sold" },
```

and replace:

```ts
      { slug: "kept", catalogId: "TT-kept", title: "Title kept, 2025", status: "not-for-sale" },
      {
        slug: "unrecorded",
        catalogId: "TT-unrecorded",
        title: "Title unrecorded, 2025",
        status: "unstated",
      },
    ]);
```

with:

```ts
      { slug: "kept", catalogId: "TT-kept", title: "Title kept, 2025", status: "not-for-sale" },
    ]);
```

In the test "prints the statement verbatim, and nothing when there is none", replace:

```ts
    expect(kit.statement).toBe("A statement.");
```

with:

```ts
    expect(kit.statement).toEqual(["A statement."]);
```

Append to the end of the file:

```ts
describe("pressKit: the statement as the artist wrote it", () => {
  it("keeps each paragraph verbatim and in order, dropping blank ones", () => {
    const k = pressKit({
      works: [],
      cv,
      shows: [],
      statement: ["First  paragraph.", "  ", "Second."],
      now,
    });
    expect(k.statement).toEqual(["First  paragraph.", "Second."]);
  });
});

describe("pressKit: the order a gallerist meets the work in", () => {
  it("leads with current work, then earlier, then archived, available first within each, and the price list follows entry for entry", () => {
    const k = pressKit({
      works: [
        work("old-sold", { lifecycle: "archived", availability: "sold" }),
        work("old-open", {
          lifecycle: "archived",
          availability: "available",
          price: usd(1500, "public"),
        }),
        work("mid", { lifecycle: "earlier", availability: "available", price: usd(1600, "public") }),
        work("new-sold", { lifecycle: "current", availability: "sold" }),
        work("new-open", {
          lifecycle: "current",
          availability: "available",
          price: usd(1700, "on-request"),
        }),
      ],
      cv,
      shows: [],
      now,
    });
    const order = ["new-open", "new-sold", "mid", "old-open", "old-sold"];
    expect(k.works.map((w) => w.work.slug)).toEqual(order);
    expect(k.priceList.map((p) => p.slug)).toEqual(order);
  });
});

describe("formatPriceLine: the price list in plain words", () => {
  it("prints a public price and an on-request price, and says so when either is missing", () => {
    const line = (over: Partial<PriceListEntry>): string =>
      formatPriceLine({ slug: "t", catalogId: "TT-t", title: "T", status: "available", ...over });
    expect(line({ price: usd(4200, "public") })).toBe("$4,200");
    expect(line({ price: usd(12000, "on-request") })).toBe("$12,000 · on request");
    expect(line({})).toBe("Available, not priced yet");
    expect(line({ status: "sold" })).toBe("Sold");
    expect(line({ status: "reserved" })).toBe("Reserved");
    expect(line({ status: "not-for-sale" })).toBe("Not for sale");
    expect(line({ status: "unstated" })).toBe("Availability not recorded yet");
  });
});
```

In `src/artist/index.test.ts`, replace:

```ts
  "formatOpening",
  "formatShowDates",
```

with:

```ts
  "formatOpening",
  "formatPriceLine",
  "formatShowDates",
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/press-kit.test.ts src/artist/index.test.ts 2>&1 | grep -E "Tests |FAIL" | head -10`
Expected: FAIL (`formatPriceLine` is not exported; order and statement shape differ).

- [ ] **Step 3: Implement**

Replace the whole of `src/artist/press-kit.ts` with:

```ts
import { forDisplay } from "./availability";
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
 * Works come in the order a visitor meets them (`forDisplay`): current work first,
 * then earlier, then archived, and within each the available pieces first. Ordering,
 * not exclusion, so a gallerist sees the whole published record, archive included,
 * with the current practice leading. The price list follows the same order, entry
 * for entry.
 *
 * Pure: the page that prints it, and that checks the token, belongs to the site.
 */

export interface PressKitInput<A extends Artwork> {
  /** The site's works, already merged with what the studio recorded. */
  works: readonly A[];
  /** The CV typed by hand; the shows' lines are added here. */
  cv: Cv;
  shows: readonly Show[];
  /** The artist's statement, printed verbatim: one string, or its paragraphs in order. */
  statement?: string | readonly string[];
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
  /** The work's record without its master file, and without a price unless the work
      is available, the same rule the price list follows. */
  work: Omit<A, "masterSrc">;
  /** The highest-resolution image the site serves: `hi` when there is one, else `src`.
      `masterSrc` is never used, because a site keeps its master apart and may not
      serve it at all. */
  image: string;
}

export interface PressKit<A extends Artwork> {
  /** The statement's paragraphs, verbatim, blank ones dropped. Absent when there is none. */
  statement?: string[];
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

/** The record a gallerist sees: no master file ever, and a price only where the work
    can still be had. */
function publicRecord<A extends Artwork>(w: A): Omit<A, "masterSrc"> {
  const { masterSrc: _master, price, ...rest } = w;
  const keepsPrice = w.availability === "available" && price;
  return (keepsPrice ? { ...rest, price } : rest) as Omit<A, "masterSrc">;
}

export function pressKit<A extends Artwork>({
  works,
  cv,
  shows,
  statement,
  now,
  timeZone = DEFAULT_TIME_ZONE,
}: PressKitInput<A>): PressKit<A> {
  const published = forDisplay(works.filter((w) => w.publish === "published"));
  const given: readonly string[] =
    typeof statement === "string" ? [statement] : (statement ?? []);
  const paragraphs = given.filter((p) => p.trim() !== "");
  return {
    ...(paragraphs.length > 0 ? { statement: paragraphs } : {}),
    cv: mergeCv(cv, cvFromShows(shows, now, timeZone)),
    works: published.map((work) => ({ work: publicRecord(work), image: work.hi ?? work.src })),
    priceList: published.map(priceLine),
  };
}

/** One price list line in plain words. An available work prints its price, public or
    on request; one with no recorded price says so, rather than leave a blank that
    reads like a mistake. */
export function formatPriceLine(entry: PriceListEntry): string {
  switch (entry.status) {
    case "available": {
      if (!entry.price) return "Available, not priced yet";
      const amount = `$${entry.price.amount.toLocaleString("en-US")}`;
      return entry.price.visibility === "on-request" ? `${amount} · on request` : amount;
    }
    case "sold":
      return "Sold";
    case "reserved":
      return "Reserved";
    case "not-for-sale":
      return "Not for sale";
    default:
      return "Availability not recorded yet";
  }
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist 2>&1 | grep -E "Test Files|Tests |FAIL" && pnpm typecheck 2>&1 | tail -3 && pnpm exec biome check --write src/artist && pnpm lint 2>&1 | tail -3`
Expected: all artist tests pass (3 new); clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/press-kit.ts src/artist/press-kit.test.ts src/artist/index.test.ts && git -c commit.gpgsign=false commit -m "artist: the press kit keeps the statement's paragraphs, leads with current work, and words its price lines"
```

---

### Task 5: Kit: the press link route, and release notes for this phase

**Files:**
- Modify: `src/artist/handlers.ts`
- Test: `src/artist/handlers.test.ts`
- Modify: `src/artist/index.test.ts`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `generatePressToken` (press-kit), `PressStore` (studio-store), the module's `json`, `locked`, `noStore`, `refused`, `report`.
- Produces: `pressHandler({ auth, store, onError?, reportTimeoutMs? }): { GET, POST }`. GET: 401 `{ error: "locked" }` without a valid cookie; `{ configured: false, token: null }` with no store; else `{ configured: true, token: <token or null> }`. POST: 401 locked; 503 no-store answer; else generates a token, `store.writeToken(token, role)`, answers `{ ok: true, token }`, or 503 `{ error: "The store did not accept that." }` when refused or failing (with `onError(error, { method })`). Every 200 carries `Cache-Control: no-store`. `StudioErrorContext.method` becomes `"GET" | "PUT" | "POST" | "DELETE"`. Julian's `src/app/api/studio/press/route.ts` (Task 11) wires it.

Any signed-in role may make or replace the link: it is the artist's own address for galleries, and replacing it changes no work's record. A cross-site form cannot replace it, because the studio cookie is `SameSite=lax` and is not sent on a cross-site POST.

- [ ] **Step 1: Write the failing tests**

In `src/artist/handlers.test.ts`, replace:

```ts
import { loginHandler, showsHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import type { ShowRecord } from "./shows";
import { createStudioAuth } from "./studio-auth";
import type { ShowsStore, StudioStore } from "./studio-store";
```

with:

```ts
import { loginHandler, pressHandler, showsHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import { isPressToken, pressTokenMatches } from "./press-kit";
import type { ShowRecord } from "./shows";
import { createStudioAuth } from "./studio-auth";
import type { PressStore, ShowsStore, StudioStore } from "./studio-store";
```

Append to the end of the file:

```ts
describe("pressHandler", () => {
  function memoryPress({ connected = true, accepts = true } = {}) {
    let token: string | undefined;
    const writes: { token: string; by: string }[] = [];
    const store: PressStore = {
      key: "test:press",
      configured: () => connected,
      readToken: async () => (connected ? token : null),
      writeToken: async (next, by) => {
        if (!connected || !accepts) return false;
        writes.push({ token: next, by });
        token = next;
        return true;
      },
    };
    return { store, writes, current: () => token };
  }

  const get = (cookie?: string) => request("GET", "/api/studio/press", { cookie });
  const post = (cookie?: string) => request("POST", "/api/studio/press", { cookie });

  it("locks both methods to no cookie and to a forged cookie, and makes no link", async () => {
    const { store, writes } = memoryPress();
    const handler = pressHandler({ auth, store });
    for (const cookie of [undefined, "kit_studio=operator.9999999999.forged"]) {
      for (const res of [await handler.GET(get(cookie)), await handler.POST(post(cookie))]) {
        expect(res.status, String(cookie)).toBe(401);
        expect(await res.json()).toEqual({ error: "locked" });
      }
    }
    expect(writes).toEqual([]);
  });

  it("GET says plainly when no store is connected", async () => {
    const { store } = memoryPress({ connected: false });
    const res = await pressHandler({ auth, store }).GET(get(await cookieFor("artist")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, token: null });
  });

  it("GET answers null until a link is made, and is never cached", async () => {
    const { store } = memoryPress();
    const res = await pressHandler({ auth, store }).GET(get(await cookieFor("artist")));
    expect(await res.json()).toEqual({ configured: true, token: null });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("POST makes a press token, saves it signed by whoever is in, and answers with it", async () => {
    const { store, writes, current } = memoryPress();
    const handler = pressHandler({ auth, store });
    const res = await handler.POST(post(await cookieFor("artist")));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { ok: boolean; token: string };
    expect(body.ok).toBe(true);
    expect(isPressToken(body.token)).toBe(true);
    expect(writes).toEqual([{ token: body.token, by: "artist" }]);
    expect(current()).toBe(body.token);
    const read = await handler.GET(get(await cookieFor("operator")));
    expect(await read.json()).toEqual({ configured: true, token: body.token });
  });

  it("POST again retires the old link: the old token no longer opens anything", async () => {
    const { store, current } = memoryPress();
    const handler = pressHandler({ auth, store });
    const make = async () =>
      ((await (await handler.POST(post(await cookieFor("artist")))).json()) as { token: string })
        .token;
    const first = await make();
    const second = await make();
    expect(second).not.toBe(first);
    expect(pressTokenMatches(first, current())).toBe(false);
    expect(pressTokenMatches(second, current())).toBe(true);
  });

  it("POST with no store answers 503 and makes nothing", async () => {
    const { store, writes } = memoryPress({ connected: false });
    const res = await pressHandler({ auth, store }).POST(post(await cookieFor("artist")));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NO_STORE);
    expect(writes).toEqual([]);
  });

  it("POST the store refuses answers 503", async () => {
    const { store } = memoryPress({ accepts: false });
    const res = await pressHandler({ auth, store }).POST(post(await cookieFor("artist")));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
  });

  it("reports a store failure on either method with its method, and still answers 503", async () => {
    const { store } = memoryPress();
    const boom = new Error("network down");
    store.readToken = async () => {
      throw boom;
    };
    store.writeToken = async () => {
      throw boom;
    };
    const calls: { error: unknown; context: unknown }[] = [];
    const handler = pressHandler({
      auth,
      store,
      onError: (error, context) => {
        calls.push({ error, context });
      },
    });
    const cookie = await cookieFor("artist");
    expect((await handler.GET(get(cookie))).status).toBe(503);
    expect((await handler.POST(post(cookie))).status).toBe(503);
    expect(calls).toEqual([
      { error: boom, context: { method: "GET" } },
      { error: boom, context: { method: "POST" } },
    ]);
  });
});
```

In `src/artist/index.test.ts`, replace:

```ts
  "pressKit",
```

with:

```ts
  "pressHandler",
  "pressKit",
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/handlers.test.ts src/artist/index.test.ts 2>&1 | grep -E "Tests |FAIL" | head -5`
Expected: FAIL, `pressHandler` is not exported.

- [ ] **Step 3: Implement**

In `src/artist/handlers.ts`, replace:

```ts
import { cleanOverlay, cleanText } from "./overlay";
import { cleanShow } from "./shows";
import type { StudioAuth } from "./studio-auth";
import type { ShowsStore, StudioStore } from "./studio-store";
```

with:

```ts
import { cleanOverlay, cleanText } from "./overlay";
import { generatePressToken } from "./press-kit";
import { cleanShow } from "./shows";
import type { StudioAuth } from "./studio-auth";
import type { PressStore, ShowsStore, StudioStore } from "./studio-store";
```

Replace:

```ts
export interface StudioErrorContext {
  method: "GET" | "PUT" | "DELETE";
  slug?: string;
}
```

with:

```ts
export interface StudioErrorContext {
  method: "GET" | "PUT" | "POST" | "DELETE";
  slug?: string;
}
```

Replace:

```ts
export interface ShowsHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}
```

with:

```ts
export interface ShowsHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

export interface PressHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  /** The store's `press`, for example `studioStore.press`. */
  store: PressStore;
  onError?: StudioErrorReporter;
  /** The longest the handler waits for `onError`, in milliseconds. Default 2000. A
      reporter still running after that no longer holds the response. */
  reportTimeoutMs?: number;
}

export interface PressHandler {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}
```

Append to the end of the file:

```ts
/** A token is a key to an unlisted page: no answer that carries one may be cached. */
const NO_STORE_HEADERS = { "cache-control": "no-store" };

/**
 * The press link: reading the current token, and making a new one.
 *
 * A new token replaces the old one in the store, so the old address stops opening
 * the press page at once, for everyone who has it. Any signed-in role may make one:
 * the link is the artist's own address for galleries, and replacing it changes no
 * work's record.
 */
export function pressHandler<R extends string>({
  auth,
  store,
  onError,
  reportTimeoutMs = REPORT_TIMEOUT_MS,
}: PressHandlerOptions<R>): PressHandler {
  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, token: null });
    try {
      const token = (await store.readToken(true)) ?? null;
      return json({ configured: true, token }, 200, NO_STORE_HEADERS);
    } catch (error) {
      await report(onError, error, { method: "GET" }, reportTimeoutMs);
      return refused();
    }
  }

  async function POST(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) return noStore();
    const token = generatePressToken();
    try {
      const ok = await store.writeToken(token, who);
      return ok ? json({ ok: true, token }, 200, NO_STORE_HEADERS) : refused();
    } catch (error) {
      await report(onError, error, { method: "POST" }, reportTimeoutMs);
      return refused();
    }
  }

  return { GET, POST };
}
```

In `CHANGELOG.md`, replace:

```

## 0.10.0
```

with:

```
- **Show words.** `formatShowDates(show)` prints a show's run in plain words ("November 7 – December 5, 2026", the month or the year said once when both ends share it) and `formatOpening(opening)` the reception ("Saturday, November 7, 6 to 9 PM", on a 12-hour clock). Both print the calendar date as stored, so no time zone can move a day.
- **Exhibition schema.** `showJsonLd` states `eventAttendanceMode` (in person) and takes optional `artist` (printed as `performer`, joined by its `@id`) and `workImage` (each listed work's image, as `image`). It states no `eventStatus`.
- **Press kit.** `pressKit` takes the statement as one string or as its paragraphs, and returns `statement` as a list of paragraphs, verbatim, blank ones dropped. Works and the price list come in `forDisplay` order (current, then earlier, then archived; available first within each), so archived work appears, last. `formatPriceLine(entry)` words one price list line ("$6,800 · on request", "Sold", "Available, not priced yet", "Availability not recorded yet").
- **Press link route.** `pressHandler({ auth, store, onError })` serves GET (the current token, or null) and POST (a new token, which retires the old link at once) with the same cookie check and 503 answers as the other handlers; every answer carrying a token is sent `Cache-Control: no-store`. `StudioErrorContext.method` gains `"POST"`.
- **Store timeout.** Every store call is abandoned after `timeoutMs` (default 4000) and fails with "store timed out after N ms": the request is aborted, and the call fails even when the fetch ignores the abort, so a store that never answers cannot hold a page until the platform's own limit. `createStudioStore` refuses a `timeoutMs` that is not a positive number.

## 0.10.0
```

(The en dash in "November 7 – December 5" is U+2013, not an em dash.)

- [ ] **Step 4: Run the kit's full gate**

Run: `cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -c $'\xe2\x80\x94' CHANGELOG.md src/artist/*.ts | grep -v ':0$' ; git status --short`
Expected: `Tests  536 passed (536)` (505 + 7 + 11 + 2 + 3 + 8); typecheck and lint clean; the em dash count prints nothing; `git status` shows the four files of this task plus the untouched ` M .gitignore`. If `src/audits/extended/index.test.ts` or `src/audits/cli.test.ts` fail under full-suite load (ledger: known flaky), rerun each alone and record it.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/handlers.ts src/artist/handlers.test.ts src/artist/index.test.ts CHANGELOG.md && git -c commit.gpgsign=false commit -m "artist: press link route, and release notes for the public pages' kit work"
```

---

### Task 6: Julian: the press key, the public store reads, and the rules for what a public page may print

**Files:**
- Modify: `src/artist.config.ts`, `src/lib/studio.ts`, `src/lib/studio.test.ts`
- Create: `src/lib/public-shows.ts`, `src/lib/shows.ts`, `src/lib/shows.test.ts`
- Create (gitignored): `.qa/E2/` (baseline snapshot)

**Interfaces:**
- Consumes: the kit at Task 5's head (`formatShowDates`, `noticeShow`, `onView`, `showStatus`, `formatTitleLine`, types `Artwork`, `ArtworkOverlay`, `Show`, `ShowKind`, `ShowRecord`).
- Produces:
  - `artistConfig.press.tokenKey === "studio:julian:press"`; `studioPress: PressStore` exported from `@/lib/studio`.
  - `savedShows(route: string): Promise<ShowRecord[]>` and `savedOverlays(route: string): Promise<Record<string, ArtworkOverlay> | null>` from `@/lib/public-shows` (cached reads; a failure is reported to Sentry with `tags: { route }` and reads as nothing saved).
  - From `@/lib/shows`: `showPath(slug): string`; `publishedShows<T extends Show>(shows): T[]`; `publishedShow<T extends Show>(shows, slug): T | undefined`; `worksInShow<A extends Artwork>(show: Pick<Show, "workSlugs">, works: readonly A[]): A[]`; `interface ShowNotice { lead: string; dates: string; href: string }`; `noticeFor(shows: readonly Show[], now: Date): ShowNotice | undefined`; `interface OnViewLine { label: string; href: string }`; `onViewFor(workSlug, shows, now): OnViewLine | undefined`; `labelTitle(work: Omit<Artwork<SeriesId>, "masterSrc">): string`; `showDescription(show: Show): string`; `showSitemapEntries(shows: readonly ShowRecord[], origin: string, fallback: Date): MetadataRoute.Sitemap`.

- [ ] **Step 1: Bring in the kit and take a baseline snapshot before any Julian change**

The phase-2a snapshot `.qa/E` was captured seconds before the last two phase-2a commits, so this plan first records `.qa/E2` from `a7c150c` built against the new kit. Every later comparison uses E2, and E2 is checked against E.

```bash
cd /Users/macbook/Claude/julianpotulicki && git status --short && git log --oneline -1 && pnpm install 2>&1 | tail -3 && mkdir -p .qa/E2 && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/E2/build.log 2>&1; tail -5 .qa/E2/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/E2/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/E2/routes.txt && cp .next/prerender-manifest.json .qa/E2/prerender-manifest.json && (lsof -ti tcp:3111 || echo free)
```

Expected: `git status --short` shows only ` M .gitignore`, ` M docs/superpowers/RESUME-julian.md` and `?? docs/boards/`; head `a7c150c`; the build succeeds; the port prints `free`.

Start the server in the background (`run_in_background: true`):

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3111
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/E2; kill -9 $(lsof -ti tcp:3111); cd .qa && for f in headers.json api.json shows-api.json css.txt routes.txt; do diff -q E/$f E2/$f >/dev/null && echo "same $f" || echo "DIFFERS $f"; done; diff -rq E/pages E2/pages && echo "same pages"
```

Expected: every line `same ...` and `same pages`. If only `studio.html` or `studio-desk.html` differ (the last two phase-2a commits touched the studio door and form), record which, and use E2 as the baseline for them from here on. If any public page, `headers.json`, `api.json` or `css.txt` differs, stop: the kit changes in Tasks 1 to 5 changed something visible, and that must be found with superpowers:systematic-debugging before going on.

- [ ] **Step 2: Write the failing tests**

In `src/lib/studio.test.ts`, replace:

```ts
import { studioAuth, studioShows, studioStore } from "./studio";
```

with:

```ts
import { studioAuth, studioPress, studioShows, studioStore } from "./studio";
```

Append to the end of `src/lib/studio.test.ts`:

```ts
describe("Julian's press link", () => {
  it("lives under its own key, apart from his overlays and his shows", () => {
    expect(artistConfig.press.tokenKey).toBe("studio:julian:press");
    expect(studioPress.key).toBe("studio:julian:press");
    expect(new Set([studioStore.key, studioShows.key, studioPress.key]).size).toBe(3);
  });
});
```

Create `src/lib/shows.test.ts`:

```ts
import type { ShowRecord } from "@iserlabs/web-kit/artist";
import { describe, expect, it } from "vitest";
import { artworkBySlug, artworks } from "@/content/artworks";
import {
  labelTitle,
  noticeFor,
  onViewFor,
  publishedShow,
  showDescription,
  showSitemapEntries,
  worksInShow,
} from "./shows";

/** Obviously fake facts: nothing here describes a real show. */
const show = (over: Partial<ShowRecord> = {}): ShowRecord => ({
  slug: "test-show",
  title: "Test Show",
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-11-30",
  workSlugs: ["light-language-red"],
  publish: "published",
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("which show a public page may print", () => {
  it("finds a published show by its web name, and never a held-back or unknown one", () => {
    const shows = [show(), show({ slug: "held", publish: "draft" })];
    expect(publishedShow(shows, "test-show")?.title).toBe("Test Show");
    expect(publishedShow(shows, "held")).toBeUndefined();
    expect(publishedShow(shows, "nope")).toBeUndefined();
  });

  it("hangs the show's works in its own order, skipping a held-back work and a slug the catalog lacks", () => {
    const merged = artworks.map((a) =>
      a.slug === "floral-01" ? { ...a, publish: "draft" as const } : a,
    );
    const hanging = worksInShow(
      show({ workSlugs: ["waterscape-09", "floral-01", "not-in-the-catalog", "light-language-red"] }),
      merged,
    );
    expect(hanging.map((w) => w.slug)).toEqual(["waterscape-09", "light-language-red"]);
  });
});

describe("the homepage line", () => {
  it("says on view while a show is current, and upcoming before it opens", () => {
    expect(noticeFor([show()], at("2026-11-20T17:00:00Z"))).toEqual({
      lead: "On view at Test Gallery",
      dates: "November 7 – 30, 2026",
      href: "/shows/test-show",
    });
    expect(noticeFor([show()], at("2026-10-20T17:00:00Z"))?.lead).toBe(
      "Upcoming at Test Gallery",
    );
  });

  it("comes down at midnight in New York the day after the show closes", () => {
    // 2026-12-01T04:30Z is 11:30 PM on November 30 in New York, the last day.
    expect(noticeFor([show()], at("2026-12-01T04:30:00Z"))?.lead).toBe("On view at Test Gallery");
    // 2026-12-01T05:30Z is 12:30 AM on December 1 in New York.
    expect(noticeFor([show()], at("2026-12-01T05:30:00Z"))).toBeUndefined();
  });

  it("says nothing for a held-back show, a past show, or one opening more than 45 days out", () => {
    const now = at("2026-11-20T17:00:00Z");
    expect(noticeFor([show({ publish: "draft" })], now)).toBeUndefined();
    expect(noticeFor([show({ startsOn: "2026-01-05", endsOn: "2026-02-01" })], now)).toBeUndefined();
    expect(noticeFor([show({ startsOn: "2027-03-01", endsOn: "2027-03-30" })], now)).toBeUndefined();
  });
});

describe("the artwork page's on-view line", () => {
  it("names the published show a work hangs in today, and nothing otherwise", () => {
    const now = at("2026-11-20T17:00:00Z");
    expect(onViewFor("light-language-red", [show()], now)).toEqual({
      label: "On view at Test Gallery",
      href: "/shows/test-show",
    });
    expect(onViewFor("waterscape-09", [show()], now)).toBeUndefined();
    expect(onViewFor("light-language-red", [show({ publish: "draft" })], now)).toBeUndefined();
    expect(
      onViewFor("light-language-red", [show({ startsOn: "2026-01-05", endsOn: "2026-02-01" })], now),
    ).toBeUndefined();
  });
});

describe("words built from the record", () => {
  it("titles a work the way its own page does, with the series after an untitled work", () => {
    const base = artworkBySlug("light-language-red");
    expect(base && labelTitle(base)).toBe("Untitled (Light Language)");
  });

  it("describes a show from its own facts", () => {
    expect(showDescription(show({ endsOn: "2026-12-05" }))).toBe(
      "Test Show, a group show at Test Gallery, Test City, November 7 – December 5, 2026. Paintings by Julian Potulicki.",
    );
    expect(showDescription(show({ kind: "event", endsOn: "2026-11-07" }))).toBe(
      "Test Show, an event at Test Gallery, Test City, November 7, 2026. Paintings by Julian Potulicki.",
    );
  });

  it("lists every published show in the sitemap, past ones included, dated by its last save", () => {
    const fallback = new Date("2026-07-13T00:00:00Z");
    const entries = showSitemapEntries(
      [
        show({ updatedAt: "2026-10-01T12:00:00.000Z" }),
        show({ slug: "old", startsOn: "2025-01-10", endsOn: "2025-02-10" }),
        show({ slug: "held", publish: "draft" }),
      ],
      "https://site.example.test",
      fallback,
    );
    expect(entries).toEqual([
      {
        url: "https://site.example.test/shows/test-show",
        lastModified: new Date("2026-10-01T12:00:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: "https://site.example.test/shows/old",
        lastModified: fallback,
        changeFrequency: "monthly",
        priority: 0.7,
      },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec vitest run src/lib/shows.test.ts src/lib/studio.test.ts 2>&1 | tail -6`
Expected: FAIL (`./shows` does not resolve; `studioPress` is not exported).

- [ ] **Step 4: Implement**

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
 * calendar days, and his shows live under their own key beside his overlays. The
 * press key arrived with the press page: the current address of his unlisted page
 * for galleries lives under a third key, apart from both.
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
  // The press page's current token. Making a new one in the studio replaces it, which
  // retires the old address at once.
  press: { tokenKey: "studio:julian:press" },
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
  pressKey: artistConfig.press.tokenKey,
  // The public artwork pages read through this. A timed revalidate keeps those 34
  // pages built ahead of time and still lands a studio edit within the minute; an
  // uncached read would render every one of them on each visit. The studio's own
  // screens read fresh. Every call gives up after the kit's default four seconds.
  cachedRead: { next: { revalidate: 60 } },
});

/** Julian's shows, typed in the studio. Public pages read them through the same
    one-minute cache as his overlays; the studio reads them fresh. */
export const studioShows = studioStore.shows;

/** The press page's current token. The press page and the studio read it fresh, so
    a replaced link stops working at once. */
export const studioPress = studioStore.press;
```

Create `src/lib/public-shows.ts`:

```ts
import type { ArtworkOverlay, ShowRecord } from "@iserlabs/web-kit/artist";
import * as Sentry from "@sentry/nextjs";
import { studioShows, studioStore } from "@/lib/studio";

/**
 * The store reads a public page makes, through the store's one-minute cache.
 *
 * With no store connected they read as no shows and no edits and nothing is
 * fetched, so a page is built once, exactly as it was before shows existed. A failed
 * or timed-out read must not take a public page down: the page renders from the
 * catalog alone, as if nothing were saved, for at most the minute until the next
 * read, and Sentry hears about it. The CV page makes the same trade.
 */
export async function savedShows(route: string): Promise<ShowRecord[]> {
  try {
    return (await studioShows.readShows()) ?? [];
  } catch (error) {
    Sentry.captureException(error, { tags: { route } });
    return [];
  }
}

export async function savedOverlays(
  route: string,
): Promise<Record<string, ArtworkOverlay> | null> {
  try {
    return await studioStore.readOverlays();
  } catch (error) {
    Sentry.captureException(error, { tags: { route } });
    return null;
  }
}
```

Create `src/lib/shows.ts`:

```ts
import {
  type Artwork,
  formatShowDates,
  formatTitleLine,
  noticeShow,
  onView,
  type Show,
  type ShowKind,
  type ShowRecord,
  showStatus,
} from "@iserlabs/web-kit/artist";
import type { MetadataRoute } from "next";
import { artistConfig } from "@/artist.config";
import { site } from "@/content/site";
import { type SeriesId, seriesById } from "@/content/works";

/**
 * What Julian's public pages say about his shows: which show a page may print, which
 * works hang in it, the homepage line and the artwork page's "On view at" line. The
 * rules themselves (dates read in New York, the 45-day window, the day after close)
 * live in the kit; this file turns them into his words and his addresses.
 *
 * A held-back show is never printed anywhere public. A show hangs only works that
 * are in his catalog and published.
 */

const TIME_ZONE = artistConfig.timeZone;

export const showPath = (slug: string): string => `/shows/${slug}`;

export function publishedShows<T extends Show>(shows: readonly T[]): T[] {
  return shows.filter((s) => s.publish === "published");
}

export function publishedShow<T extends Show>(shows: readonly T[], slug: string): T | undefined {
  return publishedShows(shows).find((s) => s.slug === slug);
}

/** The works hanging in a show, in the show's own order. A slug the catalog lacks,
    or a work that is held back, is left out rather than printed half-known. */
export function worksInShow<A extends Artwork>(
  show: Pick<Show, "workSlugs">,
  works: readonly A[],
): A[] {
  const bySlug = new Map(works.map((w) => [w.slug, w] as const));
  const hanging: A[] = [];
  for (const slug of show.workSlugs) {
    const work = bySlug.get(slug);
    if (work && work.publish === "published") hanging.push(work);
  }
  return hanging;
}

/** The homepage line, as its words and its address. */
export interface ShowNotice {
  lead: string;
  dates: string;
  href: string;
}

/** "On view at <venue>" while a published show is on, "Upcoming at <venue>" when
    the next one opens within 45 days, nothing otherwise. Gone the day after close. */
export function noticeFor(shows: readonly Show[], now: Date): ShowNotice | undefined {
  const show = noticeShow(shows, now, TIME_ZONE);
  if (!show) return undefined;
  const on = showStatus(show, now, TIME_ZONE) === "current";
  return {
    lead: `${on ? "On view at" : "Upcoming at"} ${show.venue}`,
    dates: formatShowDates(show),
    href: showPath(show.slug),
  };
}

/** The artwork page's line while the work hangs in a published show today. */
export interface OnViewLine {
  label: string;
  href: string;
}

export function onViewFor(
  workSlug: string,
  shows: readonly Show[],
  now: Date,
): OnViewLine | undefined {
  const show = onView(workSlug, shows, now, TIME_ZONE);
  return show ? { label: `On view at ${show.venue}`, href: showPath(show.slug) } : undefined;
}

/** "Untitled (Light Language)": the title an artwork page gives its work, with the
    series in parentheses so it never stands where a curator reads a year. */
export function labelTitle(work: Omit<Artwork<SeriesId>, "masterSrc">): string {
  return `${formatTitleLine(work)} (${seriesById(work.series).label})`;
}

const KIND_WORDS: Record<ShowKind, string> = {
  solo: "a solo show",
  "two-person": "a two-person show",
  group: "a group show",
  event: "an event",
};

/** The show page's description, built only from the show's own facts. */
export function showDescription(show: Show): string {
  return `${show.title}, ${KIND_WORDS[show.kind]} at ${show.venue}, ${show.city}, ${formatShowDates(show)}. Paintings by ${site.name}.`;
}

/** Every published show keeps its page after it closes, as the exhibition record,
    so every one is listed, dated by its last save in the studio. */
export function showSitemapEntries(
  shows: readonly ShowRecord[],
  origin: string,
  fallback: Date,
): MetadataRoute.Sitemap {
  return publishedShows(shows).map((s) => {
    const saved = s.updatedAt ? new Date(s.updatedAt) : undefined;
    return {
      url: `${origin}${showPath(s.slug)}`,
      lastModified: saved && !Number.isNaN(saved.getTime()) ? saved : fallback,
      changeFrequency: "monthly",
      priority: 0.7,
    };
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm exec biome check --write src && pnpm exec biome check src 2>&1 | tail -3`
Expected: `Tests  69 passed (69)` (59 + 9 + 1); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/artist.config.ts src/lib/studio.ts src/lib/studio.test.ts src/lib/public-shows.ts src/lib/shows.ts src/lib/shows.test.ts && git status --short && git -c commit.gpgsign=false commit -m "Shows: the press link key, the public store reads, and the rules for what a public page may print"
```

Expected before the commit: the six files staged; ` M .gitignore`, ` M docs/superpowers/RESUME-julian.md` and `?? docs/boards/` untouched. (Julian's `pnpm-lock.yaml` does not change: the `file:` dependency resolves to the same path.)

---

### Task 7: Julian: a page for every published show, in the homepage's viewer, and in the sitemap

**Files:**
- Create: `src/components/ShowViewer.tsx`, `src/app/shows/[slug]/page.tsx`
- Modify: `src/app/globals.css` (append), `src/app/sitemap.ts`

**Interfaces:**
- Consumes: Task 6's `savedShows`, `savedOverlays`, `publishedShows`, `publishedShow`, `worksInShow`, `labelTitle`, `showDescription`, `showPath`, `showSitemapEntries`; the kit's `formatShowDates`, `formatOpening`, `formatMediumLine`, `mergeAll`, `showJsonLd`; the site's `DFoot`, `Mark`, `markFor`, `boardSrc`, `shapeOf`, `seriesById`, `artworks`, `site`.
- Produces: the route `/shows/[slug]` (published shows only, 404 otherwise, `revalidate = 60`); `ViewerItem` and `ShowViewer` (default export) from `@/components/ShowViewer`; the CSS classes `.d-viewer`, `.d-dot`, `.d-show-track`, `.d-show-cel`, `.d-show-strip`, `.d-show-note`, `.d-show-facts`, `.d-show-more`, `.d-show-link`, used again by Tasks 9 and 10; section ids `show-works` and `show-facts` (Task 14's screenshots anchor on them).

Before writing the page, read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md` and `.../02-components/image.md` (AGENTS.md), and invoke the `modern-web-guidance` skill with `retrieve "scroll-snap-state-sync"`: the viewer below follows it (`scrollsnapchange` where supported, `IntersectionObserver` otherwise, `aria-current` on the active thumbnail).

The show page, matching option 3's surface A: the title in the site's display type, one locator line (venue, city, dates), the show's paintings in the homepage's swipe-and-strip viewer (each whole, each linking to its artwork page), the record line beneath, the strip of every painting in the show, then the facts row (address, opening), the gallery's own page, and the site's footer. Revalidation: `revalidate = 60` like the artwork pages, and the store's reads carry the same 60-second revalidate as `/cv`, so a show published in the studio reaches its page within the minute. With no store, `generateStaticParams` returns nothing and every slug is a 404.

- [ ] **Step 1: Write the viewer**

Create `src/components/ShowViewer.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mark, markFor } from "@/components/DMark";
import type { SeriesId } from "@/content/works";

/** One painting in a show, as the viewer needs it. Built on the server from the record. */
export interface ViewerItem {
  slug: string;
  /** "Untitled (Light Language)", the title its own page carries. */
  title: string;
  alt: string;
  /** The render's own width and height, so its box is reserved and the canvas is
      never cropped. */
  width: number;
  height: number;
  src: string;
  thumb: string;
  /** The body of work, for its mark. */
  seriesId: SeriesId;
  series: string;
  medium: string;
}

/**
 * A show's paintings in the homepage's own viewer: one canvas at a time, whole,
 * swipe or scroll sideways for the next, its record set beneath, and the strip of
 * every painting in the show under that. Each painting opens its own page; each
 * thumbnail brings its painting into view, as the homepage strip does.
 *
 * The painting in view is read from the browser's snap events where it has them,
 * and from an intersection observer where it does not. Without script the row still
 * scrolls and every painting still links; the record then names the first.
 */
export default function ShowViewer({ items }: { items: ViewerItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const row = track.current;
    if (!row) return;
    const pick = (target: Element | null | undefined) => {
      const i = Number((target as HTMLElement | null | undefined)?.dataset.i);
      if (Number.isInteger(i)) setActive(i);
    };
    if ("onscrollsnapchange" in HTMLElement.prototype) {
      const onSnap = (event: Event) =>
        pick((event as Event & { snapTargetInline?: Element | null }).snapTargetInline);
      row.addEventListener("scrollsnapchange", onSnap);
      return () => row.removeEventListener("scrollsnapchange", onSnap);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) pick(entry.target);
      },
      { root: row, threshold: 0.6 },
    );
    for (const cel of row.querySelectorAll("[data-i]")) observer.observe(cel);
    return () => observer.disconnect();
  }, []);

  function go(i: number) {
    const row = track.current;
    if (!row) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: i * row.clientWidth, behavior: calm ? "auto" : "smooth" });
    setActive(i);
  }

  const current = items[active] ?? items[0];
  if (!current) return null;
  // The mark's own shape and paint, without the fields that describe the series.
  const { key: _key, label: _label, first: _first, ...look } = markFor(current.seriesId);

  return (
    <section id="show-works" aria-label="The paintings in this show">
      <div className="d-show-track" ref={track}>
        {items.map((item, i) => (
          <figure className="d-show-cel" data-i={i} key={item.slug}>
            <Link href={`/work/${item.slug}`} aria-label={`${item.title}, open its page`}>
              <Image
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width:760px) 94vw, 900px"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
              />
            </Link>
          </figure>
        ))}
      </div>
      <p className="d-record-line" aria-live="polite">
        <Mark {...look} size={14} />
        <span className="d-sname">{current.series}</span>
        <span className="d-dot" aria-hidden="true" />
        <span className="d-med">{current.medium}</span>
        <span className="d-pos">{`${active + 1} / ${items.length}`}</span>
      </p>
      <div className="d-show-strip">
        {items.map((item, i) => (
          <button
            type="button"
            key={item.slug}
            aria-label={`${item.title}, ${i + 1} of ${items.length}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => go(i)}
          >
            <Image src={item.thumb} alt="" width={item.width} height={item.height} sizes="60px" />
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/shows/[slug]/page.tsx`:

```tsx
import {
  formatMediumLine,
  formatOpening,
  formatShowDates,
  mergeAll,
  showJsonLd,
} from "@iserlabs/web-kit/artist";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DFoot from "@/components/DFoot";
import ShowViewer, { type ViewerItem } from "@/components/ShowViewer";
import { artworks } from "@/content/artworks";
import { boardSrc, shapeOf } from "@/content/dimensions";
import { site } from "@/content/site";
import { seriesById } from "@/content/works";
import { savedOverlays, savedShows } from "@/lib/public-shows";
import {
  labelTitle,
  publishedShow,
  publishedShows,
  showDescription,
  showPath,
  worksInShow,
} from "@/lib/shows";

/** A show saved or published in the studio reaches its page within the minute,
    the same cadence as the artwork pages and the CV. */
export const revalidate = 60;

export async function generateStaticParams() {
  return publishedShows(await savedShows("show-page")).map((s) => ({ slug: s.slug }));
}

/** The published show and the works hanging in it, or null for anything else: a
    held-back show, an unknown name, or no store at all. */
async function load(slug: string) {
  const show = publishedShow(await savedShows("show-page"), slug);
  if (!show) return null;
  const works = worksInShow(show, mergeAll(artworks, await savedOverlays("show-page")));
  return { show, works };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return {};
  const { show, works } = data;
  const description = showDescription(show);
  const title = `${show.title} | ${site.name}`;
  const first = works[0];
  const images = first ? [{ url: boardSrc(first.slug, 1280), alt: first.alt }] : undefined;
  return {
    title: show.title,
    description,
    alternates: { canonical: showPath(show.slug) },
    // With no painting to show, the site's own card stays in place.
    ...(images
      ? {
          openGraph: { title, description, type: "website", url: showPath(show.slug), images },
          twitter: { card: "summary_large_image", title, description, images },
        }
      : {}),
  };
}

/**
 * A show, in the direction Jake picked off the round-1 board on 2026-10-13: the
 * homepage's own viewer. The title, one line saying where and when, the paintings
 * hanging there one at a time and whole, their record beneath, the strip of the
 * whole show, then where to go and when the opening is. A past show keeps its page
 * as the exhibition record.
 */
export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { show, works } = data;

  const items: ViewerItem[] = works.map((w) => {
    const shape = shapeOf(w.slug);
    return {
      slug: w.slug,
      title: labelTitle(w),
      alt: w.alt,
      width: shape.w,
      height: shape.h,
      src: boardSrc(w.slug, 1280),
      thumb: boardSrc(w.slug, "thumb"),
      seriesId: w.series,
      series: seriesById(w.series).label,
      medium: formatMediumLine(w),
    };
  });

  const facts = [
    show.address ? `${show.address}, ${show.city}` : undefined,
    show.opening ? `Opening ${formatOpening(show.opening)}` : undefined,
  ].filter((fact): fact is string => Boolean(fact));

  // Only the works the page shows are named, each by the @id its own page gives it.
  const ld = showJsonLd(
    { ...show, workSlugs: works.map((w) => w.slug) },
    {
      url: site.url,
      artist: { name: site.name, id: `${site.url}/#person` },
      workImage: (s) => boardSrc(s, 1280),
    },
  );

  return (
    <div data-ground="stark" className="d-page d-viewer">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD, with "<" escaped so studio text cannot end the script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
      />

      <header className="d-head">
        <h1 className="d-name">{show.title}</h1>
        <p className="d-locator">{`${show.venue}, ${show.city} · ${formatShowDates(show)}`}</p>
      </header>

      {items.length > 0 ? <ShowViewer items={items} /> : null}

      <section className="d-column" id="show-facts">
        {show.note ? <p className="d-show-note">{show.note}</p> : null}
        {facts.length > 0 ? (
          <p className="d-show-facts">
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
        ) : null}
        {show.href ? (
          <p className="d-show-more">
            <a className="d-show-link" href={show.href} rel="noopener noreferrer" target="_blank">
              <span>{"The show on the gallery's own page"}</span>
            </a>
          </p>
        ) : null}
      </section>

      <DFoot />
    </div>
  );
}
```

- [ ] **Step 3: Add the show page's rules to the stylesheet**

Append to the end of `src/app/globals.css`:

```css

/* ------------------------------------------------------------------ *
   Shows and the press page, in the direction Jake picked on 2026-10-13
   off the round-1 board: the homepage's own viewer. A show's paintings
   sit in the same swipe-and-strip row the homepage uses, each hung whole.
   These pages set their record type at 13px, the size the board drew,
   and put a small round dot between facts.
 * ------------------------------------------------------------------ */
.d-viewer .d-locator,
.d-viewer .d-sname,
.d-viewer .d-med,
.d-viewer .d-pos,
.d-viewer .d-sign,
.d-viewer .d-nav-foot a {
  font-size: 0.8125rem;
}
.d-viewer .d-pos {
  color: #6b6b6b;
}
.d-dot {
  display: inline-block;
  flex: 0 0 auto;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #9a9a9a;
}
.d-show-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.d-show-track::-webkit-scrollbar {
  display: none;
}
/* the whole canvas inside the window: no taller than the screen allows, no wider
   than the column, never cut */
.d-show-cel {
  flex: 0 0 100%;
  scroll-snap-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 var(--d-pad);
  height: min(64vh, 600px, calc((100vw - 2 * var(--d-pad)) * 1.12));
}
@supports (height: 100dvh) {
  .d-show-cel {
    height: min(64dvh, 600px, calc((100vw - 2 * var(--d-pad)) * 1.12));
  }
}
.d-show-cel a {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  max-width: 100%;
}
.d-show-cel img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}
/* "safe" keeps the first thumbnails reachable when the row is wider than the screen */
.d-show-strip {
  display: flex;
  justify-content: safe center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 16px var(--d-pad) 0;
}
.d-show-strip::-webkit-scrollbar {
  display: none;
}
.d-show-strip button {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  height: 54px;
  min-width: 44px;
  padding: 0;
  border: 1px solid transparent;
  background: none;
  opacity: 0.6;
  cursor: pointer;
}
.d-show-strip button:hover {
  opacity: 0.85;
}
.d-show-strip button[aria-current="true"] {
  opacity: 1;
  border-color: #131313;
}
.d-show-strip img {
  height: 100%;
  width: auto;
  max-width: none;
}
.d-show-note {
  margin: clamp(30px, 5vh, 60px) 0 0;
  text-align: center;
  font-size: 1.02rem;
  line-height: 1.6;
  color: #333;
}
.d-show-facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem 1.4rem;
  margin: 0;
  padding-top: 24px;
  font-size: 1.02rem;
  color: #1d1d1d;
  text-align: center;
}
.d-show-more {
  margin: 0;
  text-align: center;
}
.d-show-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: 12px;
  font-size: 0.8125rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-decoration: none;
  color: #131313;
}
.d-show-link span {
  border-bottom: 1px solid #131313;
  padding-bottom: 2px;
}
.d-show-link:hover span {
  border-bottom-width: 2px;
}
```

- [ ] **Step 4: List published shows in the sitemap**

Replace the whole of `src/app/sitemap.ts` with:

```ts
import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { works } from "@/content/works";
import { savedShows } from "@/lib/public-shows";
import { showSitemapEntries } from "@/lib/shows";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date("2026-07-13");
  const core: MetadataRoute.Sitemap = ["", "/work", "/about", "/cv", "/inquire"].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.8,
  }));
  const workPages: MetadataRoute.Sitemap = works.map((w) => ({
    url: `${site.url}/work/${w.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  // Published shows only, past ones included. The press page is never listed.
  const showPages = showSitemapEntries(await savedShows("sitemap"), site.url, now);
  return [...core, ...workPages, ...showPages];
}
```

- [ ] **Step 5: Verify it builds and holds the rules**

Run:

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src && pnpm exec biome check src 2>&1 | tail -3 && pnpm typecheck 2>&1 | tail -3 && pnpm test 2>&1 | grep -E "Test Files|Tests " && env KV_REST_API_URL= KV_REST_API_TOKEN= NEXT_TELEMETRY_DISABLED=1 pnpm build 2>&1 | grep -E "shows|Error|error|Failed" | head -10
```

Expected: lint and typecheck clean; `Tests  69 passed (69)`; the build succeeds and its route table lists `● /shows/[slug]`. If the build prints `ƒ /shows/[slug]` (rendered on every visit), something read a request-time value: stop and find it, because the page must be built ahead of time and revalidated. If Biome objects to the underscore names in the mark destructuring, keep them (they are deliberately unused) with a `// biome-ignore lint/correctness/noUnusedVariables: only the mark's shape and paint are passed on` line above.

- [ ] **Step 6: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/components/ShowViewer.tsx "src/app/shows/[slug]/page.tsx" src/app/globals.css src/app/sitemap.ts && git -c commit.gpgsign=false commit -m "Shows: a page for every published show, in the homepage's viewer, and in the sitemap"
```

---

### Task 8: Julian: the homepage line, under the marks, while a show is on or about to open

**Files:**
- Modify: `src/lib/board/document.ts`, `src/lib/board/styles.ts`, `src/app/route.ts`
- Test: `src/lib/board/document.test.ts`

**Interfaces:**
- Consumes: Task 6's `ShowNotice`, `noticeFor`, `savedShows`.
- Produces: `renderBoard({ noindex?: boolean; notice?: ShowNotice }): string`, byte for byte the old document whenever `notice` is undefined; `noticeStyles: string` exported from `./styles`. The line's markup is `\n  <div class="shownote" id="on-view"><p>...</p></div>`, emitted between the marks (`#glyphrow`) and his quote, matching option 3's surface B; its styles are appended inside the same `<style>` only when the line is there. `/direction` (the noindex duplicate) never carries it.

The homepage is a route handler built ahead of time (`dynamic = "force-static"`, `revalidate = false`, both kept). It now reads the shows through the store's 60-second cached read, which Next's docs say lowers the route's revalidation to 60 seconds whenever a store is connected, so the line appears within a minute of a show qualifying and comes down within a minute after midnight in New York the day after it closes, with no manual step. With no store connected nothing is fetched and the page is built once, exactly as before. Task 13 proves the 60 seconds on a real build.

- [ ] **Step 1: Write the failing tests**

In `src/lib/board/document.test.ts`, replace:

```ts
import { works } from "@/content/works";
import { renderBoard } from "./document";
```

with:

```ts
import { works } from "@/content/works";
import { noticeFor } from "@/lib/shows";
import { renderBoard } from "./document";
import { noticeStyles } from "./styles";
```

Append to the end of the file:

```ts
describe("the show line", () => {
  /** Obviously fake words and address: test-only. */
  const notice = {
    lead: "On view at Test <Gallery> & Co",
    dates: "November 7 – 30, 2026",
    href: "/shows/test-show",
  };

  it("changes nothing, byte for byte, when no show qualifies", () => {
    const now = new Date("2026-11-20T17:00:00Z");
    const fake = { title: "Test", venue: "Test Gallery", city: "Test City", workSlugs: [] };
    const quiet = noticeFor(
      [
        { ...fake, slug: "past", kind: "solo", startsOn: "2026-01-05", endsOn: "2026-02-01", publish: "published" },
        { ...fake, slug: "held", kind: "group", startsOn: "2026-11-01", endsOn: "2026-11-30", publish: "draft" },
        { ...fake, slug: "far", kind: "group", startsOn: "2027-03-01", endsOn: "2027-03-30", publish: "published" },
      ],
      now,
    );
    expect(quiet).toBeUndefined();
    expect(renderBoard({ notice: quiet })).toBe(html);
  });

  it("sits between the marks and his quote, escaped, linking to the show", () => {
    const page = renderBoard({ notice });
    const at = page.indexOf('<div class="shownote" id="on-view">');
    expect(at).toBeGreaterThan(page.indexOf('id="glyphrow"'));
    expect(at).toBeLessThan(page.indexOf('<blockquote class="quote">'));
    expect(page).toContain("<span>On view at Test &lt;Gallery&gt; &amp; Co</span>");
    expect(page).toContain('<a href="/shows/test-show"><span>The show</span></a>');
  });

  it("adds only the line and its styles, and never reaches the /direction copy", () => {
    const page = renderBoard({ notice });
    const without = page
      .replace(noticeStyles, "")
      .replace(/\n {2}<div class="shownote" id="on-view">.*?<\/div>/s, "");
    expect(without).toBe(html);
    expect(renderBoard({ noindex: true })).not.toContain("shownote");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec vitest run src/lib/board/document.test.ts 2>&1 | tail -6`
Expected: FAIL (`noticeStyles` is not exported; `renderBoard` ignores `notice`).

- [ ] **Step 3: Implement**

Append to the end of `src/lib/board/styles.ts`:

```ts

/**
 * The show line's styles. They are added to the page only while the line is on it,
 * so whenever no show is on or about to open the homepage is byte for byte what it
 * was before shows existed. Sizes and spacing are the ones option 3 drew on the
 * round-1 board.
 */
export const noticeStyles = `
/* ---- the show line, while a show is on or about to open ----------------- */
.shownote{margin:0 0 30px}
.shownote p{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .6rem;margin:0;
  font-size:.8125rem;letter-spacing:.12em;text-transform:uppercase}
.shownote .dot{display:inline-block;flex:0 0 auto;width:3px;height:3px;border-radius:50%;
  background:#9a9a9a}
.shownote a{display:inline-flex;align-items:center;min-height:44px;color:#131313;
  text-decoration:none}
.shownote a span{border-bottom:1px solid #131313;padding-bottom:2px}
.shownote a:hover span{border-bottom-width:2px}
`;
```

In `src/lib/board/document.ts`, replace:

```ts
import { seriesById, works } from "@/content/works";
```

with:

```ts
import { seriesById, works } from "@/content/works";
import type { ShowNotice } from "@/lib/shows";
```

Replace:

```ts
import { boardStyles } from "./styles";
```

with:

```ts
import { boardStyles, noticeStyles } from "./styles";
```

Replace:

```ts
function jsonLd(): string {
```

with:

```ts
/**
 * The show line, under the marks and above his quote, while a show is on or about
 * to open (option 3, surface B, on the round-1 board). It is the only thing the
 * homepage gains for shows, and it is absent, along with its styles, whenever no
 * show qualifies.
 */
function noticeBlock(notice: ShowNotice): string {
  return `
  <div class="shownote" id="on-view"><p><span>${esc(notice.lead)}</span><span class="dot" aria-hidden="true"></span><span>${esc(
    notice.dates,
  )}</span><a href="${esc(notice.href)}"><span>The show</span></a></p></div>`;
}

function jsonLd(): string {
```

Replace:

```ts
export function renderBoard({ noindex = false }: { noindex?: boolean } = {}): string {
```

with:

```ts
export function renderBoard({
  noindex = false,
  notice,
}: { noindex?: boolean; notice?: ShowNotice } = {}): string {
```

Replace:

```ts
<style>${boardStyles}</style>
```

with:

```ts
<style>${boardStyles}${notice ? noticeStyles : ""}</style>
```

Replace:

```ts
  <div class="glyphrow" id="glyphrow" role="group" aria-label="Bodies of work">${glyphRow()}</div>
```

with:

```ts
  <div class="glyphrow" id="glyphrow" role="group" aria-label="Bodies of work">${glyphRow()}</div>${notice ? noticeBlock(notice) : ""}
```

Replace the whole of `src/app/route.ts` with:

```ts
import { renderBoard } from "@/lib/board/document";
import { savedShows } from "@/lib/public-shows";
import { noticeFor } from "@/lib/shows";

/**
 * The homepage.
 *
 * Julian chose this direction off the board on 2026-08-27, so it became the site
 * rather than a page inside it. It is served as its own complete document because
 * the whole point of the direction is that nothing frames the work: no site
 * header, no footer, no inherited layout.
 *
 * Since 2026-09-04 the document is BUILT FROM THE ARTWORK RECORDS rather than read
 * off disk as a hand-authored file, so adding a painting is one entry in `works`
 * and every surface picks it up together. See `src/lib/board/document.ts`.
 *
 * Since 2026-10-13 it also carries one line under the marks while a published show
 * is on, or opens within 45 days. The shows are read through the store's one-minute
 * cache, which makes this route rebuild within the minute whenever a store is
 * connected, so the line comes down by itself the day after a show closes. With no
 * store the page is built once, exactly as before, and with no qualifying show the
 * document is byte for byte the one it always was.
 *
 * The first design is kept, unchanged, at /ARCHIVE.
 */
export const dynamic = "force-static";
export const revalidate = false;

export async function GET() {
  const notice = noticeFor(await savedShows("home"), new Date());
  return new Response(renderBoard({ notice }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src && pnpm exec biome check src 2>&1 | tail -3 && pnpm typecheck 2>&1 | tail -3 && pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: clean; `Tests  72 passed (72)`.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/lib/board/document.ts src/lib/board/styles.ts src/lib/board/document.test.ts src/app/route.ts && git -c commit.gpgsign=false commit -m "Home: a line under the marks while a show is on or about to open, gone the day after it closes"
```

---

### Task 9: Julian: the artwork page says where a painting is on view

**Files:**
- Modify: `src/app/work/[slug]/page.tsx`, `src/app/globals.css` (append)

**Interfaces:**
- Consumes: Task 6's `onViewFor`, `savedShows`.
- Produces: inside the record (`.d-solo-label`), directly after `<ArtworkLabel>`, the line `<p class="d-avail d-onview"><a href="/shows/<slug>"><span>On view at <venue></span></a></p>`, only while the work hangs in a published show that is on today in New York. Nothing else on the page changes: same layout, same JSON-LD, same everything; Task 13 proves the page equals E2 once that one paragraph is removed.

- [ ] **Step 1: Add the line**

In `src/app/work/[slug]/page.tsx`, replace:

```ts
import { studioStore } from "@/lib/studio";
```

with:

```ts
import { savedShows } from "@/lib/public-shows";
import { onViewFor } from "@/lib/shows";
import { studioStore } from "@/lib/studio";
```

Replace:

```ts
  const artwork = merge(base, (await studioStore.readOverlays())?.[w.slug]);
```

with:

```ts
  const artwork = merge(base, (await studioStore.readOverlays())?.[w.slug]);
  // The published show this painting hangs in today, read in New York through the
  // store's one-minute cache. No show, or a failed read, prints no line.
  const onView = onViewFor(w.slug, await savedShows("work-page"), new Date());
```

Replace:

```tsx
        <ArtworkLabel work={artwork} tone="stark" />
```

with:

```tsx
        <ArtworkLabel work={artwork} tone="stark" />
        {onView ? (
          <p className="d-avail d-onview">
            <Link href={onView.href}>
              <span>{onView.label}</span>
            </Link>
          </p>
        ) : null}
```

Append to the end of `src/app/globals.css`:

```css
/* the artwork page's "On view at" line, inside its record, while it hangs in a show */
.d-onview {
  font-size: 0.8125rem;
}
.d-onview a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: #131313;
  text-decoration: none;
}
.d-onview a span {
  border-bottom: 1px solid #131313;
  padding-bottom: 2px;
}
.d-onview a:hover span {
  border-bottom-width: 2px;
}
```

- [ ] **Step 2: Verify**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src && pnpm exec biome check src 2>&1 | tail -3 && pnpm typecheck 2>&1 | tail -3 && pnpm test 2>&1 | grep -E "Test Files|Tests " && git diff --stat`
Expected: clean; `Tests  72 passed (72)`; the diff touches only the two files, the page by about a dozen lines.

- [ ] **Step 3: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add "src/app/work/[slug]/page.tsx" src/app/globals.css && git -c commit.gpgsign=false commit -m "Work: the artwork page says where a painting is on view"
```

---

### Task 10: Julian: the unlisted press page for galleries

**Files:**
- Create: `src/components/SideScroll.tsx`, `src/app/press/[token]/page.tsx`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: the kit's `pressKit`, `pressTokenMatches`, `formatPriceLine`, `formatMediumLine`, `formatDimensionsLine`, `cvSections`, `newestFirst`, `mergeAll`, type `CvEntry`; Task 6's `studioPress`, `savedShows`, `savedOverlays`, `labelTitle`; the site's `cv`, `site.statementLong`, `artworks`, `boardSrc`, `shapeOf`, `DFoot`, `artistConfig`.
- Produces: the route `/press/[token]` (rendered on every visit; the token read fresh; 404 on any mismatch, an unset token, no store, or a failing store); `SideScroll` (default export, props `{ target: string; count: number }`); classes `.d-press-*`; ids `press-count`, `press-works`, `press-cards`, `press-statement`.

Before writing the page, invoke `modern-web-guidance` with a search for "horizontal scrolling row of cards with previous and next buttons" and follow what it returns where it applies.

What it prints, matching option 3's surface C: "Press" in the display type; "Julian Potulicki, oil painter, Nyack, New York"; his CV, one line per section (education when he has some, then solo and group exhibitions with his published shows merged in, newest first); "Works and prices · N works"; a sideways row of every published work (current, then earlier, then archived), each whole with its title, its medium and size ("size not recorded yet" when there is none, per design standard 1.4), its price line per Jake's rule (public and on-request prices for available work; sold, reserved and not-for-sale works named without a price; "Availability not recorded yet" otherwise) and a download of the highest-resolution image the site serves (`/works-hi/<slug>.jpeg`, never the master); the two step buttons; his statement, verbatim, in its four paragraphs, signed; the footer.

Unlisted, and why `robots.txt` is left alone: the page carries `noindex, nofollow, noarchive, nocache`, no canonical link, and `no-referrer` (so the token is never sent to the gallery's or Instagram's server when a visitor follows a link out). It is never in the sitemap and nothing on the site links to it. `robots.txt` deliberately gains no `Disallow: /press/` line: a disallowed address is never crawled, so a search engine never reads its `noindex`, and a leaked press address can then be listed as a bare URL with its token showing. Leaving it crawlable lets `noindex` keep it out entirely. This is reported to Jake in Task 14 as a decision he can overrule.

- [ ] **Step 1: Write the step buttons**

Create `src/components/SideScroll.tsx`:

```tsx
"use client";

/**
 * Two buttons that step a sideways row along by one screen, for anyone without a
 * trackpad or a touch screen. The row scrolls by touch or trackpad without them.
 */
export default function SideScroll({ target, count }: { target: string; count: number }) {
  function step(direction: 1 | -1) {
    const row = document.getElementById(target);
    if (!row) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * row.clientWidth, behavior: calm ? "auto" : "smooth" });
  }

  return (
    <p className="d-press-pager">
      <button
        type="button"
        className="d-press-step"
        aria-controls={target}
        aria-label="Previous works"
        onClick={() => step(-1)}
      >
        {"‹"}
      </button>
      <span className="d-pos">{`Swipe or step through all ${count}`}</span>
      <button
        type="button"
        className="d-press-step"
        aria-controls={target}
        aria-label="Next works"
        onClick={() => step(1)}
      >
        {"›"}
      </button>
    </p>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/press/[token]/page.tsx`:

```tsx
import {
  type CvEntry,
  cvSections,
  formatDimensionsLine,
  formatMediumLine,
  formatPriceLine,
  mergeAll,
  newestFirst,
  pressKit,
  pressTokenMatches,
} from "@iserlabs/web-kit/artist";
import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { artistConfig } from "@/artist.config";
import DFoot from "@/components/DFoot";
import SideScroll from "@/components/SideScroll";
import { artworks } from "@/content/artworks";
import { cv } from "@/content/cv";
import { boardSrc, shapeOf } from "@/content/dimensions";
import { site } from "@/content/site";
import { savedOverlays, savedShows } from "@/lib/public-shows";
import { labelTitle } from "@/lib/shows";
import { studioPress } from "@/lib/studio";

/**
 * The press page: what a gallerist is sent, at an address Julian can retire from
 * the studio at any time (option 3, surface C, on the round-1 board).
 *
 * Unlisted: nothing on the site links here, it is never in the sitemap, and search
 * engines are told not to index, follow or keep it. robots.txt does not name it on
 * purpose: a blocked address is never read, so its noindex would never be seen, and
 * a leaked link could then be listed with its token showing. No referrer is sent
 * when a visitor follows a link out, so the token stays on this page.
 *
 * The token is read fresh on every visit, so a link replaced in the studio stops
 * working at once. Any mismatch, an unset token, no store or a failing store is a
 * plain 404: the page never says whether a link once worked.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Press",
  description: `Statement, CV, works and prices for ${site.name}, oil painter in ${site.location}.`,
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  referrer: "no-referrer",
  alternates: { canonical: null },
};

async function currentToken(): Promise<string | null | undefined> {
  try {
    return await studioPress.readToken(true);
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "press" } });
    return null;
  }
}

/** "Light Codes, Metro Craft, 989 Pacific St, Crown Heights, Brooklyn, 2025". */
const cvLine = (e: CvEntry): string =>
  [e.title, e.venue, e.location, e.year].filter(Boolean).join(", ");

export default async function PressPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!pressTokenMatches(token, await currentToken())) notFound();

  const [overlays, shows] = await Promise.all([savedOverlays("press"), savedShows("press")]);
  const kit = pressKit({
    works: mergeAll(artworks, overlays),
    cv,
    shows,
    statement: site.statementLong,
    now: new Date(),
    timeZone: artistConfig.timeZone,
  });
  const count = kit.works.length;

  return (
    <div data-ground="stark" className="d-page d-viewer">
      <header className="d-head">
        <h1 className="d-name">Press</h1>
        <p className="d-locator">{`${site.name}, oil painter, ${site.location}`}</p>
        {kit.cv.education.length > 0 ? (
          <p className="d-press-cv">
            <span className="d-sname">Education</span>
            {kit.cv.education.map((e) => (
              <Fragment key={`${e.what}-${e.where ?? ""}`}>
                <span className="d-dot" aria-hidden="true" />
                <span>{[e.what, e.where, e.year].filter(Boolean).join(", ")}</span>
              </Fragment>
            ))}
          </p>
        ) : null}
        {cvSections(kit.cv).map((section) => (
          <p className="d-press-cv" key={section.id}>
            <span className="d-sname">{section.heading}</span>
            {newestFirst(section.entries).map((e) => (
              <Fragment key={`${e.year}-${e.title}`}>
                <span className="d-dot" aria-hidden="true" />
                <span>{cvLine(e)}</span>
              </Fragment>
            ))}
          </p>
        ))}
      </header>

      <p className="d-press-label d-press-wide" id="press-count">
        {`Works and prices · ${count} ${count === 1 ? "work" : "works"}`}
      </p>
      {count > 0 ? (
        <section id="press-works" aria-labelledby="press-count">
          <div className="d-press-cards" id="press-cards">
            {kit.works.map(({ work, image }, i) => {
              const shape = shapeOf(work.slug);
              const line = kit.priceList.find((p) => p.slug === work.slug);
              const medium = [
                formatMediumLine(work),
                formatDimensionsLine(work) || "size not recorded yet",
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <div className="d-press-card" key={work.slug}>
                  <figure>
                    <Image
                      src={boardSrc(work.slug, 1280)}
                      alt={work.alt}
                      width={shape.w}
                      height={shape.h}
                      sizes="300px"
                      loading={i < 3 ? "eager" : "lazy"}
                    />
                  </figure>
                  <p className="d-press-name">{labelTitle(work)}</p>
                  <p className="d-press-medium">{medium}</p>
                  {line ? <p className="d-press-price">{formatPriceLine(line)}</p> : null}
                  <a className="d-press-dl" href={image} download>
                    <span>Download high-resolution image</span>
                  </a>
                </div>
              );
            })}
          </div>
          <SideScroll target="press-cards" count={count} />
        </section>
      ) : null}

      {kit.statement ? (
        <section className="d-column" id="press-statement">
          <p className="d-press-label">Statement</p>
          <blockquote className="d-press-statement">
            {kit.statement.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <cite>{site.name}</cite>
          </blockquote>
        </section>
      ) : null}

      <DFoot />
    </div>
  );
}
```

- [ ] **Step 3: Add the press page's rules to the stylesheet**

Append to the end of `src/app/globals.css`:

```css
/* ---- the press page ---- */
.d-press-cv {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.7rem;
  margin: 1rem 0 0;
  font-size: 0.95rem;
  color: #333;
}
.d-press-label {
  margin: clamp(40px, 7vh, 80px) 0 12px;
  font-size: 0.8125rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.d-press-wide {
  padding: 0 var(--d-pad);
}
.d-press-cards {
  display: flex;
  gap: var(--d-pad);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--d-pad);
  padding: 0 var(--d-pad) 12px;
  scrollbar-width: thin;
}
.d-press-card {
  flex: 0 0 calc((100vw - 4 * var(--d-pad)) / 3);
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
@media (max-width: 760px) {
  .d-press-card {
    flex-basis: calc(100vw - 2 * var(--d-pad));
  }
}
.d-press-card figure {
  margin: 0;
  height: min(300px, 70vw);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}
.d-press-card img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}
.d-press-name {
  margin: 0.4rem 0 0;
  font-size: 0.8125rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.d-press-medium {
  margin: 0;
  font-size: 0.86rem;
  color: #5c5c5c;
}
.d-press-price {
  margin: 0;
  font-size: 1rem;
}
.d-press-dl {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 0.8125rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  text-decoration: none;
  color: #131313;
}
.d-press-dl span {
  border-bottom: 1px solid #131313;
  padding-bottom: 2px;
}
.d-press-dl:hover span {
  border-bottom-width: 2px;
}
.d-press-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0;
  padding: 14px var(--d-pad) 0;
  text-align: center;
}
.d-press-step {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border: 1px solid #d8d8d8;
  border-radius: 50%;
  background: #fff;
  color: #131313;
  font: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}
.d-press-step:hover {
  border-color: #131313;
}
.d-press-statement {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.7;
  color: #333;
}
.d-press-statement p {
  margin: 0 0 1em;
}
.d-press-statement cite {
  display: block;
  font-style: normal;
  font-size: 0.8125rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5c5c5c;
}
```

- [ ] **Step 4: Verify it builds**

Run:

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src && pnpm exec biome check src 2>&1 | tail -3 && pnpm typecheck 2>&1 | tail -3 && pnpm test 2>&1 | grep -E "Test Files|Tests " && env KV_REST_API_URL= KV_REST_API_TOKEN= NEXT_TELEMETRY_DISABLED=1 pnpm build 2>&1 | grep -E "press|shows|Error|error|Failed" | head -10
```

Expected: clean; `Tests  72 passed (72)`; the route table lists `ƒ /press/[token]` and `● /shows/[slug]`.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/components/SideScroll.tsx "src/app/press/[token]/page.tsx" src/app/globals.css && git -c commit.gpgsign=false commit -m "Press: the unlisted press page for galleries"
```

---

### Task 11: Julian: the studio makes or replaces the press link

**Files:**
- Create: `src/app/api/studio/press/route.ts`
- Modify: `src/app/studio/page.tsx` (whole file below), `src/app/studio/StudioClient.tsx`

**Interfaces:**
- Consumes: the kit's `pressHandler`; Task 6's `studioPress`; `readStudioReply` (`@/lib/studio-reply`, already imported by `StudioClient.tsx`).
- Produces: `GET` and `POST` at `/api/studio/press` (kit semantics, Task 5); `StudioClient` gains props `pressToken: string | null` and `siteUrl: string`; the desk's last section, "Press link", shows the whole link in a read-only field with a Copy button, and one button that makes the first link or replaces it (with a plain confirmation, because replacing it ends the old link for every gallery holding it). The desk counts as ready only when the overlay, shows and press stores are all connected; otherwise it still shows its one "No store is connected" notice, unchanged (this closes the ledger's "no store connected" follow-up for the press link too).

- [ ] **Step 1: The route**

Create `src/app/api/studio/press/route.ts`:

```ts
import { pressHandler } from "@iserlabs/web-kit/artist";
import * as Sentry from "@sentry/nextjs";
import { studioAuth, studioPress } from "@/lib/studio";

/**
 * The press link: GET reads the current token, POST makes a new one, which retires
 * the old address at once. The handler (cookie check, token, plain-words answers)
 * lives in the kit; this file wires Julian's door and store to it.
 */
const press = pressHandler({
  auth: studioAuth,
  store: studioPress,
  // A store failure answers the studio with a plain 503; this is how it also reaches Sentry.
  onError: (error, { method }) => {
    Sentry.captureException(error, { tags: { route: "studio-press", method } });
  },
});

export const GET = press.GET;
export const POST = press.POST;
```

- [ ] **Step 2: The studio page reads the token**

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
import { site } from "@/content/site";
import { studioAuth, studioPress, studioShows, studioStore } from "@/lib/studio";
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
    studioStore.configured() && studioShows.configured() && studioPress.configured()
      ? "ready"
      : "none";
  let overlays: Record<string, ArtworkOverlay> = {};
  let shows: ShowRecord[] = [];
  let pressToken: string | null = null;
  if (role && storeState === "ready") {
    try {
      overlays = (await studioStore.readOverlays(true)) ?? {};
      shows = (await studioShows.readShows(true)) ?? [];
      pressToken = (await studioPress.readToken(true)) ?? null;
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
      pressToken={pressToken}
      siteUrl={site.url}
    />
  );
}
```

- [ ] **Step 3: The Press section on the desk**

In `src/app/studio/StudioClient.tsx`, replace:

```tsx
 * Shows sit below the works. Julian types each show's facts himself, because they
 * are his: a show stays held back until he publishes it, and it can list only works
 * in his catalog.
```

with:

```tsx
 * Shows sit below the works. Julian types each show's facts himself, because they
 * are his: a show stays held back until he publishes it, and it can list only works
 * in his catalog.
 *
 * The press link comes last: the address of his private page for galleries, shown
 * whole so it can be copied, and replaced with one button when he wants the old one
 * to stop working.
```

Replace:

```tsx
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
```

with:

```tsx
export default function StudioClient({
  role,
  configured,
  records,
  shows,
  storeState,
  pressToken,
  siteUrl,
}: {
  role: string | null;
  configured: boolean;
  records: Record[];
  shows: ShowRecord[];
  storeState: StoreState;
  pressToken: string | null;
  siteUrl: string;
}) {
  if (!role) return <Door configured={configured} />;
  return (
    <Desk
      role={role}
      records={records}
      shows={shows}
      storeState={storeState}
      pressToken={pressToken}
      siteUrl={siteUrl}
    />
  );
}
```

Replace:

```tsx
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
```

with:

```tsx
function Desk({
  role,
  records,
  shows,
  storeState,
  pressToken,
  siteUrl,
}: {
  role: string;
  records: Record[];
  shows: ShowRecord[];
  storeState: StoreState;
  pressToken: string | null;
  siteUrl: string;
}) {
```

Replace:

```tsx
          <Shows shows={shows} works={records} />
```

with:

```tsx
          <Shows shows={shows} works={records} />

          <Press token={pressToken} siteUrl={siteUrl} />
```

Append to the end of the file:

```tsx

/** The address of the press page, and the one button that makes it or replaces it. */
function Press({ token, siteUrl }: { token: string | null; siteUrl: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link = token ? `${siteUrl.replace(/\/+$/, "")}/press/${token}` : "";

  let action = "Make the press link";
  if (token) action = "Make a new link";
  if (busy) action = "Making";

  async function make() {
    if (
      token &&
      !window.confirm(
        "Make a new press link? The current link stops working at once, for everyone who has it.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/studio/press", { method: "POST" });
      const reply = await readStudioReply<{ error?: string; token?: string }>(
        res,
        "That did not work.",
      );
      if (!reply.ok) throw new Error(reply.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Could not copy the link. Select it and copy it by hand.");
    }
  }

  return (
    <section className="mt-10" aria-labelledby="press-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="press-heading" className="display-m">
          Press link
        </h2>
        <button
          type="button"
          onClick={make}
          disabled={busy}
          className="btn min-h-[48px] disabled:opacity-60"
        >
          {action}
        </button>
      </div>

      <p className="mt-4 max-w-2xl text-[0.95rem] text-[var(--color-ink-faint)]">
        One private page for galleries: your statement, your CV, every published work with a
        download of its largest image, and the price list, on-request prices included. Search
        engines are asked to leave it out. A new link retires the old one at once, for everyone who
        has it.
      </p>

      {token ? (
        <div className="mt-4">
          <label className="block">
            <span className="block text-[0.85rem] text-[var(--color-ink-faint)]">
              The link to send
            </span>
            <input
              type="text"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 min-h-[44px] w-full border-b border-[var(--color-line)] bg-transparent py-2 text-[16px]"
            />
          </label>
          <button type="button" onClick={copy} className="btn mt-4 min-h-[48px]">
            Copy link
          </button>
          {copied ? (
            <p className="pb-3 text-[0.85rem] text-[var(--color-code-green,#3c6b4a)]">Copied.</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 max-w-2xl text-[0.95rem] text-[var(--color-ink-faint)]">
          No press link yet.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-[0.9rem] text-[var(--color-code-red)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
```

Every class name above already appears in `StudioClient.tsx` (the Shows section and its form), so Tailwind generates nothing new; Task 12 proves it.

- [ ] **Step 4: Verify**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src && pnpm exec biome check src 2>&1 | tail -3 && pnpm typecheck 2>&1 | tail -3 && pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: clean; `Tests  72 passed (72)`.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add src/app/api/studio/press/route.ts src/app/studio/page.tsx src/app/studio/StudioClient.tsx && git -c commit.gpgsign=false commit -m "Studio: make or replace the press link"
```

---

### Task 12: Julian: prove that, with the store blank, every existing page is unchanged

**Files:**
- Modify: `scripts/qa/render-snapshot.mjs`
- Create (gitignored): `.qa/F/`

**Interfaces:**
- Consumes: everything from Tasks 6 to 11; baselines `.qa/E2` (Task 6) and `.qa/E` (phase 2a).
- Produces: snapshot `.qa/F` with `press-api.json`, `extra.json` and `extra/` (sitemap, robots, two unlisted addresses); `.qa/F/check-home.txt` (the design check's homepage baseline for Task 14); the comparison verdicts; the green gate in both repos.

The intended differences, and the only ones allowed, with the store blank:
1\) `routes.txt` gains exactly three lines: `ƒ /api/studio/press`, `ƒ /press/[token]`, `● /shows/[slug]`.
2\) `css.txt` gains only the new rules, every one under `.d-viewer`, `.d-dot`, `.d-show-*`, `.d-onview` or `.d-press-*` (plus the bare closing brace lines of their `@media` and `@supports` blocks), and loses nothing.
3\) New files only: `press-api.json`, `extra.json`, `extra/`.
Everything else equals E2 byte for byte: all eight pages (the homepage, `/work`, an artwork page, `/cv`, `/about`, `/inquire`, the studio door and the signed-in desk), `headers.json`, `api.json`, `shows-api.json`, and the 60-second or built-once state of every prerendered route.

- [ ] **Step 1: The snapshot probes the press API and the unlisted addresses, each in a file of its own**

In `scripts/qa/render-snapshot.mjs`, replace:

```js
 *   shows-api.json      every shows API answer, kept apart so api.json still compares
```

with:

```js
 *   shows-api.json      every shows API answer, kept apart so api.json still compares
 *   press-api.json      every press link API answer, kept apart for the same reason
 *   extra.json, extra/  the sitemap, robots.txt, an unknown show and an unknown press
 *                       address, kept out of pages/ so pages/ still compares
```

Replace:

```js
// Every page, and the cache policy it is served with: a page that turns dynamic shows up here.
```

with:

```js
// The press link API, in a file of its own as well.
const pressCall = (method, token) =>
  fetch(new URL("/api/studio/press", base), {
    method,
    redirect: "manual",
    headers: { "content-type": "application/json", ...cookieHeader(token) },
  });
const pressApi = [];
pressApi.push(await record("press GET, no cookie", await pressCall("GET")));
pressApi.push(await record("press POST, no cookie", await pressCall("POST")));
const pressGetJulian = await pressCall("GET", julian);
// The same refusal again: the next call would write a press token to a live store.
{
  const probe = await pressGetJulian
    .clone()
    .json()
    .catch(() => null);
  if (probe?.configured !== false) {
    console.error(
      "The press store is live (press GET says configured: " +
        `${probe?.configured ?? "unreadable"}). ` +
        "This script would write a press token, so the store must be blanked: " +
        "start the server with KV_REST_API_URL= and KV_REST_API_TOKEN= set empty.",
    );
    process.exit(1);
  }
}
pressApi.push(await record("press GET, julian", pressGetJulian));
pressApi.push(await record("press POST, julian, store off", await pressCall("POST", julian)));

// Every page, and the cache policy it is served with: a page that turns dynamic shows up here.
```

Replace:

```js
await capture("/studio, signed in", "studio-desk", "/studio", julian);
```

with:

```js
await capture("/studio, signed in", "studio-desk", "/studio", julian);

// The sitemap, robots.txt and two addresses that must not open, kept out of pages/.
await mkdir(join(out, "extra"), { recursive: true });
const extra = {};
for (const [label, file, path] of [
  ["/sitemap.xml", "sitemap.xml", "/sitemap.xml"],
  ["/robots.txt", "robots.txt", "/robots.txt"],
  ["/shows/qa-no-such-show", "show-missing.html", "/shows/qa-no-such-show"],
  ["/press/<a well-formed token nobody set>", "press-unknown.html", `/press/${"A".repeat(43)}`],
]) {
  const res = await page(path);
  extra[label] = {
    status: res.status,
    contentType: res.headers.get("content-type"),
    cacheControl: res.headers.get("cache-control"),
  };
  await writeFile(join(out, "extra", file), normalize(await res.text()));
}
```

Replace:

```js
await writeFile(join(out, "shows-api.json"), `${JSON.stringify(showsApi, null, 2)}\n`);
```

with:

```js
await writeFile(join(out, "shows-api.json"), `${JSON.stringify(showsApi, null, 2)}\n`);
await writeFile(join(out, "press-api.json"), `${JSON.stringify(pressApi, null, 2)}\n`);
await writeFile(join(out, "extra.json"), `${JSON.stringify(extra, null, 2)}\n`);
```

Replace:

```js
  `snapshot ${out}: ${ROUTES.length + 1} pages, ${api.length} studio API answers, ${showsApi.length} shows API answers, ${stylesheets.length} stylesheets`,
```

with:

```js
  `snapshot ${out}: ${ROUTES.length + 1} pages, ${api.length} studio API answers, ${showsApi.length} shows API answers, ${pressApi.length} press API answers, ${Object.keys(extra).length} unlisted addresses, ${stylesheets.length} stylesheets`,
```

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write scripts/qa/render-snapshot.mjs && pnpm exec biome check scripts src 2>&1 | tail -3`
Expected: clean.

- [ ] **Step 2: Build F with the store blanked**

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/F && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/F/build.log 2>&1; tail -5 .qa/F/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/F/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/F/routes.txt && cp .next/prerender-manifest.json .qa/F/prerender-manifest.json && (lsof -ti tcp:3111 || echo free)
```

Expected: the build succeeds; `free`.

- [ ] **Step 3: Snapshot F, and record the design check's homepage baseline**

Start the server in the background (`run_in_background: true`):

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3111
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/F && node ~/.claude/shared/design-check/check.mjs http://localhost:3111/ --repo /Users/macbook/Claude/julianpotulicki > .qa/F/check-home.txt 2>&1; tail -12 .qa/F/check-home.txt; kill -9 $(lsof -ti tcp:3111)
```

Expected: `snapshot .qa/F: 8 pages, 11 studio API answers, 4 shows API answers, 4 press API answers, 4 unlisted addresses, ...`. The design check prints its table for the unchanged homepage; whatever it says (the live record type is under 13px on phones and may fail the text floor) is the baseline, and this phase changes none of it.

- [ ] **Step 4: Compare F with E2 and E**

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && diff -r E2/pages F/pages && diff E2/headers.json F/headers.json && diff E2/api.json F/api.json && diff E2/shows-api.json F/shows-api.json && echo "PAGES, CACHE POLICY AND STUDIO APIS UNCHANGED" && diff -r -x studio.html -x studio-desk.html E/pages F/pages && echo "PUBLIC PAGES MATCH .qa/E TOO"
```

Expected: the two lines print and nothing else does.

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && echo "removed: $(diff E2/css.txt F/css.txt | grep -c '^<')" && echo "added outside the new rules: $(diff E2/css.txt F/css.txt | grep '^>' | grep -vcE '\.d-(viewer|dot|show-|onview|press-)|^> ?\}?$')" && echo "added: $(diff E2/css.txt F/css.txt | grep -c '^>')"
```

Expected: `removed: 0`, `added outside the new rules: 0`, and a positive `added`. If a line was removed, look at it: the only acceptable case is an existing `@media` block the stylesheet tool merged a new `.d-` rule into, which then shows the old line removed and the merged line added (inspect with `diff E2/css.txt F/css.txt | head -40` and record it). Any other change means a word in new source made Tailwind generate a utility: find the word, rephrase it, rebuild from Step 2.

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && diff <(LC_ALL=en_US.UTF-8 grep -vE ' /(api/studio/press|press/\[token\]|shows/\[slug\])$' F/routes.txt) E2/routes.txt && LC_ALL=en_US.UTF-8 grep -E ' /(api/studio/press|press/\[token\]|shows/\[slug\])$' F/routes.txt && node -e 'const a=require("./E2/prerender-manifest.json").routes,b=require("./F/prerender-manifest.json").routes;for (const r of ["/","/cv","/sitemap.xml","/work/light-language-red"]) console.log(r, a[r]?.initialRevalidateSeconds, b[r]?.initialRevalidateSeconds)'
```

Expected: no diff, then exactly `ƒ /api/studio/press`, `ƒ /press/[token]`, `● /shows/[slug]`, then:

```
/ false false
/cv false false
/sitemap.xml false false
/work/light-language-red 60 60
```

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && node -e 'for (const [k,v] of Object.entries(require("./F/extra.json"))) console.log(v.status, k); for (const r of require("./F/press-api.json")) console.log(r.status, r.name, JSON.stringify(r.body))' && grep -c '<loc>' F/extra/sitemap.xml; grep -cE '/shows/|/press' F/extra/sitemap.xml F/extra/robots.txt; true
```

Expected:

```
200 /sitemap.xml
200 /robots.txt
404 /shows/qa-no-such-show
404 /press/<a well-formed token nobody set>
401 press GET, no cookie {"error":"locked"}
401 press POST, no cookie {"error":"locked"}
200 press GET, julian {"configured":false,"token":null}
503 press POST, julian, store off {"error":"No store is connected, so nothing would be saved."}
39
F/extra/sitemap.xml:0
F/extra/robots.txt:0
```

(39 = the five core pages and the 34 artwork pages, as before.) Any other difference: stop and use superpowers:systematic-debugging.

- [ ] **Step 5: The required audit, with the store blanked**

```bash
cd /Users/macbook/Claude/julianpotulicki && (lsof -ti tcp:3100 || echo "3100 free") && env KV_REST_API_URL= KV_REST_API_TOKEN= pnpm wk:audit > .qa/F/wk-audit.txt 2>&1; tail -5 .qa/F/wk-audit.txt; diff <(grep -iE 'pass|fail|error|ok' .qa/C/wk-audit.txt) <(grep -iE 'pass|fail|error|ok' .qa/F/wk-audit.txt) && echo "AUDIT VERDICT UNCHANGED"
```

Expected: `3100 free`, `web-kit audit (required): OK`, `AUDIT VERDICT UNCHANGED`.

- [ ] **Step 6: Full gate in both repos**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm exec biome check src scripts 2>&1 | tail -3 && cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3
```

Expected: Julian `Tests  72 passed (72)`; kit `Tests  536 passed (536)`; every typecheck and lint clean. (Julian's repo-wide `pnpm lint` also reads the untracked `docs/boards/` JSON, which is why the check is scoped to `src scripts`.)

- [ ] **Step 7: Writing checks on everything both branches added**

```bash
cd /Users/macbook/Claude/julianpotulicki && git diff a7c150c -- src scripts | grep '^+' | grep -c $'\xe2\x80\x94'; git diff a7c150c -- src scripts | grep '^+' | grep -inE 'catalogu[e]|fulfilmen[t]|behavio[u]r|colo[u]r|honou[r]|favou[r]|defenc[e]|artefac[t]|organi[s]e|recogni[s]e|centr[e]\b|centimetr[e]'; git log a7c150c..HEAD --format='%B' | grep -icE 'claude|co-authored|generated with'; cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git diff e81c946 -- src CHANGELOG.md | grep '^+' | grep -c $'\xe2\x80\x94'; git log e81c946..HEAD --format='%B' | grep -icE 'claude|co-authored|generated with'
```

Expected: `0`, no spelling lines, `0`, `0`, `0`.

- [ ] **Step 8: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add scripts/qa/render-snapshot.mjs && git status --short && git -c commit.gpgsign=false commit -m "QA: the snapshot probes the press API and the unlisted addresses on their own"
```

Expected before the commit: only `scripts/qa/render-snapshot.mjs` staged; ` M .gitignore`, ` M docs/superpowers/RESUME-julian.md`, `?? docs/boards/` untouched; nothing under `.qa/` (ignored).

---

### Task 13: Julian: end to end against the local stand-in, with a published current show and a held-back one

**Files:**
- Create (gitignored, never committed): `.qa/seed-stand-in.mjs`, `.qa/public-e2e.mjs`, `.qa/G/`
- Uses: `.qa/stand-in-kv.mjs` (exists, from phase 2a)

**Interfaces:**
- Consumes: the whole site; `.qa/E2/pages/` and `.qa/F/extra/robots.txt` as references.
- Produces: build G (the stand-in seeded before the build, so the homepage, CV, sitemap and show pages are prerendered from it); `.qa/G/seeded.json`; the end-to-end verdict; `.qa/G/press-token.txt` (the live stand-in token, for Task 14's screenshots); a running stand-in on 8079 and server on 3113.

This is one of only two tasks that run with a store, and the store is a 30-line local process holding obviously fake facts. The seed script refuses any address but `127.0.0.1`, and the end-to-end script refuses to write anything until it has proven every store call so far went to the stand-in and to one of Julian's three keys.

The seeded facts (all fake, all in the stand-in's memory only):
1\) "QA Current Show", group, Test Gallery, 1 Test Street, Test City, from five days ago to twenty days ahead (New York days), opening on its first day 18:00 to 21:00, a gallery page on `gallery.example.test`, a one-line note, published, hanging seven slugs: five published works, `floral-01` (held back by an overlay) and `qa-missing-work` (not in the catalog).
2\) "QA Held Show", solo, Held Test Venue, current dates, hanging `portrait-ruff`, held back.
3\) "QA Past Show", solo, Past Test Venue, January 10 to February 10, 2025, hanging `abstract-02`, published.
4\) Overlays: `floral-01` held back; `waterscape-03` available at a public 1000; `colorfield-04` available at 2000 on request; `floral-03` sold. `light-language-red` carries no overlay, so its page can be compared with E2.

- [ ] **Step 1: The seed script**

Create `.qa/seed-stand-in.mjs`:

```js
// Seeds the local stand-in store with obviously fake shows and edits, for one local check.
// Writes only to 127.0.0.1. Never deployed, never committed.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const store = process.argv[2] ?? "http://127.0.0.1:8079";
const out = process.argv[3] ?? ".qa/G/seeded.json";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(store)) {
  console.error(`Refusing to seed ${store}: only a stand-in on 127.0.0.1 may be seeded.`);
  process.exit(1);
}

// Today as a New York calendar day, and calendar arithmetic on it (no clock involved).
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (date, days) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const current = {
  slug: "qa-current-show",
  title: "QA Current Show",
  kind: "group",
  venue: "Test Gallery",
  address: "1 Test Street",
  city: "Test City",
  startsOn: shift(today, -5),
  endsOn: shift(today, 20),
  opening: { on: shift(today, -5), from: "18:00", to: "21:00" },
  workSlugs: [
    "light-language-red",
    "waterscape-06",
    "colorfield-02",
    "floral-01",
    "geometric-01",
    "waterscape-09",
    "qa-missing-work",
  ],
  href: "https://gallery.example.test/qa-current-show",
  note: "A test line, printed as typed.",
  publish: "published",
};
const held = {
  slug: "qa-held-show",
  title: "QA Held Show",
  kind: "solo",
  venue: "Held Test Venue",
  city: "Test City",
  startsOn: shift(today, -2),
  endsOn: shift(today, 30),
  workSlugs: ["portrait-ruff"],
  publish: "draft",
};
const past = {
  slug: "qa-past-show",
  title: "QA Past Show",
  kind: "solo",
  venue: "Past Test Venue",
  city: "Test City",
  startsOn: "2025-01-10",
  endsOn: "2025-02-10",
  workSlugs: ["abstract-02"],
  publish: "published",
};
const overlays = {
  "floral-01": { publish: "draft" },
  "waterscape-03": {
    availability: "available",
    price: { amount: 1000, currency: "USD", visibility: "public" },
  },
  "colorfield-04": {
    availability: "available",
    price: { amount: 2000, currency: "USD", visibility: "on-request" },
  },
  "floral-03": { availability: "sold" },
};

async function set(key, value) {
  const res = await fetch(`${store}/set/${key}`, { method: "POST", body: JSON.stringify(value) });
  if (!res.ok) throw new Error(`the stand-in refused ${key}: ${res.status}`);
}
await set("studio:julian:shows", { [current.slug]: current, [held.slug]: held, [past.slug]: past });
await set("studio:julian:overlays", overlays);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ today, current, held, past }, null, 2)}\n`);
console.log(
  `seeded ${store}: 3 shows (current ${current.startsOn} to ${current.endsOn}), 4 overlays`,
);
```

- [ ] **Step 2: The end-to-end script**

Create `.qa/public-e2e.mjs`:

```js
// The public show, notice, artwork, CV and press pages, end to end, against the stand-in.
// Run against a build made with the stand-in seeded. Gitignored, never deployed.
import { readFileSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3113";
const log = process.argv[3] ?? ".qa/stand-in-kv.log";
const seeded = JSON.parse(readFileSync(process.argv[4] ?? ".qa/G/seeded.json", "utf8"));
const ORIGIN = "https://julianpotulicki.com";
const KEYS = /^(GET \/get|POST \/set)\/studio:julian:(overlays|shows|press)$/;

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};
const get = async (path, init = {}) => {
  const res = await fetch(new URL(path, base), { redirect: "manual", ...init });
  const raw = await res.text();
  // React separates adjacent text with empty comments; drop them before reading words.
  return { status: res.status, raw, text: raw.replaceAll("<!-- -->", "") };
};
const ldNodes = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .flatMap((b) => b["@graph"] ?? [b]);

// The snapshot script's own normalizing, so a page compares with .qa/E2 file for file.
const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
function maskSentry(html) {
  return html
    .replace(/(<meta name="sentry-trace" content=")[^"]*(")/g, "$1SENTRY-TRACE$2")
    .replace(
      /(<meta name="baggage" content="[^"]*?)sentry-trace_id=[0-9a-f]+/g,
      "$1sentry-trace_id=SENTRY-TRACE-ID",
    )
    .replace(
      /(<meta name="baggage" content="[^"]*?)sentry-sample_rand=[0-9.]+/g,
      "$1sentry-sample_rand=SENTRY-SAMPLE-RAND",
    );
}
function normalize(html) {
  const stripped = html
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (whole, attrs, body) =>
      /\bsrc="\/_next\//.test(attrs) || body.includes("self.__next_f") ? "" : whole,
    )
    .replace(/<link\b[^>]*\bas="script"[^>]*>/g, "")
    .replace(/\/_next\/static\/[^"'\s)]+/g, "/_next/static/X");
  return maskSentry(buildId ? stripped.replaceAll(buildId, "BUILD_ID") : stripped);
}

// The run in words, the way the kit prints it, from the seeded calendar dates.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function runWords(startsOn, endsOn) {
  const [ay, am, ad] = startsOn.split("-").map(Number);
  const [by, bm, bd] = endsOn.split("-").map(Number);
  const R = " – ";
  if (startsOn === endsOn) return `${MONTHS[am - 1]} ${ad}, ${ay}`;
  if (ay !== by) return `${MONTHS[am - 1]} ${ad}, ${ay}${R}${MONTHS[bm - 1]} ${bd}, ${by}`;
  if (am !== bm) return `${MONTHS[am - 1]} ${ad}${R}${MONTHS[bm - 1]} ${bd}, ${by}`;
  return `${MONTHS[am - 1]} ${ad}${R}${bd}, ${by}`;
}
const dates = runWords(seeded.current.startsOn, seeded.current.endsOn);
const hanging = ["light-language-red", "waterscape-06", "colorfield-02", "geometric-01", "waterscape-09"];

// 0. Before anything is written: every store call so far went to the stand-in, to Julian's keys.
const seen = readFileSync(log, "utf8").trim().split("\n");
check("the build and the server read the stand-in", seen.includes("GET /get/studio:julian:shows"));
check("every store call so far went to one of Julian's three keys", seen.every((l) => KEYS.test(l)));
if (failures > 0) {
  console.error("Stop: the server may not be talking to the stand-in. Nothing was written.");
  process.exit(1);
}

// 1. The homepage.
const home = await get("/");
check("home answers 200", home.status === 200);
check("home carries the on-view line", home.text.includes("<span>On view at Test Gallery</span>"));
check("home line prints the run", home.text.includes(`<span>${dates}</span>`));
check("home line links the show", home.raw.includes('<a href="/shows/qa-current-show"><span>The show</span></a>'));
for (const word of ["QA Held Show", "Held Test Venue", "Past Test Venue"]) {
  check(`home never names ${word}`, !home.text.includes(word));
}
const homeQuiet = normalize(home.raw)
  .replace(/\n\/\* ---- the show line[\s\S]*?(?=<\/style>)/, "")
  .replace(/\n {2}<div class="shownote" id="on-view">[\s\S]*?<\/div>/, "");
check("home is E2's homepage plus the line and its styles, nothing else", homeQuiet === readFileSync(".qa/E2/pages/home.html", "utf8"));

// 2. The show page.
const show = await get("/shows/qa-current-show");
check("show page answers 200", show.status === 200);
check("show title", show.text.includes('<h1 class="d-name">QA Current Show</h1>'));
check("show locator: venue, city and the run", show.text.includes(`Test Gallery, Test City · ${dates}`));
check("show address", show.text.includes("<span>1 Test Street, Test City</span>"));
check("show opening, on a 12-hour clock", show.text.includes("<span>Opening ") && show.text.includes(", 6 to 9 PM</span>"));
check("show note, verbatim", show.text.includes("A test line, printed as typed."));
check("show links the gallery's own page", show.raw.includes('href="https://gallery.example.test/qa-current-show"'));
check("show canonical", show.raw.includes(`<link rel="canonical" href="${ORIGIN}/shows/qa-current-show"/>`));
for (const slug of hanging) check(`show hangs ${slug}, linked to its page`, show.raw.includes(`href="/work/${slug}"`));
check("show leaves out the held-back work", !show.raw.includes("/work/floral-01") && !show.raw.includes("floral-01-"));
check("show leaves out the slug the catalog lacks", !show.raw.includes("qa-missing-work"));
check("show counts its paintings", show.text.includes(`1 / ${hanging.length}`));
const event = ldNodes(show.raw).find((n) => n["@type"] === "ExhibitionEvent");
check("show carries an ExhibitionEvent", Boolean(event));
if (event) {
  check("event: schema.org context", event["@context"] === "https://schema.org");
  check("event: name and page", event.name === "QA Current Show" && event.url === `${ORIGIN}/shows/qa-current-show`);
  check("event: the calendar dates as stored", event.startDate === seeded.current.startsOn && event.endDate === seeded.current.endsOn);
  check("event: in person", event.eventAttendanceMode === "https://schema.org/OfflineEventAttendanceMode");
  check(
    "event: the place",
    event.location?.["@type"] === "Place" &&
      event.location?.name === "Test Gallery" &&
      event.location?.address?.streetAddress === "1 Test Street" &&
      event.location?.address?.addressLocality === "Test City",
  );
  check("event: the artist, by the site's own Person", event.performer?.["@id"] === `${ORIGIN}/#person` && event.performer?.name === "Julian Potulicki");
  check("event: one image per painting shown", Array.isArray(event.image) && event.image.length === hanging.length && event.image.every((u) => u.startsWith(`${ORIGIN}/board/`)));
  check(
    "event: the works shown, each by its own page's @id, and no others",
    JSON.stringify(event.workFeatured.map((w) => w["@id"])) === JSON.stringify(hanging.map((s) => `${ORIGIN}/work/${s}#artwork`)),
  );
  check("event: the gallery's page and the note", event.sameAs === "https://gallery.example.test/qa-current-show" && event.description === "A test line, printed as typed.");
  check("event: no status claimed", !("eventStatus" in event));
}

// 3. The artwork pages.
const red = await get("/work/light-language-red");
check("artwork page says where it hangs", red.text.includes("<span>On view at Test Gallery</span>") && red.raw.includes('href="/shows/qa-current-show"'));
const redQuiet = normalize(red.raw).replace(/<p class="d-avail d-onview">[\s\S]*?<\/p>/, "");
check("artwork page is E2's page plus that one line, nothing else", redQuiet === readFileSync(".qa/E2/pages/work_light-language-red.html", "utf8"));
check("the show names the work by the @id its own page gives it", ldNodes(red.raw).some((n) => n["@id"] === `${ORIGIN}/work/light-language-red#artwork`));
for (const slug of ["portrait-ruff", "abstract-02"]) {
  const page = await get(`/work/${slug}`);
  check(`no on-view line on ${slug} (a held-back show, a past show)`, page.status === 200 && !page.text.includes("On view at"));
}

// 4. The CV, the sitemap and robots.txt.
const cvPage = await get("/cv");
check("CV carries the current and the past show", cvPage.text.includes("QA Current Show") && cvPage.text.includes("QA Past Show"));
check("CV never names the held-back show", !cvPage.text.includes("QA Held Show"));
const sitemap = await get("/sitemap.xml");
check("sitemap lists both published shows", sitemap.raw.includes(`${ORIGIN}/shows/qa-current-show`) && sitemap.raw.includes(`${ORIGIN}/shows/qa-past-show`));
check("sitemap never lists the held-back show or a press address", !sitemap.raw.includes("qa-held-show") && !sitemap.raw.includes("/press"));
const robots = await get("/robots.txt");
check("robots.txt is unchanged and names no press address", robots.raw === readFileSync(".qa/F/extra/robots.txt", "utf8") && !robots.raw.includes("/press"));

// 5. Held back, past and unknown shows.
check("the held-back show's page is a 404", (await get("/shows/qa-held-show")).status === 404);
check("an unknown show's page is a 404", (await get("/shows/qa-no-such-show")).status === 404);
check("the past show keeps its page", (await get("/shows/qa-past-show")).status === 200);

// 6. The press link, round trip. The first write to the stand-in happens here.
const login = await fetch(new URL("/api/studio/login", base), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ passphrase: "qa-julian-pass" }),
});
const cookie = (login.headers.getSetCookie().find((c) => c.startsWith("jp_studio=")) ?? "").split(";")[0];
check("studio sign-in", Boolean(cookie));
const pressApi = (method) => fetch(new URL("/api/studio/press", base), { method, headers: { cookie } });
check("the press route is locked without a cookie", (await fetch(new URL("/api/studio/press", base), { method: "POST" })).status === 401);
const before = await (await pressApi("GET")).json();
check("no press link before one is made", before.configured === true && before.token === null);
const first = (await (await pressApi("POST")).json()).token;
check("a press link is made", typeof first === "string" && /^[A-Za-z0-9_-]{43}$/.test(first));
const press = await get(`/press/${first}`);
check("the press page opens with the current link", press.status === 200 && press.text.includes('<h1 class="d-name">Press</h1>'));
const robotsMeta = /<meta name="robots" content="([^"]+)"/.exec(press.raw)?.[1] ?? "";
check("the press page asks not to be indexed or followed", robotsMeta.includes("noindex") && robotsMeta.includes("nofollow"));
check("the press page sends no referrer", press.raw.includes('<meta name="referrer" content="no-referrer"/>'));
check("the press page names no canonical address", !press.raw.includes('rel="canonical"'));
check("the press page counts the published works (34, less the one held back)", press.text.includes("Works and prices · 33 works"));
check("a public price prints", press.text.includes(">$1,000<"));
check("an on-request price prints for galleries", press.text.includes(">$2,000 · on request<"));
check("a sold work says sold, without a price", press.text.includes(">Sold<"));
check("an unrecorded work says so", press.text.includes(">Availability not recorded yet<"));
check("a missing size says so", press.text.includes("size not recorded yet"));
check("the held-back work is not in the press kit", !press.raw.includes("floral-01"));
check("the CV carries the published shows and not the held-back one", press.text.includes("QA Current Show") && press.text.includes("Light Codes") && !press.text.includes("QA Held Show"));
const statement = /<blockquote class="d-press-statement">([\s\S]*?)<\/blockquote>/.exec(press.raw)?.[1] ?? "";
check("the statement prints in its four paragraphs", (statement.match(/<p>/g) ?? []).length === 4 && statement.includes("drawn to vibrant color"));
const download = /<a class="d-press-dl" href="([^"]+)" download/.exec(press.raw)?.[1] ?? "";
check("each work offers its high-resolution file", download.startsWith("/works-hi/"));
check("the high-resolution file is served", download !== "" && (await fetch(new URL(download, base), { method: "HEAD" })).status === 200);
const desk = await get("/studio", { headers: { cookie } });
check("the studio shows the whole link", desk.raw.includes(`value="${ORIGIN}/press/${first}"`));
const second = (await (await pressApi("POST")).json()).token;
check("a new link is made", typeof second === "string" && second !== first);
check("the old link is a 404 at once", (await get(`/press/${first}`)).status === 404);
check("the new link opens", (await get(`/press/${second}`)).status === 200);
check("a malformed link is a 404", (await get("/press/not-a-token")).status === 404);
writeFileSync(".qa/G/press-token.txt", `${second}\n`);

// 7. Nothing went anywhere but the stand-in, writes included.
const after = readFileSync(log, "utf8").trim().split("\n");
check("every store call, writes included, went to one of Julian's three keys", after.every((l) => KEYS.test(l)));

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 3: Start the stand-in, seed it, and build G against it**

Check both ports are free (`lsof -ti tcp:8079 || echo free` and `lsof -ti tcp:3113 || echo free` each print `free`), then `rm -f .qa/stand-in-kv.log`, then start the stand-in in the background (`run_in_background: true`):

```bash
cd /Users/macbook/Claude/julianpotulicki && node .qa/stand-in-kv.mjs 8079 .qa/stand-in-kv.log
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/G && node .qa/seed-stand-in.mjs http://127.0.0.1:8079 .qa/G/seeded.json && env KV_REST_API_URL=http://127.0.0.1:8079 KV_REST_API_TOKEN=qa-stand-in STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/G/build.log 2>&1; tail -5 .qa/G/build.log; grep -c '^GET /get/studio:julian:shows$' .qa/stand-in-kv.log; grep -vE '^(GET /get|POST /set)/studio:julian:(overlays|shows|press)$' .qa/stand-in-kv.log | head -3; node -e 'const m=require("./.next/prerender-manifest.json").routes;for (const r of ["/","/cv","/sitemap.xml","/work/light-language-red","/shows/qa-current-show","/shows/qa-past-show","/shows/qa-held-show"]) console.log(r, m[r] ? m[r].initialRevalidateSeconds : "not built")'
```

Expected: `seeded http://127.0.0.1:8079: 3 shows (...), 4 overlays`; the build succeeds; a count of at least `1`; no lines from the key filter; then:

```
/ 60
/cv 60
/sitemap.xml 60
/work/light-language-red 60
/shows/qa-current-show 60
/shows/qa-past-show 60
/shows/qa-held-show not built
```

This is the proof that the homepage line comes down by itself: with a store connected the homepage is rebuilt every 60 seconds, and every rebuild asks `noticeFor` about that moment in New York (the day-after-close rule is proven in Task 6's tests). It is also the proof that the store's abort signal (Task 1) kept every cached read cached. If `/` prints `false`, the fetch did not lower the route's revalidation in this Next version: read `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`, set `export const revalidate = 60` in `src/app/route.ts` (replacing `false`), commit that with a one-line reason, and rerun Task 12 from Step 2, recording any change to `headers.json` for `/` as an intended difference.

- [ ] **Step 4: Run the end-to-end check**

Start the server on the build from Step 3, in the background (`run_in_background: true`):

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL=http://127.0.0.1:8079 KV_REST_API_TOKEN=qa-stand-in STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3113
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node .qa/public-e2e.mjs http://localhost:3113 .qa/stand-in-kv.log .qa/G/seeded.json 2>&1 | tee .qa/G/e2e.txt | grep -vE '^PASS' ; grep -c '^PASS' .qa/G/e2e.txt
```

Expected: the only line not starting with `PASS` is `ALL PASS`, then the count of passing checks (about 75). If the script stops at step 0, kill both processes at once and report it: never retry a write against an unproven store. If "home is E2's homepage" or "artwork page is E2's page" fails, diff the two (`node -e` the normalized page into `.qa/G/` and `diff` it against E2) and treat any difference other than the line itself as a bug.

Leave both processes running for Task 14.

---

### Task 14: Screenshots, the design standard's self-check, then STOP for Jake's look

**Files:**
- Create (gitignored): `.qa/frame.html`, `.qa/G/shots/`, `.qa/G/check-*.txt`, `.qa/G/press-sources.json`, `.qa/G/critic.json`, `.qa/G/review.html`
- Modify (on disk only, never staged): `docs/superpowers/RESUME-julian.md` (Julian), `.superpowers/sdd/progress.md` (kit, gitignored)

**Interfaces:**
- Consumes: build G, the running stand-in (8079) and server (3113), `.qa/G/press-token.txt`, `.qa/F/check-home.txt`, the board's `d3.html`.
- Produces: desktop and 390-wide shots of the show page, the homepage with its line, the artwork page's line and the press page, beside option 3's own surfaces; the section 12 verdicts; the review page opened for Jake; the handback. Nothing ships.

- [ ] **Step 1: Make sure the stand-in and the server are up**

```bash
cd /Users/macbook/Claude/julianpotulicki && (lsof -ti tcp:8079 >/dev/null && echo "stand-in up" || echo "stand-in DOWN") && (lsof -ti tcp:3113 >/dev/null && echo "server up" || echo "server DOWN") && test -s .qa/G/press-token.txt && echo "token on file"
```

Expected: `stand-in up`, `server up`, `token on file`. If either is down (a new session), restart them without rebuilding: start the stand-in as in Task 13 Step 3 (after `rm -f .qa/stand-in-kv.log`), run `node .qa/seed-stand-in.mjs http://127.0.0.1:8079 .qa/G/seeded.json`, start the server as in Task 13 Step 4, and rerun the end-to-end check (it writes a fresh token). If the day has changed since the build, the seed's dates move with it while the prerendered pages keep the build's dates for up to a minute; wait 70 seconds and load each page once before shooting.

- [ ] **Step 2: The screenshot harness**

Headless Chrome on this machine will not lay a page out narrower than about 500px, so a 390 window is a lie. The harness hangs the page in an iframe of the exact width inside a wider window, which is how the round-1 board showed phones.

Create `.qa/frame.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>QA frame</title>
<style>html,body{margin:0;background:#e9e9e6}iframe{display:block;border:0;background:#fff}</style>
<iframe id="f" title="page under test"></iframe>
<script>
  const q = new URLSearchParams(location.search);
  const f = document.getElementById("f");
  f.width = q.get("w") || "390";
  f.height = q.get("h") || "844";
  f.src = q.get("src");
</script>
```

Take the shots:

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/G/shots && TOKEN=$(cat .qa/G/press-token.txt) && CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" && BOARD="file://$PWD/docs/boards/2026-10-13-shows-press-checkout/d3.html" && shot() { src=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$2"); "$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=12000 --window-size="$5" --screenshot="$PWD/.qa/G/shots/$1.png" "file://$PWD/.qa/frame.html?w=$3&h=$4&src=$src" >/dev/null 2>&1; ~/.claude/scripts/qa-shot.sh ".qa/G/shots/$1.png" --out ".qa/G/shots/$1.jpg"; } && \
shot show-desktop "http://localhost:3113/shows/qa-current-show" 1440 900 1460,920 && \
shot show-desktop-full "http://localhost:3113/shows/qa-current-show" 1440 2000 1460,2020 && \
shot show-phone "http://localhost:3113/shows/qa-current-show" 390 844 600,864 && \
shot show-phone-facts "http://localhost:3113/shows/qa-current-show#show-facts" 390 844 600,864 && \
shot home-phone-fold "http://localhost:3113/" 390 844 600,864 && \
shot home-desktop-line "http://localhost:3113/#on-view" 1440 900 1460,920 && \
shot home-phone-line "http://localhost:3113/#on-view" 390 844 600,864 && \
shot work-phone-onview "http://localhost:3113/work/light-language-red" 390 1100 600,1120 && \
shot work-desktop-onview "http://localhost:3113/work/light-language-red" 1440 1500 1460,1520 && \
shot press-desktop "http://localhost:3113/press/$TOKEN" 1440 900 1460,920 && \
shot press-desktop-full "http://localhost:3113/press/$TOKEN" 1440 2600 1460,2620 && \
shot press-phone "http://localhost:3113/press/$TOKEN" 390 844 600,864 && \
shot press-phone-works "http://localhost:3113/press/$TOKEN#press-works" 390 844 600,864 && \
shot press-phone-statement "http://localhost:3113/press/$TOKEN#press-statement" 390 844 600,864 && \
shot board-show-desktop "$BOARD#sf-show" 1440 900 1460,920 && \
shot board-show-phone "$BOARD#sf-show" 390 844 600,864 && \
shot board-notice-phone "$BOARD#sf-notice" 390 844 600,864 && \
shot board-press-desktop "$BOARD#sf-press" 1440 900 1460,920 && \
shot board-press-phone "$BOARD#sf-press" 390 844 600,864 && ls .qa/G/shots/*.jpg | wc -l
```

Expected: 19 jpegs, each printed by `qa-shot.sh` under 50KB.

- [ ] **Step 3: Look at every shot, once each**

Read each `.jpg` (never the `.png`). For every built surface, against its board twin, confirm and write one line each into `.qa/G/look.txt`:
1\) Every painting is whole: no edge cut, correct proportion, inside the window at first paint on the phone.
2\) The page holds option 3's arrangement: title, one locator line, the viewer, the record line with mark and dot, the strip, the facts, the gallery link, the footer (show); the line between the marks and the quote (home); "Press", the CV lines, "Works and prices · 33 works", the sideways cards with price lines and downloads, the step buttons, the statement (press).
3\) No sideways scroll, no clipped text, no new ingredient (no color band, card frame, banner or second face).
4\) The homepage above the marks is unchanged (`home-phone-fold` matches the live homepage).
5\) The artwork page differs only by the "On view at Test Gallery" line under its label.
A shot that is blank or shows an error means the harness or the server failed: fix that and reshoot before judging.

- [ ] **Step 4: The design standard's section 12 self-check**

12.1, the page check, at all 17 geometries:

```bash
cd /Users/macbook/Claude/julianpotulicki && TOKEN=$(cat .qa/G/press-token.txt) && for p in "show:/shows/qa-current-show" "press:/press/$TOKEN" "home:/"; do name=${p%%:*}; path=${p#*:}; node ~/.claude/shared/design-check/check.mjs "http://localhost:3113$path" --repo /Users/macbook/Claude/julianpotulicki > ".qa/G/check-$name.txt" 2>&1; echo "== $name"; tail -10 ".qa/G/check-$name.txt"; done; diff .qa/F/check-home.txt .qa/G/check-home.txt
```

Expected: the show page and the press page PASS all six checks (text floor 13px, contrast on painted pixels, 44px targets, no sideways scroll, no broken image). The homepage: every row the same as the blank-store baseline, or better; the line adds no failing text run, no contrast failure and no small target. A failure on the show or press page blocks: fix it inside option 3 (the `.d-viewer` scope exists for exactly this), rerun Task 12 Step 4's CSS check, rebuild G (Task 13 Step 3 and 4), reshoot, recheck. A homepage row that was already failing in `.qa/F/check-home.txt` is the live homepage's own record type, unchanged by this phase; report it to Jake as found, not fixed, because the homepage must stay byte for byte as it is.

12.2, content truth, on the one page with dollar figures:

Create `.qa/G/press-sources.json`:

```json
{
  "figures": [
    { "value": "$1,000", "source": "stand-in fixture, .qa/seed-stand-in.mjs, waterscape-03 (fake, QA only)" },
    { "value": "$2,000", "source": "stand-in fixture, .qa/seed-stand-in.mjs, colorfield-04 (fake, QA only)" }
  ]
}
```

```bash
cd /Users/macbook/Claude/julianpotulicki && node ~/.claude/shared/design-check/truth.mjs "http://localhost:3113/press/$(cat .qa/G/press-token.txt)" --sources .qa/G/press-sources.json 2>&1 | tail -6
```

Expected: PASS (the page prints no figure the record does not hold).

12.3 (design boards only) does not apply to built pages. 12.5 (the publish gate) does not apply: nothing is published.

12.4, caliber: dispatch the `throughline-visual-critic` agent with this brief, and save its JSON to `.qa/G/critic.json`:

> Score three built surfaces of julianpotulicki.com against `~/.claude/shared/caliber/rubric.md` and the approved shelf in `~/.claude/shared/caliber/manifest.json`, and return only the rubric's JSON. Surfaces and shots (desktop and 390-wide phone, read each once): the show page (`.qa/G/shots/show-*.jpg`), the homepage's show line (`home-*.jpg`, with `work-*-onview.jpg` for the artwork page's line), the press page (`press-*.jpg`), all under `/Users/macbook/Claude/julianpotulicki/`. The approved direction is option 3 of the round-1 board; its own renders are `board-*.jpg` in the same folder. Locked by the client and not to be scored as a choice: the single face Space Grotesk, the white wall, ink #131313, color only from his marks, and no new visual ingredient. The facts on screen are QA fixtures ("Test Gallery", round prices); judge the design, not the words.

Pass: average at least 8.0 and no criterion below 6. A fail blocks: fix the critic's named problems that sit inside option 3 and the locks, rebuild, reshoot, rescore once. If the only thing still holding the average under 8.0 is the locked single face (the board's critic scored option 3 at 7.9 for that reason), record it in `.qa/G/critic.json` and carry it to Jake as the known cap he picked with; do not add a second face.

- [ ] **Step 5: The review page, opened in Safari**

Create `.qa/G/review.html` (it stays local; Jake cannot open links, localhost or inline images, so the shots are the review):

```html
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Julian shows and press</title>
<style>
  body{margin:0;padding:24px;background:#f4f4f2;color:#131313;font:16px/1.5 -apple-system,"Helvetica Neue",sans-serif}
  h1{font-size:22px;margin:0 0 6px} h2{font-size:17px;margin:36px 0 10px} p{margin:0 0 10px;max-width:70ch}
  .row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
  figure{margin:0;background:#fff;padding:8px} figcaption{font-size:13px;color:#444;padding-top:6px}
  img{display:block;max-width:100%;height:auto}
</style>
<h1>Julian: the show page, the homepage line and the press page</h1>
<p>Built from option 3, "The homepage's viewer", which you picked on October 13. Each built page sits next to the board's own drawing of it. Everything you read on these pages (Test Gallery, QA Current Show, the prices) is test data held only on this computer, not anything real.</p>
<h2>The show page</h2>
<div class="row">
<figure><img src="shots/show-desktop.jpg" alt=""><figcaption>Built, computer</figcaption></figure>
<figure><img src="shots/board-show-desktop.jpg" alt=""><figcaption>The board, computer</figcaption></figure>
<figure><img src="shots/show-phone.jpg" alt=""><figcaption>Built, phone</figcaption></figure>
<figure><img src="shots/show-phone-facts.jpg" alt=""><figcaption>Built, phone, further down</figcaption></figure>
<figure><img src="shots/board-show-phone.jpg" alt=""><figcaption>The board, phone</figcaption></figure>
<figure><img src="shots/show-desktop-full.jpg" alt=""><figcaption>Built, computer, whole page</figcaption></figure>
</div>
<h2>The homepage line, and the artwork page</h2>
<div class="row">
<figure><img src="shots/home-phone-line.jpg" alt=""><figcaption>Built, phone, under the marks</figcaption></figure>
<figure><img src="shots/board-notice-phone.jpg" alt=""><figcaption>The board, phone</figcaption></figure>
<figure><img src="shots/home-desktop-line.jpg" alt=""><figcaption>Built, computer</figcaption></figure>
<figure><img src="shots/home-phone-fold.jpg" alt=""><figcaption>Built, phone, top of the homepage, unchanged</figcaption></figure>
<figure><img src="shots/work-phone-onview.jpg" alt=""><figcaption>An artwork page, phone, with its new line</figcaption></figure>
<figure><img src="shots/work-desktop-onview.jpg" alt=""><figcaption>An artwork page, computer</figcaption></figure>
</div>
<h2>The press page</h2>
<div class="row">
<figure><img src="shots/press-desktop.jpg" alt=""><figcaption>Built, computer</figcaption></figure>
<figure><img src="shots/board-press-desktop.jpg" alt=""><figcaption>The board, computer</figcaption></figure>
<figure><img src="shots/press-phone.jpg" alt=""><figcaption>Built, phone</figcaption></figure>
<figure><img src="shots/press-phone-works.jpg" alt=""><figcaption>Built, phone, the works</figcaption></figure>
<figure><img src="shots/press-phone-statement.jpg" alt=""><figcaption>Built, phone, the statement</figcaption></figure>
<figure><img src="shots/board-press-phone.jpg" alt=""><figcaption>The board, phone</figcaption></figure>
<figure><img src="shots/press-desktop-full.jpg" alt=""><figcaption>Built, computer, whole page</figcaption></figure>
</div>
```

Open it with the sandbox lifted (`open -a Safari` does nothing inside the sandbox), then prove the tab exists:

```bash
open -a Safari /Users/macbook/Claude/julianpotulicki/.qa/G/review.html && sleep 2 && osascript -e 'tell application "Safari" to get URL of every tab of every window' | tr ',' '\n' | grep -c 'review.html'
```

Expected: `1` or more. If Safari cannot be opened from this session, hand Jake the file's path instead and say so.

- [ ] **Step 6: Stop the processes, and update the notes on disk**

```bash
kill -9 $(lsof -ti tcp:3113) $(lsof -ti tcp:8079) 2>/dev/null; lsof -ti tcp:3113 tcp:8079 || echo "both stopped"
```

In Julian's `docs/superpowers/RESUME-julian.md` (on disk only; it is never staged), replace the `## NEXT ACTION` section's body with: phase 2b built and checked locally on `artist-module` (kit plan `docs/superpowers/plans/2026-10-13-artist-module-phase2b.md`); the show page, homepage line, artwork line, press page and studio press link are done; waiting on Jake's look at `.qa/G/review.html`; nothing pushed or deployed; payments (phase 3) next; Task 12 publish still waits on GitHub access and Jake's GO. Update `saved:` to now.

Append to the kit's `.superpowers/sdd/progress.md` (gitignored) one line per task in the ledger's own form, ending with: `PHASE 2B BUILT: kit <first>..<last> (536 tests), julian a7c150c..<last> (72 tests); snapshot F = E2 except routes +3 and css additions; e2e ALL PASS (<n> checks); section 12: show <verdict>, press <verdict>, home <verdict vs F>; critic <avg>. WAITING: Jake's look (design gate).`

- [ ] **Step 7: STOP for Jake's look**

This is a design gate (CLAUDE.md section 1, stop (c)). Do not merge, push, deploy or start phase 3. Hand back, in plain words and in this order: that the three pages are built in option 3 and open on his screen in Safari for review; what each one does in one sentence; the decisions he can overrule (the "Upcoming at" wording before a show opens; the thumbnails bring a painting into view rather than leaving the page; archived works appear last in the press kit; robots.txt left alone so search engines can read the press page's "do not index" instruction; the new pages' small type set at 13px); the self-check results in one line each, including any homepage row that was already failing before this work; the critic's score; and that nothing was pushed or published. Then stop and wait for his pick.

---

## Self-Review

**Spec and brief coverage:**

| Requirement | Task |
|---|---|
| A) `/shows/[slug]`: published only, 404 otherwise | 6 (`publishedShow`), 7, 13 (held-back and unknown 404) |
| A) venue, dates in plain words read in the site zone, opening, address, gallery link | 2 (`formatShowDates`, `formatOpening`), 6, 7, 13 |
| A) the works hanging there: published catalog works only, each linking to its page, whole | 6 (`worksInShow`), 7 (viewer, `max-width`/`max-height`), 13, 14 (look) |
| A) `showJsonLd` for published shows only, filtered to the works shown | 3, 7, 13 (ExhibitionEvent checks) |
| A) built ahead of time, revalidated like the CV's store reads; metadata and canonical | 7 (`revalidate = 60`, `generateStaticParams`, `generateMetadata`), 13 (manifest 60) |
| B) homepage line from `noticeShow`, placed and styled per option 3, gone the day after close | 6 (`noticeFor`, midnight test), 8, 13 (manifest 60, line present) |
| B) nothing on the homepage changes when no show qualifies, proven byte for byte | 8 (unit test), 12 (F equals E2 and E), 13 (G home minus the line equals E2) |
| C) artwork page "On view at" line with a link, nothing else changes | 6 (`onViewFor`), 9, 13 (page minus the line equals E2) |
| D) `/press/[token]`: unlisted (noindex, not in sitemap; robots decision justified), token via `pressTokenMatches`, 404 on mismatch or unset | 10, 12 (unknown token 404), 13 (round trip) |
| D) statement: widen the kit type (decided and justified) | 4 |
| D) CV with shows, works with hi-res downloads, price list per Jake's rule | 4 (`formatPriceLine`), 10, 13 |
| D) archived works: appear, last (decided and justified) | 4 |
| E) studio Press section, authenticated route, rotation retires the old link, full link shown | 5 (`pressHandler`), 11, 13 (old token 404) |
| E) `pressKey "studio:julian:press"`, distinct; `press.tokenKey` in Julian's config | 6 (test of three distinct keys) |
| F) abortable store timeout, default a few seconds, configurable, tested; CHANGELOG | 1, 5 |
| G) sitemap includes published shows; ExhibitionEvent validated | 6 (`showSitemapEntries`), 7, 13 |
| H) Julian suite, typecheck, `biome check src` | every Julian task, 12 |
| H) blank store: every existing page unchanged except intended differences, listed | 12 (list at the top of the task) |
| H) end to end on 127.0.0.1 with a current published show and a held-back show | 13 |
| H) press link round trip | 13 |
| H) screenshots desktop and 390 via the iframe harness | 14 |
| H) section 12 self-check, then STOP for Jake | 14 |
| Ledger "Phase 2b needs": published filter before render and schema; press keys; rotate route; statement shape; archived decision; store timeout | 6/7, 6, 5/11, 4, 4, 1 |
| Ledger follow-up: studio says when nothing can be saved (now including the press store) | 11 |
| Out of scope, untouched: checkout (surface D), payments, `web-kit artist init`, publishing either repo | none |

**Placeholder scan:** every code step carries complete code; every command has its expected output. The ledger line in Task 14 Step 6 has angle-bracket slots for hashes and counts that only exist at run time; they are filled from the run, not invented.

**Type consistency:** `formatShowDates(show: Pick<Show, "startsOn" | "endsOn">)` and `formatOpening(opening)` (Task 2) are what Tasks 6 and 7 call. `ShowSite.artist` and `ShowSite.workImage` (Task 3) are what Task 7 passes. `PressKit.statement: string[]`, `forDisplay` order and `formatPriceLine(entry: PriceListEntry)` (Task 4) are what Task 10 renders. `pressHandler` returns `{ GET, POST }` (Task 5), which Task 11 exports. `studioPress` (Task 6) is used by Tasks 10 and 11. `ShowNotice` and `noticeFor` (Task 6) are what Task 8's `renderBoard({ notice })` and `route.ts` use. `OnViewLine` and `onViewFor` (Task 6) are what Task 9 renders. `ViewerItem` (Task 7) is built by the show page with `seriesId`, `series`, `medium`, `width`, `height`, `src`, `thumb`, `title`, `alt`, `slug`. `savedShows(route)` and `savedOverlays(route)` (Task 6) are called by Tasks 7, 8, 9 and 10 with the route names `show-page`, `sitemap`, `home`, `work-page`, `press`.

**Counts:** kit 505 + 7 (Task 1) + 11 (Task 2) + 2 (Task 3) + 3 (Task 4) + 8 (Task 5) = 536. Julian 59 + 10 (Task 6) + 3 (Task 8) = 72.
