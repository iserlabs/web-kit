# Changelog

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
