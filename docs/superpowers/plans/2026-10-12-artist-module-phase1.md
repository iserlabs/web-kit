# Artist Module Phase 1 (Extract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the artwork record, availability, studio auth, studio store, overlay validation, the studio login and work handlers, and the CV out of julianpotulicki.com into a new `@iserlabs/web-kit/artist` export (kit v0.10.0), then switch Julian's site to import them with zero visible change and no data moved.

**Architecture:** Each unit becomes one framework-free `.ts` file under `src/artist/` in the kit, re-exported from `src/artist/index.ts` and published at `./artist`. Everything that was hard-wired to Julian (series ids, catalog prefix, cookie name, roles, env var names, store key, the works list, the CV source, Next's fetch cache hint) becomes an argument or a config value, and Julian's site passes his existing values from a new `src/artist.config.ts`. Julian consumes the unreleased kit through a temporary `file:` dependency on this worktree, and a final task swaps that for `github:iserlabs/web-kit#v0.10.0` once the kit is merged and tagged.

**Tech Stack:** TypeScript (kit: TS 7, lib-oriented tsconfig; Julian: TS 6, `tsconfig-next`), Vitest 4, Biome 2.5, pnpm 10, Next.js 16 (Julian only), Web Crypto, Web `Request`/`Response`, Upstash REST over `fetch`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-10-12-artist-module-design.md`, phase 1 ("Extract") only. Shows, press kit, payments adapter and `web-kit artist init` are phase 2 and out of scope.
- **Repos and branches:** kit worktree `/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`, branch `artist-module`. Julian `/Users/macbook/Claude/julianpotulicki`, new branch `artist-module` cut from `payments-design` in Task 1. Never touch the kit's main checkout `~/Claude/_tools/web-kit` (someone else's uncommitted edit lives there).
- **pnpm only.** Never `npm` or `yarn`.
- **Commits:** always `git -c commit.gpgsign=false commit -m "..."`. No `Co-Authored-By` line, no "Generated with" line, and no mention of Claude or AI anywhere: commit messages, PR bodies, code, comments. Both repos are iserlabs client repos.
- **Writing:** American English only. No em dashes (U+2014) in any file, comment, commit message or PR body. When moving a comment, keep its substance; replace any em dash with a comma, colon or period, and convert British spellings in Julian's comments to American ones (catalog, fulfillment). The multiplication sign `×` in the dimensions label is part of the label format and stays. In shell checks, match the em dash by its UTF-8 bytes, `$'\xe2\x80\x94'`.
- **Kit rules:** `src/artist/` imports nothing from React or Next. Handlers take a Web `Request` and return a `Response`, read cookies from the `Cookie` header and set them with `Set-Cookie`. Types are imported with `import type` (the kit tsconfig sets `verbatimModuleSyntax`), and indexed access is guarded (`noUncheckedIndexedAccess`). Kit code must also compile under Julian's `tsconfig-next`.
- **Julian compatibility values (must be exactly these):** cookie name `jp_studio`; secret env `STUDIO_SECRET`; roles `julian` (passphrase env `STUDIO_PASS_JULIAN`) and `jake` (passphrase env `STUDIO_PASS_JAKE`, the only role that may reset a record); store key `studio:julian:overlays`; store env `KV_REST_API_URL` and `KV_REST_API_TOKEN`; catalog prefix `JP-`; cookie lifetime 12 hours; cookie value format `<role>.<expires>.<mac>` where `<mac>` is base64url (no padding) HMAC-SHA256 of `<role>.<expires>` keyed by the secret; public artwork pages read the store with `{ next: { revalidate: 60 } }`, studio screens read with `cache: "no-store"`.
- **No data moved.** Nothing in this plan writes to Upstash. Every QA build runs with the store switched off (`KV_REST_API_URL=` and `KV_REST_API_TOKEN=` set empty, which Next keeps over `.env.local`: `@next/env` only fills a variable whose value is `undefined`).
- **Zero visible change** on `/`, `/work`, `/work/light-language-red`, `/cv`, `/about`, `/inquire` and `/studio`, proven by Tasks 1, 8 and 11.
- **Do not push Julian's branch before Task 12.** The `file:` dependency points at a path on this Mac, so CI (`pnpm install --frozen-lockfile` on GitHub) and Vercel would both fail on it.
- **Test counts:** kit baseline 166 tests in 35 files (measured 2026-10-12). Julian baseline 98 tests (RESUME, recounted per file: 12+8+3+12+5+21+10+15+12).
- **Phase 2 must stay additive.** Extension points, designed in now:
  1\) `showsHandler({ auth, store, catalog })` joins `handlers.ts` and reuses `StudioCatalog.has` to validate a show's `workSlugs`.
  2\) Shows get their own `ShowsStore` interface (and an optional `showsKey` on `StudioStoreOptions`), returned alongside `StudioStore` by `createStudioStore`; `StudioStore` itself is never widened, so `workHandler` and every fake that implements it keep compiling.
  3\) `ArtistConfig` gains only optional fields (`timeZone`, `artistName`, `series`, press settings).
  4\) `cvFromShows(shows)` joins `cv.ts`. New names are appended to the surface list in `src/artist/index.test.ts`; removing a name is a breaking change.

---

## File Structure

**Kit** (`/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`)

| File | Responsibility |
|---|---|
| `src/artist/record.ts` | `Artwork<S>` and its field types, label formatters, `isPurchasable`, `missingFields`, `isFullyDocumented`, `catalogIds` |
| `src/artist/availability.ts` | `groupByAvailability`, `hasAvailabilityData`, `currentFirst`, `forDisplay`, each given the works |
| `src/artist/cv.ts` | CV types, `cvSections`, `newestFirst`, `cvGaps`, `hasCvContent`, each given the CV |
| `src/artist/studio-auth.ts` | `createStudioAuth`, `readCookie`: signed role cookies over Web Crypto |
| `src/artist/overlay.ts` | `ArtworkOverlay`, `cleanOverlay`, `cleanText`: what the studio may record and how a form is validated |
| `src/artist/studio-store.ts` | `createStudioStore` (Upstash REST), `merge`, `mergeAll` |
| `src/artist/config.ts` | `ArtistConfig`, the shape of a site's `src/artist.config.ts` |
| `src/artist/handlers.ts` | `loginHandler`, `workHandler`, `StudioCatalog` |
| `src/artist/index.ts` | the barrel published at `@iserlabs/web-kit/artist` |
| `src/artist/*.test.ts` | one test file per unit, plus `index.test.ts` pinning the public surface |
| `package.json` | `./artist` export, version 0.10.0 |
| `CHANGELOG.md`, `CLAUDE.md`, `README.md` | release note, Exports line, usage |

**Julian** (`/Users/macbook/Claude/julianpotulicki`)

| File | Change |
|---|---|
| `scripts/qa/render-snapshot.mjs` | create: captures and normalizes what a running build serves |
| `.gitignore` | add `/.qa/` (snapshot output) |
| `package.json`, `pnpm-lock.yaml` | kit dependency (temporary `file:`, finally `github:...#v0.10.0`), `"web-kit": { "artist": { "enabled": true } }` |
| `src/artist.config.ts` | create: Julian's names (prefix, cookie, roles, secret env, store key) |
| `src/lib/studio.ts`, `src/lib/studio.test.ts` | create: `studioAuth` and `studioStore` built from the config, plus compatibility tests |
| `src/lib/studio-auth.ts`, `src/lib/studio-store.ts` and their tests | delete (moved to the kit) |
| `src/app/api/studio/login/route.ts`, `src/app/api/studio/work/route.ts` | wire the kit handlers |
| `src/app/studio/page.tsx`, `src/app/work/[slug]/page.tsx`, `src/app/cv/page.tsx`, `src/components/ArtworkLabel.tsx` | import from the kit |
| `src/content/artwork.ts`, `src/content/artwork.test.ts`, `src/content/availability.ts` | delete (moved to the kit) |
| `src/content/artworks.ts`, `artworks.test.ts`, `availability.test.ts`, `cv.ts`, `cv.test.ts` | keep Julian's content and the tests of his content; import logic from the kit |
| `docs/superpowers/RESUME-julian.md` | status line |

Julian's `src/content/works.ts`, `site.ts`, `dimensions.ts` and `src/app/studio/StudioClient.tsx` do not change.

---

### Task 1: Julian baseline render snapshot (A), on untouched code

**Files:**
- Create: `/Users/macbook/Claude/julianpotulicki/scripts/qa/render-snapshot.mjs`
- Modify: `/Users/macbook/Claude/julianpotulicki/.gitignore` (append two lines)

**Interfaces:**
- Consumes: nothing.
- Produces: `node scripts/qa/render-snapshot.mjs <baseUrl> <outDir> [legacyCookieFile]`, writing `pages/*.html`, `headers.json`, `api.json`, `css.txt`, `private/cookie.txt` and, with a legacy cookie, `legacy.json` and `legacy/studio-desk.html`. Snapshot A lives in `/Users/macbook/Claude/julianpotulicki/.qa/A`, with `routes.txt` and `build.log` beside it. Tasks 8, 11 and 12 compare against this layout.

- [ ] **Step 1: Cut the branch from a clean tree**

```bash
cd /Users/macbook/Claude/julianpotulicki && git status --short && git switch payments-design && git switch -c artist-module && git log --oneline -3
```

Expected: `git status --short` prints nothing; the log shows `bd7dc4e Resume: payments, November shows and the artist module` on top. If the tree is not clean, stop and report.

- [ ] **Step 2: Install Julian's dependencies as locked**

`pnpm install --offline` does NOT work here: the store has no copy of the web-kit v0.7.0 tarball (`ERR_PNPM_NO_OFFLINE_TARBALL`, checked 2026-10-12). An online install works because `codeload.github.com` and `registry.npmjs.org` answer from this machine even though `github.com` does not.

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm install --frozen-lockfile 2>&1 | tail -5
```

Expected: ends with `Done in ...`. If codeload is unreachable, fall back to a kit worktree at the tag (do not commit the resulting lockfile change):
`git -C /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail worktree add /Users/macbook/Claude/.claude-worktrees/web-kit-v0.7.0 v0.7.0`, set the dependency to `file:/Users/macbook/Claude/.claude-worktrees/web-kit-v0.7.0`, `pnpm install`, and note the fallback in the snapshot folder as `A/NOTE.txt`.

- [ ] **Step 3: Confirm the baseline is green**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3
```

Expected: `Tests  98 passed (98)`; typecheck prints no errors; Biome prints `Checked ... files` with no errors.

- [ ] **Step 4: Write the snapshot script**

Create `/Users/macbook/Claude/julianpotulicki/scripts/qa/render-snapshot.mjs`:

```js
#!/usr/bin/env node
/**
 * Render snapshot: what a running build of this site serves, normalized so two
 * builds can be compared file for file with `diff -r`.
 *
 *   node scripts/qa/render-snapshot.mjs <baseUrl> <outDir> [legacyCookieFile]
 *
 * Run it from the repo root against `next start`, with the server started under
 * the QA environment so every build sees the same data: the store switched off
 * and known studio passphrases.
 *
 *   KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret
 *   STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass
 *
 * Writes, under <outDir>:
 *   pages/<name>.html   each route, normalized (see `normalize`), plus the studio signed in
 *   headers.json        status, content type and cache policy per route
 *   api.json            every studio API answer, cookie values redacted
 *   css.txt             every stylesheet the pages link, one rule per line
 *   private/cookie.txt  a fresh studio cookie for Julian, for the next build's legacy check
 *   legacy.json and legacy/studio-desk.html, only when legacyCookieFile is given:
 *                       what a cookie issued by an earlier build opens on this one
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [base, out, legacyCookieFile] = process.argv.slice(2);
if (!base || !out) {
  console.error(
    "usage: node scripts/qa/render-snapshot.mjs <baseUrl> <outDir> [legacyCookieFile]",
  );
  process.exit(2);
}

const ROUTES = ["/", "/work", "/work/light-language-red", "/cv", "/about", "/inquire", "/studio"];
const SLUG = "light-language-red";
const COOKIE = "jp_studio";
const PASS = { julian: "qa-julian-pass", jake: "qa-jake-pass" };

let buildId = "";
try {
  buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
} catch {
  // Not run from the root of a built site: there is no build id to strip.
}

const nameOf = (route) => (route === "/" ? "home" : route.slice(1).replaceAll("/", "_"));

/**
 * Next's own scripts carry the React flight payload, whose module ids and chunk
 * names move whenever the module graph changes, and every static asset path
 * carries a content hash. A visitor sees neither. Everything else stays,
 * including the site's own inline scripts and its JSON-LD.
 */
function normalize(html) {
  const stripped = html
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (whole, attrs, body) =>
      /\bsrc="\/_next\//.test(attrs) || body.includes("self.__next_f") ? "" : whole,
    )
    .replace(/<link\b[^>]*\bas="script"[^>]*>/g, "")
    .replace(/\/_next\/static\/[^"'\s)]+/g, "/_next/static/X");
  return buildId ? stripped.replaceAll(buildId, "BUILD_ID") : stripped;
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cookieHeader(token) {
  return token ? { cookie: `${COOKIE}=${token}` } : {};
}

/** The cookie's attributes, lowercased and sorted, with its value redacted and its
    Expires dropped: those two change on every run by design. */
function redactSetCookie(raw) {
  const [pair = "", ...attrs] = raw.split(";").map((part) => part.trim());
  const at = pair.indexOf("=");
  return {
    name: pair.slice(0, at),
    value: pair.slice(at + 1) ? "<token>" : "",
    attrs: attrs
      .map((a) => a.toLowerCase())
      .filter((a) => !a.startsWith("expires="))
      .sort(),
  };
}

function tokenFrom(res) {
  for (const raw of res.headers.getSetCookie()) {
    const pair = raw.split(";")[0] ?? "";
    if (pair.startsWith(`${COOKIE}=`)) return pair.slice(COOKIE.length + 1);
  }
  return "";
}

async function record(name, res) {
  return {
    name,
    status: res.status,
    contentType: res.headers.get("content-type"),
    body: parseBody(await res.text()),
    setCookie: res.headers.getSetCookie().map(redactSetCookie),
  };
}

const page = (path, token) =>
  fetch(new URL(path, base), { redirect: "manual", headers: cookieHeader(token) });

const login = (body) =>
  fetch(new URL("/api/studio/login", base), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json" },
    body,
  });

const work = (method, token, { query = "", body } = {}) =>
  fetch(new URL(`/api/studio/work${query}`, base), {
    method,
    redirect: "manual",
    headers: { "content-type": "application/json", ...cookieHeader(token) },
    body,
  });

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(base, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`nothing answered at ${base} within 60 seconds`);
}

await waitForServer();
await mkdir(join(out, "pages"), { recursive: true });
await mkdir(join(out, "private"), { recursive: true });

// The studio API first, so the signed-in desk can be captured with the pages.
const api = [];
api.push(
  await record("login, wrong passphrase", await login(JSON.stringify({ passphrase: "nope" }))),
);
api.push(await record("login, unreadable body", await login("not json")));
const julianRes = await login(JSON.stringify({ passphrase: PASS.julian }));
const julian = tokenFrom(julianRes);
api.push(await record("login, julian", julianRes));
const jakeRes = await login(JSON.stringify({ passphrase: PASS.jake }));
const jake = tokenFrom(jakeRes);
api.push(await record("login, jake", jakeRes));
if (!julian || !jake) {
  console.error("studio login returned no cookie: was the server started with the QA environment?");
  process.exit(1);
}
api.push(await record("work GET, no cookie", await work("GET")));
api.push(await record("work GET, julian", await work("GET", julian)));
api.push(
  await record(
    "work PUT, jake, store off",
    await work("PUT", jake, { body: JSON.stringify({ slug: SLUG, title: "QA" }) }),
  ),
);
api.push(
  await record("work DELETE, julian", await work("DELETE", julian, { query: `?slug=${SLUG}` })),
);
api.push(
  await record(
    "work DELETE, jake, unknown slug",
    await work("DELETE", jake, { query: "?slug=not-a-work" }),
  ),
);
api.push(
  await record(
    "work DELETE, jake, store off",
    await work("DELETE", jake, { query: `?slug=${SLUG}` }),
  ),
);
api.push(
  await record(
    "logout",
    await fetch(new URL("/api/studio/login", base), { method: "DELETE", redirect: "manual" }),
  ),
);

// Every page, and the cache policy it is served with: a page that turns dynamic shows up here.
const headers = {};
const stylesheets = [];
const capture = async (label, file, path, token) => {
  const res = await page(path, token);
  const html = await res.text();
  headers[label] = {
    status: res.status,
    contentType: res.headers.get("content-type"),
    cacheControl: res.headers.get("cache-control"),
  };
  await writeFile(join(out, "pages", `${file}.html`), normalize(html));
  for (const [tag] of html.matchAll(/<link\b[^>]*>/g)) {
    const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
    if (href && /\brel="stylesheet"/.test(tag) && !stylesheets.includes(href)) {
      stylesheets.push(href);
    }
  }
};
for (const route of ROUTES) await capture(route, nameOf(route), route);
await capture("/studio, signed in", "studio-desk", "/studio", julian);

const css = [];
for (const href of stylesheets) {
  const res = await page(href);
  css.push(`/* ${href.replace(/\/_next\/static\/[^"'\s)]+/, "/_next/static/X")} */`);
  css.push((await res.text()).replace(/}/g, "}\n"));
}

await writeFile(join(out, "headers.json"), `${JSON.stringify(headers, null, 2)}\n`);
await writeFile(join(out, "api.json"), `${JSON.stringify(api, null, 2)}\n`);
await writeFile(join(out, "css.txt"), `${css.join("\n")}\n`);
await writeFile(join(out, "private", "cookie.txt"), `${julian}\n`);

