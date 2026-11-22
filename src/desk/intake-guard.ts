/**
 * What a public POST is allowed to be.
 *
 * `/api/inquiry` and `/api/subscribe` are unauthenticated endpoints that mail a
 * human and rewrite a stored document, and neither had a body cap, a field cap
 * or any rate limit at all. A scripted loop could mail the owner's inbox
 * without bound and grow one JSON document forever; because the whole list is
 * read and rewritten per request, the cost of that grows quadratically.
 *
 * The limiter is deliberately IN MEMORY AND PER INSTANCE, and that is a real
 * limitation rather than an oversight. Serverless spreads requests across
 * instances, so this stops a naive flood from one client and does not stop a
 * distributed one. It is the cheap 90% that needs no new infrastructure; the
 * remaining 10% wants a shared store, which is a decision with a bill attached
 * and belongs to the owner rather than to this file.
 */

/** Bytes. Generous for a form, far under anything that could be an upload. */
export const MAX_BODY = 16 * 1024;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Requests allowed per window, per client, per instance. */
const LIMIT = 8;
const WINDOW_MS = 60_000;

/**
 * The caller's address as far as the platform will say.
 *
 * Behind Vercel `x-forwarded-for` is set by the proxy rather than the client,
 * so the leftmost entry is the real one. With no header at all every caller
 * shares one bucket, which fails closed rather than open: a limiter that
 * silently stops limiting is worse than none.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/* `limit` is the allowance for one bucket; a door with a reason to take more than a form's eight
   (a client filing a dozen vendors' certificates at once) names its own and says why. */
export function rateLimited(key: string, now = Date.now(), limit = LIMIT): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    /* Opportunistic sweep, so a long-lived instance does not accumulate a
       bucket per address it has ever seen. */
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

/**
 * Reads the body only if it is small enough to be a form.
 *
 * Checks `content-length` first because that refuses an oversized body without
 * buffering it, then measures what actually arrived, because the header is
 * supplied by the caller and a caller who is attacking you is not obliged to be
 * honest about it.
 */
export async function readSmallJson(req: Request): Promise<unknown | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) return null;

  const text = await req.text().catch(() => null);
  if (text === null || text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The one refusal both routes give, so they cannot drift apart. */
export function tooMany(): Response {
  return Response.json(
    { error: "That was a lot of requests at once. Please try again in a minute." },
    { status: 429, headers: { "retry-after": "60" } },
  );
}
