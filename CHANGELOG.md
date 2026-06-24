# Changelog

## Unreleased
- landstar donor-parity (replacing its general scripts with the kit): still pending.

## 0.5.1
- `network`: **Xenia Operations moved to its own subdomain** — `xenia-ops.url` is now `https://ops.xenia.host` (was `https://xenia.host`). `xenia.host` is reserved for the Xenia Network umbrella, so `XENIA_NETWORK.url` (`https://xenia.host/network`) is unchanged. Data-only; no API change.

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