if (legacyCookieFile) {
  const legacy = (await readFile(legacyCookieFile, "utf8")).trim();
  const answer = await record(
    "work GET, cookie issued by the earlier build",
    await work("GET", legacy),
  );
  await writeFile(join(out, "legacy.json"), `${JSON.stringify(answer, null, 2)}\n`);
  await mkdir(join(out, "legacy"), { recursive: true });
  const desk = await page("/studio", legacy);
  await writeFile(join(out, "legacy", "studio-desk.html"), normalize(await desk.text()));
  console.log(`legacy cookie: ${answer.status} ${JSON.stringify(answer.body)}`);
}

console.log(
  `snapshot ${out}: ${ROUTES.length + 1} pages, ${api.length} studio API answers, ${stylesheets.length} stylesheets`,
);
for (const [label, h] of Object.entries(headers)) {
  console.log(`${h.status} ${label} | ${h.cacheControl ?? "-"}`);
}
```

- [ ] **Step 5: Ignore the snapshot output**

Append to `/Users/macbook/Claude/julianpotulicki/.gitignore`:

```
# render snapshots (scripts/qa/render-snapshot.mjs)
/.qa/
```

- [ ] **Step 6: Format, lint, commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write scripts/qa/render-snapshot.mjs && pnpm lint 2>&1 | tail -3 && git add scripts/qa/render-snapshot.mjs .gitignore && git -c commit.gpgsign=false commit -m "QA: render snapshot script for before-and-after build comparisons"
```

Expected: Biome reports no errors; one commit created.

- [ ] **Step 7: Build A under the QA environment**

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/A && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/A/build.log 2>&1; tail -45 .qa/A/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/A/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/A/routes.txt && head -20 .qa/A/routes.txt
```

Expected: the build log ends with the route table; `routes.txt` lists lines such as `ƒ /studio`, `ƒ /api/studio/login`, `ƒ /api/studio/work` and `● /work/[slug]`. Write down which symbol each of those carries.

- [ ] **Step 8: Serve A and snapshot it**

Confirm port 3111 is free: `lsof -ti tcp:3111 || echo free` prints `free`. Then start the server in the background (Bash tool with `run_in_background: true`):

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3111
```

Then, in the foreground:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/A; kill -9 $(lsof -ti tcp:3111)
```

The server process is named `next-server`, so `pkill -f "next start"` does not stop it; always use the `lsof` form above.

Expected output: `snapshot .qa/A: 8 pages, 11 studio API answers, N stylesheets` then one line per page, all `200`, with `/studio` carrying a `no-store` cache policy. Check `.qa/A/api.json` by eye: `login, wrong passphrase` is 401, `login, julian` is 200 with a `jp_studio` cookie, `work GET, no cookie` is 401 `{"error":"locked"}`, `work PUT, jake, store off` is 503, `work DELETE, julian` is 403, `work DELETE, jake, unknown slug` is 404, `work DELETE, jake, store off` is 503.

---

### Task 2: Kit: the artwork record and the `./artist` export

**Files:**
- Create: `src/artist/record.ts`, `src/artist/record.test.ts`, `src/artist/index.ts`
- Modify: `package.json` (exports map)

All kit paths in Tasks 2 to 7 are relative to `/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail`.

**Interfaces:**
- Consumes: nothing.
- Produces (from `./record`): types `Aspect`, `Availability`, `Lifecycle`, `PublishState`, `Unit`, `Dimensions`, `Price`, `Edition`, `Artwork<S extends string = string>`; functions `formatTitleLine(w: Artwork): string`, `formatMediumLine(w: Artwork): string`, `formatDimensionsLine(w: Artwork): string`, `formatLabel(w: Artwork): string[]`, `formatEdition(w: Artwork): string`, `formatAvailability(w: Artwork): string`, `isPurchasable(w: Artwork): boolean`, `missingFields(w: Artwork): string[]`, `isFullyDocumented(w: Artwork): boolean`, `catalogIds(slugs: readonly string[], prefix: string): Map<string, string>`. Package export `"./artist": "./src/artist/index.ts"`.

- [ ] **Step 1: Install and record the baseline**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git status -sb | head -3 && pnpm install --offline --frozen-lockfile 2>&1 | tail -2 && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2
```

Expected: branch `artist-module`; offline install succeeds (it does for the kit, checked 2026-10-12); `Test Files  35 passed (35)`, `Tests  166 passed (166)`; typecheck and lint clean.

- [ ] **Step 2: Write the failing test**

Create `src/artist/record.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  type Artwork,
  catalogIds,
  formatAvailability,
  formatDimensionsLine,
  formatEdition,
  formatLabel,
  formatMediumLine,
  formatTitleLine,
  isFullyDocumented,
  isPurchasable,
  missingFields,
} from "./record";

/** A record with only what every work is guaranteed to have. */
const bare = (over: Partial<Artwork> = {}): Artwork => ({
  slug: "waterscape-01",
  catalogId: "AA-0001",
  series: "waterscapes",
  lifecycle: "current",
  publish: "published",
  src: "/works/waterscape-01.png",
  alt: "A waterscape",
  aspect: "landscape",
  ...over,
});

describe("Carole 06: the label block", () => {
  it("puts the title before the date", () => {
    expect(formatTitleLine(bare({ title: "Alcyone", year: 2025 }))).toBe("Alcyone, 2025");
  });

  it("calls an untitled work Untitled rather than leaving a hole", () => {
    expect(formatTitleLine(bare())).toBe("Untitled");
    expect(formatTitleLine(bare({ year: 2024 }))).toBe("Untitled, 2024");
  });

  it("names the materials and the substrate", () => {
    expect(formatMediumLine(bare({ medium: ["Oil"], substrate: "linen" }))).toBe("Oil on linen");
  });

  it("lists multiple materials instead of saying mixed media", () => {
    const w = bare({ medium: ["Oil", "graphite", "wax"], substrate: "linen" });
    expect(formatMediumLine(w)).toBe("Oil, graphite and wax on linen");
    expect(formatMediumLine(w)).not.toContain("Mixed media");
  });

  it("puts height before width", () => {
    const w = bare({ dimensions: { height: 36, width: 24, unit: "in" } });
    expect(formatDimensionsLine(w)).toBe("36 × 24 in");
  });

  it("adds depth only when the work has it", () => {
    expect(
      formatDimensionsLine(bare({ dimensions: { height: 36, width: 24, depth: 2, unit: "in" } })),
    ).toBe("36 × 24 × 2 in");
  });

  it("prints the full three-line block when everything is known", () => {
    const w = bare({
      title: "Alcyone",
      year: 2025,
      medium: ["Oil", "graphite"],
      substrate: "linen",
      dimensions: { height: 36, width: 24, unit: "in" },
    });
    expect(formatLabel(w)).toEqual(["Alcyone, 2025", "Oil and graphite on linen", "36 × 24 in"]);
  });
});

describe("the absent-field rule: show only what exists", () => {
  it("drops the dimensions line entirely rather than printing a blank", () => {
    const w = bare({ title: "Alcyone", year: 2025, medium: ["Oil"], substrate: "linen" });
    expect(formatLabel(w)).toEqual(["Alcyone, 2025", "Oil on linen"]);
  });

  it("drops the medium line when neither material nor substrate is known", () => {
    expect(formatLabel(bare({ title: "Alcyone" }))).toEqual(["Alcyone"]);
  });

  it("never emits an empty string, a placeholder, or an on-request stand-in", () => {
    for (const line of formatLabel(bare())) {
      expect(line.trim()).not.toBe("");
      expect(line).not.toMatch(/on request|TBD|unknown|n\/a/i);
    }
  });

  it("survives a record where only the substrate is known", () => {
    expect(formatMediumLine(bare({ substrate: "linen" }))).toBe("linen");
  });

  it("prints an edition only where one exists", () => {
    expect(formatEdition(bare())).toBe("");
    expect(formatEdition(bare({ edition: { number: 2, of: 10 } }))).toBe("Edition 2 of 10");
  });
});

describe("Carole 05: sold work never reads as available", () => {
  it("says sold plainly", () => {
    expect(formatAvailability(bare({ availability: "sold" }))).toBe("Sold");
  });

  it("does not invite an inquiry on a sold work", () => {
    expect(formatAvailability(bare({ availability: "sold" }))).not.toMatch(/request|inquire/i);
  });

  it("shows a public price when the price is public", () => {
    const w = bare({
      availability: "available",
      price: { amount: 4200, currency: "USD", visibility: "public" },
    });
    expect(formatAvailability(w)).toBe("$4,200");
  });

  it("withholds the amount when the price is on request", () => {
    const w = bare({
      availability: "available",
      price: { amount: 4200, currency: "USD", visibility: "on-request" },
    });
    expect(formatAvailability(w)).toBe("Price on request");
    expect(formatAvailability(w)).not.toContain("4,200");
  });

  it("stays silent when availability was never recorded, rather than implying a sale", () => {
    expect(formatAvailability(bare())).toBe("");
  });

  it("only lets a published, available work be purchased", () => {
    expect(isPurchasable(bare({ availability: "available" }))).toBe(true);
    expect(isPurchasable(bare({ availability: "sold" }))).toBe(false);
    expect(isPurchasable(bare({ availability: "available", publish: "draft" }))).toBe(false);
    expect(isPurchasable(bare())).toBe(false);
  });
});

describe("Carole 15: the record reports its own gaps", () => {
  it("names every missing field on a bare record", () => {
    expect(missingFields(bare())).toEqual([
      "title",
      "year",
      "medium",
      "substrate",
      "dimensions",
      "availability",
    ]);
  });

  it("counts a fully documented work as complete", () => {
    const w = bare({
      title: "Alcyone",
      year: 2025,
      medium: ["Oil"],
      substrate: "linen",
      dimensions: { height: 36, width: 24, unit: "in" },
      availability: "available",
    });
    expect(missingFields(w)).toEqual([]);
    expect(isFullyDocumented(w)).toBe(true);
  });

  it("treats an empty medium list as missing, not as documented", () => {
    expect(missingFields(bare({ medium: [] }))).toContain("medium");
  });
});

describe("catalog ids come from the site's prefix", () => {
  it("numbers works by sorted slug, so list order cannot shift them", () => {
    const ids = catalogIds(["b-work", "a-work", "c-work"], "JP-");
    expect(ids.get("a-work")).toBe("JP-0001");
    expect(ids.get("b-work")).toBe("JP-0002");
    expect(ids.get("c-work")).toBe("JP-0003");
  });

  it("uses whatever prefix the site configures", () => {
    expect(catalogIds(["only"], "PL-").get("only")).toBe("PL-0001");
  });

  it("leaves the caller's list in its own order", () => {
    const slugs = ["b", "a"];
    catalogIds(slugs, "X-");
    expect(slugs).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec vitest run src/artist/record.test.ts 2>&1 | tail -8`
Expected: FAIL, `Failed to load url ./record` (or "Cannot find module").

- [ ] **Step 4: Write the record**

Create `src/artist/record.ts`:

```ts
/**
 * The artwork record.
 *
 * One shape, serving both the portfolio a curator reads and the transaction a
 * collector completes. Everything else on an artist's site reads from here, which
 * is why it is built first: a surface cannot render a field the record has no room
 * for.
 *
 * The field list is Carole 06 (title, date, medium, SUBSTRATE, height, width,
 * depth, units, edition, availability) plus what a site needs to sell and ship a
 * piece (catalog id, price with its own visibility, buyer, transaction, shipping).
 * It began as julianpotulicki.com's record, built as one model to serve both his
 * site and PLFA, and is now the model every artist site in the kit shares.
 *
 * Two rules are encoded here rather than in the surfaces:
 *
 * 1. DIMENSIONS ARE NUMBERS, NEVER A SENTENCE. Carole 06 asks for height before
 *    width everywhere. Stored as one free-text string, that ordering survives
 *    exactly as long as whoever types it remembers, and nothing can filter on size
 *    later.
 *
 * 2. AN ABSENT FIELD PRINTS NOTHING. Jake's ruling, 2026-08-09: a site ships
 *    before the metadata is complete, publishes everything, and shows only what
 *    exists. So the formatters below drop a line rather than emitting a blank, a
 *    placeholder, or "dimensions on request" on every work. Surfaces must not
 *    special-case this; they call the formatter and print what comes back.
 *
 * The series belongs to the site: `Artwork<S>` takes the site's own series ids as
 * its type parameter and accepts any string by default.
 */

export type Aspect = "portrait" | "landscape" | "square";

/** Carole 05: sold work must never read as available inventory. A state, not a label. */
export type Availability = "available" | "sold" | "reserved" | "not-for-sale";

/** Carole 05 again: older work stays visible without dominating the current practice. */
export type Lifecycle = "current" | "earlier" | "archived";

/** Julian: "not every page of a notebook dumped online." Draft is the default. */
export type PublishState = "published" | "draft";

export type Unit = "in" | "cm";

export interface Dimensions {
  /** Height first, always. Carole 06. */
  height: number;
  width: number;
  /** Only for work with real depth: a gallery-wrap canvas, a relief, an object. */
  depth?: number;
  unit: Unit;
}

export interface Price {
  amount: number;
  currency: "USD";
  /**
   * Session 05 wants price and its visibility as separate fields so public-price
   * and inquiry-only is a setting rather than a rebuild. Carole 14 leans toward
   * transparency where selling is a goal, but the decision is the artist's and this
   * flag is where the answer lands.
   */
  visibility: "public" | "on-request";
}

export interface Edition {
  number: number;
  of: number;
}

export interface Artwork<S extends string = string> {
  /** Stable public identifier and route segment. */
  slug: string;
  /**
   * Carole 06 and session 06 both want a catalog id: the thing a certificate, an
   * invoice and a shipping record all point at. Independent of the slug, which is
   * a URL and may be rewritten.
   */
  catalogId: string;

  /** Carole 06: title, and it precedes the date everywhere it is printed. */
  title?: string;
  year?: number;

  /**
   * Carole 06: name the materials. "Mixed media" is banned as a catch-all when the
   * actual materials can be stated, so this is a list and the formatter joins it.
   */
  medium?: string[];
  /** Carole 06: never "oil" alone when it is oil on linen. */
  substrate?: string;

  dimensions?: Dimensions;
  edition?: Edition;

  series: S;
  availability?: Availability;
  lifecycle: Lifecycle;
  publish: PublishState;
  price?: Price;

  /** Session 06's fulfillment chain. Absent until a piece actually sells. */
  buyerRef?: string;
  transactionRef?: string;
  shippingStatus?: "pending" | "packed" | "shipped" | "delivered" | "collected";
  certificateRef?: string;

  /** Carole 08: the master is kept separate from the web derivative. */
  masterSrc?: string;
  src: string;
  hi?: string;
  alt: string;
  aspect: Aspect;

  /** A short line in the artist's register, never art-world copy. */
  blurb?: string;
  feature?: boolean;
}

/* ------------------------------------------------------------------ formatting

   Carole 06's display block, exactly:

     Title, Year
     Medium on substrate
     H × W [× D] unit

   Each line is independent. A record with a title and nothing else prints one
   line, not three with two blanks. */

/** "Untitled" is the honest label for an untitled work; it is not a missing title. */
export function formatTitleLine(w: Artwork): string {
  const title = w.title?.trim() || "Untitled";
  return w.year ? `${title}, ${w.year}` : title;
}

/** "Oil and graphite on linen". Empty when we know neither material nor substrate. */
export function formatMediumLine(w: Artwork): string {
  const media = (w.medium ?? []).map((m) => m.trim()).filter(Boolean);
  const list =
    media.length > 1 ? `${media.slice(0, -1).join(", ")} and ${media[media.length - 1]}` : media[0];
  if (list && w.substrate) return `${list} on ${w.substrate}`;
  if (list) return list;
  if (w.substrate) return w.substrate;
  return "";
}

/** "36 × 24 in" or "36 × 24 × 2 in". Height first. Empty when unmeasured. */
export function formatDimensionsLine(w: Artwork): string {
  const d = w.dimensions;
  if (!d) return "";
  const n = (v: number) => (Number.isInteger(v) ? String(v) : String(v));
  const parts = [n(d.height), n(d.width)];
  if (d.depth !== undefined) parts.push(n(d.depth));
  return `${parts.join(" × ")} ${d.unit}`;
}

/** The whole block, absent lines dropped. Surfaces render this and nothing else. */
export function formatLabel(w: Artwork): string[] {
  return [formatTitleLine(w), formatMediumLine(w), formatDimensionsLine(w)].filter(
    (line) => line.length > 0,
  );
}

/** Carole 06: "Edition 2 of 10", only where editions exist. */
export function formatEdition(w: Artwork): string {
  return w.edition ? `Edition ${w.edition.number} of ${w.edition.of}` : "";
}

/**
 * What a visitor is told about getting the piece. Carole 05 is the constraint:
 * sold work must never read as available inventory, so a sold piece says sold
 * plainly rather than falling through to an inquiry prompt.
 */
export function formatAvailability(w: Artwork): string {
  switch (w.availability) {
    case "sold":
      return "Sold";
    case "reserved":
      return "Reserved";
    case "not-for-sale":
      return "Not for sale";
    case "available":
      return w.price?.visibility === "public" && w.price
        ? `$${w.price.amount.toLocaleString("en-US")}`
        : "Price on request";
    default:
      // Availability unrecorded. Say nothing rather than imply it can be bought.
      return "";
  }
}

/** Only a published, available work may be offered for sale on the site. */
export function isPurchasable(w: Artwork): boolean {
  return w.publish === "published" && w.availability === "available";
}

/**
 * Carole 15 asks whether every published work carries complete metadata. This
 * reports the gaps rather than hiding them, so the studio can show the artist
 * exactly what a record is missing.
 */
export function missingFields(w: Artwork): string[] {
  const gaps: string[] = [];
  if (!w.title) gaps.push("title");
  if (!w.year) gaps.push("year");
  if (!w.medium?.length) gaps.push("medium");
  if (!w.substrate) gaps.push("substrate");
  if (!w.dimensions) gaps.push("dimensions");
  if (!w.availability) gaps.push("availability");
  return gaps;
}

export function isFullyDocumented(w: Artwork): boolean {
  return missingFields(w).length === 0;
}

/**
 * Provisional catalog numbers, assigned by sorted slug so the mapping is stable
 * regardless of the order a site lists its works in: prefix "JP-" gives "JP-0001".
 * The studio takes over issuance; a number that has been printed on a certificate
 * must never be reassigned.
 */
export function catalogIds(slugs: readonly string[], prefix: string): Map<string, string> {
  return new Map(
    [...slugs]
      .sort()
      .map((slug, i): [string, string] => [slug, `${prefix}${String(i + 1).padStart(4, "0")}`]),
  );
}
```

