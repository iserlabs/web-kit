# @iserlabs/web-kit

Shared, build-free web kit for Iser Labs marketing sites. Consumed as source via a git-tag dependency:

    "@iserlabs/web-kit": "github:iserlabs/web-kit#v0.1.0"

A menu, not a mandate — import only what a site needs. See the fleet consistency spec for the full design.

## Usage

Add the kit (pin a tag):

    pnpm add "@iserlabs/web-kit@github:iserlabs/web-kit#v0.1.0"

For Next sites, transpile it: `next.config.ts` → `transpilePackages: ["@iserlabs/web-kit"]`.

### Config presets
- `biome.json` → `{ "extends": ["@iserlabs/web-kit/biome"] }`
- `tsconfig.json` → `{ "extends": "@iserlabs/web-kit/tsconfig" }`

### Token contract (Tailwind 4)
`globals.css`:

    @import "tailwindcss";
    @import "shadcn/tailwind.css";
    @import "@iserlabs/web-kit/tailwind";
    /* then override :root / .dark values for your brand */

### Utilities
- `import { pageMeta } from "@iserlabs/web-kit/seo"`
- `import { organization, lodgingBusiness, breadcrumb, faq } from "@iserlabs/web-kit/schema"`
- `import { createContactHandler } from "@iserlabs/web-kit/forms"`
- `import { validateEnv } from "@iserlabs/web-kit/env"`
- `import { cn } from "@iserlabs/web-kit/utils"`

### Conformance
- `pnpm exec web-kit doctor` — checks an adopting site's baseline (skips non-adopters).

### Audits (required tier)
Add `web-kit.audits.config.mjs` at the site root:

    export default {
      previewCommand: "pnpm build && pnpm start --port 4321",
      baseUrl: "http://localhost:4321",
      pageTypes: { "/": "home", "/rooms": "lodging" },
      expectedSchema: { home: ["Organization"], lodging: ["LodgingBusiness"] },
      headers: { requireCsp: true },
      contrast: { cssFile: "src/app/globals.css", minRatio: 4.5 },
      // severity: { "header-xcto-missing": "off" }, // per-check override
    };

Then gate CI with `web-kit audit --tier required` (crawls the preview server,
fails on any `error` finding).

### Audits (extended tier — opt-in, browser-backed)
`web-kit audit --tier extended` adds **Lighthouse** (perf/SEO/best-practices/a11y
scores + CWV) and **axe** (WCAG a11y) per route. Findings default to `warn`
(advisory) — opt a code up to `error` via `severity` to make it a gate.

The browser tools are **install-on-demand** (the kit stays lean for required-only
sites):

    pnpm add -D lighthouse chrome-launcher @axe-core/playwright playwright
    pnpm exec playwright install chromium

Configure in `web-kit.audits.config.mjs`:

    extended: {
      // lighthouse: false,            // or { thresholds: { performance: 0.9, seo: 0.95 } }
      // axe: false,                   // or { tags: ["wcag2a","wcag2aa"] }
      // cwv: { thresholds: { lcp: 2500, cls: 0.1 } },
      // routes: ["/"],                // defaults to the required-tier route list
    }


## Brand pack

Every new client site and major redesign ships a signature board and a link
preview board on the client's own domain:

```bash
pnpm exec web-kit brand-pack init
```

That writes `brand-pack.config.mjs` plus `/brand`, `/brand/signature` and
`/brand/share`, and wires the site's `opengraph-image` from the picked card. It
never overwrites a file that already exists, so re-running fills in only what is
missing.

Fill in every `__UNFILLED__` in `brand-pack.config.mjs` with the client's real
tokens and the real details of each named person, then send the client the
`/brand` link. They pick a letter on each board and you set `signature` and
`shareCard` in the config.

`web-kit audit --tier required` fails while any value is unfilled or either pick
is missing. That is deliberate: a board must never render an invented name, job
title or tagline.

## Sync harness

For a platform that copies something in from outside on a schedule (an inventory archive, a
booking system, a feed). The harness runs it once a day or at whatever cadence you set, and
looks after itself: a half-finished read is retried within the hour, a failed read waits 15,
then 30, then 60 minutes instead of hammering the source, and a broken code change waits for a
fix instead of re-running every 15 minutes. It sends at most one alert every six hours (none as
Mac pop-ups while `~/.config/xenia/no-mac-popups` exists), turns red on the business dashboard
only after three failures in a row or 30 hours without a good read, and answers "is it healthy"
in one command. It is bash on purpose: launchd starts it, and macOS grants automation permission
to the process launchd started. Design and the rules behind it:
`docs/superpowers/specs/2026-10-13-sync-harness-design.md`.

    src/sync-harness/sync-harness status <job>    # also: week, now, unstick, config
    src/sync-harness/sync-harness replay <job> --since 2026-10-03

Adding a sync to a new platform, in five steps:

1. Write `~/Claude/clients/<job>.d/config.sh`: `JOB`, `TITLE`, `SYNC_CMD`, `LOG`, `STATE`, the
   cadence and backoff settings, and `PLAIN`, `LABEL`, `INTERVAL_MIN`, `GRACE_MIN` for the
   schedule. `src/sync-harness/examples/plfa/config.sh` lists every setting.
2. Write `hooks.sh` next to it: `hook_classify` turns a run's log lines into one verdict (`ok`,
   `partial`, `partial-retry-soon`, `fail-browser`, `fail-code`, `fail-build`,
   `fail-permission`, `skip`) and `hook_explain` says it in a plain sentence. A simple sync can
   skip the hooks and set `FINISHED_RE` and `SKIP_RE` instead.
3. Cut fixtures from a real run of the sync into `src/sync-harness/test/fixtures/` and assert
   their verdicts in `test/run-tests.sh`; run `pnpm test:sync-harness`.
4. Replay the real log (`sync-harness replay <job>`) and check the verdict table against what
   happened.
5. `sync-harness install <job>` writes the launchd plist and prints the `launchctl` line and the
   `/os` registry row; load the one and add the other.
