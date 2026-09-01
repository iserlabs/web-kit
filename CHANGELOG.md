# Changelog

## Unreleased
- **`@iserlabs/web-kit/brand-pack`** new export, plus `web-kit brand-pack init` and a blocking audit check. Every new client site and major redesign now ships two boards on the client's own domain at `/brand`: five email signature designs, each with a one-click copy that puts real rich HTML on the clipboard, and five link preview cards shown inside accurate iMessage, WhatsApp, Slack, LinkedIn, X, Facebook and Google frames. Codifies work previously hand-built per client (Sun Mountain, Streamlined, PLFA, jakejjlee). The five variant renderers and the seven platform frame specs live in the kit, so a design change reaches every client through a ref bump; `init` scaffolds the route shells into the client repo, so a per-client override is an ordinary edit rather than a fork. The kit stays React-free: cards are serializable trees the consumer converts with `createElement`.
- **Audits (required tier):** new codes `brand-pack-missing`, `brand-pack-unpicked`, `brand-pack-placeholder`, `brand-pack-routes-missing`, `brand-pack-invalid`, `brand-pack-no-people`, `brand-pack-em-dash`, `brand-pack-skip-unreasoned`. **This is blocking for every adopted site that is not the template.** A site not ready to backfill declares a dated opt-out, which must carry both a reason and a date:
  ```json
  "web-kit": { "brandPack": { "skip": true, "reason": "...", "date": "2026-09-01" } }
  ```
  A bare `skip: true` is itself an error, because that is how a gate quietly stops meaning anything.
- **`@iserlabs/web-kit/proof`** — new export: `OPERATING_RECORD`, the founder's owner-attested career totals as the single canonical proof dataset shared verbatim by every Xenia Network site's "Operating Record" proof strip (`OperatingRecord`/`OperatingRecordStat` types). Pure data; strict-canonical — kills the prior per-site drift (237/240 STRs, 16,100+/16,500+/16,000+/14,000+ reservations, 500+/600+ claims). Sites that can't yet bump the pinned ref keep a verbatim `src/content/operating-record.ts` port + invariant test as the drift guard.
- landstar donor-parity (replacing its general scripts with the kit): still pending.

## 0.5.0
- **`@iserlabs/web-kit/network`** — new export: The Xenia Network member registry (`networkMembers`, `memberById`, `footerMembersFor`, `managementBrands`, `engines`, `brandListLabel`, `XENIA_NETWORK`, `STREAMLINED_ID`, `includeStreamlinedInBrandFooters`) plus the JSON-LD builder (`networkGraph`, `NETWORK_ID`). Pure data + functions; first fleet-content module in the kit. Lifted verbatim from `xenia-hospitality-operations` so every affiliated site consumes one source of truth (Xenia Network rollout, plan 2 of 4). Schema models the umbrella with `subOrganization`/`memberOf` — never `sameAs`; Columbus excluded by design.

## 0.4.0
- Audits (required tier): `web-kit audit --tier required` — server-crawl gate for SEO-meta, JSON-LD, token-palette contrast, and security headers. New subpath `@iserlabs/web-kit/audits`, configured per site by `web-kit.audits.config.mjs`. Per-check severity overrides; fails on `error`.
- Audits (extended tier): `web-kit audit --tier extended` — Lighthouse (perf/SEO/best-practices/a11y + CWV) and axe (WCAG) per route, advisory `warn` by default. Browser deps dynamically imported + install-on-demand to keep required-only sites lean.
- Audit hardening: origin-agnostic sitemap paths, decorative `alt=""` allowed, `@graph` JSON-LD `@type` collection, process-group preview teardown.
- First **tagged** release of the audits + `tsconfig-next` work — consolidates the fleet off SHA pins back onto a tag so Renovate can auto-bump it.

## 0.3.1
- `observability` `checkAndRecord` accepts an optional injectable `now` (3rd arg, defaults to `Date.now()`) and rolls the window over at exactly `ttlMs` (`>=`) — so a deduped alert fires on the boundary instead of one tick later. Backward-compatible; lets landstar drop its last local dedup copy.

## 0.3.0
- `observability` dedup now **carries the suppressed count forward** into the next window's first alert (no more silently-forgotten suppressions across a window roll-over).
- **`observabilityEnv` moved** from the `./observability` barrel to its own subpath **`@iserlabs/web-kit/observability/env`** — the client-safe barrel is now **zod-free**, so a Layer-B site importing `baseSentryOptions` never has to install zod. (Breaking for the unreleased v0.2.0 barrel export only; no shipped consumers.)

## 0.2.0
- Add `@iserlabs/web-kit/observability` (client-safe: `baseSentryOptions`, `scrub*`, `IGNORE_ERRORS`/`shouldIgnore`, `getEmojiPrefix`, `REPLAY_MASKING_DEFAULTS`, `observabilityEnv`) and `@iserlabs/web-kit/observability/server` (`dedup`, `discord` transport, `notify`). `@discordjs/rest`/`discord-api-types` are optional peers.
- `forms.createContactHandler` gains optional `onSuccess`/`onSendError` hooks for the observability lead rail (forms stays decoupled — one-way dependency).

## 0.1.0
- Config presets: `@iserlabs/web-kit/biome`, `@iserlabs/web-kit/tsconfig`.
- Design-token contract: `@iserlabs/web-kit/tailwind` (shadcn base-nova-aligned).
- Utilities: `seo` (pageMeta), `schema` (JSON-LD), `forms` (contact handler core), `env`, `utils` (cn).
- `web-kit doctor` conformance CLI.
- Source-consumption resolution verified (Biome/TS/Tailwind/bin/tsx) via the Phase 0 spike.
