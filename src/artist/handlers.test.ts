import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginHandler, showsHandler, workHandler } from "./handlers";
import type { ArtworkOverlay } from "./overlay";
import type { ShowRecord } from "./shows";
import { createStudioAuth } from "./studio-auth";
import type { ShowsStore, StudioStore } from "./studio-store";

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
      expect(await res.json(), body).toEqual({ error: "Could not read that." });
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

  it("answers 503 in plain words when reading the store fails", async () => {
    const { store } = memoryStore();
    store.readOverlays = async () => {
      throw new Error("network down");
    };
    const res = await workHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/work", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });

  it("answers 503 in plain words when saving to the store fails", async () => {
    const { store } = memoryStore();
    store.writeOverlay = async () => {
      throw new Error("network down");
    };
    const res = await workHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/work", {
        cookie: await cookieFor("artist"),
        body: JSON.stringify({ slug: "waterscape-01", title: "Alcyone" }),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });

  it("answers 503 in plain words when resetting in the store fails", async () => {
    const { store } = memoryStore();
    store.clearOverlay = async () => {
      throw new Error("network down");
    };
    const res = await workHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/work?slug=waterscape-01", {
        cookie: await cookieFor("operator"),
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });

  it("locks PUT to no cookie and to a forged cookie, and writes nothing", async () => {
    const { store, writes } = memoryStore();
    const handler = workHandler({ auth, store, catalog });
    const body = JSON.stringify({ slug: "waterscape-01", title: "Alcyone" });
    for (const cookie of [undefined, "kit_studio=operator.9999999999.forged"]) {
      const res = await handler.PUT(request("PUT", "/api/studio/work", { cookie, body }));
      expect(res.status, String(cookie)).toBe(401);
      expect(await res.json()).toEqual({ error: "locked" });
    }
    expect(writes).toEqual([]);
  });

  it("locks DELETE to no cookie and to a forged cookie, and clears nothing", async () => {
    const { store, data } = memoryStore();
    const handler = workHandler({ auth, store, catalog });
    for (const cookie of [undefined, "kit_studio=operator.9999999999.forged"]) {
      const res = await handler.DELETE(
        request("DELETE", "/api/studio/work?slug=waterscape-01", { cookie }),
      );
      expect(res.status, String(cookie)).toBe(401);
      expect(await res.json()).toEqual({ error: "locked" });
    }
    expect(data["waterscape-01"]).toEqual({ title: "Saved" });
  });
});

