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

`@iserlabs/web-kit/{biome, tsconfig, tsconfig-next, tailwind, seo, schema, forms,
env, utils, audits, brand-pack, artist, inquiry, owner-portal, owner-statement, desk/*, observability, observability/env, observability/server}`. Notes:
- `tsconfig` is **lib-oriented** (ES2022 / `noUncheckedIndexedAccess` /
  `verbatimModuleSyntax`) and breaks Next apps — Next sites extend
  `tsconfig-next` instead (the Next-safe preset).
- `tailwind` is the shadcn-base-nova-aligned token contract (share the contract,
  not the costume).
- `observability` provides error/event notification helpers (dedup, severity
  scrubbing, Discord notify); `observability/env` and `observability/server`
  are scoped sub-paths for env-var access and server-side transport.
- `desk/*` is the back-office Desk's general engines, one path per file (see `docs/desk.md`).
  Framework-free `.ts` except `unsaved` (React). A site's own facts are handed in, never written
  here; this repo is public, so no client name, address or hosting ID goes in a file or a comment.
- `artist` is the artist-site module (artwork record, availability, CV, shows,
  press kit, studio auth, studio store, studio route handlers), first used by
  julianpotulicki.com.
  Framework-free `.ts`: handlers take a Web `Request` and return a `Response`, and
  the visible pages stay in each site. The `"web-kit": { "artist": { "enabled": true } }`
  flag is reserved for phase-2 tooling (`web-kit artist init`, an audit check); nothing
  reads it yet and the export works without it.

- `inquiry` is the one-question-per-screen inquiry flow (`defineInquiry`, `useInquiryFlow`,
  `createInquiryController`, `createInquiryHandler`/`createInquiryRoute`). Logic in the kit,
  `.ts` with no brand names; the visible UI is scaffolded into each site by
  `web-kit inquiry init` and art-directed there. See `docs/inquiry.md`.

- `guest-guide` (plus `guest-guide/alpenglow`, `/static`, `/sw`, `/manifest`, `/robots`) is the
  one guest guide template, brand-switched by tokens. Model, checks and planner are framework-free
  `.ts`; the components are React server components with no client code; `static` renders them
  under `tsx` for plain-HTML sites. Every `.tsx` carries the automatic JSX runtime pragma, because
  tsx compiles kit files in node_modules with no tsconfig. Fixtures use stand-in Wi-Fi values and
  no photos (public repo). See `docs/guest-guide.md`.

- `owner-portal` is the owner statements module (`StatementTabs`, `groupStatements`,
  `portalTotals`, `validateModel`): statements by year, then month, as accessible tabs.
  Figures come from the statement itself; the kit holds no client name or number. See
  `docs/owner-portal.md`.

- `owner-statement` renders one engine-written `owner-statement/1` model as the owner's monthly
  statement page and print PDF (`renderStatement`, `validate`, `formatCents`, `BRANDS`), plus its link
  preview (`statementShareMeta`, `renderStatementShareCard`; see `src/owner-statement/README.md`). `.mjs` plus
  `index.d.ts`, framework free; every rule scoped under `.os`. Fixtures carry real figures but
  stand-in names (public repo). The sites keep their own model files and logos.

## CLI

The `web-kit` bin (used by consumers as `pnpm wk:doctor` / `wk:audit`):
- `web-kit doctor` — conformance: Biome/tsconfig presets wired, token slots
  present. Has a template-skip so the starter passes its own identity check.
- `web-kit audit --tier required` — SEO, schema/JSON-LD, canonical, contrast,
  a11y, bundle. The merge-gate tier.
- `web-kit brand-pack init` scaffolds the `/brand` signature and link preview
  boards into a client site. Required on every new client build and major
  redesign; `audit --tier required` fails an adopted site without one, unless
  its `package.json` carries a dated `web-kit.brandPack.skip` with a reason.
- `web-kit owner-statement validate|render` checks a statement model and renders it to a standalone
  HTML file (and a PDF through headless Chrome).
- `web-kit inquiry init` scaffolds the inquiry flow component and an example config into a site.
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
- `brand-pack` is `.mjs`, not `.ts`: the audit check and the CLI read the
  client's `brand-pack.config.mjs` under bare Node, which cannot import
  TypeScript. The scaffolded config imports nothing at all (its type comes from
  a JSDoc annotation) so the gate still works in a repo with a broken install.
  The kit carries no React: cards are serializable trees the consumer turns into
  elements with `createElement`.
- Audits assume real canonical origins: `parseSitemap` uses `URL.pathname`;
  preview teardown SIGKILLs the process group.

## Repo / workflow

Public repo (`github.com/iserlabs/web-kit`). Branch → PR → merge. Each real-world
audit bug fix should land with a regression test.
