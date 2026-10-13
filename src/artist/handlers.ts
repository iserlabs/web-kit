import { cleanOverlay, cleanText } from "./overlay";
import { cleanShow } from "./shows";
import type { StudioAuth } from "./studio-auth";
import type { ShowsStore, StudioStore } from "./studio-store";

/**
 * The studio's routes, framework-free: each handler takes a Web Request and
 * returns a Response, so a site's route file only wires them up.
 *
 * Every handler verifies the signed cookie itself. A hidden studio link is never
 * the gate.
 */

/** What the handlers need to know about the site's catalog: whether a slug is a work
    on this site. An overlay can only describe a work that exists, and a show can only
    list works that exist, so a studio route cannot be used to conjure a painting or
    to point one at someone else's image. */
export interface StudioCatalog {
  has(slug: string): boolean;
}

export interface LoginHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  /** How long a wrong passphrase waits for its answer. Default 600 ms. */
  wrongKeyDelayMs?: number;
}

export interface LoginHandler {
  POST(request: Request): Promise<Response>;
  DELETE(request?: Request): Promise<Response>;
}

/** Where a store failure happened, for whoever reports it. */
export interface StudioErrorContext {
  method: "GET" | "PUT" | "DELETE";
  slug?: string;
}

/** The work handler's earlier name for the same context. */
export type WorkErrorContext = StudioErrorContext;

/** Called with the error whenever the store fails, just before the 503 answer, so a
    site can report it (Sentry, a log). It may be async: the handler waits for it, so
    a serverless runtime does not freeze a report half sent, and a reporter that throws
    or rejects never changes the answer. */
export type StudioErrorReporter = (
  error: unknown,
  context: StudioErrorContext,
) => void | Promise<void>;

export interface WorkHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  store: StudioStore;
  catalog: StudioCatalog;
  /** The longest request body accepted, in characters. Default 8000. */
  maxBodyLength?: number;
  onError?: StudioErrorReporter;
  /** The longest the handler waits for `onError`, in milliseconds. Default 2000. A
      reporter still running after that no longer holds the response. */
  reportTimeoutMs?: number;
}

export interface WorkHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

export interface ShowsHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  /** The store's `shows`, for example `studioStore.shows`. */
  store: ShowsStore;
  /** Every work a show lists must be one of these. */
  catalog: StudioCatalog;
  /** The longest request body accepted, in characters. Default 8000. */
  maxBodyLength?: number;
  onError?: StudioErrorReporter;
  /** The longest the handler waits for `onError`, in milliseconds. Default 2000. A
      reporter still running after that no longer holds the response. */
  reportTimeoutMs?: number;
}

export interface ShowsHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers });
}

const locked = () => json({ error: "locked" }, 401);
const notAWork = () => json({ error: "That is not a work on this site." }, 404);
const notAShow = () => json({ error: "That is not a show on this site." }, 404);
const refused = () => json({ error: "The store did not accept that." }, 503);
const noStore = () => json({ error: "No store is connected, so nothing would be saved." }, 503);
const unreadable = () => json({ error: "Could not read that." }, 400);

const REPORT_TIMEOUT_MS = 2000;

/** Hands a store failure to the site's reporter, if it has one, and waits for it, but
    never longer than `timeoutMs`, so a hung reporter cannot hold the response. A
    reporter that throws or rejects must not turn a clean 503 into an unhandled error. */
async function report(
  onError: StudioErrorReporter | undefined,
  error: unknown,
  context: StudioErrorContext,
  timeoutMs: number,
): Promise<void> {
  if (!onError) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    // Never keep a Node process alive for the sake of a report.
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    await Promise.race([Promise.resolve().then(() => onError(error, context)), ceiling]);
  } catch {
    // Swallowed on purpose: the answer is already decided.
  } finally {
    clearTimeout(timer);
  }
}

/** A request body that is a JSON object no longer than `max` characters, or the
    answer refusing it. */
async function readObject(
  request: Request,
  max: number,
): Promise<Record<string, unknown> | Response> {
  const raw = await request.text();
  if (raw.length > max) return json({ error: "That is too long." }, 413);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return unreadable();
    }
    return parsed as Record<string, unknown>;
  } catch {
    return unreadable();
  }
}

/**
 * The door. One passphrase in, one signed role cookie out.
 *
 * Deliberately slow to answer a wrong key: the only way in is guessing, so the
 * cheapest useful defense is making guesses expensive. Says "That passphrase is not
 * right." either way rather than distinguishing one role's key from another's,
 * because naming which key was close is help for exactly one kind of visitor.
 */