describe("workHandler onError", () => {
  const putReq = async () =>
    request("PUT", "/api/studio/work", {
      cookie: await cookieFor("artist"),
      body: JSON.stringify({ slug: "waterscape-01", title: "Alcyone" }),
    });
  const getReq = async () =>
    request("GET", "/api/studio/work", { cookie: await cookieFor("artist") });
  const delReq = async () =>
    request("DELETE", "/api/studio/work?slug=waterscape-01", {
      cookie: await cookieFor("operator"),
    });

  it("is called once with the error and the method (and slug) on each store failure", async () => {
    const boom = new Error("network down");
    const calls: { error: unknown; context: unknown }[] = [];
    const onError = (error: unknown, context: unknown) => {
      calls.push({ error, context });
    };
    const { store } = memoryStore();
    store.readOverlays = async () => {
      throw boom;
    };
    store.writeOverlay = async () => {
      throw boom;
    };
    store.clearOverlay = async () => {
      throw boom;
    };
    const handler = workHandler({ auth, store, catalog, onError });
    expect((await handler.GET(await getReq())).status).toBe(503);
    expect((await handler.PUT(await putReq())).status).toBe(503);
    expect((await handler.DELETE(await delReq())).status).toBe(503);
    expect(calls).toEqual([
      { error: boom, context: { method: "GET" } },
      { error: boom, context: { method: "PUT", slug: "waterscape-01" } },
      { error: boom, context: { method: "DELETE", slug: "waterscape-01" } },
    ]);
  });

  it("is not called when the store answers", async () => {
    const calls: unknown[] = [];
    const { store } = memoryStore();
    const handler = workHandler({
      auth,
      store,
      catalog,
      onError: (e) => {
        calls.push(e);
      },
    });
    expect((await handler.GET(await getReq())).status).toBe(200);
    expect((await handler.PUT(await putReq())).status).toBe(200);
    expect((await handler.DELETE(await delReq())).status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("does not change the 503 answer when onError itself throws", async () => {
    const { store } = memoryStore();
    store.readOverlays = async () => {
      throw new Error("network down");
    };
    store.writeOverlay = async () => {
      throw new Error("network down");
    };
    store.clearOverlay = async () => {
      throw new Error("network down");
    };
    const handler = workHandler({
      auth,
      store,
      catalog,
      onError: () => {
        throw new Error("reporter down");
      },
    });
    for (const req of [await getReq(), await putReq(), await delReq()]) {
      const method = req.method;
      const res = await handler[method as "GET" | "PUT" | "DELETE"](req);
      expect(res.status, method).toBe(503);
      expect(await res.json()).toEqual({ error: "The store did not accept that." });
    }
  });

  it("waits for an async reporter, and one that rejects never changes the 503", async () => {
    const { store } = memoryStore();
    store.readOverlays = async () => {
      throw new Error("network down");
    };
    let finished = 0;
    const waits = workHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        finished += 1;
      },
    });
    expect((await waits.GET(await getReq())).status).toBe(503);
    expect(finished).toBe(1);
    const rejects = workHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        throw new Error("reporter down");
      },
    });
    const res = await rejects.GET(await getReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "The store did not accept that." });
  });
});

/** Obviously fake facts: nothing here describes a real show. */
const fakeShow = (over: Partial<ShowRecord> = {}): ShowRecord => ({
  slug: "test-show",
  title: "Test Show",
  kind: "solo",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "draft",
  ...over,
});

function memoryShows({ connected = true, accepts = true } = {}) {
  const data: Record<string, ShowRecord> = { "test-show": fakeShow() };
  const writes: { show: ShowRecord; by: string }[] = [];
  const store: ShowsStore = {
    key: "test:shows",
    configured: () => connected,
    readShows: async () => (connected ? Object.values(data) : null),
    writeShow: async (show, by) => {
      if (!connected || !accepts) return false;
      writes.push({ show, by });
      data[show.slug] = show;
      return true;
    },
    deleteShow: async (slug) => {
      if (!connected || !accepts) return false;
      delete data[slug];
      return true;
    },
  };
  return { store, data, writes };
}

const showBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    slug: "new-show",
    title: "New Show",
    kind: "group",
    venue: "Test Gallery",
    city: "Test City",
    startsOn: "2026-11-07",
    endsOn: "2026-12-05",
    workSlugs: ["waterscape-01"],
    publish: "published",
    ...over,
  });

const savedNewShow = {
  slug: "new-show",
  title: "New Show",
  kind: "group",
  venue: "Test Gallery",
  city: "Test City",
  startsOn: "2026-11-07",
  endsOn: "2026-12-05",
  workSlugs: ["waterscape-01"],
  publish: "published",
};

const NO_STORE = { error: "No store is connected, so nothing would be saved." };
const REFUSED = { error: "The store did not accept that." };

