# CLAUDE.md

Guidance for Claude Code in the **`@iserlabs/web-kit`** repository.

## Project

`@iserlabs/web-kit` is the shared toolkit for the Iser Labs marketing sites
(`../*` siblings under `websites/`): config presets, SEO/schema/forms helpers,
audit + conformance CLIs, and a token contract. It is **consumed as source via a
git ref — there is no build, `dist/`, or npm release**. Consumers pin a git tag
or commit SHA in their `package.json` (`github:iserlabs/web-kit#<ref>`).

## Consumption model

- Sites depend on `github:iserlabs/web-kit#<tag-or-SHA>`. Some pin tags
  (`v0.3.x`), some pin commit SHAs (to dodge version-coordination with the
  concurrent observability work). Both are valid.
- App-consumed code is `.ts` (transpiled by the consuming app). CLI code is
  `.mjs` (runs under bare Node — no `tsx` available to consumers).
- To upgrade a consumer: bump its pinned ref, `pnpm install`, re-run its
  `wk:doctor` / `wk:audit`.

## Exports

`@iserlabs/web-kit/{biome, tsconfig, tailwind, seo, schema, forms, env, utils,
audits, observability, observability/env, observability/server}`. Notes:
- `tsconfig` is **lib-oriented** (ES2022 / `noUncheckedIndexedAccess` /
  `verbatimModuleSyntax`) and breaks Next apps — Next sites use their own
  `tsconfig.json` that extends sensible defaults for Next.js directly.
- `tailwind` is the shadcn-base-nova-aligned token contract (share the contract,
  not the costume).
- `observability` provides error/event notification helpers (dedup, severity
  scrubbing, Discord notify); `observability/env` and `observability/server`
  are scoped sub-paths for env-var access and server-side transport.

## CLI

The `web-kit` bin (used by consumers as `pnpm wk:doctor` / `wk:audit`):
- `web-kit doctor` — conformance: Biome/tsconfig presets wired, token slots
  present. Has a template-skip so the starter passes its own identity check.
- `web-kit audit --tier required` — SEO, schema/JSON-LD, canonical, contrast,
  a11y, bundle. The merge-gate tier.
- `web-kit audit --tier extended` — Lighthouse (perf/SEO/BP/a11y + CWV) + axe
  (WCAG), advisory `warn` by default. Browser deps (`lighthouse`,
  `chrome-launcher`, `@axe-core/playwright`, `playwright`) install on demand so
  required-only consumers stay lean.

## Conventions & gotchas

- A shared Biome preset MUST set `"root": false` or Biome 2 treats it as a
  competing root.
- Tailwind 4 CLI bin is `tailwindcss` (not `@tailwindcss/cli`); use `@source`,
  not `--content`.
- Token-contract retrofits clobber a branded site's `@theme` overrides — new
  sites get the contract via the starter; already-branded clones keep their
  brand (adopt biome/audits/doctor only).
- Audits assume real canonical origins: `parseSitemap` uses `URL.pathname`;
  preview teardown SIGKILLs the process group.

## Repo / workflow

Public repo (`github.com/iserlabs/web-kit`). Branch → PR → merge. Each real-world
audit bug fix should land with a regression test.
