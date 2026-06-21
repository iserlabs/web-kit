// Canonical PII scrub for the Sentry beforeSend hook AND the Discord ALERTS
// rail (notify). The LEADS rail (notifyLead) carries PII by design and must
// NOT pass through here. Pure (regex only) — safe on server and client.
const PII_KEYS = new Set(["email", "phone", "name", "zip", "address"]);
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

export function scrubPii(input: string): string {
  return input.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

/** Top-level-only key redaction — Sentry `extra` is flat at every call site. */
export function scrubObject(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PII_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

interface ScrubbableEvent {
  extra?: Record<string, unknown>;
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
}

/** Sentry `beforeSend` scrub: `extra` by key, plus message + exception
 *  values by regex so an upstream error echoing a recipient address can't
 *  leak it into the issue title. Mutates and returns the event. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  event.extra = scrubObject(event.extra);
  if (typeof event.message === "string") event.message = scrubPii(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = scrubPii(ex.value);
  }
  return event;
}
