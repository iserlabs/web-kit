import { cleanOverlay, cleanText } from "./overlay";
import type { StudioAuth } from "./studio-auth";
import type { StudioStore } from "./studio-store";

/**
 * The studio's routes, framework-free: each handler takes a Web Request and
 * returns a Response, so a site's route file only wires them up.
 *
 * Every handler verifies the signed cookie itself. A hidden studio link is never
 * the gate.
 */

/** What the handlers need to know about the site's catalog: whether a slug is a work
    on this site. An overlay can only describe a work that exists, so a studio route
    cannot be used to conjure a painting or to point one at someone else's image. */
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

export interface WorkHandlerOptions<R extends string = string> {
  auth: StudioAuth<R>;
  store: StudioStore;
  catalog: StudioCatalog;
  /** The longest request body accepted, in characters. Default 8000. */
  maxBodyLength?: number;
  /** Called with the error whenever the store fails, just before the 503 answer, so a
      site can report it (Sentry, a log). A throwing onError never changes the answer. */
  onError?: (error: unknown, context: WorkErrorContext) => void;
}

export interface WorkErrorContext {
  method: "GET" | "PUT" | "DELETE";
  slug?: string;
}

export interface WorkHandler {
  GET(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
}

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers });
}

const locked = () => json({ error: "locked" }, 401);
const notAWork = () => json({ error: "That is not a work on this site." }, 404);
const refused = () => json({ error: "The store did not accept that." }, 503);

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
      return json({ error: "Could not read that." }, 400);
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
}: WorkHandlerOptions<R>): WorkHandler {
  function report(error: unknown, context: WorkErrorContext): void {
    try {
      onError?.(error, context);
    } catch {
      // A broken reporter must not turn a clean 503 into an unhandled error.
    }
  }

  async function GET(request: Request): Promise<Response> {
    if (!(await auth.roleFrom(request))) return locked();
    if (!store.configured()) return json({ configured: false, overlays: {} });
    try {
      return json({ configured: true, overlays: (await store.readOverlays(true)) ?? {} });
    } catch (error) {
      report(error, { method: "GET" });
      return refused();
    }
  }

  async function PUT(request: Request): Promise<Response> {
    const who = await auth.roleFrom(request);
    if (!who) return locked();
    if (!store.configured()) {
      return json({ error: "No store is connected, so nothing would be saved." }, 503);
    }

    const raw = await request.text();
    if (raw.length > maxBodyLength) {
      return json({ error: "That is too long." }, 413);
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return json({ error: "Could not read that." }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Could not read that." }, 400);
    }

    const slug = cleanText(body.slug, 120);
    if (!slug || !catalog.has(slug)) return notAWork();

    try {
      const ok = await store.writeOverlay(slug, cleanOverlay(body), who);
      return ok ? json({ ok: true }) : refused();
    } catch (error) {
      report(error, { method: "PUT", slug });
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
      report(error, { method: "DELETE", slug });
      return refused();
    }
  }

  return { GET, PUT, DELETE };
}
