# Artist module: the artwork record, the studio, the CV, shows and the press kit

**Date:** 2026-10-12
**Status:** approved by Jake, 2026-10-12 ("DO IT"). Implementation plan to follow at `../plans/2026-10-12-artist-module.md`.
**Package:** `@iserlabs/web-kit`, new `artist` export, a `web-kit artist init` CLI subcommand
**First consumer:** julianpotulicki.com. Its own code is the source of the extraction.
**Sibling:** the payments rail, `2026-10-12-payments-rail-design.md`. The artist module ships the catalog adapter the rail asks for.
**Standard it encodes:** `~/.claude/docs/artist-site-standard.md` (the Carole test), which already names "julianpotulicki.com, Perry Lawson Fine Art, and every one after them".

## The rule this implements

Jake, 2026-10-12: "all the code we're building should be templated and able to be drawn forth for
future artist portfolio web platforms", and "I want all work that I do to potentially be recycled,
refined, reused, upgraded, refined endlessly. never a one-off."

So the parts of Julian's site that would be the same on any artist's site move into the kit. What
stays in his repo is what is his: the 34 paintings, his series, his words, his design.

## Order of work

1\) **Extract** the four existing parts (artwork record, availability, studio editing, CV) into the
kit, and switch Julian's site to import them, with no visible change and no data moved.
2\) **Shows and press kit**, built new inside the module, for his November exhibitions.
3\) **Payments**, per the sibling spec, wired to the module's catalog adapter.

Shows go before payments because November has a fixed date, and payments cannot take real money
until Julian supplies his Stripe account, tax number and terms.

## What moves, and what changes on the way

All of it is framework-free `.ts`. Server handlers take a Web `Request` and return a `Response`.
The kit carries no React (its standing convention); the visible parts are scaffolded into each site
by `artist init` and owned there.

| Kit unit | From Julian's file | Generalized how |
|---|---|---|
| `artist/record` | `src/content/artwork.ts` | `SeriesId` becomes `string`, and the site supplies its series list. Formatters, `missingFields`, `isFullyDocumented` and `isPurchasable` move unchanged. The catalog id prefix (`JP-`) comes from config. |
| `artist/availability` | `src/content/availability.ts` | Every function takes the works list as an argument. No module-level default import. |
| `artist/studio-auth` | `src/lib/studio-auth.ts` | `createStudioAuth({ cookieName, roles, secretEnv })`. Roles and the env var holding each role's passphrase come from config. HMAC over Web Crypto, failing closed, unchanged. |
| `artist/studio-store` | `src/lib/studio-store.ts` | `createStudioStore({ key })` over Upstash REST with plain `fetch`. Holds overlays (as now) and shows (new). `merge` and `mergeAll` move unchanged. |
| `artist/overlay` | the validation in `src/app/api/studio/work/route.ts` | `cleanOverlay(body)` becomes a pure function, so every site validates edits identically. |
| `artist/handlers` | `api/studio/login` and `api/studio/work` routes | `loginHandler`, `workHandler` and `showsHandler`, each given the auth, the store and the site's catalog. A site's route file becomes three lines. |
| `artist/cv` | `src/content/cv.ts` | The types and `cvSections`, `newestFirst`, `cvGaps` and `hasCvContent` move. New: `cvFromShows(shows)`, so a show typed once becomes its CV line. |
| `artist/shows` | new | below |
| `artist/press-kit` | new | below |
| `artist/payments-adapter` | new | the payments rail's `getItem` and `onStatus`, built on the record and the store |

**Julian keeps exact compatibility.** His config passes `cookieName: "jp_studio"`, his existing
Upstash key `studio:julian:overlays` and the `JP-` prefix, so his login cookies stay valid and his
saved edits are read in place. No data migration. His 98 tests stay green throughout; the ones that
test moved logic move with it into the kit, and his repo keeps the tests of his own content.

## Shows (new)

A show is created in the studio, not in code, because Julian enters his own facts. That is Jake's
ruling: a show page goes live only once its venue and dates are entered.

