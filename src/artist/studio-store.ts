import { type ArtworkOverlay, sanitizeStoredOverlay } from "./overlay";
import { isPressToken } from "./press-kit";
import type { Artwork } from "./record";
import { type Show, type ShowRecord, sanitizeStoredShows } from "./shows";

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
 * Shows and the press token live beside the overlays, each under its own key, as
 * two sibling stores (`shows`, `press`). The overlay store's own shape never grows,
 * so everything written against `StudioStore` keeps compiling.
 *
 * Talks to Upstash over its REST API with plain fetch. No client library, so no
 * dependency for what is a handful of HTTP calls.
 *
 * Unconfigured returns null everywhere, never an empty object. A caller must be able
 * to tell "no store" from "nothing saved", or the studio will cheerfully show an
 * empty form and lose whatever was typed into it.
 */

export interface StudioStoreOptions {
  /** The Upstash key holding every overlay, e.g. "studio:julian:overlays". */
  key: string;
  /** The Upstash key holding the site's shows, e.g. "studio:julian:shows". Unset means
      the site keeps no shows: `shows` reads null and writes nothing. */
  showsKey?: string;
  /** The Upstash key holding the press kit's current token. Unset means no press kit. */
  pressKey?: string;
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
  /** The longest one store call may take, in milliseconds, before it is abandoned
      and fails with "store timed out". Default 4000. A store that never answers must
      not leave a page loading until the platform gives up on it. */
  timeoutMs?: number;
}

/** How long a store call may take when the site names no limit of its own. */
const DEFAULT_TIMEOUT_MS = 4000;

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

export interface ShowsStore {
  /** The key the shows live under, or undefined when the site keeps none. */
  readonly key: string | undefined;
  /** True when a store is connected and the site names a shows key. */
  configured(): boolean;
  /** Every valid show, in stored order. null means no store, which is not the same as
      no shows. `fresh` skips every cache. */
  readShows(fresh?: boolean): Promise<ShowRecord[] | null>;
  /** Saves one show whole, replacing any earlier version with the same slug in its
      place and keeping the rest. Returns false when unconfigured. Trusts its caller to
      have validated the show with cleanShow (the shows handler does). */
  writeShow(show: Show, by: string): Promise<boolean>;
  /** Removes one show. Returns false when unconfigured. */
  deleteShow(slug: string): Promise<boolean>;
}

export interface PressStore {
  /** The key the press token lives under, or undefined when the site has no press kit. */
  readonly key: string | undefined;
  configured(): boolean;
  /** The current press token. null: no store. undefined: none has been set. */
  readToken(fresh?: boolean): Promise<string | null | undefined>;
  /** Replaces the token, which retires the old press address at once. Throws on a
      token generatePressToken would not make. Returns false when unconfigured. */
  writeToken(token: string, by: string): Promise<boolean>;
}

/** What createStudioStore returns: the overlay store, with shows and the press token
    beside it. */