Create `src/artist/index.ts`:

```ts
/**
 * @iserlabs/web-kit/artist: the parts of an artist's portfolio site that are the
 * same on every artist's site. Framework-free `.ts`: no React, no Next imports, and
 * every server handler takes a Web Request and returns a Response.
 */
export * from "./record";
```

- [ ] **Step 5: Publish the path**

In `package.json`, in `"exports"`, replace:

```json
    "./audits": "./src/audits/index.mjs",
```

with:

```json
    "./audits": "./src/audits/index.mjs",
    "./artist": "./src/artist/index.ts",
```

- [ ] **Step 6: Run the tests, typecheck and lint**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/record.test.ts 2>&1 | grep -E "Tests " && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2
```

Expected: `Tests  24 passed (24)` for the file; whole suite `36 passed (36)` files, `190 passed (190)` tests; typecheck and lint clean.

- [ ] **Step 7: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/record.ts src/artist/record.test.ts src/artist/index.ts package.json && git -c commit.gpgsign=false commit -m "artist: the artwork record, its formatters and catalog ids, at ./artist"
```

---

### Task 3: Kit: availability and the CV

**Files:**
- Create: `src/artist/availability.ts`, `src/artist/availability.test.ts`, `src/artist/cv.ts`, `src/artist/cv.test.ts`
- Modify: `src/artist/index.ts`

**Interfaces:**
- Consumes: `Artwork` from `./record`.
- Produces: `AvailabilityGroups<A extends Artwork = Artwork>`; `groupByAvailability<A extends Artwork>(works: readonly A[]): AvailabilityGroups<A>`; `hasAvailabilityData(works: readonly Artwork[]): boolean`; `currentFirst<A extends Artwork>(works: readonly A[]): A[]`; `forDisplay<A extends Artwork>(works: readonly A[]): A[]`. Types `CvEntry`, `CvEducation`, `Cv`, `CvSection`; `cvSections(source: Cv): CvSection[]`; `newestFirst(entries: readonly CvEntry[]): CvEntry[]`; `cvGaps(source: Cv): string[]`; `hasCvContent(source: Cv): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/artist/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentFirst, forDisplay, groupByAvailability, hasAvailabilityData } from "./availability";
import type { Artwork } from "./record";

let made = 0;
const work = (over: Partial<Artwork> = {}): Artwork => {
  made += 1;
  return {
    slug: `w-${made}`,
    catalogId: "AA-0000",
    series: "waterscapes",
    lifecycle: "current",
    publish: "published",
    src: "/works/x.png",
    alt: "x",
    aspect: "landscape",
    ...over,
  };
};

describe("Carole 05: sold is separated from available", () => {
  it("puts available and sold in different groups", () => {
    const g = groupByAvailability([
      work({ availability: "available" }),
      work({ availability: "sold" }),
    ]);
    expect(g.available).toHaveLength(1);
    expect(g.unavailable).toHaveLength(1);
  });

  it("treats reserved as unavailable, not as active inventory", () => {
    const g = groupByAvailability([work({ availability: "reserved" })]);
    expect(g.available).toHaveLength(0);
    expect(g.unavailable).toHaveLength(1);
  });

  it("keeps not-for-sale apart from sold, since it never was inventory", () => {
    const g = groupByAvailability([work({ availability: "not-for-sale" })]);
    expect(g.notForSale).toHaveLength(1);
    expect(g.unavailable).toHaveLength(0);
  });

  it("never counts an unrecorded work as available", () => {
    const g = groupByAvailability([work()]);
    expect(g.available).toHaveLength(0);
    expect(g.unstated).toHaveLength(1);
  });
});

describe("a site stays silent until it knows something", () => {
  it("reports no availability data when no work has a status", () => {
    expect(hasAvailabilityData([work(), work()])).toBe(false);
  });

  it("reports data the moment one work has a status", () => {
    expect(hasAvailabilityData([work(), work({ availability: "sold" })])).toBe(true);
  });
});

describe("Carole 05: current work leads, older work stays visible", () => {
  it("orders current before earlier before archived", () => {
    const ordered = currentFirst([
      work({ lifecycle: "archived" }),
      work({ lifecycle: "current" }),
      work({ lifecycle: "earlier" }),
    ]);
    expect(ordered.map((w) => w.lifecycle)).toEqual(["current", "earlier", "archived"]);
  });

  it("keeps archived work present rather than dropping it", () => {
    const input = [work({ lifecycle: "archived" }), work({ lifecycle: "current" })];
    expect(currentFirst(input)).toHaveLength(input.length);
  });

  it("ranks an available work above a sold one within the same lifecycle", () => {
    const ordered = forDisplay([
      work({ availability: "sold" }),
      work({ availability: "available" }),
    ]);
    expect(ordered[0]?.availability).toBe("available");
  });

  it("lets lifecycle outrank availability, so current work leads regardless", () => {
    const ordered = forDisplay([
      work({ lifecycle: "archived", availability: "available" }),
      work({ lifecycle: "current", availability: "sold" }),
    ]);
    expect(ordered[0]?.lifecycle).toBe("current");
  });

  it("leaves a list with no statuses in the order it was given", () => {
    const input = [work(), work(), work()];
    expect(forDisplay(input).map((w) => w.slug)).toEqual(input.map((w) => w.slug));
  });
});
```

Create `src/artist/cv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { type Cv, cvGaps, cvSections, hasCvContent, newestFirst } from "./cv";

const empty: Cv = {
  education: [],
  soloExhibitions: [],
  groupExhibitions: [],
  press: [],
  awards: [],
};

const withSolo: Cv = {
  ...empty,
  soloExhibitions: [{ year: "2025", title: "Light Codes", venue: "Metro Craft", location: "Brooklyn" }],
};

describe("Carole 13: no empty headings", () => {
  it("renders no section at all when there is nothing to put in it", () => {
    expect(cvSections(empty)).toEqual([]);
    expect(hasCvContent(empty)).toBe(false);
  });

  it("renders only the sections that have entries, in Carole's order", () => {
    const source: Cv = { ...withSolo, awards: [{ year: "2024", title: "A prize" }] };
    expect(cvSections(source).map((s) => s.id)).toEqual(["solo", "awards"]);
  });

  it("counts education alone as content", () => {
    expect(hasCvContent({ ...empty, education: [{ what: "Studied under a mentor" }] })).toBe(true);
  });
});

describe("Carole 10: order", () => {
  it("orders entries newest first", () => {
    const sorted = newestFirst([
      { year: "2024", title: "Alcyone" },
      { year: "2025", title: "Light Codes" },
    ]);
    expect(sorted.map((e) => e.year)).toEqual(["2025", "2024"]);
  });

  it("does not throw on a non-numeric year", () => {
    expect(() => newestFirst([{ year: "n.d.", title: "Untitled show" }])).not.toThrow();
  });
});

describe("what is still missing", () => {
  it("names education and exhibitions when both are missing", () => {
    expect(cvGaps(empty)).toEqual(["education, mentors or meaningful study", "exhibitions"]);
  });

  it("stops reporting a gap once it is filled", () => {
    const filled: Cv = { ...withSolo, education: [{ what: "Studied under a mentor" }] };
    expect(cvGaps(filled)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run src/artist/availability.test.ts src/artist/cv.test.ts 2>&1 | tail -8`
Expected: FAIL, both modules missing.

- [ ] **Step 3: Write the two modules**

Create `src/artist/availability.ts`:

```ts
import type { Artwork } from "./record";

/**
 * Carole 05: sold work must not be mixed into active inventory.
 *
 * Her reasoning is commercial, not tidiness: a gallery or a collector becomes
 * interested in a piece and only then discovers it is gone, and even a clearly
 * marked "sold" adds clutter to what a buyer is actually shopping. So available
 * and sold are separated at the query layer, not merely styled differently.
 *
 * A site that holds no availability data yet puts every work in `unstated`. That
 * is deliberate and honest: a work whose status nobody recorded must not be
 * presented as purchasable. The separation exists so that the moment the studio
 * sets a status, the surfaces already behave correctly.
 *
 * Every function takes the works it sorts. The kit holds no catalog of its own.
 */

export interface AvailabilityGroups<A extends Artwork = Artwork> {
  /** Offerable now. Carole's "active inventory". */
  available: A[];
  /** Sold or reserved. Shown as record and provenance, never as inventory. */
  unavailable: A[];
  /** Deliberately not for sale: kept work, studio collection, loans. */
  notForSale: A[];
  /** Status never recorded. Says nothing about acquiring the piece. */
  unstated: A[];
}

export function groupByAvailability<A extends Artwork>(works: readonly A[]): AvailabilityGroups<A> {
  const groups: AvailabilityGroups<A> = {
    available: [],
    unavailable: [],
    notForSale: [],
    unstated: [],
  };
  for (const w of works) {
    switch (w.availability) {
      case "available":
        groups.available.push(w);
        break;
      case "sold":
      case "reserved":
        groups.unavailable.push(w);
        break;
      case "not-for-sale":
        groups.notForSale.push(w);
        break;
      default:
        groups.unstated.push(w);
    }
  }
  return groups;
}

/**
 * Whether the site currently knows enough to talk about availability at all.
 * Surfaces use this to stay silent rather than render an empty "Available"
 * heading, which Carole 13 counts as a sign of an abandoned site.
 */
export function hasAvailabilityData(works: readonly Artwork[]): boolean {
  return works.some((w) => w.availability !== undefined);
}

/**
 * Carole 05 again: current work leads, older work stays visible without
 * dominating. Ordering, not exclusion, so nothing disappears from the record.
 */
const LIFECYCLE_ORDER = { current: 0, earlier: 1, archived: 2 } as const;

export function currentFirst<A extends Artwork>(works: readonly A[]): A[] {
  return [...works].sort((a, b) => LIFECYCLE_ORDER[a.lifecycle] - LIFECYCLE_ORDER[b.lifecycle]);
}

/**
 * The order a visitor should meet the work in: current before earlier before
 * archived, and within that, offerable before gone. A sold piece never outranks
 * an available one on a page a collector is browsing.
 */
export function forDisplay<A extends Artwork>(works: readonly A[]): A[] {
  const rank = (w: Artwork) =>
    w.availability === "available" ? 0 : w.availability === undefined ? 1 : 2;
  return [...works].sort(
    (a, b) => LIFECYCLE_ORDER[a.lifecycle] - LIFECYCLE_ORDER[b.lifecycle] || rank(a) - rank(b),
  );
}
```

Create `src/artist/cv.ts`:

```ts
/**
 * The CV.
 *
 * Carole 10 makes this a primary destination and specifies the shape: education
 * near the top, exhibitions newest first, solo separated from group, entries kept
 * to year / title / venue / city. She adds that a self-taught or emerging artist
 * can list mentors, meaningful study and workshops in place of a degree.
 *
 * Carole 13 is the constraint that decides how this behaves: a stale or empty
 * section reads as an abandoned site and costs the artist the gallery. So every
 * section is OPTIONAL and a page renders only the ones with real entries. An empty
 * Awards heading is worse than no Awards heading.
 *
 * The site owns its CV and passes it in. Nothing here invents an entry, and
 * `cvGaps` names what is still missing so it never quietly stays empty.
 */

export interface CvEntry {
  year: string;
  title: string;
  venue?: string;
  location?: string;
  href?: string;
  note?: string;
}

export interface CvEducation {
  year?: string;
  what: string;
  where?: string;
}

export interface Cv {
  /** Carole 10: a degree, or the mentors and study that stand in for one. */
  education: CvEducation[];
  soloExhibitions: CvEntry[];
  groupExhibitions: CvEntry[];
  press: CvEntry[];
  awards: CvEntry[];
}

export interface CvSection {
  id: string;
  heading: string;
  entries: CvEntry[];
}

/** Only sections with entries, in Carole's order. Education is rendered by the page
    above these, since its entries have a different shape. */
export function cvSections(source: Cv): CvSection[] {
  return [
    { id: "solo", heading: "Solo Exhibitions", entries: source.soloExhibitions },
    { id: "group", heading: "Group Exhibitions", entries: source.groupExhibitions },
    { id: "press", heading: "Selected Press", entries: source.press },
    { id: "awards", heading: "Awards and Residencies", entries: source.awards },
  ].filter((s) => s.entries.length > 0);
}

/** Newest first, per Carole 10. Non-numeric years sort last rather than throwing. */
export function newestFirst(entries: readonly CvEntry[]): CvEntry[] {
  return [...entries].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
}

/** What the artist still owes this page. Surfaced so it cannot quietly stay empty. */
export function cvGaps(source: Cv): string[] {
  const gaps: string[] = [];
  if (!source.education.length) gaps.push("education, mentors or meaningful study");
  if (!source.soloExhibitions.length && !source.groupExhibitions.length) {
    gaps.push("exhibitions");
  }
  return gaps;
}

/** Carole 13: do not ship a destination with nothing on it. */
export function hasCvContent(source: Cv): boolean {
  return cvSections(source).length > 0 || source.education.length > 0;
}
```

Replace `src/artist/index.ts` with:

```ts
/**
 * @iserlabs/web-kit/artist: the parts of an artist's portfolio site that are the
 * same on every artist's site. Framework-free `.ts`: no React, no Next imports, and
 * every server handler takes a Web Request and returns a Response.
 */
export * from "./availability";
export * from "./cv";
export * from "./record";
```

- [ ] **Step 4: Run the tests, typecheck and lint**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/availability.test.ts src/artist/cv.test.ts 2>&1 | grep -E "Tests " && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2
```

Expected: `Tests  18 passed (18)` (11 availability, 7 CV); suite `38 passed (38)` files, `208 passed (208)` tests; typecheck and lint clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/availability.ts src/artist/availability.test.ts src/artist/cv.ts src/artist/cv.test.ts src/artist/index.ts && git -c commit.gpgsign=false commit -m "artist: availability and the CV, each given the site's data"
```

---

### Task 4: Kit: studio auth

**Files:**
- Create: `src/artist/studio-auth.ts`, `src/artist/studio-auth.test.ts`
- Modify: `src/artist/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:

```ts
interface StudioRoleConfig<R extends string = string> { id: R; passphraseEnv: string; canReset?: boolean }
interface StudioAuthOptions<R extends string = string> {
  cookieName: string; roles: readonly StudioRoleConfig<R>[]; secretEnv: string; ttlSeconds?: number;
}
interface StudioAuth<R extends string = string> {
  readonly cookieName: string;
  roleFor(passphrase: string): R | null;
  issue(role: R): Promise<string | null>;
  verify(token: string | undefined): Promise<R | null>;
  configured(): boolean;
  canReset(role: R): boolean;
  roleFrom(request: Request): Promise<R | null>;
  setCookie(token: string): string;   // a Set-Cookie header value
  clearCookie(): string;              // a Set-Cookie header value that expires it
}
function createStudioAuth<const R extends string>(options: StudioAuthOptions<R>): StudioAuth<R>
function readCookie(header: string | null, name: string): string | undefined
```

- [ ] **Step 1: Write the failing test**

Create `src/artist/studio-auth.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudioAuth, readCookie } from "./studio-auth";

const SECRET = "KIT_TEST_STUDIO_SECRET";
const PASS_ARTIST = "KIT_TEST_PASS_ARTIST";
const PASS_OPERATOR = "KIT_TEST_PASS_OPERATOR";

const auth = createStudioAuth({
  cookieName: "kit_studio",
  secretEnv: SECRET,
  roles: [
    { id: "artist", passphraseEnv: PASS_ARTIST },
    { id: "operator", passphraseEnv: PASS_OPERATOR, canReset: true },
  ],
});

const original = { ...process.env };

beforeEach(() => {
  process.env[SECRET] = "test-secret-value";
  process.env[PASS_ARTIST] = "artist-key";
  process.env[PASS_OPERATOR] = "operator-key";
});

afterEach(() => {
  process.env = { ...original };
});

describe("the door fails closed", () => {
  it("opens for nobody when the secret is unset", async () => {
    // Assigning undefined stores the STRING "undefined", which is truthy. Delete.
    delete process.env[SECRET];
    expect(await auth.issue("operator")).toBeNull();
    expect(auth.configured()).toBe(false);
  });

  it("opens for nobody when every passphrase is unset", () => {
    delete process.env[PASS_ARTIST];
    delete process.env[PASS_OPERATOR];
    expect(auth.roleFor("artist-key")).toBeNull();
    expect(auth.configured()).toBe(false);
  });

  it("refuses an empty passphrase even when one is configured", () => {
    expect(auth.roleFor("")).toBeNull();
  });

  it("refuses a wrong passphrase", () => {
    expect(auth.roleFor("not-the-key")).toBeNull();
  });
});

