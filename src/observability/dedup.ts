// In-memory TTL suppression. Best-effort per warm instance (spec R3): a
// multi-instance burst can double-alert. Acceptable at this traffic.
export interface DedupResult {
  shouldSend: boolean;
  suppressedCount: number;
}

interface Entry {
  lastSentAt: number;
  ttlMs: number;
  suppressedSince: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;
const cache = new Map<string, Entry>();

function evictIfFull(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function checkAndRecord(
  errorKey: string,
  ttlMs: number = DEFAULT_TTL_MS,
  // Optional injectable clock for deterministic tests; defaults to the real
  // wall clock. The window rolls over at exactly `ttlMs` (`>=`) so an alert
  // fires on the boundary rather than being suppressed one tick longer.
  now: number = Date.now(),
): DedupResult {
  const existing = cache.get(errorKey);

  if (!existing || now - existing.lastSentAt >= existing.ttlMs) {
    // Carry the count suppressed during the just-expired window forward to
    // this send, so the first alert of a new window can report the catch-up
    // total ("(N suppressed since last alert)"). A brand-new key carries 0.
    const carriedOver = existing ? existing.suppressedSince : 0;
    cache.delete(errorKey); // bump to end of insertion order (LRU)
    cache.set(errorKey, { lastSentAt: now, ttlMs, suppressedSince: 0 });
    evictIfFull();
    return { shouldSend: true, suppressedCount: carriedOver };
  }

  existing.suppressedSince += 1;
  return { shouldSend: false, suppressedCount: existing.suppressedSince };
}

export function __resetDedupForTests(): void {
  cache.clear();
}
