import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loginHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import { createStudioAuth } from "./studio-auth";
import type { StudioStore } from "./studio-store";

const SECRET = "KIT_TEST_H_SECRET";
const PASS_ARTIST = "KIT_TEST_H_ARTIST";
const PASS_OPERATOR = "KIT_TEST_H_OPERATOR";

const auth = createStudioAuth({
  cookieName: "kit_studio",
  secretEnv: SECRET,
  roles: [
    { id: "artist", passphraseEnv: PASS_ARTIST },
    { id: "operator", passphraseEnv: PASS_OPERATOR, canReset: true },
  ],
});

const original = { ...process.env };

beforeEach(() => {
  process.env[SECRET] = "handler-secret";
  process.env[PASS_ARTIST] = "artist-key";
  process.env[PASS_OPERATOR] = "operator-key";
});

afterEach(() => {
  process.env = { ...original };
});

function memoryStore({ connected = true, accepts = true } = {}) {
  const data: Record<string, ArtworkOverlay> = { "waterscape-01": { title: "Saved" } };
  const writes: { slug: string; overlay: ArtworkOverlay; by: string }[] = [];
  const store: StudioStore = {
    key: "test:overlays",
    configured: () => connected,
    readOverlays: async () => (connected ? { ...data } : null),
    writeOverlay: async (slug, overlay, by) => {
      if (!connected || !accepts) return false;
      writes.push({ slug, overlay, by });
      data[slug] = { ...data[slug], ...overlay };
      return true;
    },
    clearOverlay: async (slug) => {
      if (!connected || !accepts) return false;
      delete data[slug];
      return true;
    },
  };
  return { store, data, writes };
}

const catalog = { has: (slug: string) => slug === "waterscape-01" };
const login = loginHandler({ auth, wrongKeyDelayMs: 0 });

async function cookieFor(role: "artist" | "operator"): Promise<string> {
  return `${auth.cookieName}=${await auth.issue(role)}`;
}

function request(method: string, path: string, opts: { cookie?: string; body?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(`https://site.test${path}`, { method, headers, body: opts.body });
}

const loginRequest = (body: string) => request("POST", "/api/studio/login", { body });

describe("loginHandler", () => {
  it("answers 503 when the studio has no secret", async () => {
    delete process.env[SECRET];
    const res = await login.POST(loginRequest(JSON.stringify({ passphrase: "artist-key" })));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The studio is not configured yet." });
  });

  it("answers 400 to a body it cannot read", async () => {
    const res = await login.POST(loginRequest("not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Could not read that." });
  });

  it("answers 401 to a wrong passphrase, naming no role and setting no cookie", async () => {
    const res = await login.POST(loginRequest(JSON.stringify({ passphrase: "nope" })));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "That passphrase is not right." });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("makes a wrong guess wait before it is answered", async () => {
    const slow = loginHandler({ auth, wrongKeyDelayMs: 60 });
    const started = Date.now();
    await slow.POST(loginRequest(JSON.stringify({ passphrase: "nope" })));
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it("signs the role into a cookie on the right passphrase", async () => {
    const res = await login.POST(loginRequest(JSON.stringify({ passphrase: "artist-key" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "artist" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^kit_studio=[^;]+; Path=\/;/);
    expect(setCookie).toContain("HttpOnly");
    const token = setCookie.slice("kit_studio=".length, setCookie.indexOf(";"));
    expect(await auth.verify(token)).toBe("artist");
  });

  it("logs out by expiring the cookie", async () => {
    const res = await login.DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toMatch(/^kit_studio=; .*Max-Age=0/);
  });
});

describe("workHandler", () => {
  it("is locked without a cookie", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).GET(request("GET", "/api/studio/work"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "locked" });
  });

  it("is locked to a forged cookie", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: "kit_studio=operator.9999999999.forged" }),
    );
    expect(res.status).toBe(401);
  });

  it("says when no store is connected rather than showing an empty record", async () => {
    const { store } = memoryStore({ connected: false });
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: await cookieFor("artist") }),
    );
    expect(await res.json()).toEqual({ configured: false, overlays: {} });
  });

  it("returns every saved overlay to a signed-in role", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configured: true,
      overlays: { "waterscape-01": { title: "Saved" } },
    });
  });

  it("refuses to save when no store is connected", async () => {
    const { store } = memoryStore({ connected: false });
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "Alcyone" }),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "No store is connected, so nothing would be saved.",
    });
  });

  it("refuses a body over the length limit", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog, maxBodyLength: 20 }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "long enough" }),
      }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "That is too long." });
  });

  it("refuses a body that is not a JSON object", async () => {
    const { store } = memoryStore();
    const handler = workHandler({ auth, store, catalog });
    const cookie = await cookieFor("artist");
    for (const body of ["not json", "null", "[]", "42"]) {
      const res = await handler.PUT(request("PUT", "/api/studio/work", { cookie, body }));
      expect(res.status, body).toBe(400);
    }
  });

  it("refuses a slug that is not a work on the site", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "ghost", title: "x" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "That is not a work on this site." });
  });

  it("saves the cleaned overlay as the signed-in role", async () => {
    const { store, writes } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: " Alcyone ", src: "/evil.png" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(writes).toEqual([
      { slug: "waterscape-01", overlay: { title: "Alcyone" }, by: "artist" },
    ]);
  });

  it("says so when the store does not accept a save", async () => {
    const { store } = memoryStore({ accepts: false });
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "Alcyone" }),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });

  it("lets only a role that can reset discard a record", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("artist"),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Not permitted." });
  });

  it("refuses to reset a slug that is not a work on the site", async () => {
    const { store } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=ghost", { cookie: await cookieFor("operator") }),
    );
    expect(res.status).toBe(404);
  });

  it("resets a record to its base for a role that can", async () => {
    const { store, data } = memoryStore();
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("operator"),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(data["waterscape-01"]).toBeUndefined();
  });

  it("says so when the store does not accept a reset", async () => {
    const { store } = memoryStore({ accepts: false });
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("operator"),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });
});