describe("two keys, two people", () => {
  it("gives each passphrase its own role", () => {
    expect(auth.roleFor("artist-key")).toBe("artist");
    expect(auth.roleFor("operator-key")).toBe("operator");
  });

  it("round-trips a role through a signed cookie", async () => {
    const token = await auth.issue("artist");
    expect(token).toBeTruthy();
    expect(await auth.verify(token as string)).toBe("artist");
  });
});

describe("the cookie cannot be edited into a promotion", () => {
  it("rejects a role swapped in the payload", async () => {
    const token = (await auth.issue("artist")) as string;
    const [, expires, mac] = token.split(".");
    expect(await auth.verify(`operator.${expires}.${mac}`)).toBeNull();
  });

  it("rejects an expiry pushed into the future", async () => {
    const token = (await auth.issue("artist")) as string;
    const [role, , mac] = token.split(".");
    expect(await auth.verify(`${role}.9999999999.${mac}`)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = (await auth.issue("operator")) as string;
    const [role, expires] = token.split(".");
    expect(await auth.verify(`${role}.${expires}.deadbeef`)).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    expect(await auth.verify(`operator.${past}.whatever`)).toBeNull();
  });

  it("rejects a malformed token, an unknown role, and nothing at all", async () => {
    expect(await auth.verify("garbage")).toBeNull();
    expect(await auth.verify("admin.9999999999.x")).toBeNull();
    expect(await auth.verify(undefined)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const token = (await auth.issue("operator")) as string;
    process.env[SECRET] = "a-different-secret";
    expect(await auth.verify(token)).toBeNull();
  });
});

describe("the cookie format sites already hold", () => {
  it("is <role>.<expires>.<base64url HMAC-SHA256>, both read and written", async () => {
    const mac = (payload: string) =>
      createHmac("sha256", "test-secret-value").update(payload).digest("base64url");
    const expires = Math.floor(Date.now() / 1000) + 3600;
    expect(await auth.verify(`artist.${expires}.${mac(`artist.${expires}`)}`)).toBe("artist");

    const token = (await auth.issue("artist")) as string;
    const [role, issuedExpires, issuedMac] = token.split(".");
    expect(issuedMac).toBe(mac(`${role}.${issuedExpires}`));
  });
});

describe("configuration", () => {
  it("refuses a role id or cookie name that would break the cookie", () => {
    expect(() =>
      createStudioAuth({
        cookieName: "ok",
        secretEnv: SECRET,
        roles: [{ id: "a.b", passphraseEnv: PASS_ARTIST }],
      }),
    ).toThrow(/role id/);
    expect(() => createStudioAuth({ cookieName: "ok", secretEnv: SECRET, roles: [] })).toThrow(
      /at least one role/,
    );
    expect(() =>
      createStudioAuth({
        cookieName: "bad name",
        secretEnv: SECRET,
        roles: [{ id: "a", passphraseEnv: PASS_ARTIST }],
      }),
    ).toThrow(/cookie name/);
  });

  it("lets only a role marked canReset reset a record", () => {
    expect(auth.canReset("operator")).toBe(true);
    expect(auth.canReset("artist")).toBe(false);
  });

  it("honors a shorter time to live", async () => {
    const short = createStudioAuth({
      cookieName: "kit_studio",
      secretEnv: SECRET,
      ttlSeconds: 60,
      roles: [{ id: "artist", passphraseEnv: PASS_ARTIST }],
    });
    const token = (await short.issue("artist")) as string;
    const expires = Number(token.split(".")[1]);
    const now = Math.floor(Date.now() / 1000);
    expect(expires).toBeGreaterThanOrEqual(now + 59);
    expect(expires).toBeLessThanOrEqual(now + 60);
    expect(short.setCookie(token)).toContain("Max-Age=60");
  });
});

describe("cookies on the wire", () => {
  it("reads its own cookie from a request that carries others", async () => {
    const token = (await auth.issue("artist")) as string;
    const request = new Request("https://site.test/studio", {
      headers: { cookie: `theme=dark; kit_studio=${token}; other=1` },
    });
    expect(await auth.roleFrom(request)).toBe("artist");
  });

  it("finds no role on a request without its cookie", async () => {
    expect(await auth.roleFrom(new Request("https://site.test/"))).toBeNull();
    const token = (await auth.issue("artist")) as string;
    const request = new Request("https://site.test/", {
      headers: { cookie: `other_studio=${token}` },
    });
    expect(await auth.roleFrom(request)).toBeNull();
  });

  it("sets a twelve-hour cookie that scripts cannot read", () => {
    const header = auth.setCookie("tok");
    expect(header.startsWith("kit_studio=tok; Path=/;")).toBe(true);
    for (const part of ["Max-Age=43200", "Secure", "HttpOnly", "SameSite=lax"]) {
      expect(header).toContain(part);
    }
  });

  it("clears the cookie by expiring it at once", () => {
    expect(auth.clearCookie()).toMatch(/^kit_studio=; Path=\/; Expires=[^;]+; Max-Age=0;/);
  });

  it("reads one cookie by name, decoded, and nothing when it is absent", () => {
    expect(readCookie("a=1; kit_studio=x%2Ey; b=2", "kit_studio")).toBe("x.y");
    expect(readCookie("a=1", "kit_studio")).toBeUndefined();
    expect(readCookie(null, "kit_studio")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run src/artist/studio-auth.test.ts 2>&1 | tail -8`
Expected: FAIL, module `./studio-auth` missing.

- [ ] **Step 3: Write studio auth**

Create `src/artist/studio-auth.ts`:

```ts
/**
 * The studio door.
 *
 * More than one person holds a key and they are not the same person: on
 * julianpotulicki.com the artist owns the currency of his own portfolio and Jake
 * owns the schema and the publish decisions. So the cookie carries a role, and the
 * role is signed along with the expiry rather than stored beside it, or anyone
 * holding a valid cookie could promote themselves by editing one word of it.
 *
 * HMAC over Web Crypto, which every runtime the kit targets already has. No
 * dependency for what is one signature and one comparison.
 *
 * Fails closed at every edge: an unset secret or an unset passphrase means nobody
 * gets in, rather than everybody. A door that opens when its lock is missing is
 * worse than no door, because it looks like a door.
 *
 * The cookie value is `<role>.<expires>.<mac>`, where `<mac>` is the base64url
 * HMAC-SHA256 of `<role>.<expires>`. It must not change: every cookie a site has
 * already issued is in that format, and changing it logs everyone out.
 */

export interface StudioRoleConfig<R extends string = string> {
  /** The role's name, signed into the cookie. Letters, digits, "-" and "_" only. */
  id: R;
  /** The env var holding this role's passphrase. Unset means this role cannot log in. */
  passphraseEnv: string;
  /** May discard everything recorded about a work (the work handler's DELETE). */
  canReset?: boolean;
}

export interface StudioAuthOptions<R extends string = string> {
  /** The cookie's name, e.g. "jp_studio". Letters, digits, "-" and "_" only. */
  cookieName: string;
  /** In the order a passphrase is checked against them. */
  roles: readonly StudioRoleConfig<R>[];
  /** The env var holding the signing secret. Unset means nobody gets in. */
  secretEnv: string;
  /** How long a cookie lasts. Default twelve hours. */
  ttlSeconds?: number;
}

export interface StudioAuth<R extends string = string> {
  readonly cookieName: string;
  /** Which role, if any, this passphrase opens. Unset passphrases open nothing. */
  roleFor(passphrase: string): R | null;
  /** A signed cookie value for this role, or null when no secret is set. */
  issue(role: R): Promise<string | null>;
  /** The role this cookie value proves, or null. Expiry is inside the signature. */
  verify(token: string | undefined): Promise<R | null>;
  /** True when a secret and at least one passphrase are set. */
  configured(): boolean;
  /** Whether this role may reset a record to its base state. */
  canReset(role: R): boolean;
  /** Reads this auth's cookie from a request's Cookie header and verifies it. */
  roleFrom(request: Request): Promise<R | null>;
  /** A Set-Cookie header value carrying this token. */
  setCookie(token: string): string;
  /** A Set-Cookie header value that expires the cookie at once. */
  clearCookie(): string;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

/** A real ArrayBuffer, not the ArrayBufferLike a TextEncoder hands back: WebCrypto's
    BufferSource will not accept the latter under strict types, and copying a few
    bytes is cheaper than casting the type system into agreeing. */
function enc(s: string): ArrayBuffer {
  const view = new TextEncoder().encode(s);
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc(payload)));
}

/** Length-independent comparison, so a wrong guess leaks nothing through timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** One cookie's value from a Cookie header, decoded, or undefined when absent. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at === -1 || part.slice(0, at).trim() !== name) continue;
    const raw = part.slice(at + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  return `${name}=${value}; Path=/; Expires=${expires}; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=lax`;
}

export function createStudioAuth<const R extends string>(
  options: StudioAuthOptions<R>,
): StudioAuth<R> {
  const { cookieName, roles, secretEnv } = options;
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (!SAFE_NAME.test(cookieName)) {
    throw new Error(`createStudioAuth: "${cookieName}" is not a usable cookie name`);
  }
  if (roles.length === 0) throw new Error("createStudioAuth: at least one role is required");
  for (const r of roles) {
    if (!SAFE_NAME.test(r.id)) {
      throw new Error(
        `createStudioAuth: role id "${r.id}" may use only letters, digits, "-" and "_"`,
      );
    }
  }

  const env = (name: string): string | undefined => process.env[name];
  const isRole = (value: string): value is R => roles.some((r) => r.id === value);

  function roleFor(passphrase: string): R | null {
    if (!passphrase) return null;
    for (const r of roles) {
      const expected = env(r.passphraseEnv);
      if (expected && safeEqual(passphrase, expected)) return r.id;
    }
    return null;
  }

  async function issue(role: R): Promise<string | null> {
    const secret = env(secretEnv);
    if (!secret || !isRole(role)) return null;
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const payload = `${role}.${expires}`;
    return `${payload}.${await sign(payload, secret)}`;
  }

  async function verify(token: string | undefined): Promise<R | null> {
    const secret = env(secretEnv);
    if (!secret || !token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [role, expires, mac] = parts;
    if (role === undefined || expires === undefined || mac === undefined) return null;
    if (!isRole(role)) return null;
    if (!/^\d+$/.test(expires) || Number(expires) < Math.floor(Date.now() / 1000)) return null;
    const expected = await sign(`${role}.${expires}`, secret);
    return safeEqual(mac, expected) ? role : null;
  }

  function configured(): boolean {
    return Boolean(env(secretEnv)) && roles.some((r) => Boolean(env(r.passphraseEnv)));
  }

  return {
    cookieName,
    roleFor,
    issue,
    verify,
    configured,
    canReset: (role) => roles.some((r) => r.id === role && r.canReset === true),
    roleFrom: (request) => verify(readCookie(request.headers.get("cookie"), cookieName)),
    setCookie: (token) => cookieHeader(cookieName, token, ttl),
    clearCookie: () => cookieHeader(cookieName, "", 0),
  };
}
```

Replace `src/artist/index.ts` with:

```ts
/**
 * @iserlabs/web-kit/artist: the parts of an artist's portfolio site that are the
 * same on every artist's site. Framework-free `.ts`: no React, no Next imports, and
 * every server handler takes a Web Request and returns a Response.
 */
export * from "./availability";
export * from "./cv";
export * from "./record";
export * from "./studio-auth";
```

- [ ] **Step 4: Run the tests, typecheck and lint**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/studio-auth.test.ts 2>&1 | grep -E "Tests " && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2
```

Expected: `Tests  21 passed (21)`; suite `39 passed (39)` files, `229 passed (229)` tests; typecheck and lint clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/studio-auth.ts src/artist/studio-auth.test.ts src/artist/index.ts && git -c commit.gpgsign=false commit -m "artist: studio auth, signed role cookies with configurable names"
```

---

### Task 5: Kit: overlay validation, the studio store, and the config shape

**Files:**
- Create: `src/artist/overlay.ts`, `src/artist/overlay.test.ts`, `src/artist/studio-store.ts`, `src/artist/studio-store.test.ts`, `src/artist/config.ts`
- Modify: `src/artist/index.ts`

**Interfaces:**
- Consumes: `Artwork`, `Availability`, `Lifecycle`, `PublishState`, `Unit` from `./record`; `StudioAuthOptions` from `./studio-auth`.
- Produces:

```ts
type ArtworkOverlay = Partial<Pick<Artwork, "title" | "year" | "medium" | "substrate" | "dimensions"
  | "edition" | "availability" | "lifecycle" | "publish" | "price" | "certificateRef" | "blurb">>
  & { updatedAt?: string; updatedBy?: string };
function cleanText(v: unknown, max?: number): string | undefined   // default max 200
function cleanOverlay(body: Record<string, unknown>): ArtworkOverlay
interface StudioStoreOptions { key: string; urlEnv?: string; tokenEnv?: string;
  cachedRead?: Record<string, unknown>; fetch?: typeof fetch }
interface StudioStore { readonly key: string; configured(): boolean;
  readOverlays(fresh?: boolean): Promise<Record<string, ArtworkOverlay> | null>;
  writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean>;
  clearOverlay(slug: string): Promise<boolean> }
function createStudioStore(options: StudioStoreOptions): StudioStore
function merge<A extends Artwork>(base: A, overlay: ArtworkOverlay | undefined): A
function mergeAll<A extends Artwork>(base: A[], overlays: Record<string, ArtworkOverlay> | null): A[]
interface ArtistConfig<R extends string = string> {
  catalogPrefix: string; studio: StudioAuthOptions<R> & { storeKey: string } }
```

- [ ] **Step 1: Write the failing tests**

Create `src/artist/overlay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cleanOverlay, cleanText } from "./overlay";

describe("cleanOverlay: only what the studio owns survives", () => {
  it("keeps a trimmed title and drops a blank one", () => {
    expect(cleanOverlay({ title: "  Alcyone  " })).toEqual({ title: "Alcyone" });
    expect(cleanOverlay({ title: "   " })).toEqual({});
  });

  it("caps a title at 200 characters", () => {
    expect(cleanOverlay({ title: "x".repeat(300) }).title).toHaveLength(200);
  });

  it("takes a year as a number or a string, as a whole year", () => {
    expect(cleanOverlay({ year: 2025 }).year).toBe(2025);
    expect(cleanOverlay({ year: "2024" }).year).toBe(2024);
    expect(cleanOverlay({ year: 2025.7 }).year).toBe(2025);
  });

  it("drops a year outside 1900 to 2100 or one that is not a number", () => {
    for (const year of [1899, 2101, 0, -5, "abc", null]) {
      expect(cleanOverlay({ year }).year, String(year)).toBeUndefined();
    }
  });

  it("keeps a list of materials, trimmed, at most eight", () => {
    const medium = [" Oil ", "", "graphite", 7, "a", "b", "c", "d", "e", "f", "g"];
    expect(cleanOverlay({ medium }).medium).toEqual([
      "Oil",
      "graphite",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("splits a typed medium into the materials it names", () => {
    expect(cleanOverlay({ medium: "Oil, graphite and wax" }).medium).toEqual([
      "Oil",
      "graphite",
      "wax",
    ]);
  });

  it("caps the substrate at 60 characters and the blurb at 400", () => {
    expect(cleanOverlay({ substrate: "l".repeat(80) }).substrate).toHaveLength(60);
    expect(cleanOverlay({ blurb: "b".repeat(500) }).blurb).toHaveLength(400);
  });

  it("keeps height and width together, in inches unless centimeters are chosen", () => {
    expect(cleanOverlay({ height: "36", width: 24 }).dimensions).toEqual({
      height: 36,
      width: 24,
      unit: "in",
    });
    expect(cleanOverlay({ height: 90, width: 60, depth: 4, unit: "cm" }).dimensions).toEqual({
      height: 90,
      width: 60,
      depth: 4,
      unit: "cm",
    });
    expect(cleanOverlay({ height: 36, width: 24, unit: "furlongs" }).dimensions?.unit).toBe("in");
  });

  it("drops half a measurement, which would print as a complete-looking line", () => {
    expect(cleanOverlay({ height: 36 }).dimensions).toBeUndefined();
    expect(cleanOverlay({ height: 36, width: 0 }).dimensions).toBeUndefined();
  });

  it("accepts only the known availability, lifecycle and publish states", () => {
    expect(cleanOverlay({ availability: "sold", lifecycle: "earlier", publish: "draft" })).toEqual({
      availability: "sold",
      lifecycle: "earlier",
      publish: "draft",
    });
    expect(cleanOverlay({ availability: "gone", lifecycle: "old", publish: "live" })).toEqual({});
  });

  it("records a price in dollars, public only when asked, on request otherwise", () => {
    expect(cleanOverlay({ priceAmount: "4200", priceVisibility: "public" }).price).toEqual({
      amount: 4200,
      currency: "USD",
      visibility: "public",
    });
    expect(cleanOverlay({ priceAmount: 4200, priceVisibility: "anything" }).price).toEqual({
      amount: 4200,
      currency: "USD",
      visibility: "on-request",
    });
    expect(cleanOverlay({ priceAmount: 0 }).price).toBeUndefined();
  });

  it("drops what the studio does not own", () => {
    expect(
      cleanOverlay({
        slug: "x",
        src: "/evil.png",
        alt: "x",
        series: "x",
        catalogId: "x",
        updatedBy: "x",
      }),
    ).toEqual({});
  });
});

describe("cleanText", () => {
  it("reads text only from strings", () => {
    expect(cleanText(42)).toBeUndefined();
    expect(cleanText(undefined)).toBeUndefined();
    expect(cleanText("  hi  ")).toBe("hi");
    expect(cleanText("abcdef", 3)).toBe("abc");
  });
});
```

Create `src/artist/studio-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArtworkOverlay } from "./overlay";
import type { Artwork } from "./record";
import { createStudioStore, merge, mergeAll } from "./studio-store";

const base = (over: Partial<Artwork> = {}): Artwork => ({
  slug: "waterscape-01",
  catalogId: "AA-0001",
  series: "waterscapes",
  lifecycle: "current",
  publish: "published",
  src: "/works/waterscape-01.png",
  alt: "A waterscape",
  aspect: "landscape",
  medium: ["Oil"],
  substrate: "linen",
  ...over,
});

describe("an overlay corrects what is known, never what a work is", () => {
  it("adds the fields the base record lacks", () => {
    const merged = merge(base(), {
      title: "Alcyone",
      year: 2025,
      dimensions: { height: 36, width: 24, unit: "in" },
    });
    expect(merged.title).toBe("Alcyone");
    expect(merged.year).toBe(2025);
    expect(merged.dimensions).toEqual({ height: 36, width: 24, unit: "in" });
  });

  it("leaves the base untouched where the overlay says nothing", () => {
    const merged = merge(base(), { title: "Alcyone" });
    expect(merged.src).toBe("/works/waterscape-01.png");
    expect(merged.alt).toBe("A waterscape");
    expect(merged.series).toBe("waterscapes");
    expect(merged.substrate).toBe("linen");
  });

  it("ignores empty strings rather than blanking a real value", () => {
    const merged = merge(base({ substrate: "linen" }), { substrate: "" } as ArtworkOverlay);
    expect(merged.substrate).toBe("linen");
  });

  it("ignores undefined and null rather than erasing", () => {
    const merged = merge(base(), {
      title: undefined,
      substrate: null as unknown as string,
    } as ArtworkOverlay);
    expect(merged.substrate).toBe("linen");
  });

  it("does not carry the audit fields onto the artwork", () => {
    const merged = merge(base(), {
      title: "Alcyone",
      updatedAt: "2026-08-09T00:00:00Z",
      updatedBy: "julian",
    });
    expect("updatedAt" in merged).toBe(false);
    expect("updatedBy" in merged).toBe(false);
  });

  it("returns the base unchanged when there is no overlay", () => {
    expect(merge(base(), undefined)).toEqual(base());
  });
});

describe("the overlay can change status, which is the whole point", () => {
  it("marks a work sold", () => {
    expect(merge(base(), { availability: "sold" }).availability).toBe("sold");
  });

  it("unpublishes a work without deleting it", () => {
    const merged = merge(base(), { publish: "draft" });
    expect(merged.publish).toBe("draft");
    expect(merged.slug).toBe("waterscape-01");
  });

  it("sets a price and its visibility independently", () => {
    const merged = merge(base(), {
      price: { amount: 4200, currency: "USD", visibility: "on-request" },
    });
    expect(merged.price?.amount).toBe(4200);
    expect(merged.price?.visibility).toBe("on-request");
  });
});

describe("merging the whole catalog", () => {
  it("applies each overlay to its own slug only", () => {
    const works = [base(), base({ slug: "waterscape-02", catalogId: "AA-0002" })];
    const merged = mergeAll(works, { "waterscape-02": { title: "Second" } });
    expect(merged[0]?.title).toBeUndefined();
    expect(merged[1]?.title).toBe("Second");
  });

  it("returns the base catalog untouched when there is no store", () => {
    const works = [base()];
    expect(mergeAll(works, null)).toEqual(works);
  });

  it("ignores an overlay for a slug that does not exist", () => {
    const works = [base()];
    expect(mergeAll(works, { "not-a-work": { title: "Ghost" } })).toHaveLength(1);
  });
});

const URL_ENV = "KIT_TEST_KV_URL";
const TOKEN_ENV = "KIT_TEST_KV_TOKEN";
const original = { ...process.env };

interface FakeCall {
  url: string;
  init: RequestInit & { next?: unknown };
}

/** Upstash's REST shape: GET answers { result: <stored string or null> }, SET stores the body. */
function fakeUpstash(stored: unknown = null, status = 200) {
  const calls: FakeCall[] = [];
  let value = stored;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    if (status !== 200) return new Response("unavailable", { status });
    if (url.includes("/set/")) {
      value = init?.body;
      return Response.json({ result: "OK" });
    }
    return Response.json({ result: value });
  }) as typeof fetch;
  return { fetchFn, calls, stored: () => value };
}

function storeWith(fake: ReturnType<typeof fakeUpstash>) {
  return createStudioStore({
    key: "studio:test:overlays",
    urlEnv: URL_ENV,
    tokenEnv: TOKEN_ENV,
    cachedRead: { next: { revalidate: 60 } },
    fetch: fake.fetchFn,
  });
}

describe("the store", () => {
  beforeEach(() => {
    process.env[URL_ENV] = "https://kv.example.test/";
    process.env[TOKEN_ENV] = "kv-token";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns null, never an empty object, when no store is connected", async () => {
    delete process.env[URL_ENV];
    const fake = fakeUpstash();
    const store = storeWith(fake);
    expect(store.configured()).toBe(false);
    expect(await store.readOverlays()).toBeNull();
    expect(await store.writeOverlay("a", { title: "A" }, "artist")).toBe(false);
    expect(await store.clearOverlay("a")).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("reads every overlay by slug", async () => {
    const fake = fakeUpstash(JSON.stringify({ a: { title: "A" } }));
    expect(await storeWith(fake).readOverlays()).toEqual({ a: { title: "A" } });
  });

  it("reports nothing saved as an empty object", async () => {
    expect(await storeWith(fakeUpstash(null)).readOverlays()).toEqual({});
  });

  it("survives a corrupted blob rather than taking the site down", async () => {
    expect(await storeWith(fakeUpstash("{not json")).readOverlays()).toEqual({});
  });

  it("keeps public reads cacheable and studio reads fresh", async () => {
    const fake = fakeUpstash(null);
    const store = storeWith(fake);
    await store.readOverlays();
    await store.readOverlays(true);
    const [publicRead, studioRead] = fake.calls;
    expect(publicRead?.url).toBe("https://kv.example.test/get/studio:test:overlays");
    expect(publicRead?.init.next).toEqual({ revalidate: 60 });
    expect(publicRead?.init.cache).toBeUndefined();
    expect(studioRead?.init.cache).toBe("no-store");
    expect(studioRead?.init.next).toBeUndefined();
    expect(new Headers(publicRead?.init.headers).get("authorization")).toBe("Bearer kv-token");
  });

  it("writes one slug and keeps the rest, stamping who and when", async () => {
    const fake = fakeUpstash(JSON.stringify({ a: { title: "A" }, b: { title: "B" } }));
    expect(await storeWith(fake).writeOverlay("a", { year: 2025 }, "artist")).toBe(true);
    const saved = JSON.parse(String(fake.stored())) as Record<string, ArtworkOverlay>;
    expect(saved.a?.title).toBe("A");
    expect(saved.a?.year).toBe(2025);
    expect(saved.a?.updatedBy).toBe("artist");
    expect(Number.isNaN(Date.parse(saved.a?.updatedAt ?? ""))).toBe(false);
    expect(saved.b).toEqual({ title: "B" });
    const [read, write] = fake.calls;
    expect(read?.init.cache).toBe("no-store");
    expect(write?.url).toBe("https://kv.example.test/set/studio:test:overlays");
    expect(write?.init.method).toBe("POST");
  });

  it("clears one slug and keeps the rest", async () => {
    const fake = fakeUpstash(JSON.stringify({ a: { title: "A" }, b: { title: "B" } }));
    expect(await storeWith(fake).clearOverlay("a")).toBe(true);
    expect(JSON.parse(String(fake.stored()))).toEqual({ b: { title: "B" } });
  });

  it("throws when the store answers with an error, so a save never looks done", async () => {
    await expect(storeWith(fakeUpstash(null, 500)).readOverlays()).rejects.toThrow("store 500");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run src/artist/overlay.test.ts src/artist/studio-store.test.ts 2>&1 | tail -8`
Expected: FAIL, modules `./overlay` and `./studio-store` missing.

- [ ] **Step 3: Write the overlay, the store and the config shape**

Create `src/artist/overlay.ts`:

```ts
import type { Artwork, Availability, Lifecycle, PublishState, Unit } from "./record";

/**
 * What the studio may record about a work, and the one function that decides what
 * survives from a submitted form.
 *
 * Every field is validated here rather than trusted from the form, because the
 * form is not the only thing that can call a studio route. A pure function, so
 * every artist site validates edits identically and the rules are tested once.
 */

/** The fields the studio may set. Deliberately a subset: slug, series, image and alt
    text stay with the repo, because they decide what the work IS rather than what we
    know about it. */
export type ArtworkOverlay = Partial<
  Pick<
    Artwork,
    | "title"
    | "year"
    | "medium"
    | "substrate"
    | "dimensions"
    | "edition"
    | "availability"
    | "lifecycle"
    | "publish"
    | "price"
    | "certificateRef"
    | "blurb"
  >
> & { updatedAt?: string; updatedBy?: string };

const AVAILABILITY = new Set<Availability>(["available", "sold", "reserved", "not-for-sale"]);
const LIFECYCLE = new Set<Lifecycle>(["current", "earlier", "archived"]);
const PUBLISH = new Set<PublishState>(["published", "draft"]);
const UNITS = new Set<Unit>(["in", "cm"]);

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Trimmed text cut to `max` characters, or undefined when there is none. */
export function cleanText(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

/** Only the fields the studio owns survive this. Anything else is dropped silently. */
export function cleanOverlay(body: Record<string, unknown>): ArtworkOverlay {
  const out: ArtworkOverlay = {};

  const title = cleanText(body.title);
  if (title !== undefined) out.title = title;

  const year = num(body.year);
  if (year !== undefined && year >= 1900 && year <= 2100) out.year = Math.trunc(year);

  if (Array.isArray(body.medium)) {
    const media = body.medium
      .map((m) => cleanText(m, 60))
      .filter((m): m is string => Boolean(m));
    if (media.length) out.medium = media.slice(0, 8);
  } else {
    const medium = cleanText(body.medium, 200);
    // Carole 06 bans a single "mixed media" blob, so a typed string is split into
    // the materials it names rather than stored as one opaque phrase.
    if (medium)
      out.medium = medium
        .split(/,| and /i)
        .map((m) => m.trim())
        .filter(Boolean)
        .slice(0, 8);
  }

  const substrate = cleanText(body.substrate, 60);
  if (substrate !== undefined) out.substrate = substrate;

  const height = num(body.height);
  const width = num(body.width);
  const depth = num(body.depth);
  const unit =
    typeof body.unit === "string" && UNITS.has(body.unit as Unit) ? (body.unit as Unit) : "in";
  // Height and width travel together or not at all: half a measurement is worse
  // than none, because it prints as a complete-looking line.
  if (height !== undefined && width !== undefined) {
    out.dimensions = { height, width, unit, ...(depth !== undefined ? { depth } : {}) };
  }

  if (
    typeof body.availability === "string" &&
    AVAILABILITY.has(body.availability as Availability)
  ) {
    out.availability = body.availability as Availability;
  }
  if (typeof body.lifecycle === "string" && LIFECYCLE.has(body.lifecycle as Lifecycle)) {
    out.lifecycle = body.lifecycle as Lifecycle;
  }
  if (typeof body.publish === "string" && PUBLISH.has(body.publish as PublishState)) {
    out.publish = body.publish as PublishState;
  }

  const amount = num(body.priceAmount);
  if (amount !== undefined) {
    out.price = {
      amount,
      currency: "USD",
      visibility: body.priceVisibility === "public" ? "public" : "on-request",
    };
  }

  const blurb = cleanText(body.blurb, 400);
  if (blurb !== undefined) out.blurb = blurb;

  return out;
}
```

Create `src/artist/studio-store.ts`:

```ts
import type { ArtworkOverlay } from "./overlay";
import type { Artwork } from "./record";

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
 * Talks to Upstash over its REST API with plain fetch. No client library, so no
 * dependency for what is four HTTP calls.
 *
 * Unconfigured returns null everywhere, never an empty object. A caller must be able
 * to tell "no store" from "nothing saved", or the studio will cheerfully show an
 * empty form and lose whatever was typed into it.
 */

export interface StudioStoreOptions {
  /** The Upstash key holding every overlay, e.g. "studio:julian:overlays". */
  key: string;
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

export function createStudioStore(options: StudioStoreOptions): StudioStore {
  const { key } = options;
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

  async function call(path: string, init: RequestInit | undefined, fresh: boolean): Promise<unknown> {
    const c = creds();
    if (!c) return null;
    const doFetch = options.fetch ?? globalThis.fetch;
    const res = await doFetch(`${c.url}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${c.token}`, ...(init?.headers ?? {}) },
      ...(fresh ? { cache: "no-store" as const } : (options.cachedRead ?? {})),
    } as RequestInit);
    if (!res.ok) throw new Error(`store ${res.status}`);
    const body = (await res.json()) as { result?: unknown };
    return body.result ?? null;
  }

  async function readOverlays(fresh = false): Promise<Record<string, ArtworkOverlay> | null> {
    if (!configured()) return null;
    const raw = await call(`get/${key}`, undefined, fresh);
    if (raw === null || raw === undefined) return {};
    try {
      return typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, ArtworkOverlay>)
        : (raw as Record<string, ArtworkOverlay>);
    } catch {
      // A corrupted blob must not take the public site down with it. Report empty and
      // let the base catalog render; the studio will overwrite on the next save.
      return {};
    }
  }

  async function writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = {
      ...current,
      [slug]: { ...current[slug], ...overlay, updatedAt: new Date().toISOString(), updatedBy: by },
    };
    await call(`set/${key}`, { method: "POST", body: JSON.stringify(next) }, true);
    return true;
  }

  async function clearOverlay(slug: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = { ...current };
    delete next[slug];
    await call(`set/${key}`, { method: "POST", body: JSON.stringify(next) }, true);
    return true;
  }

  return { key, configured, readOverlays, writeOverlay, clearOverlay };
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

Create `src/artist/config.ts`:

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
  studio: StudioAuthOptions<R> & {
    /** The Upstash key holding the studio's per-work overlays. */
    storeKey: string;
  };
}
```

Replace `src/artist/index.ts` with:

```ts
/**
 * @iserlabs/web-kit/artist: the parts of an artist's portfolio site that are the
 * same on every artist's site. Framework-free `.ts`: no React, no Next imports, and
 * every server handler takes a Web Request and returns a Response.
 */
export * from "./availability";
export * from "./config";
export * from "./cv";
export * from "./overlay";
export * from "./record";
export * from "./studio-auth";
export * from "./studio-store";
```

- [ ] **Step 4: Run the tests, typecheck and lint**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/overlay.test.ts src/artist/studio-store.test.ts 2>&1 | grep -E "Tests " && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2
```

Expected: `Tests  33 passed (33)` (13 overlay, 20 store); suite `41 passed (41)` files, `262 passed (262)` tests; typecheck and lint clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/overlay.ts src/artist/overlay.test.ts src/artist/studio-store.ts src/artist/studio-store.test.ts src/artist/config.ts src/artist/index.ts && git -c commit.gpgsign=false commit -m "artist: overlay validation, the studio store and the site config shape"
```

---

### Task 6: Kit: the studio route handlers

**Files:**
- Create: `src/artist/handlers.ts`, `src/artist/handlers.test.ts`
- Modify: `src/artist/index.ts`

**Interfaces:**
- Consumes: `StudioAuth` (Task 4), `StudioStore`, `ArtworkOverlay`, `cleanOverlay`, `cleanText` (Task 5).
- Produces:

```ts
interface StudioCatalog { has(slug: string): boolean }
interface LoginHandlerOptions<R extends string = string> { auth: StudioAuth<R>; wrongKeyDelayMs?: number }
interface LoginHandler { POST(request: Request): Promise<Response>; DELETE(request?: Request): Promise<Response> }
interface WorkHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>; store: StudioStore; catalog: StudioCatalog; maxBodyLength?: number }
interface WorkHandler { GET(request: Request): Promise<Response>; PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response> }
function loginHandler<R extends string>(options: LoginHandlerOptions<R>): LoginHandler
function workHandler<R extends string>(options: WorkHandlerOptions<R>): WorkHandler
```

Response bodies and statuses are exactly Julian's current ones: login 503 `{"error":"The studio is not configured yet."}`, 400 `{"error":"Could not read that."}`, 401 `{"error":"That passphrase is not right."}` after the delay, 200 `{"ok":true,"role":"<role>"}`; logout 200 `{"ok":true}`; work 401 `{"error":"locked"}`, GET `{"configured":false,"overlays":{}}` or `{"configured":true,"overlays":{...}}`, PUT 503 `{"error":"No store is connected, so nothing would be saved."}`, 413 `{"error":"That is too long."}`, 400 `{"error":"Could not read that."}`, 404 `{"error":"That is not a work on this site."}`, 503 `{"error":"The store did not accept that."}`, 200 `{"ok":true}`; DELETE 403 `{"error":"Not permitted."}`. One deliberate change: a PUT body that parses as JSON but is not an object (`null`, `[]`, `42`) now answers 400 instead of throwing.

- [ ] **Step 1: Write the failing test**

Create `src/artist/handlers.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loginHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import { createStudioAuth } from "./studio-auth";
import type { StudioStore } from "./studio-store";

const SECRET = "KIT_TEST_H_SECRET";
const PASS_ARTIST = "KIT_TEST_H_ARTIST";
const PASS_OPERATOR = "KIT_TEST_H_OPERATOR";

const auth = createStudioAuth({
  cookieName: "kit_studio",
  secretEnv: SECRET,
  roles: [
    { id: "artist", passphraseEnv: PASS_ARTIST },
    { id: "operator", passphraseEnv: PASS_OPERATOR, canReset: true },
  ],
});

const original = { ...process.env };

beforeEach(() => {
  process.env[SECRET] = "handler-secret";
  process.env[PASS_ARTIST] = "artist-key";
  process.env[PASS_OPERATOR] = "operator-key";
});

afterEach(() => {
  process.env = { ...original };
});

function memoryStore({ connected = true, accepts = true } = {}) {
  const data: Record<string, ArtworkOverlay> = { "waterscape-01": { title: "Saved" } };
  const writes: { slug: string; overlay: ArtworkOverlay; by: string }[] = [];
  const store: StudioStore = {
    key: "test:overlays",
    configured: () => connected,
    readOverlays: async () => (connected ? { ...data } : null),
    writeOverlay: async (slug, overlay, by) => {
      if (!connected || !accepts) return false;
      writes.push({ slug, overlay, by });
      data[slug] = { ...data[slug], ...overlay };
      return true;
    },
    clearOverlay: async (slug) => {
      if (!connected || !accepts) return false;
      delete data[slug];
      return true;
    },
  };
  return { store, data, writes };
}

const catalog = { has: (slug: string) => slug === "waterscape-01" };
const login = loginHandler({ auth, wrongKeyDelayMs: 0 });

async function cookieFor(role: "artist" | "operator"): Promise<string> {
  return `${auth.cookieName}=${await auth.issue(role)}`;
}

function request(method: string, path: string, opts: { cookie?: string; body?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(`https://site.test${path}`, { method, headers, body: opts.body });
}

const loginRequest = (body: string) => request("POST", "/api/studio/login", { body });

describe("loginHandler", () => {
  it("answers 503 when the studio has no secret", async () => {
    delete process.env[SECRET];
    const res = await login.POST(loginRequest(JSON.stringify({ passphrase: "artist-key" })));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The studio is not configured yet." });
  });

  it("answers 400 to a body it cannot read", async () => {
    const res = await login.POST(loginRequest("not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Could not read that." });
  });

  it("answers 401 to a wrong passphrase, naming no role and setting no cookie", async () => {
    const res = await login.POST(loginRequest(JSON.stringify({ passphrase: "nope" })));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "That passphrase is not right." });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("makes a wrong guess wait before it is answered", async () => {
    const slow = loginHandler({ auth, wrongKeyDelayMs: 60 });
    const started = Date.now();
    await slow.POST(loginRequest(JSON.stringify({ passphrase: "nope" })));
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it("signs the role into a cookie on the right passphrase", async () => {
    const res = await login.POST(loginRequest(JSON.stringify({ passphrase: "artist-key" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "artist" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^kit_studio=[^;]+; Path=\/;/);
    expect(setCookie).toContain("HttpOnly");
    const token = setCookie.slice("kit_studio=".length, setCookie.indexOf(";"));
    expect(await auth.verify(token)).toBe("artist");
  });

  it("logs out by expiring the cookie", async () => {
    const res = await login.DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toMatch(/^kit_studio=; .*Max-Age=0/);
  });
});

describe("workHandler", () => {
  it("is locked without a cookie", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).GET(request("GET", "/api/studio/work"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "locked" });
  });

  it("is locked to a forged cookie", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: "kit_studio=operator.9999999999.forged" }),
    );
    expect(res.status).toBe(401);
  });

  it("says when no store is connected rather than showing an empty record", async () => {
    const { store } = memoryStore({ connected: false });
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: await cookieFor("artist") }),
    );
    expect(await res.json()).toEqual({ configured: false, overlays: {} });
  });

  it("returns every saved overlay to a signed-in role", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configured: true,
      overlays: { "waterscape-01": { title: "Saved" } },
    });
  });

  it("refuses to save when no store is connected", async () => {
    const { store } = memoryStore({ connected: false });
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "Alcyone" }),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "No store is connected, so nothing would be saved." });
  });

  it("refuses a body over the length limit", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog, maxBodyLength: 20 }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "long enough" }),
      }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "That is too long." });
  });

  it("refuses a body that is not a JSON object", async () => {
    const { store } = memoryStore();
    const handler = workHandler({ auth, store, catalog });
    const cookie = await cookieFor("artist");
    for (const body of ["not json", "null", "[]", "42"]) {
      const res = await handler.PUT(request("PUT", "/api/studio/work", { cookie, body }));
      expect(res.status, body).toBe(400);
    }
  });

  it("refuses a slug that is not a work on the site", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "ghost", title: "x" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "That is not a work on this site." });
  });

  it("saves the cleaned overlay as the signed-in role", async () => {
    const { store, writes } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: " Alcyone ", src: "/evil.png" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(writes).toEqual([{ slug: "waterscape-01", overlay: { title: "Alcyone" }, by: "artist" }]);
  });

  it("says so when the store does not accept a save", async () => {
    const { store } = memoryStore({ accepts: false });
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "Alcyone" }),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });

  it("lets only a role that can reset discard a record", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("artist"),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Not permitted." });
  });

  it("refuses to reset a slug that is not a work on the site", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=ghost", { cookie: await cookieFor("operator") }),
    );
    expect(res.status).toBe(404);
  });

  it("resets a record to its base for a role that can", async () => {
    const { store, data } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("operator"),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(data["waterscape-01"]).toBeUndefined();
  });

  it("says so when the store does not accept a reset", async () => {
    const { store } = memoryStore({ accepts: false });
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("operator"),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run src/artist/handlers.test.ts 2>&1 | tail -8`
Expected: FAIL, module `./handlers` missing.

- [ ] **Step 3: Write the handlers**

Create `src/artist/handlers.ts`:

```ts
import { cleanOverlay, cleanText } from "./overlay";
import type { StudioAuth } from "./studio-auth";
import type { StudioStore } from "./studio-store";

/**
 * The studio's routes, framework-free: each handler takes a Web Request and
 * returns a Response, so a site's route file only wires them up.
 *
 * Every handler verifies the signed cookie itself. A hidden studio link is never
 * the gate.
 */

/** What the handlers need to know about the site's catalog: whether a slug is a work
    on this site. An overlay can only describe a work that exists, so a studio route
    cannot be used to conjure a painting or to point one at someone else's image. */
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

export interface WorkHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  store: StudioStore;
  catalog: StudioCatalog;
  /** The longest request body accepted, in characters. Default 8000. */
  maxBodyLength?: number;
}

export interface WorkHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers });
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
      return json({ error: "Could not read that." }, 400);
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
}: WorkHandlerOptions<R>): WorkHandler {
  const locked = () => json({ error: "locked" }, 401);
  const notAWork = () => json({ error: "That is not a work on this site." }, 404);
  const refused = () => json({ error: "The store did not accept that." }, 503);

  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, overlays: {} });
    return json({ configured: true, overlays: (await store.readOverlays(true)) ?? {} });
  }

  async function PUT(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) {
      return json({ error: "No store is connected, so nothing would be saved." }, 503);
    }

    const raw = await request.text();
    if (raw.length > maxBodyLength) {
      return json({ error: "That is too long." }, 413);
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return json({ error: "Could not read that." }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Could not read that." }, 400);
    }

    const slug = cleanText(body.slug, 120);
    if (!slug || !catalog.has(slug)) return notAWork();

    const ok = await store.writeOverlay(slug, cleanOverlay(body), who);
    return ok ? json({ ok: true }) : refused();
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
    const ok = await store.clearOverlay(slug);
    return ok ? json({ ok: true }) : refused();
  }

  return { GET, PUT, DELETE };
}
```

Replace `src/artist/index.ts` with:

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
export * from "./record";
export * from "./studio-auth";
export * from "./studio-store";
```

