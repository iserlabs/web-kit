import { type ArtworkOverlay, sanitizeStoredOverlay } from "./overlay";
import type { Artwork } from "./record";

/**
 * The studio store: what the artist and the operator edit, kept apart from what
 * the repo ships.
 *
 * Carole 05 requires that adding work, changing availability or moving a piece to
 * sold must not need a developer. A site's catalog is code, so it can only be the
 * BASE. Everything editable is written here as a per-slug OVERLAY, and the site
 * renders base + overlay. That keeps three properties worth having:
 *
 *   1. Nothing the artist edits can break a build. A malformed overlay degrades to
 *      the base record rather than failing a deploy.
 *   2. The repo stays the source of truth for what EXISTS; the store owns what is
 *      KNOWN about it. A work cannot be conjured or deleted from the studio.
 *   3. When a catalog eventually moves wholesale into the store, the merge below is
 *      the only thing that has to change.
 *
 * Talks to Upstash over its REST API with plain fetch. No client library, so no
 * dependency for what is four HTTP calls.
 *
 * Unconfigured returns null everywhere, never an empty object. A caller must be able
 * to tell "no store" from "nothing saved", or the studio will cheerfully show an
 * empty form and lose whatever was typed into it.
 */

export interface StudioStoreOptions {
  /** The Upstash key holding every overlay, e.g. "studio:julian:overlays". */
  key: string;
  /** Env var holding the Upstash REST URL. Default "KV_REST_API_URL". */
  urlEnv?: string;
  /** Env var holding the Upstash REST token. Default "KV_REST_API_TOKEN". */
  tokenEnv?: string;
  /**
   * Extra fetch options for reads that are not `fresh`, which are the reads a public
   * page performs. On Next, `{ next: { revalidate: 60 } }` keeps those pages static
   * and still lands a studio edit within the minute: an uncached (`no-store`) read is
   * what turned 34 static artwork pages into dynamic ones on julianpotulicki.com.
   * The kit passes this through untouched and imports nothing from any framework.
   */
  cachedRead?: Record<string, unknown>;
  /** The fetch to use. Default: the global fetch, looked up at call time so a
      framework that patches it (Next does) is honored. */
  fetch?: typeof fetch;
}

export interface StudioStore {
  readonly key: string;
  configured(): boolean;
  /** Every overlay, by slug. null means no store, which is not the same as none saved.
      `fresh` skips every cache: writes and the studio's own screens pass it. */
  readOverlays(fresh?: boolean): Promise<Record<string, ArtworkOverlay> | null>;
  /** Writes one slug's overlay, preserving the rest. Returns false when unconfigured. */
  writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean>;
  /** Drops a slug's overlay entirely, so the work falls back to its base record. */
  clearOverlay(slug: string): Promise<boolean>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function createStudioStore(options: StudioStoreOptions): StudioStore {
  const { key } = options;
  const urlEnv = options.urlEnv ?? "KV_REST_API_URL";
  const tokenEnv = options.tokenEnv ?? "KV_REST_API_TOKEN";

  function creds(): { url: string; token: string } | null {
    const url = process.env[urlEnv];
    const token = process.env[tokenEnv];
    return url && token ? { url: url.replace(/\/$/, ""), token } : null;
  }

  function configured(): boolean {
    return creds() !== null;
  }

  async function call(
    path: string,
    init: RequestInit | undefined,
    fresh: boolean,
  ): Promise<unknown> {
    const c = creds();
    if (!c) return null;
    const doFetch = options.fetch ?? globalThis.fetch;
    const res = await doFetch(`${c.url}/${path}`, {
      ...(fresh ? { cache: "no-store" as const } : (options.cachedRead ?? {})),
      method: init?.method ?? "GET",
      body: init?.body,
      headers: { Authorization: `Bearer ${c.token}`, ...(init?.headers ?? {}) },
    } as RequestInit);
    if (!res.ok) throw new Error(`store ${res.status}`);
    const body = (await res.json()) as { result?: unknown };
    return body.result ?? null;
  }

  async function readOverlays(fresh = false): Promise<Record<string, ArtworkOverlay> | null> {
    if (!configured()) return null;
    const raw = await call(`get/${key}`, undefined, fresh);
    if (raw === null || raw === undefined) return {};
    try {
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!isPlainObject(parsed)) return {};
      const out: Record<string, ArtworkOverlay> = {};
      for (const [slug, entry] of Object.entries(parsed)) {
        if (isPlainObject(entry)) out[slug] = sanitizeStoredOverlay(entry);
      }
      return out;
    } catch {
      // A corrupted blob must not take the public site down with it. Report empty and
      // let the base catalog render; the studio will overwrite on the next save.
      return {};
    }
  }

  async function writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = {
      ...current,
      [slug]: { ...current[slug], ...overlay, updatedAt: new Date().toISOString(), updatedBy: by },
    };
    await call(`set/${key}`, { method: "POST", body: JSON.stringify(next) }, true);
    return true;
  }

  async function clearOverlay(slug: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = { ...current };
    delete next[slug];
    await call(`set/${key}`, { method: "POST", body: JSON.stringify(next) }, true);
    return true;
  }

  return { key, configured, readOverlays, writeOverlay, clearOverlay };
}

/**
 * base + overlay. An overlay only ever adds or corrects what is known; it cannot
 * remove a work, repoint its image, or rewrite its alt text.
 */
export function merge<A extends Artwork>(base: A, overlay: ArtworkOverlay | undefined): A {
  if (!overlay) return base;
  const { updatedAt: _a, updatedBy: _b, ...fields } = overlay;
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return { ...base, ...clean } as A;
}

export function mergeAll<A extends Artwork>(
  base: A[],
  overlays: Record<string, ArtworkOverlay> | null,
): A[] {
  if (!overlays) return base;
  return base.map((w) => merge(w, overlays[w.slug]));
}
