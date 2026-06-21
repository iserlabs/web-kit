// Single structured-alert entry point: gate → dedup → scrub → route →
// never-throw. Runbook injection is an F-only enrichment (payload.runbook_url
// only); no AsyncLocalStorage request-id fallback — request_id is an explicit
// arg (spec §7, Layer-F deps out of scope).
import { checkAndRecord } from "./dedup";
import { alertDiscord } from "./discord";
import type { EmbedField } from "./discord";
import { scrubPii } from "./scrub";
import { getEmojiPrefix, type Kind, type Severity } from "./severity";

export interface NotifyPayload {
  severity: Severity;
  kind?: Kind;
  title: string;
  message: string;
  error_key?: string;
  runbook_url?: string;
  request_id?: string;
  fields?: EmbedField[];
}

function deriveErrorKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function enabled(): boolean {
  const env = process.env.VERCEL_ENV;
  if (env === "production" || env === "preview") return true;
  return process.env.OBSERVABILITY_FORCE_NOTIFY === "1";
}

export async function notify(payload: NotifyPayload): Promise<void> {
  try {
    if (!enabled()) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[notify skipped] ${payload.severity} ${payload.title}`);
      }
      return;
    }

    const errorKey = payload.error_key ?? deriveErrorKey(payload.title);
    const dedupKey = `${payload.severity}:${errorKey}`;
    const ttl = payload.severity === "critical" ? 60_000 : undefined;
    const { shouldSend, suppressedCount } = ttl
      ? checkAndRecord(dedupKey, ttl)
      : checkAndRecord(dedupKey);
    if (!shouldSend) {
      console.warn(
        JSON.stringify({
          event: "notify_suppressed",
          error_key: errorKey,
          suppressed_count: suppressedCount,
        }),
      );
      return;
    }

    const prefix = getEmojiPrefix(payload.severity, payload.kind);
    const safeMessage =
      typeof payload.message === "string" ? scrubPii(payload.message) : "";

    const parts: string[] = [`${prefix} ${payload.title}`];
    if (safeMessage) parts.push(safeMessage);
    if (suppressedCount > 0)
      parts.push(`(${suppressedCount} suppressed since last alert)`);
    if (payload.runbook_url) parts.push(`Runbook: ${payload.runbook_url}`);
    if (payload.request_id) parts.push(`request_id: ${payload.request_id}`);
    for (const f of payload.fields ?? []) {
      parts.push(`${f.name}: ${scrubPii(String(f.value))}`);
    }

    const level = payload.severity === "warn" ? "warning" : payload.severity;
    await alertDiscord(parts.join(" — "), level);
  } catch (err) {
    // LAST RESORT — never crash the caller (spec §7).
    console.error(
      `[OBSERVABILITY_LAST_RESORT] notify_delivery_failed severity=${payload.severity} title="${payload.title}" err=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