- [ ] **Step 4: Run the tests, typecheck and lint**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec vitest run src/artist/handlers.test.ts 2>&1 | grep -E "Tests " && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2 && rg -n "from \"(react|next)" src/artist || echo "no framework imports"
```

Expected: `Tests  20 passed (20)`; suite `42 passed (42)` files, `282 passed (282)` tests; typecheck and lint clean; last line `no framework imports`.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/handlers.ts src/artist/handlers.test.ts src/artist/index.ts && git -c commit.gpgsign=false commit -m "artist: studio login and work handlers over Web Request and Response"
```

---

### Task 7: Kit: public surface, version 0.10.0, release notes

**Files:**
- Create: `src/artist/index.test.ts`
- Modify: `package.json` (version), `CHANGELOG.md`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: everything exported from `src/artist/index.ts`.
- Produces: kit version `0.10.0`, the surface list phase 2 appends to.

- [ ] **Step 1: Write the surface test**

Create `src/artist/index.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as artist from "./index";

/** Every function a site can import. Phase 2 appends to this list; removing a name
    is a breaking change for every site on the module. */
const FUNCTIONS = [
  "catalogIds",
  "cleanOverlay",
  "cleanText",
  "createStudioAuth",
  "createStudioStore",
  "currentFirst",
  "cvGaps",
  "cvSections",
  "forDisplay",
  "formatAvailability",
  "formatDimensionsLine",
  "formatEdition",
  "formatLabel",
  "formatMediumLine",
  "formatTitleLine",
  "groupByAvailability",
  "hasAvailabilityData",
  "hasCvContent",
  "isFullyDocumented",
  "isPurchasable",
  "loginHandler",
  "merge",
  "mergeAll",
  "missingFields",
  "newestFirst",
  "readCookie",
  "workHandler",
];

describe("@iserlabs/web-kit/artist", () => {
  it("exports exactly the functions sites build on", () => {
    const names = Object.entries(artist)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(names).toEqual(FUNCTIONS);
  });

  it("is published at the ./artist path", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(pkg.exports["./artist"]).toBe("./src/artist/index.ts");
  });

  it("takes a site's config as written, its cookie and store names included", () => {
    const config = {
      catalogPrefix: "JP-",
      studio: {
        cookieName: "jp_studio",
        secretEnv: "STUDIO_SECRET",
        roles: [
          { id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" },
          { id: "jake", passphraseEnv: "STUDIO_PASS_JAKE", canReset: true },
        ],
        storeKey: "studio:julian:overlays",
      },
    } as const satisfies artist.ArtistConfig;
    const auth = artist.createStudioAuth(config.studio);
    const store = artist.createStudioStore({ key: config.studio.storeKey });
    expect(auth.cookieName).toBe("jp_studio");
    expect(store.key).toBe("studio:julian:overlays");
    expect(auth.canReset("jake")).toBe(true);
    expect(auth.canReset("julian")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm exec vitest run src/artist/index.test.ts 2>&1 | grep -E "Tests |FAIL|Expected|Received" | head -20`
