// client-safe entry: pure modules only — no Node-only Discord transport here.
export { observabilityEnv } from "./env";
export { IGNORE_ERRORS, shouldIgnore } from "./ignore";
export type { BaseSentryOptions, BaseSentryOptionsParams } from "./options";
export { baseSentryOptions, REPLAY_MASKING_DEFAULTS } from "./options";
export { scrubEvent, scrubObject, scrubPii } from "./scrub";
export type { Kind, Severity } from "./severity";
export { getEmojiPrefix } from "./severity";