describe("showsHandler", () => {
  it("locks every method to no cookie and to a forged cookie, and changes nothing", async () => {
    const { store, data, writes } = memoryShows();
    const handler = showsHandler({ auth, store, catalog });
    for (const cookie of [undefined, "kit_studio=operator.9999999999.forged"]) {
      const answers = [
        await handler.GET(request("GET", "/api/studio/shows", { cookie })),
        await handler.PUT(request("PUT", "/api/studio/shows", { cookie, body: showBody() })),
        await handler.DELETE(request("DELETE", "/api/studio/shows?slug=test-show", { cookie })),
      ];
      for (const res of answers) {
        expect(res.status, String(cookie)).toBe(401);
        expect(await res.json()).toEqual({ error: "locked" });
      }
    }
    expect(writes).toEqual([]);
    expect(Object.keys(data)).toEqual(["test-show"]);
  });

  it("GET says plainly when no store is connected", async () => {
    const { store } = memoryShows({ connected: false });
    const res = await showsHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/shows", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, shows: [] });
  });

  it("GET lists the saved shows", async () => {
    const { store } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).GET(
      request("GET", "/api/studio/shows", { cookie: await cookieFor("artist") }),
    );
    expect(await res.json()).toEqual({ configured: true, shows: [fakeShow()] });
  });

  it("PUT saves a valid show, signed by whoever is in, and answers with what was saved", async () => {
    const { store, writes } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", {
        cookie: await cookieFor("artist"),
        body: showBody({ title: "  New Show  ", extra: "dropped" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, show: savedNewShow });
    expect(writes).toEqual([{ show: savedNewShow, by: "artist" }]);
  });

  it("PUT refuses a show with problems, naming each one, and saves nothing", async () => {
    const { store, writes } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", {
        cookie: await cookieFor("artist"),
        body: showBody({ endsOn: "2026-11-01", workSlugs: ["not-a-work"] }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "That show is not ready to save.",
      problems: [
        "The last day cannot come before the first.",
        '"not-a-work" is not a work on this site.',
      ],
    });
    expect(writes).toEqual([]);
  });

  it("PUT answers 503 in plain words when no store is connected", async () => {
    const { store } = memoryShows({ connected: false });
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NO_STORE);
  });

  it("PUT refuses a body over the cap with 413", async () => {
    const { store, writes } = memoryShows();
    const res = await showsHandler({ auth, store, catalog, maxBodyLength: 50 }).PUT(
      request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "That is too long." });
    expect(writes).toEqual([]);
  });

  it("PUT answers 400 to a body it cannot read, or JSON that is not an object", async () => {
    const { store } = memoryShows();
    const handler = showsHandler({ auth, store, catalog });
    for (const body of ["not json", "[1]", "null"]) {
      const res = await handler.PUT(
        request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body }),
      );
      expect(res.status, body).toBe(400);
      expect(await res.json()).toEqual({ error: "Could not read that." });
    }
  });

  it("PUT answers 503 when the store does not accept the show", async () => {
    const { store } = memoryShows({ accepts: false });
    const res = await showsHandler({ auth, store, catalog }).PUT(
      request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
  });

  it("DELETE is open to any signed-in role, since a show is the artist's own fact", async () => {
    const { store, data } = memoryShows();
    const res = await showsHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/shows?slug=test-show", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(data["test-show"]).toBeUndefined();
  });

  it("DELETE answers 404 for a show that is not saved, or no slug at all", async () => {
    const { store, data } = memoryShows();
    const handler = showsHandler({ auth, store, catalog });
    for (const path of ["/api/studio/shows?slug=not-a-show", "/api/studio/shows"]) {
      const res = await handler.DELETE(
        request("DELETE", path, { cookie: await cookieFor("operator") }),
      );
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: "That is not a show on this site." });
    }
    expect(Object.keys(data)).toEqual(["test-show"]);
  });

  it("DELETE answers 503 in plain words when no store is connected", async () => {
    const { store } = memoryShows({ connected: false });
    const res = await showsHandler({ auth, store, catalog }).DELETE(
      request("DELETE", "/api/studio/shows?slug=test-show", { cookie: await cookieFor("artist") }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NO_STORE);
  });
});