Expected: `Tests  3 passed (3)`. The surface already exists, so this test pins it rather than driving it. If the first test fails, the diff names the function that is missing or extra: fix the export, not the list.

- [ ] **Step 3: Bump the version**

In `package.json`, replace `"version": "0.9.2",` with `"version": "0.10.0",`.

- [ ] **Step 4: Changelog**

In `CHANGELOG.md`, replace the line `## 0.9.2` with:

```markdown
## 0.10.0
- **`@iserlabs/web-kit/artist`**, new export: the parts of an artist's portfolio site that are the same on every artist's site, extracted from julianpotulicki.com with no change to what that site shows. Framework-free `.ts` with no React and no Next imports; every server handler takes a Web `Request` and returns a `Response`.
  - Record: the `Artwork` type (Carole 06 fields; `Artwork<S>` takes the site's own series ids), the label formatters, `isPurchasable`, `missingFields`, `isFullyDocumented`, and `catalogIds(slugs, prefix)` for stable numbering under the site's prefix.
  - Availability: `groupByAvailability`, `hasAvailabilityData`, `currentFirst`, `forDisplay`, each given the works.
  - CV: the CV types plus `cvSections`, `newestFirst`, `cvGaps`, `hasCvContent`, each given the site's CV.
  - Studio auth: `createStudioAuth({ cookieName, roles, secretEnv })`, signed role cookies over Web Crypto that fail closed. The cookie format is the one julianpotulicki.com already issues, so adopting the module logs nobody out.
  - Studio store: `createStudioStore({ key })`, per-work overlays over Upstash REST with plain `fetch`, plus `merge` and `mergeAll`. `cachedRead` passes a framework's fetch options (Next's `revalidate`) through without importing the framework.
  - `cleanOverlay(body)`: the one validation every studio edit passes.
  - `loginHandler` and `workHandler`: the studio routes; a site's route file wires them up in a few lines. A work edit whose body is JSON but not an object now answers 400 instead of throwing.
- A site switches the module on with `"web-kit": { "artist": { "enabled": true } }` in its `package.json`. Shows, the press kit, the payments adapter and `web-kit artist init` follow in the next release.

## 0.9.2
```

- [ ] **Step 5: CLAUDE.md Exports line**

In `CLAUDE.md`, replace:

```
env, utils, audits, brand-pack, observability, observability/env, observability/server}`. Notes:
```

with:

```
env, utils, audits, brand-pack, artist, observability, observability/env, observability/server}`. Notes:
```

and replace:

```
  are scoped sub-paths for env-var access and server-side transport.
```

with:

```
  are scoped sub-paths for env-var access and server-side transport.
- `artist` is the artist-site module (artwork record, availability, CV, studio
  auth, studio store, studio route handlers), first used by julianpotulicki.com.
  Framework-free `.ts`: handlers take a Web `Request` and return a `Response`, and
  the visible pages stay in each site. A site switches it on with
  `"web-kit": { "artist": { "enabled": true } }` in its `package.json`.
```

- [ ] **Step 6: README section**

Append to `README.md`:

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && cat >> README.md <<'EOF'

## Artist module

`@iserlabs/web-kit/artist` holds the parts of an artist's portfolio site that are
the same on every artist's site: the artwork record and its label formatters,
availability, the CV, and the studio (signed role cookies, per-work overlays over
Upstash, and the login and work route handlers). It carries no React and no Next
imports; each handler takes a Web `Request` and returns a `Response`.

A site keeps its own names in `src/artist.config.ts` and wires a route in a few
lines:

    // src/app/api/studio/work/route.ts
    import { workHandler } from "@iserlabs/web-kit/artist";
    import { artworkBySlug } from "@/content/artworks";
    import { studioAuth, studioStore } from "@/lib/studio";

    const work = workHandler({
      auth: studioAuth,
      store: studioStore,
      catalog: { has: (slug) => artworkBySlug(slug) !== undefined },
    });

    export const GET = work.GET;
    export const PUT = work.PUT;
    export const DELETE = work.DELETE;

Switch it on in the site's `package.json` with
`"web-kit": { "artist": { "enabled": true } }`.
EOF
```

- [ ] **Step 7: Full gate and the writing check**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && pnpm exec biome check --write src/artist && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -2 && pnpm lint 2>&1 | tail -2 && git diff 578fa14 -- src package.json CHANGELOG.md CLAUDE.md README.md | grep '^+' | grep -c $'\xe2\x80\x94'; git diff 578fa14 -- src | grep '^+' | grep -inE 'catalog(ue)|fulfi(l)ment|behavio(u)r|colo(u)r|hono(u)r|favo(u)r|defen(c)e|artef(a)ct'
```

Expected: `43 passed (43)` files, `285 passed (285)` tests; typecheck and lint clean; the em dash count prints `0` (no em dash in any added line); the British-spelling grep prints nothing.

- [ ] **Step 8: Commit**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git add src/artist/index.test.ts package.json CHANGELOG.md CLAUDE.md README.md && git -c commit.gpgsign=false commit -m "release: v0.10.0, the artist module (phase 1)"
```

---

### Task 8: Julian builds against the local kit (snapshot B)

**Files:**
- Modify: `/Users/macbook/Claude/julianpotulicki/package.json`, `/Users/macbook/Claude/julianpotulicki/pnpm-lock.yaml`

**Interfaces:**
- Consumes: the kit at the Task 7 commit, through `file:`.
- Produces: `node_modules/@iserlabs/web-kit` at version 0.10.0 with `src/artist/`; snapshot B in `.qa/B` (with `private/cookie.txt`, a cookie issued by Julian's ORIGINAL studio code, which Task 11 replays); the `wk:audit` verdict in `.qa/B/wk-audit.txt`.

- [ ] **Step 1: Point the dependency at the worktree and switch the module on**

In `/Users/macbook/Claude/julianpotulicki/package.json`, replace:

```json
    "@iserlabs/web-kit": "github:iserlabs/web-kit#v0.7.0",
```

with:

```json
    "@iserlabs/web-kit": "file:/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail",
```

and replace:

```json
    "vitest": "^4.0.0"
  }
}
```

with:

```json
    "vitest": "^4.0.0"
  },
  "web-kit": {
    "artist": {
      "enabled": true
    }
  }
}
```

`file:` is used rather than `link:` on purpose: pnpm copies the kit into `node_modules/.pnpm`, inside the project, so Turbopack and Vitest see it exactly as they will see the GitHub tarball, and `next.config.ts` already lists `@iserlabs/web-kit` in `transpilePackages`, so no Next config change is needed. A `link:` symlink would point outside the project root, which Turbopack refuses without a `turbopack.root` change. A plain `pnpm install` re-copies a `file:` directory, so after ANY later kit edit, run `pnpm install` here before testing (checked 2026-10-12). Vitest already transforms TypeScript from `node_modules` without extra config (checked 2026-10-12 against the current kit).

- [ ] **Step 2: Install (online; offline cannot re-resolve)**

`pnpm install --offline` fails after this change (`ERR_PNPM_NO_OFFLINE_TARBALL` for packages the re-resolution needs, checked 2026-10-12); an online install against the npm registry works.

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm install 2>&1 | tail -3 && node -p 'require("./node_modules/@iserlabs/web-kit/package.json").version' && ls node_modules/@iserlabs/web-kit/src/artist && git diff --stat pnpm-lock.yaml && git diff pnpm-lock.yaml | grep -E '^[-+] ' | grep -vE 'web-kit|node-html-parser'
```