export type StudioStores = StudioStore & { shows: ShowsStore; press: PressStore };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function createStudioStore(options: StudioStoreOptions): StudioStores {
  const { key, showsKey, pressKey } = options;
  // Two collections under one key would overwrite each other: a shows key equal to the
  // overlay key would make the first show save sanitize away every artwork edit.
  const named = [
    ["key", key],
    ["showsKey", showsKey],
    ["pressKey", pressKey],
  ] as const;
  for (const [i, [nameA, a]] of named.entries()) {
    for (const [nameB, b] of named.slice(i + 1)) {
      if (a !== undefined && b !== undefined && a === b) {
        throw new Error(`createStudioStore: ${nameA} and ${nameB} are the same key "${a}"`);
      }
    }
  }
  const urlEnv = options.urlEnv ?? "KV_REST_API_URL";
  const tokenEnv = options.tokenEnv ?? "KV_REST_API_TOKEN";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`createStudioStore: timeoutMs must be a positive number, not ${timeoutMs}`);
  }

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
    // A store that never answers is abandoned after timeoutMs: the request is
    // aborted, and the call fails even if the fetch ignores the abort, so a page is
    // never left waiting on it. The timeout is decided before the abort, so the
    // caller always reads "store timed out", never an abort error.
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`store timed out after ${timeoutMs} ms`));
        controller.abort();
      }, timeoutMs);
      // Never keep a Node process alive for the sake of a store call.
      (timer as { unref?: () => void }).unref?.();
    });
    // The races below consume the rejection; this keeps a late one from being reported
    // as unhandled.
    expired.catch(() => undefined);
    try {
      const res = await Promise.race([
        doFetch(`${c.url}/${path}`, {
          ...(fresh ? { cache: "no-store" as const } : (options.cachedRead ?? {})),
          method: init?.method ?? "GET",
          body: init?.body,
          headers: { Authorization: `Bearer ${c.token}`, ...(init?.headers ?? {}) },
          signal: controller.signal,
        } as RequestInit),
        expired,
      ]);
      if (!res.ok) throw new Error(`store ${res.status}`);
      const body = (await Promise.race([res.json(), expired])) as { result?: unknown };
      return body.result ?? null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** A stored JSON blob, parsed. undefined when nothing is stored or it is corrupted:
      a broken blob must not take a public page down with it. */
  async function readJson(k: string, fresh: boolean): Promise<unknown> {
    const raw = await call(`get/${k}`, undefined, fresh);
    if (raw === null || raw === undefined) return undefined;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return undefined;
    }
  }

  async function writeJson(k: string, value: unknown): Promise<void> {
    await call(`set/${k}`, { method: "POST", body: JSON.stringify(value) }, true);
  }

  /* -------------------------------------------------------------- overlays */

  async function readOverlays(fresh = false): Promise<Record<string, ArtworkOverlay> | null> {
    if (!configured()) return null;
    const parsed = await readJson(key, fresh);
    if (!isPlainObject(parsed)) return {};
    const out: Record<string, ArtworkOverlay> = {};
    for (const [slug, entry] of Object.entries(parsed)) {
      if (isPlainObject(entry)) out[slug] = sanitizeStoredOverlay(entry);
    }
    return out;
  }

  async function writeOverlay(slug: string, overlay: ArtworkOverlay, by: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = {
      ...current,
      [slug]: { ...current[slug], ...overlay, updatedAt: new Date().toISOString(), updatedBy: by },
    };
    await writeJson(key, next);
    return true;
  }

  async function clearOverlay(slug: string): Promise<boolean> {
    const current = await readOverlays(true);
    if (current === null) return false;
    const next = { ...current };
    delete next[slug];
    await writeJson(key, next);
    return true;
  }

  /* -------------------------------------------------------------- shows */

  const showsConfigured = (): boolean => Boolean(showsKey) && configured();

  async function readShowMap(fresh: boolean): Promise<Record<string, ShowRecord> | null> {
    if (!showsKey || !configured()) return null;
    return sanitizeStoredShows(await readJson(showsKey, fresh));
  }

  const shows: ShowsStore = {
    key: showsKey,
    configured: showsConfigured,
    async readShows(fresh = false) {
      const map = await readShowMap(fresh);
      return map === null ? null : Object.values(map);
    },
    async writeShow(show, by) {
      const current = await readShowMap(true);
      if (current === null || !showsKey) return false;
      // Whole, never merged: a field the artist cleared must stay cleared.
      const next = {
        ...current,
        [show.slug]: { ...show, updatedAt: new Date().toISOString(), updatedBy: by },
      };
      await writeJson(showsKey, next);
      return true;
    },
    async deleteShow(slug) {
      const current = await readShowMap(true);
      if (current === null || !showsKey) return false;
      const next = { ...current };
      delete next[slug];
      await writeJson(showsKey, next);
      return true;
    },
  };

  /* -------------------------------------------------------------- press token */

  const press: PressStore = {
    key: pressKey,
    configured: () => Boolean(pressKey) && configured(),
    async readToken(fresh = false) {
      if (!pressKey || !configured()) return null;
      const parsed = await readJson(pressKey, fresh);
      return isPlainObject(parsed) && isPressToken(parsed.token) ? parsed.token : undefined;
    },
    async writeToken(token, by) {
      if (!isPressToken(token)) throw new Error("not a press token");
      if (!pressKey || !configured()) return false;
      await writeJson(pressKey, { token, updatedAt: new Date().toISOString(), updatedBy: by });
      return true;
    },
  };

  return { key, configured, readOverlays, writeOverlay, clearOverlay, shows, press };
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