```ts
interface Show {
  slug: string;
  title: string;
  kind: "solo" | "group" | "two-person" | "event";
  venue: string;
  address?: string;
  city: string;
  startsOn: string;   // "2026-11-07", a calendar date in the site's time zone
  endsOn: string;     // inclusive
  opening?: { on: string; from: string; to?: string }; // "2026-11-07", "18:00", "21:00"
  workSlugs: string[];
  href?: string;      // the gallery's own page for the show
  note?: string;      // one line in the artist's words, printed verbatim
  publish: "published" | "draft";
}
```

1\) **Status is computed, never stored.** `showStatus(show, now, timeZone)` returns `upcoming`,
`current` or `past`. Date-only strings are resolved in the site's time zone (default
`America/New_York`), never parsed as UTC, and the tests prove it at an hour where UTC and New York
fall on different days, plus a time zone east of UTC.
2\) **Homepage notice.** `noticeShow(shows, now)` returns the current show, or else the next
upcoming one within 45 days, or nothing. The line comes down the day after a show closes, with no
manual step.
3\) **On view.** `onView(workSlug, shows, now)` returns the show a work is hanging in. A work on
view is never buyable on the site, so a gallery never has a work sold out from under it. This is the
fifth condition in the payments adapter's `isBuyable`.
4\) **Show pages** at `/shows/[slug]`: the venue, the dates, the opening, the address, and the works
hanging there, each linking to its artwork page, which in turn says "On view at ...". Past shows stay
as the exhibition record. Schema: `ExhibitionEvent` with `location`, `startDate`, `endDate` and
`workFeatured`.
5\) **CV.** `cvFromShows` turns every published, started show into a CV line, newest first, merged
with hand-entered entries. `solo` and `event` go under solo exhibitions (Julian's Alcyone evening
sits there today); `two-person` and `group` go under group exhibitions. An upcoming show is not on
the CV until it opens. One fact, typed once.

## Press kit (new)

An unlisted page for gallerists at `/press/<token>`. The token is a long random string set in the
studio and changeable there, so Julian can retire a link. Hidden from search engines with
`noindex` and left out of the sitemap. No password, per Jake.

It assembles: the statement, the CV, each work's full record with a download of the highest-
resolution image the site holds, and a price list. **The price list includes "on request" prices**
(Jake's ruling): gallerists need real numbers to plan a show, and Carole's rule still holds, one
price everywhere, only who sees it differs. Sold and not-for-sale works list as such, without a
price.

## The switch and scaffold

`package.json` -> `"web-kit": { "artist": { "enabled": true } }`.

`web-kit artist init` scaffolds `src/artist.config.ts` (site id, artist name, series list, roles,
time zone, catalog prefix, store key), the studio page with three tabs (Works, Shows, and Payment
links when the payments rail is on), the API route files, `/shows/[slug]`, the homepage notice
component, `/press/[token]` and `/cv`. Every visible file is a starting point the site's own
design replaces.

## Correctness

1\) Every studio handler verifies the signed cookie itself. A hidden studio link is never the gate.
2\) An unconfigured store or auth returns null and the studio says what is missing, never an empty
form that loses what was typed.
3\) Show writes are validated by a pure `cleanShow`: dates must be real calendar dates, `endsOn` not
before `startsOn`, and every `workSlugs` entry must exist in the site's catalog.
4\) Nothing is invented. An absent field prints nothing, as the record already does.

## Testing

The extracted tests move with their code. New tests cover `showStatus` across the time-zone
boundary, `noticeShow` on the day after close, `onView` making a work unbuyable, `cleanShow`
rejections, `cvFromShows` ordering, the press kit including on-request prices and excluding sold
prices, and the press page carrying `noindex`. Julian's site then runs its full suite, `wk:audit`
and a rendered check of every route, before and after the switch, with zero visible difference
except the new show and press surfaces.

## Design gate

The new visible surfaces (show page, homepage notice, press kit, and the payments checkout) go to
one rendered board in Julian's v3 language before they are built, per the visual tuning board spec:
0, 0+, then six to eight options sharing one stated premise.

## Out of scope

Moving Julian's 34-work catalog out of code into the store (the merge layer allows it later),
Astro scaffolding, multi-artist gallery sites (Perry Lawson Fine Art runs its own build; adopting
this module there is a separate decision).