Expected: `0.10.0`; the artist files listed; the lockfile diff touches only the web-kit entries and `node-html-parser` (8.0.3 to 9.0.4, a kit dependency bump since v0.7.0), so the last command prints nothing. Any other changed package: stop and report.

- [ ] **Step 3: Julian's own suite, unchanged code, new kit**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3
```

Expected: `Tests  98 passed (98)`; typecheck and lint clean. The kit's Biome preset moved from v0.7.0 to 0.10.0 (`a11y/noRedundantRoles` turned off, schema 2.5.3), which only relaxes a rule.

- [ ] **Step 4: Build B and snapshot it**

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/B && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/B/build.log 2>&1; tail -45 .qa/B/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/B/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/B/routes.txt
```

Start the server in the background (`run_in_background: true`), after `lsof -ti tcp:3111 || echo free` prints `free`:

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3111
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/B; kill -9 $(lsof -ti tcp:3111)
```

Expected: `snapshot .qa/B: 8 pages, 11 studio API answers, ...`, every page `200`.

- [ ] **Step 5: Compare A and B**

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && diff -r A/pages B/pages && diff A/headers.json B/headers.json && diff A/api.json B/api.json && diff A/routes.txt B/routes.txt && echo "PAGES HEADERS API ROUTES IDENTICAL"; diff A/css.txt B/css.txt
```

Expected: `PAGES HEADERS API ROUTES IDENTICAL`. The CSS is either identical or differs in one place only: the `.dark` rule gains `color-scheme:dark` (kit 0.9.2 token contract change; Julian never applies the `.dark` class, so nothing visible changes). Any other difference: stop and use superpowers:systematic-debugging before going on.

- [ ] **Step 6: Record the audit verdict on the new kit**

The audit builds and serves on its own port (3100, from `web-kit.audits.config.mjs`) with the real environment, so it runs after the snapshot (it overwrites `.next`).

```bash
cd /Users/macbook/Claude/julianpotulicki && (lsof -ti tcp:3100 || echo "3100 free") && pnpm wk:audit > .qa/B/wk-audit.txt 2>&1; tail -25 .qa/B/wk-audit.txt
```

Expected: the required tier passes (the repo carries the `web-kit.template.json` marker, so the brand-pack check is skipped). If it fails, record the failing codes: Task 11 must show the same verdict, and a failure that exists here was not caused by the extraction.

- [ ] **Step 7: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add package.json pnpm-lock.yaml && git -c commit.gpgsign=false commit -m "Build against the local web-kit 0.10.0 while it is unpublished, and switch on the artist module"
```

---

### Task 9: Julian's studio on the kit

**Files:**
- Create: `/Users/macbook/Claude/julianpotulicki/src/artist.config.ts`, `src/lib/studio.ts`, `src/lib/studio.test.ts`
- Modify: `src/app/api/studio/login/route.ts`, `src/app/api/studio/work/route.ts`, `src/app/studio/page.tsx`, `src/app/work/[slug]/page.tsx`
- Delete: `src/lib/studio-auth.ts`, `src/lib/studio-auth.test.ts`, `src/lib/studio-store.ts`, `src/lib/studio-store.test.ts`

Julian paths in Tasks 9 to 11 are relative to `/Users/macbook/Claude/julianpotulicki`. Before editing route files, read the Caching section of `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (AGENTS.md: this Next version differs from training data). It confirms route handlers are not cached by default, and a GET that reads request headers is never prerendered, so the work route stays dynamic.

**Interfaces:**
- Consumes: `createStudioAuth`, `createStudioStore`, `loginHandler`, `workHandler`, `merge`, `mergeAll`, `ArtistConfig` from `@iserlabs/web-kit/artist`.
- Produces: `artistConfig` (`src/artist.config.ts`, with `catalogPrefix` used by Task 10); `studioAuth: StudioAuth<"julian" | "jake">` and `studioStore: StudioStore` from `@/lib/studio`.

- [ ] **Step 1: Write the failing compatibility test**

Create `src/lib/studio.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artistConfig } from "@/artist.config";
import { studioAuth, studioStore } from "./studio";

const original = { ...process.env };

beforeEach(() => {
  process.env.STUDIO_SECRET = "test-secret-value";
  process.env.STUDIO_PASS_JULIAN = "julian-key";
  process.env.STUDIO_PASS_JAKE = "jake-key";
});

afterEach(() => {
  process.env = { ...original };
});

describe("Julian's studio keeps the names already in production", () => {
  it("uses the jp_studio cookie, his store key and the JP- catalog prefix", () => {
    expect(studioAuth.cookieName).toBe("jp_studio");
    expect(studioStore.key).toBe("studio:julian:overlays");
    expect(artistConfig.catalogPrefix).toBe("JP-");
  });

  it("still opens for a cookie signed the way the old studio signed it", async () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const payload = `julian.${expires}`;
    const mac = createHmac("sha256", "test-secret-value").update(payload).digest("base64url");
    expect(await studioAuth.verify(`${payload}.${mac}`)).toBe("julian");
  });

  it("gives each passphrase its role, and lets only Jake reset a record", () => {
    expect(studioAuth.roleFor("julian-key")).toBe("julian");
    expect(studioAuth.roleFor("jake-key")).toBe("jake");
    expect(studioAuth.canReset("jake")).toBe(true);
    expect(studioAuth.canReset("julian")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec vitest run src/lib/studio.test.ts 2>&1 | tail -6`
Expected: FAIL, `@/artist.config` and `./studio` missing.

- [ ] **Step 3: Write the config and the studio module**

Create `src/artist.config.ts`:

```ts
import type { ArtistConfig } from "@iserlabs/web-kit/artist";

/**
 * Julian's settings for the kit's artist module (`@iserlabs/web-kit/artist`).
 *
 * Every name here is the one already in production: the `jp_studio` cookie, the
 * Upstash key his studio edits live under, the `JP-` catalog numbers and the two
 * passphrase variables. Changing any of them logs everyone out, orphans his saved
 * edits or renumbers his works, so they stay exactly as they are.
 */
export const artistConfig = {
  catalogPrefix: "JP-",
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
  },
} as const satisfies ArtistConfig;
```

Create `src/lib/studio.ts`:

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
  // The public artwork pages read through this. A timed revalidate keeps those 34
  // pages static and still lands a studio edit within the minute; an uncached read
  // would turn every one of them dynamic. The studio's own screens read fresh.
  cachedRead: { next: { revalidate: 60 } },
});
```

- [ ] **Step 4: Wire the two routes**

Replace the whole of `src/app/api/studio/login/route.ts` with:

```ts
import { loginHandler } from "@iserlabs/web-kit/artist";
import { studioAuth } from "@/lib/studio";

/**
 * The studio door: one passphrase in, one signed role cookie out, slow to answer a
 * wrong key. The handler lives in the kit; Julian's names come from
 * `src/artist.config.ts`.
 */
const login = loginHandler({ auth: studioAuth });

export const POST = login.POST;
export const DELETE = login.DELETE;
```

Replace the whole of `src/app/api/studio/work/route.ts` with:

```ts
import { workHandler } from "@iserlabs/web-kit/artist";
import { artworkBySlug } from "@/content/artworks";
import { studioAuth, studioStore } from "@/lib/studio";

/**
 * Reading and writing what is KNOWN about a work. The handler (cookie check, field
 * validation, Jake-only reset) lives in the kit; this file says which works exist.
 * An overlay can only describe a work in the repo catalog, so this route cannot be
 * used to conjure a painting or to point one at someone else's image.
 */
const work = workHandler({
  auth: studioAuth,
  store: studioStore,
  catalog: { has: (slug) => artworkBySlug(slug) !== undefined },
});

export const GET = work.GET;
export const PUT = work.PUT;
export const DELETE = work.DELETE;
```

- [ ] **Step 5: Point the two pages at the new module**

In `src/app/studio/page.tsx`, replace:

```ts
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { missingFields } from "@/content/artwork";
import { artworks } from "@/content/artworks";
import { STUDIO_COOKIE, studioConfigured, verify } from "@/lib/studio-auth";
import { mergeAll, readOverlays } from "@/lib/studio-store";
```

with:

```ts
import { mergeAll } from "@iserlabs/web-kit/artist";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { missingFields } from "@/content/artwork";
import { artworks } from "@/content/artworks";
import { studioAuth, studioStore } from "@/lib/studio";
```

and replace:

```ts
  const role = await verify(jar.get(STUDIO_COOKIE)?.value);
  const configured = studioConfigured();
  const overlays = role ? ((await readOverlays(true)) ?? {}) : {};
```

with:

```ts
  const role = await studioAuth.verify(jar.get(studioAuth.cookieName)?.value);
  const configured = studioAuth.configured();
  const overlays = role ? ((await studioStore.readOverlays(true)) ?? {}) : {};
```

In `src/app/work/[slug]/page.tsx`, replace:

```ts
import type { Metadata } from "next";
import Image from "next/image";
```

with:

```ts
import { merge } from "@iserlabs/web-kit/artist";
import type { Metadata } from "next";
import Image from "next/image";
```

replace:

```ts
import { merge, readOverlays } from "@/lib/studio-store";
```

with:

```ts
import { studioStore } from "@/lib/studio";
```

and replace:

```ts
  const artwork = merge(base, (await readOverlays())?.[w.slug]);
```

with:

```ts
  const artwork = merge(base, (await studioStore.readOverlays())?.[w.slug]);
```

- [ ] **Step 6: Delete the moved files**

```bash
cd /Users/macbook/Claude/julianpotulicki && git rm -q src/lib/studio-auth.ts src/lib/studio-auth.test.ts src/lib/studio-store.ts src/lib/studio-store.test.ts && rg -n "@/lib/studio-(auth|store)|STUDIO_COOKIE|[^.]readOverlays\(" src || echo "no old studio imports"
```

Expected: `no old studio imports` (every remaining call is `studioStore.readOverlays(...)`, which the pattern skips).

- [ ] **Step 7: Format and run the gates**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src/artist.config.ts src/lib/studio.ts src/lib/studio.test.ts src/app/api/studio src/app/studio/page.tsx "src/app/work/[slug]/page.tsx" && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3
```

Expected: `Tests  77 passed (77)` (98, minus the 24 studio tests that moved to the kit, plus these 3); typecheck and lint clean.

- [ ] **Step 8: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add -A src/artist.config.ts src/lib src/app/api/studio src/app/studio/page.tsx "src/app/work/[slug]/page.tsx" && git status --short && git -c commit.gpgsign=false commit -m "Studio: sign-in, saving and the store now come from web-kit, with the same cookie, key and roles"
```

Expected: `git status --short` before the commit lists only the files in this task.

---

### Task 10: Julian's record, availability and CV on the kit

**Files:**
- Modify: `src/content/artworks.ts` (rewrite), `src/content/artworks.test.ts` (one import), `src/content/availability.test.ts` (rewrite), `src/content/cv.ts` (rewrite), `src/content/cv.test.ts` (rewrite), `src/app/cv/page.tsx`, `src/components/ArtworkLabel.tsx`, `src/app/studio/page.tsx`, `src/app/work/[slug]/page.tsx`
- Delete: `src/content/artwork.ts`, `src/content/artwork.test.ts`, `src/content/availability.ts`

**Interfaces:**
- Consumes: `Artwork`, `Unit`, `catalogIds`, the formatters, `missingFields`, `forDisplay`, `groupByAvailability`, `hasAvailabilityData`, `Cv`, `cvSections`, `cvGaps`, `newestFirst` from `@iserlabs/web-kit/artist`; `artistConfig.catalogPrefix`; `SeriesId`, `Work`, `works`, `enhancedSlugs` from `./works`.
- Produces: `artworks: Artwork<SeriesId>[]` and the same helper names Julian's pages already import (`artworkBySlug`, `publishedArtworks`, `availableArtworks`, `soldArtworks`, `artworksInSeries`, `parseMedium`, `DEFAULT_UNIT`); `cv: Cv`.

- [ ] **Step 1: Rewrite the tests of Julian's content first**

Replace the whole of `src/content/availability.test.ts` with:

```ts
import { forDisplay, groupByAvailability, hasAvailabilityData } from "@iserlabs/web-kit/artist";
import { describe, expect, it } from "vitest";
import { artworks } from "./artworks";

/** The rules themselves are tested in the kit. These check Julian's live catalog. */
describe("the live catalog says nothing about availability yet", () => {
  it("reports no availability data for the catalog as it stands today", () => {
    expect(hasAvailabilityData(artworks)).toBe(false);
  });

  it("groups the whole live catalog as unstated rather than available", () => {
    const g = groupByAvailability(artworks);
    expect(g.unstated).toHaveLength(artworks.length);
    expect(g.available).toHaveLength(0);
  });

  it("leaves today's catalog in its authored order, since nothing is stated", () => {
    expect(forDisplay(artworks).map((w) => w.slug)).toEqual(artworks.map((w) => w.slug));
  });
});
```

Replace the whole of `src/content/cv.test.ts` with:

```ts
import { cvGaps, cvSections } from "@iserlabs/web-kit/artist";
import { describe, expect, it } from "vitest";
import { cv } from "./cv";

/** The CV rules are tested in the kit. These check Julian's own record. */
describe("Carole 13: no empty headings on Julian's CV", () => {
  it("omits group, press and awards while they are empty", () => {
    const ids = cvSections(cv).map((s) => s.id);
    expect(ids).not.toContain("group");
    expect(ids).not.toContain("press");
    expect(ids).not.toContain("awards");
  });

  it("shows the sections that do have entries", () => {
    expect(cvSections(cv).map((s) => s.id)).toContain("solo");
  });
});

describe("Carole 10: his record", () => {
  it("carries the real exhibitions across from the site record", () => {
    expect(cv.soloExhibitions.length).toBeGreaterThan(0);
    expect(cv.soloExhibitions.map((e) => e.title)).toContain("Light Codes");
  });

  it("keeps venue and location as separate fields", () => {
    const first = cv.soloExhibitions[0];
    expect(first.venue).toBeTruthy();
    expect(first.location).toBeTruthy();
  });
});

describe("honest content", () => {
  it("invents no education, press or awards", () => {
    expect(cv.education).toEqual([]);
    expect(cv.press).toEqual([]);
    expect(cv.awards).toEqual([]);
  });

  it("names what is still missing rather than leaving it silent", () => {
    expect(cvGaps(cv)).toContain("education, mentors or meaningful study");
  });
});
```

In `src/content/artworks.test.ts`, replace:

```ts
import { formatLabel, isFullyDocumented, missingFields } from "./artwork";
```

with:

```ts
import { formatLabel, isFullyDocumented, missingFields } from "@iserlabs/web-kit/artist";
```

- [ ] **Step 2: Run them**

Run: `cd /Users/macbook/Claude/julianpotulicki && pnpm exec vitest run src/content 2>&1 | grep -E "Tests |FAIL" | head`
Expected: all pass (`availability.test.ts` 3, `cv.test.ts` 6, `artworks.test.ts` 15, plus `artwork.test.ts` 21 and `dimensions.test.ts` 5 still present). They pass now because the kit functions exist; Step 6 proves they still pass once Julian's copies are gone.

- [ ] **Step 3: Rewrite `src/content/artworks.ts`**

```ts
import { type Artwork, catalogIds, type Unit } from "@iserlabs/web-kit/artist";
import { artistConfig } from "@/artist.config";
import { enhancedSlugs, type SeriesId, type Work, works } from "./works";

/**
 * The catalog, in the shape the rest of the site reads.
 *
 * This DERIVES from the legacy `works` array rather than replacing it with 34
 * hand-transcribed records. Transcribing them by hand would introduce exactly the
 * errors the record was built to prevent, and the legacy array is still what the
 * shipped pages import. When the studio takes over, this module's source swaps from
 * `works` to the store and every surface downstream is unaffected: that is the
 * point of deriving rather than duplicating.
 *
 * What the migration can and cannot recover:
 *
 * RECOVERED. Every legacy `medium` is already written "Oil on linen" form, so
 * splitting on " on " fills Carole 06's medium AND substrate for all 34 works at
 * once. Two of her six required fields, complete, today.
 *
 * NOT RECOVERED. Title, year, dimensions and availability were never captured for
 * any work. They stay undefined, the formatters drop their lines, and the studio is
 * how they arrive. `missingFields` reports the gap per work rather than hiding it.
 */

/** Provisional catalog numbers, assigned by sorted slug so the mapping is stable
    regardless of array order. The studio takes over issuance; a number that has been
    printed on a certificate must never be reassigned. The prefix is Julian's
    (`src/artist.config.ts`); the numbering lives in the kit. */
const catalogNumbers = catalogIds(
  works.map((w) => w.slug),
  artistConfig.catalogPrefix,
);

/**
 * "Oil on linen" -> { medium: ["Oil"], substrate: "linen" }.
 * A string with no " on " is treated as material only: inventing a substrate we
 * were never told would be a fabricated fact on a record a collector may rely on.
 */
export function parseMedium(value: string | undefined): {
  medium?: string[];
  substrate?: string;
} {
  const raw = value?.trim();
  if (!raw) return {};
  const at = raw.toLowerCase().lastIndexOf(" on ");
  if (at === -1) return { medium: splitMaterials(raw) };
  return {
    medium: splitMaterials(raw.slice(0, at)),
    substrate: raw.slice(at + 4).trim() || undefined,
  };
}

/** "Oil, graphite and wax" -> ["Oil", "graphite", "wax"]. Carole 06 bans a single
    "mixed media" blob, so materials are stored as a list from the start. */
function splitMaterials(value: string): string[] {
  return value
    .split(/,| and /i)
    .map((m) => m.trim())
    .filter(Boolean);
}

export const DEFAULT_UNIT: Unit = "in";

