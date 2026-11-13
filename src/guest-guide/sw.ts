/**
 * The guide's service worker, as JavaScript text each site serves at its own
 * path (`/guides/sw.js` on SMS, Columbus and Palisade, so v1 registrations
 * update in place). Serve it with `Cache-Control: no-cache`.
 *
 * It saves exactly what a page asks it to save and nothing else, into one
 * cache named `<cachePrefix>-v2-<version>`. Activation deletes only this
 * site's older `<cachePrefix>-*` caches (v1's `sms-guides-v1` included). A
 * saved page refreshes on every successful online visit; there is no
 * time-based expiry (no clock logic, R4).
 */
export type GuideServiceWorkerOptions = {
  /** e.g. "sms-guides". Lowercase letters, digits and hyphens. */
  cachePrefix: string;
  /** The worker's scope, e.g. "/guides/". */
  scope: string;
  /** The build id: a new value starts a fresh cache and drops the old one. */
  version: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^[A-Za-z0-9._-]{1,64}$/;

export function guideServiceWorker(o: GuideServiceWorkerOptions): string {
  if (!SLUG.test(o.cachePrefix)) throw new Error(`cachePrefix "${o.cachePrefix}" is not a slug`);
  if (!VERSION.test(o.version))
    throw new Error(`version "${o.version}" has characters a cache name cannot hold`);
  if (!/^[./A-Za-z0-9_-]*\/?$/.test(o.scope)) throw new Error(`scope "${o.scope}" is not a path`);
  const cfg = JSON.stringify({
    prefix: o.cachePrefix,
    cache: `${o.cachePrefix}-v2-${o.version}`,
    scope: o.scope,
  });
  return `/* guest guide offline worker (web-kit) */
"use strict";
const CFG = ${cfg};
const SCOPE = new URL(CFG.scope, self.location).href;
const same = (u) => { try { return new URL(u, self.location).origin === self.location.origin; } catch (e) { return false; } };

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CFG.prefix + "-") && k !== CFG.cache).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const m = event.data;
  if (!m || m.type !== "save-guide" || typeof m.page !== "string" || !Array.isArray(m.urls)) return;
  const page = new URL(m.page, SCOPE).href;
  if (!page.startsWith(SCOPE) || !same(page)) return;
  const urls = [page, ...m.urls.filter((u) => typeof u === "string" && same(u)).map((u) => new URL(u, page).href)];
  const source = event.source;
  event.waitUntil((async () => {
    const cache = await caches.open(CFG.cache);
    for (const u of new Set(urls)) {
      const res = await fetch(u, { credentials: "same-origin" });
      if (!res.ok) throw new Error("save failed: " + res.status + " " + u);
      await cache.put(u, res);
    }
    if (source && source.postMessage) source.postMessage({ type: "guide-saved", page: m.page });
  })().catch((e) => console.warn("guide worker:", e && e.message)));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !same(req.url)) return;
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CFG.cache);
      try {
        const res = await fetch(req);
        // A saved page refreshes on every successful visit; an unsaved one is never stored.
        if (res.ok && (await cache.match(req.url, { ignoreSearch: true }))) await cache.put(new URL(req.url).origin + new URL(req.url).pathname, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(req.url, { ignoreSearch: true });
        if (hit) return hit;
        throw e;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CFG.cache);
    const hit = await cache.match(req.url);
    if (hit) return hit;
    return fetch(req);
  })());
});
`;
}
