// SDK-agnostic: returns a PLAIN options object structurally compatible with
// Sentry.init for any framework SDK. Takes env VALUES as params — it never
// reads process.env / import.meta.env, since client env access differs
// between Next (process.env.NEXT_PUBLIC_*) and Astro (import.meta.env.PUBLIC_*).
import { IGNORE_ERRORS } from "./ignore";
import { scrubEvent } from "./scrub";

export interface BaseSentryOptionsParams {
  runtime: "browser" | "node" | "edge";
  dsn: string | undefined;
  environment: string;
  release: string | undefined;
  enabled: boolean;
}

export interface BaseSentryOptions {
  dsn: string | undefined;
  environment: string;
  release: string | undefined;
  enabled: boolean;
  tracesSampleRate: number;
  sendDefaultPii: boolean;
  ignoreErrors: string[];
  beforeSend: typeof scrubEvent;
}

export function baseSentryOptions(
  params: BaseSentryOptionsParams,
): BaseSentryOptions {
  return {
    dsn: params.dsn,
    environment: params.environment,
    release: params.release,
    enabled: params.enabled,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: IGNORE_ERRORS,
    beforeSend: scrubEvent,
  };
}

/** Replay masking is mandated (spec §5). Consumer wiring spreads this into
 *  its SDK's replayIntegration(...) — the SDK itself is never imported here. */
export const REPLAY_MASKING_DEFAULTS = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
} as const;