export function loginHandler<R extends string>({
  auth,
  wrongKeyDelayMs = 600,
}: LoginHandlerOptions<R>): LoginHandler {
  async function POST(request: Request): Promise<Response> {
    if (!auth.configured()) {
      return json({ error: "The studio is not configured yet." }, 503);
    }

    let passphrase = "";
    try {
      const body = (await request.json()) as { passphrase?: unknown };
      passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
    } catch {
      return unreadable();
    }

    const role = auth.roleFor(passphrase);
    if (!role) {
      await new Promise((resolve) => setTimeout(resolve, wrongKeyDelayMs));
      return json({ error: "That passphrase is not right." }, 401);
    }

    const token = await auth.issue(role);
    if (!token) {
      return json({ error: "The studio is not configured yet." }, 503);
    }
    return json({ ok: true, role }, 200, { "Set-Cookie": auth.setCookie(token) });
  }

  async function DELETE(): Promise<Response> {
    return json({ ok: true }, 200, { "Set-Cookie": auth.clearCookie() });
  }

  return { POST, DELETE };
}

/**
 * Reading and writing what is KNOWN about a work.
 *
 * Every field passes `cleanOverlay` rather than being trusted from the form, and the
 * slug is checked against the site's catalog.
 */
export function workHandler<R extends string>({
  auth,
  store,
  catalog,
  maxBodyLength = 8000,
  onError,
  reportTimeoutMs = REPORT_TIMEOUT_MS,
}: WorkHandlerOptions<R>): WorkHandler {
  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, overlays: {} });
    try {
      return json({ configured: true, overlays: (await store.readOverlays(true)) ?? {} });
    } catch (error) {
      await report(onError, error, { method: "GET" }, reportTimeoutMs);
      return refused();
    }
  }

  async function PUT(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) return noStore();

    const body = await readObject(request, maxBodyLength);
    if (body instanceof Response) return body;

    const slug = cleanText(body.slug, 120);
    if (!slug || !catalog.has(slug)) return notAWork();

    try {
      const ok = await store.writeOverlay(slug, cleanOverlay(body), who);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      await report(onError, error, { method: "PUT", slug }, reportTimeoutMs);
      return refused();
    }
  }

  async function DELETE(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    // Only a role marked canReset may reset a record to its base state. The artist
    // editing their own work is routine; discarding everything recorded about a
    // piece is not.
    if (!auth.canReset(who)) {
      return json({ error: "Not permitted." }, 403);
    }
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug || !catalog.has(slug)) return notAWork();
    try {
      const ok = await store.clearOverlay(slug);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      await report(onError, error, { method: "DELETE", slug }, reportTimeoutMs);
      return refused();
    }
  }

  return { GET, PUT, DELETE };
}

/**
 * Reading and writing the artist's shows.
 *
 * Every write passes `cleanShow`, which refuses an incomplete or impossible show and
 * names each problem, and checks every listed work against the site's catalog. Any
 * signed-in role may delete a show: a show is the artist's own fact, and removing a
 * canceled one touches no work's record.
 */
export function showsHandler<R extends string>({
  auth,
  store,
  catalog,
  maxBodyLength = 8000,
  onError,
  reportTimeoutMs = REPORT_TIMEOUT_MS,
}: ShowsHandlerOptions<R>): ShowsHandler {
  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, shows: [] });
    try {
      return json({ configured: true, shows: (await store.readShows(true)) ?? [] });
    } catch (error) {
      await report(onError, error, { method: "GET" }, reportTimeoutMs);
      return refused();
    }
  }

  async function PUT(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) return noStore();

    const body = await readObject(request, maxBodyLength);
    if (body instanceof Response) return body;

    const result = cleanShow(body, catalog);
    if (!result.ok) {
      return json({ error: "That show is not ready to save.", problems: result.problems }, 400);
    }

    try {
      if (body.create === true) {
        const saved = await store.readShows(true);
        if (saved?.some((s) => s.slug === result.show.slug)) {
          return json({ error: "A show with that name already exists." }, 409);
        }
      }
      const ok = await store.writeShow(result.show, who);
      return ok ? json({ ok: true, show: result.show }) : refused();
    } catch (error) {
      await report(onError, error, { method: "PUT", slug: result.show.slug }, reportTimeoutMs);
      return refused();
    }
  }

  async function DELETE(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return noStore();
    const slug = cleanText(new URL(request.url).searchParams.get("slug"), 120);
    if (!slug) return notAShow();
    try {
      const saved = await store.readShows(true);
      if (saved === null) return noStore();
      if (!saved.some((s) => s.slug === slug)) return notAShow();
      const ok = await store.deleteShow(slug);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      await report(onError, error, { method: "DELETE", slug }, reportTimeoutMs);
      return refused();
    }
  }

  return { GET, PUT, DELETE };
}