function toArtwork(w: Work): Artwork<SeriesId> {
  const { medium, substrate } = parseMedium(w.medium);
  return {
    slug: w.slug,
    catalogId: catalogNumbers.get(w.slug) ?? `${artistConfig.catalogPrefix}${w.slug}`,
    // Title and year are genuinely unknown. Left undefined so the formatter prints
    // "Untitled" honestly rather than a guess.
    medium,
    substrate,
    series: w.series,
    // Availability was never recorded. Undefined means the site says nothing about
    // buying this piece, which is correct: implying it is for sale would be a claim
    // we cannot support.
    lifecycle: "current",
    // Preserves what is live today. Julian said he does not want the notebook
    // dumped online, but he has not yet said WHICH works come down; that is what
    // the intake asks. Unpublishing on his behalf before he answers would be us
    // making an editorial call about his practice without him.
    publish: "published",
    masterSrc: w.src,
    src: w.src,
    hi: w.hi ?? (enhancedSlugs.has(w.slug) ? `/works-hi/${w.slug}.jpeg` : undefined),
    alt: w.alt,
    aspect: w.aspect,
    feature: w.feature,
  };
}

export const artworks: Artwork<SeriesId>[] = works.map(toArtwork);

export const artworkBySlug = (slug: string): Artwork<SeriesId> | undefined =>
  artworks.find((a) => a.slug === slug);

/** What the public may see. Carole 05: sold work is separated, not mixed in. */
export const publishedArtworks = (): Artwork<SeriesId>[] =>
  artworks.filter((a) => a.publish === "published");

export const availableArtworks = (): Artwork<SeriesId>[] =>
  publishedArtworks().filter((a) => a.availability === "available");

export const soldArtworks = (): Artwork<SeriesId>[] =>
  publishedArtworks().filter((a) => a.availability === "sold");

export const artworksInSeries = (series: SeriesId): Artwork<SeriesId>[] =>
  publishedArtworks().filter((a) => a.series === series);
```

- [ ] **Step 4: Rewrite `src/content/cv.ts` and point the importers at the kit**

Replace the whole of `src/content/cv.ts` with:

```ts
import type { Cv } from "@iserlabs/web-kit/artist";
import { site } from "./site";

/**
 * Julian's CV. The shape, and the rules for what a CV page may show (Carole 10 and
 * 13), live in the kit at `@iserlabs/web-kit/artist`.
 *
 * Everything below is drawn from what Julian has actually supplied. Nothing is
 * invented: no degree, no residency, no press. The intake form asks him for the
 * rest, and `cvGaps` names what is still missing so it never quietly stays empty.
 */

/** Solo and group are separated because Carole asks for that separation. The two
    shows on record are both solo or solo-equivalent; the group list stays empty
    until Julian names one, and an empty list renders nothing. */
export const cv: Cv = {
  education: [],
  soloExhibitions: site.exhibitions.map((e) => ({
    year: e.year,
    title: e.title,
    venue: e.venue,
    location: e.location,
    href: e.href,
    note: e.role,
  })),
  groupExhibitions: [],
  press: [],
  awards: [],
};
```

In `src/app/cv/page.tsx`, replace:

```ts
import type { Metadata } from "next";
import DFoot from "@/components/DFoot";
import { cv, cvSections, newestFirst } from "@/content/cv";
```

with:

```ts
import { cvSections, newestFirst } from "@iserlabs/web-kit/artist";
import type { Metadata } from "next";
import DFoot from "@/components/DFoot";
import { cv } from "@/content/cv";
```

and replace:

```ts
  const sections = cvSections();
```

with:

```ts
  const sections = cvSections(cv);
```

In `src/components/ArtworkLabel.tsx`, replace:

```ts
} from "@/content/artwork";
```

with:

```ts
} from "@iserlabs/web-kit/artist";
```

In `src/app/studio/page.tsx`, replace:

```ts
import { mergeAll } from "@iserlabs/web-kit/artist";
```

with:

```ts
import { mergeAll, missingFields } from "@iserlabs/web-kit/artist";
```

and delete the line:

```ts
import { missingFields } from "@/content/artwork";
```

In `src/app/work/[slug]/page.tsx`, replace:

```ts
import { merge } from "@iserlabs/web-kit/artist";
```

with:

```ts
import { formatTitleLine, merge } from "@iserlabs/web-kit/artist";
```

and delete the line:

```ts
import { formatTitleLine } from "@/content/artwork";
```

- [ ] **Step 5: Delete Julian's copies of the moved logic**

```bash
cd /Users/macbook/Claude/julianpotulicki && git rm -q src/content/artwork.ts src/content/artwork.test.ts src/content/availability.ts && rg -n '@/content/(artwork|availability)"|from "\./(artwork|availability)"' src || echo "no old content imports"
```

Expected: `no old content imports`.

- [ ] **Step 6: Format and run the gates**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm exec biome check --write src/content src/app/cv/page.tsx src/components/ArtworkLabel.tsx src/app/studio/page.tsx "src/app/work/[slug]/page.tsx" && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3
```

Expected: `Tests  43 passed (43)` (77, minus 21 record, 9 availability and 4 CV tests that now live in the kit); typecheck and lint clean. The catalog-number test in `artworks.test.ts` still expects `JP-0001`, which proves the prefix and sort order survived.

- [ ] **Step 7: Commit**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add -A src/content src/app/cv/page.tsx src/components/ArtworkLabel.tsx src/app/studio/page.tsx "src/app/work/[slug]/page.tsx" && git status --short && git -c commit.gpgsign=false commit -m "Artwork record, availability and CV rules now come from web-kit; his catalog and CV stay here"
```

---

### Task 11: Prove zero visible change

**Files:**
- Modify: `docs/superpowers/RESUME-julian.md` (status line only)

**Interfaces:**
- Consumes: snapshot B and `.qa/B/private/cookie.txt` (Task 8), `.qa/B/wk-audit.txt`.
- Produces: snapshot C, the comparison verdict, the green gate.

- [ ] **Step 1: Build C and snapshot it, replaying B's cookie**

B's cookie was issued by Julian's original studio code with the QA secret and lasts 12 hours, so run this within 12 hours of Task 8 Step 4.

```bash
cd /Users/macbook/Claude/julianpotulicki && mkdir -p .qa/C && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/C/build.log 2>&1; tail -45 .qa/C/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/C/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/C/routes.txt
```

This build is also the proof that Next and Turbopack transpile the kit's `src/artist` TypeScript from `node_modules` (through the `transpilePackages` entry already present). Start the server in the background (`run_in_background: true`) after `lsof -ti tcp:3111 || echo free` prints `free`:

```bash
cd /Users/macbook/Claude/julianpotulicki && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm exec next start -p 3111
```

Then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/C .qa/B/private/cookie.txt; kill -9 $(lsof -ti tcp:3111)
```

Expected: `legacy cookie: 200 {"configured":false,"overlays":{}}`, then the snapshot summary with every page `200`.

- [ ] **Step 2: Compare B and C**

```bash
cd /Users/macbook/Claude/julianpotulicki/.qa && diff -r B/pages C/pages && diff B/headers.json C/headers.json && diff B/api.json C/api.json && diff B/routes.txt C/routes.txt && diff B/css.txt C/css.txt && diff B/pages/studio-desk.html C/legacy/studio-desk.html && echo "ZERO VISIBLE CHANGE: pages, cache policy, studio API, route table, CSS, legacy cookie"
```

Expected: the final line prints and nothing else does. What each part proves:
1\) `pages`: the seven routes plus the signed-in studio render the same markup and JSON-LD.
2\) `headers.json`: every page keeps its cache policy, so no static page turned dynamic.
3\) `api.json`: every studio answer has the same status and body, and the cookie the kit sets carries the same attributes Next set (`httponly`, `max-age=43200`, `path=/`, `samesite=lax`, `secure`).
4\) `routes.txt`: `/studio`, `/api/studio/login` and `/api/studio/work` keep their dynamic marker, and `/work/[slug]` keeps its 1-minute revalidate.
5\) `legacy`: a cookie issued by the old code opens the new studio to the same desk.

If the legacy check shows 401 because more than 12 hours passed, do not fake it: say so in the handback, and rely on the unit test "still opens for a cookie signed the way the old studio signed it" (Task 9). Any other difference: stop and use superpowers:systematic-debugging.

- [ ] **Step 3: Full gate**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && (lsof -ti tcp:3100 || echo "3100 free") && pnpm wk:audit > .qa/C/wk-audit.txt 2>&1; tail -25 .qa/C/wk-audit.txt; diff <(grep -iE 'pass|fail|error|ok' .qa/B/wk-audit.txt) <(grep -iE 'pass|fail|error|ok' .qa/C/wk-audit.txt) && echo "AUDIT VERDICT UNCHANGED"
```

Expected: `Tests  43 passed (43)`; typecheck and lint clean; the audit ends with the same verdict as Task 8 and `AUDIT VERDICT UNCHANGED` prints.

- [ ] **Step 4: Writing check on everything this branch added**

```bash
cd /Users/macbook/Claude/julianpotulicki && git diff payments-design -- . ':!pnpm-lock.yaml' | grep '^+' | grep -c $'\xe2\x80\x94'; git diff payments-design -- src scripts | grep '^+' | grep -inE 'catalog(ue)|fulfi(l)ment|behavio(u)r|colo(u)r|hono(u)r|favo(u)r|defen(c)e|artef(a)ct'; git log payments-design..HEAD --format='%B' | grep -icE 'claude|co-authored|generated with'
```

Expected: `0`, nothing, `0`.

- [ ] **Step 5: Update the RESUME and commit**

In `docs/superpowers/RESUME-julian.md`, replace:

```
**Order of work:** 1) extract into the kit (plan: kit `docs/superpowers/plans/2026-10-12-artist-module-phase1.md`), 2) shows + press kit, 3) payments.
```

with:

```
**Order of work:** 1) extract into the kit: DONE locally on branch `artist-module` (kit v0.10.0 in the worktree; this repo builds against it through a temporary `file:` dependency, so do not push until the kit is tagged and plan Task 12 pins `github:iserlabs/web-kit#v0.10.0`), 2) shows + press kit, 3) payments.
```

```bash
cd /Users/macbook/Claude/julianpotulicki && git add docs/superpowers/RESUME-julian.md && git -c commit.gpgsign=false commit -m "Resume: the extraction is done locally and proven to change nothing visible"
```

---

### Task 12: Publish kit v0.10.0 and pin it in Julian's site

**Blocked until both hold:** 1\) GitHub is reachable from the machine running this task (`git ls-remote https://github.com/iserlabs/web-kit.git HEAD` answers; from this sandbox `github.com` does not resolve, though `codeload.github.com` does). 2\) Jake has given an explicit GO to merge the kit PR to `main`. Pushing a branch and opening a PR are not gated; the merge and the tag are.

**Files:**
- Modify: `/Users/macbook/Claude/julianpotulicki/package.json`, `/Users/macbook/Claude/julianpotulicki/pnpm-lock.yaml`

**Interfaces:**
- Consumes: kit branch `artist-module` at the Task 7 commit; snapshot C.
- Produces: tag `v0.10.0` on `iserlabs/web-kit`; Julian pinned to `github:iserlabs/web-kit#v0.10.0`; snapshot D.

- [ ] **Step 1: Push the kit branch and open the PR**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && git push -u origin artist-module && gh pr create --repo iserlabs/web-kit --base main --head artist-module --title "artist: the artist module, phase 1 (v0.10.0)" --body "Adds @iserlabs/web-kit/artist: the artwork record, availability, CV, studio auth, studio store, overlay validation and the studio login and work handlers, extracted from julianpotulicki.com. Framework-free; handlers take a Web Request and return a Response. Julian's site builds against it with no visible change (render snapshots compared before and after). Also carries the payments rail and artist module specs. Version 0.10.0; see CHANGELOG."
```

Expected: a PR URL. Report it and stop for Jake's GO on the merge.

- [ ] **Step 2: After the GO, merge and tag**

```bash
cd /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail && gh pr merge --repo iserlabs/web-kit artist-module --squash && git fetch origin main --tags && git tag v0.10.0 origin/main && git push origin v0.10.0 && git rev-parse v0.10.0^{commit}
```

Expected: the tag's commit hash. Write it down as `KIT_SHA`.

- [ ] **Step 3: Pin the tag in Julian's site**

In `/Users/macbook/Claude/julianpotulicki/package.json`, replace:

```json
    "@iserlabs/web-kit": "file:/Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail",
```

with:

```json
    "@iserlabs/web-kit": "github:iserlabs/web-kit#v0.10.0",
```

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm install 2>&1 | tail -3 && grep -n -A2 "'@iserlabs/web-kit':" pnpm-lock.yaml | head -4 && diff -r node_modules/@iserlabs/web-kit/src/artist /Users/macbook/Claude/.claude-worktrees/web-kit-payments-rail/src/artist && echo "INSTALLED KIT MATCHES THE WORKTREE"
```

Expected: the lockfile specifier reads `github:iserlabs/web-kit#v0.10.0` and its version is a `codeload.github.com/iserlabs/web-kit/tar.gz/<KIT_SHA>` URL; `INSTALLED KIT MATCHES THE WORKTREE` prints.

- [ ] **Step 4: Gate and snapshot D**

```bash
cd /Users/macbook/Claude/julianpotulicki && pnpm install --frozen-lockfile 2>&1 | tail -2 && pnpm test 2>&1 | grep -E "Test Files|Tests " && pnpm typecheck 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && mkdir -p .qa/D && env KV_REST_API_URL= KV_REST_API_TOKEN= STUDIO_SECRET=qa-render-secret STUDIO_PASS_JULIAN=qa-julian-pass STUDIO_PASS_JAKE=qa-jake-pass NEXT_TELEMETRY_DISABLED=1 pnpm build > .qa/D/build.log 2>&1; tail -20 .qa/D/build.log && LC_ALL=en_US.UTF-8 grep -E '^[┌├└│]' .qa/D/build.log | LC_ALL=en_US.UTF-8 sed -E 's/^[┌├└│ ]+//' | awk '{print $1, $2}' > .qa/D/routes.txt
```

The frozen install proves CI's `pnpm install --frozen-lockfile` will pass. Start the server in the background as in Task 11 Step 1, then:

```bash
cd /Users/macbook/Claude/julianpotulicki && node scripts/qa/render-snapshot.mjs http://localhost:3111 .qa/D; kill -9 $(lsof -ti tcp:3111); cd .qa && diff -r C/pages D/pages && diff C/headers.json D/headers.json && diff C/api.json D/api.json && diff C/routes.txt D/routes.txt && diff C/css.txt D/css.txt && echo "TAGGED KIT RENDERS THE SAME AS THE LOCAL KIT"
```

Expected: `Tests  43 passed (43)`; typecheck and lint clean; the final line prints.

- [ ] **Step 5: Commit and open Julian's PR**

```bash
cd /Users/macbook/Claude/julianpotulicki && git add package.json pnpm-lock.yaml && git -c commit.gpgsign=false commit -m "Pin web-kit v0.10.0" && git push -u origin artist-module && gh pr create --base main --head artist-module --title "Artist module: the record, studio and CV now come from web-kit v0.10.0" --body "Moves the artwork record, availability, studio sign-in, studio saving and the CV rules into @iserlabs/web-kit/artist and imports them back. Same cookie, same store key, same catalog numbers: nobody is logged out and no saved edit moves. Render snapshots of /, /work, one artwork page, /cv, /about, /inquire and /studio are identical before and after; tests 43 passing (the moved tests now run in the kit)."
```

Expected: a PR URL. Merging it deploys to production, so it waits for Jake's GO (or a "ship it").

---

## Self-review

**Spec coverage (phase 1 rows of the spec table):**
1\) `artist/record`: Task 2 (`Artwork<S>` for the site's series, formatters and gap checks unchanged, `catalogIds` with the configured prefix).
2\) `artist/availability`: Task 3, every function takes the works.
3\) `artist/studio-auth`: Task 4, `createStudioAuth({ cookieName, roles, secretEnv })`, HMAC over Web Crypto, fails closed, format pinned by test.
4\) `artist/studio-store`: Task 5, `createStudioStore({ key })` over Upstash REST with plain `fetch`, `merge` and `mergeAll` unchanged; shows are left to a separate interface in phase 2.
5\) `artist/overlay`: Task 5, `cleanOverlay` pure.
6\) `artist/handlers`: Task 6, `loginHandler` and `workHandler` given auth, store and catalog; Julian's route files shrink to a few lines in Task 9.
7\) `artist/cv`: Task 3, types plus `cvSections`, `newestFirst`, `cvGaps`, `hasCvContent` with the source passed in. `cvFromShows` is phase 2.
8\) Julian compatibility (`jp_studio`, `studio:julian:overlays`, `JP-`, roles and env names, no data migration): Global Constraints, Task 9 config and tests, Task 11 legacy-cookie replay.
9\) Tests move with their code, Julian keeps tests of his content, both suites green: Tasks 2 to 7 (kit 166 to 285), Tasks 9 and 10 (Julian 98 to 43).
10\) Zero visible change, rendered check before and after: Tasks 1, 8, 11, 12. `wk:audit` before and after: Tasks 8 and 11.
11\) Kit wiring (export, CLAUDE.md, CHANGELOG, 0.10.0) and Julian's switch: Tasks 2, 7, 8.
12\) Local consumption and the final pin: Tasks 8 and 12.

**Type consistency checked:** `StudioAuth.cookieName`, `roleFor`, `issue`, `verify`, `configured`, `canReset`, `roleFrom`, `setCookie`, `clearCookie`; `StudioStore.key`, `configured`, `readOverlays`, `writeOverlay`, `clearOverlay`; `ArtistConfig.catalogPrefix` and `studio.storeKey`; `StudioCatalog.has`. The same names appear in Tasks 4 to 11 and in the surface list of Task 7.