describe("showsHandler onError", () => {
  function failingShows() {
    const { store } = memoryShows();
    const boom = new Error("network down");
    store.readShows = async () => {
      throw boom;
    };
    store.writeShow = async () => {
      throw boom;
    };
    return { store, boom };
  }

  const getReq = async () =>
    request("GET", "/api/studio/shows", { cookie: await cookieFor("artist") });
  const putReq = async () =>
    request("PUT", "/api/studio/shows", { cookie: await cookieFor("artist"), body: showBody() });
  const delReq = async () =>
    request("DELETE", "/api/studio/shows?slug=test-show", { cookie: await cookieFor("artist") });

  it("is called once with the error and the method (and slug) on each store failure", async () => {
    const { store, boom } = failingShows();
    const calls: { error: unknown; context: unknown }[] = [];
    const handler = showsHandler({
      auth,
      store,
      catalog,
      onError: (error, context) => {
        calls.push({ error, context });
      },
    });
    expect((await handler.GET(await getReq())).status).toBe(503);
    expect((await handler.PUT(await putReq())).status).toBe(503);
    expect((await handler.DELETE(await delReq())).status).toBe(503);
    expect(calls).toEqual([
      { error: boom, context: { method: "GET" } },
      { error: boom, context: { method: "PUT", slug: "new-show" } },
      { error: boom, context: { method: "DELETE", slug: "test-show" } },
    ]);
  });

  it("waits for an async reporter, and one that rejects never changes the 503", async () => {
    const { store } = failingShows();
    let finished = 0;
    const waits = showsHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        finished += 1;
      },
    });
    expect((await waits.PUT(await putReq())).status).toBe(503);
    expect(finished).toBe(1);
    const rejects = showsHandler({
      auth,
      store,
      catalog,
      onError: async () => {
        throw new Error("reporter down");
      },
    });
    for (const req of [await getReq(), await putReq(), await delReq()]) {
      const method = req.method as "GET" | "PUT" | "DELETE";
      const res = await rejects[method](req);
      expect(res.status, method).toBe(503);
      expect(await res.json()).toEqual(REFUSED);
    }
  });

  it("answers 503 promptly when the reporter never settles, and clears its timer", async () => {
    const { store } = failingShows();
    const handler = showsHandler({
      auth,
      store,
      catalog,
      reportTimeoutMs: 20,
      onError: () => new Promise<void>(() => {}),
    });
    const started = Date.now();
    const res = await handler.GET(await getReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("caps a hung reporter at two seconds by default, and leaves no timer behind", async () => {
    const { store } = failingShows();
    const req = await getReq();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const hung = showsHandler({
        auth,
        store,
        catalog,
        onError: () => new Promise<void>(() => {}),
      });
      let status = 0;
      const pending = hung.GET(req).then((r) => {
        status = r.status;
      });
      // The cookie check runs on real async crypto, so wait until the ceiling timer is set.
      while (vi.getTimerCount() === 0) await new Promise((r) => setImmediate(r));
      await vi.advanceTimersByTimeAsync(1999);
      expect(status).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(status).toBe(503);
      expect(vi.getTimerCount()).toBe(0);

      const quick = showsHandler({ auth, store, catalog, onError: async () => {} });
      expect((await quick.GET(await getReq())).status).toBe(503);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers DELETE with the refused body when deleteShow returns false", async () => {
    const { store, data } = memoryShows({ accepts: false });
    const calls: unknown[] = [];
    const handler = showsHandler({ auth, store, catalog, onError: (e) => void calls.push(e) });
    const res = await handler.DELETE(await delReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
    expect(data["test-show"]).toBeDefined();
    expect(calls).toEqual([]);
  });

  it("answers DELETE with the refused body when deleteShow throws, reporting once", async () => {
    const { store } = memoryShows();
    const boom = new Error("delete failed");
    store.deleteShow = async () => {
      throw boom;
    };
    const calls: { error: unknown; context: unknown }[] = [];
    const handler = showsHandler({
      auth,
      store,
      catalog,
      onError: (error, context) => void calls.push({ error, context }),
    });
    const res = await handler.DELETE(await delReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
    expect(calls).toEqual([{ error: boom, context: { method: "DELETE", slug: "test-show" } }]);
  });

  it("does not change the 503 answer when onError itself throws", async () => {
    const { store } = failingShows();
    const handler = showsHandler({
      auth,
      store,
      catalog,
      onError: () => {
        throw new Error("reporter down");
      },
    });
    const res = await handler.GET(await getReq());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(REFUSED);
  });
});
