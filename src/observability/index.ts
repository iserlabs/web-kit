// client-safe entry: pure modules only — no Node-only Discord transport here,
// and NO zod dependency (observabilityEnv lives at ./observability/env so a
// Layer-B site importing Sentry options never has to install zod).
export { IGNORE_ERRORS, shouldIgnore } from "./ignore";
export type { BaseSentryOptions, BaseSentryOptionsParams } from "./options";
export { baseSentryOptions, REPLAY_MASKING_DEFAULTS } from "./options";
export { scrubEvent, scrubObject, scrubPii } from "./scrub";
export type { Kind, Severity } from "./severity";
export { getEmojiPrefix } from "./severity";
