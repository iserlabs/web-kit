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
): DedupResult {
  const now = Date.now();
  const existing = cache.get(errorKey);

  if (!existing || now - existing.lastSentAt > existing.ttlMs) {
    cache.delete(errorKey); // bump to end of insertion order (LRU)
    cache.set(errorKey, { lastSentAt: now, ttlMs, suppressedSince: 0 });
    evictIfFull();
    return { shouldSend: true, suppressedCount: 0 };
  }

  existing.suppressedSince += 1;
  return { shouldSend: false, suppressedCount: existing.suppressedSince };
}

export function __resetDedupForTests(): void {
  cache.clear();
}
