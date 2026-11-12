# guest-guide

One guest guide template, "Alpenglow", for every brand. The kit holds the model, the checks, the
layout planner, the components, the static renderer, the offline worker and the AI-crawler list.
Each site holds its own facts (with a source and a checked date on every one), its brand tokens,
its approvals and its held drafts, and maps them into the kit model with a small adapter.

```ts
import { planGuide, resolveCopy, validateModel, validateBrand } from "@iserlabs/web-kit/guest-guide";
import { AlpenglowGuide, guideHead, guideMetadata } from "@iserlabs/web-kit/guest-guide/alpenglow";
import { renderGuideHtml } from "@iserlabs/web-kit/guest-guide/static";   // static sites, under tsx
import { guideServiceWorker } from "@iserlabs/web-kit/guest-guide/sw";
import { guideManifest, guideIconSvg } from "@iserlabs/web-kit/guest-guide/manifest";
import { AI_CRAWLERS, aiGuideRules, robotsTxt } from "@iserlabs/web-kit/guest-guide/robots";
```

The v0.13 to v0.16 exports (`GuestGuide`, `validateGuide`, `factsTable`, `factsMarkdown`,
`findLeaks`) are unchanged.

## Flow

1) The site adapter builds a `GuideModel` (`model.ts`). A fact not on record is an `Unknown`:
   it prints only as its own `liveLine`, or as the approved unknown line. There is no field for
   an entry code.
2) `validateModel(model, { today, phone, forbidden })` and `validateBrand(brand)` run in a site
   test; any problem fails the build. `today` is passed in; nothing reads a clock.
3) `resolveCopy(model, { approvals, brandLabels })` returns every printed label and line, each
   marked `live` or `approved`. A held line prints only when its section is approved for that
   house (`scope: "brand"` or `"house:<slug>"`). Door timing also needs
   `entry.codeDeliveryNext.guestyConfirmed`. `drafts: "show"` is for the `/drafts` preview only.
4) `planGuide(model, copy, { page, extraUrls, imageUrl, phone })` lays the guide out: cover rows,
   quick find, chapters numbered over the chapters present, placed photos, the offline URL list.
5) Next sites render `<AlpenglowGuide plan brand renderImage imageUrl nonce serviceWorker />` in
   a server component. Static sites call `renderGuideHtml(...)` under `tsx`.

## Rules the code enforces

| Rule | Where |
|---|---|
| Live copy by default; held lines need an approval | `resolveCopy`; render test: zero approvals, no held string |
| Door timing printed verbatim (R6) | `copy.codeDelivery`; both gates for `codeDeliveryNext` |
| No clock in the render (R4) | frozen and shifted clock renders are byte-identical |
| No AI, unconfirmed-rights, door or defect photo; each photo once | `unplaceable`, `planGuide` |
| Light page, brand locks, contrast | `validateBrand` (4.5:1 text, 3:1 accent, fields above luminance 0.55, banned faces, noBlue) |
| Cover crop at least 1170 px wide, or a refine record | `validateModel` |
| Shade never above 0.35 | `validateModel`, `shadeOf`, `groundShadeOf` |
| Time-bound rows fail the build after their day; a guide unchecked for 60 days fails | `validateModel` |
| 911 once, no phone where the brand says never | `planGuide`, render test |

## Cover

`look.cover` is a photo (`layout` low, high or band, from the zone measurement) or a type cover.
Low covers set the facts on the photo's ground in white over a shade that rides behind the facts;
high covers set the name in the sky and drop the timetable onto the arrival field on upright
phones and short laptops; band covers shorten the photo to its sky. Cover rows: a live first
sentence up to 90 characters, else a jump link; `look.coverRows` overrides per house. Every
essential row carries `data-essential`; `web-kit guide-check` proves them inside the first window.

## Brand tokens

`GuideBrand` (`brand.ts`): faces, ink, sec, accent, accentText, onPhoto, button, eight fields,
phone policy, cache prefix and the brand's own v1 labels. `brandCss(brand)` writes only the custom
properties on `.gg[data-brand="<id>"]`. Fonts are self-hosted by each site (next/font, or woff2
files passed to `renderGuideHtml({ fonts })`).

## Offline

Serve `guideServiceWorker({ cachePrefix, scope, version })` at the site's existing worker path with
`Cache-Control: no-cache`. The page posts `plan.offlineUrls` after load, on idle, never with
Save-Data on; the worker caches exactly those into `<cachePrefix>-v2-<version>`, drops only the
site's older `<cachePrefix>-*` caches, and answers; only then does the saved line show. A saved page
refreshes on each successful online visit. Proven in headless Chrome (`sw.browser.test.ts`); the
real-iPhone airplane-mode test before production is still owed.

## Crawlers

`AI_CRAWLERS` (21 agents). `aiGuideRules(paths)` adds one rule beside a Next site's own `*` rule;
`robotsTxt({ star, guidePaths, sitemap })` writes a whole file for a static site. The `*` record is
never changed.

## CLI

```
GUEST_GUIDE_CODES=<codes> web-kit guide-leaks --dir <built html dir> [--slugs a,b] [--forbid "x|y"]
GUEST_GUIDE_CODES=<codes> web-kit guide-leaks --url <origin> --paths /guides/a,/guides/b
web-kit guide-check <url-or-html-file>
```

`guide-leaks` exits 0 when every page was scanned and none holds a code, 1 on a leak, 2 when no
codes were given, a page could not be read, or nothing was scanned. Codes come from the environment
only and print as "code N of M". `guide-check` needs Playwright and checks 18 geometries (the 17
design-check sizes plus 320 x 720).

## Fixtures

`src/guest-guide/fixtures/` holds two board houses (live wording, stand-in Wi-Fi values: this repo
is public) and five edge cases. `pnpm exec tsx scripts/guide-fixture.tsx --out <dir> --assets
<photo dir> --fetch-fonts` writes each as `<id>.html` (live copy only) and `<id>-drafts.html`
(every held line in place). Photos are not in the repo.
