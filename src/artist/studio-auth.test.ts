import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudioAuth, readCookie } from "./studio-auth";

const SECRET = "KIT_TEST_STUDIO_SECRET";
const PASS_ARTIST = "KIT_TEST_PASS_ARTIST";
const PASS_OPERATOR = "KIT_TEST_PASS_OPERATOR";

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
  process.env[SECRET] = "test-secret-value";
  process.env[PASS_ARTIST] = "artist-key";
  process.env[PASS_OPERATOR] = "operator-key";
});

afterEach(() => {
  process.env = { ...original };
});

describe("the door fails closed", () => {
  it("opens for nobody when the secret is unset", async () => {
    // Assigning undefined stores the STRING "undefined", which is truthy. Delete.
    delete process.env[SECRET];
    expect(await auth.issue("operator")).toBeNull();
    expect(auth.configured()).toBe(false);
  });

  it("opens for nobody when every passphrase is unset", () => {
    delete process.env[PASS_ARTIST];
    delete process.env[PASS_OPERATOR];
    expect(auth.roleFor("artist-key")).toBeNull();
    expect(auth.configured()).toBe(false);
  });

  it("refuses an empty passphrase even when one is configured", () => {
    expect(auth.roleFor("")).toBeNull();
  });

  it("refuses a wrong passphrase", () => {
    expect(auth.roleFor("not-the-key")).toBeNull();
  });
});

describe("two keys, two people", () => {
  it("gives each passphrase its own role", () => {
    expect(auth.roleFor("artist-key")).toBe("artist");
    expect(auth.roleFor("operator-key")).toBe("operator");
  });

  it("round-trips a role through a signed cookie", async () => {
    const token = await auth.issue("artist");
    expect(token).toBeTruthy();
    expect(await auth.verify(token as string)).toBe("artist");
  });
});

describe("the cookie cannot be edited into a promotion", () => {
  it("rejects a role swapped in the payload", async () => {
    const token = (await auth.issue("artist")) as string;
    const [, expires, mac] = token.split(".");
    expect(await auth.verify(`operator.${expires}.${mac}`)).toBeNull();
  });

  it("rejects an expiry pushed into the future", async () => {
    const token = (await auth.issue("artist")) as string;
    const [role, , mac] = token.split(".");
    expect(await auth.verify(`${role}.9999999999.${mac}`)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = (await auth.issue("operator")) as string;
    const [role, expires] = token.split(".");
    expect(await auth.verify(`${role}.${expires}.deadbeef`)).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    // Validly signed, so only the expiry check can reject it.
    const mac = createHmac("sha256", "test-secret-value")
      .update(`operator.${past}`)
      .digest("base64url");
    expect(await auth.verify(`operator.${past}.${mac}`)).toBeNull();
  });

  it("rejects a malformed token, an unknown role, and nothing at all", async () => {
    expect(await auth.verify("garbage")).toBeNull();
    expect(await auth.verify("admin.9999999999.x")).toBeNull();
    expect(await auth.verify(undefined)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const token = (await auth.issue("operator")) as string;
    process.env[SECRET] = "a-different-secret";
    expect(await auth.verify(token)).toBeNull();
  });
});

describe("the cookie format sites already hold", () => {
  it("is <role>.<expires>.<base64url HMAC-SHA256>, both read and written", async () => {
    const mac = (payload: string) =>
      createHmac("sha256", "test-secret-value").update(payload).digest("base64url");
    const expires = Math.floor(Date.now() / 1000) + 3600;
    expect(await auth.verify(`artist.${expires}.${mac(`artist.${expires}`)}`)).toBe("artist");

    const token = (await auth.issue("artist")) as string;
    const [role, issuedExpires, issuedMac] = token.split(".");
    expect(issuedMac).toBe(mac(`${role}.${issuedExpires}`));
  });
});

describe("configuration", () => {
  it("refuses a role id or cookie name that would break the cookie", () => {
    expect(() =>
      createStudioAuth({
        cookieName: "ok",
        secretEnv: SECRET,
        roles: [{ id: "a.b", passphraseEnv: PASS_ARTIST }],
      }),
    ).toThrow(/role id/);
    expect(() => createStudioAuth({ cookieName: "ok", secretEnv: SECRET, roles: [] })).toThrow(
      /at least one role/,
    );
    expect(() =>
      createStudioAuth({
        cookieName: "bad name",
        secretEnv: SECRET,
        roles: [{ id: "a", passphraseEnv: PASS_ARTIST }],
      }),
    ).toThrow(/cookie name/);
  });

  it("refuses a lifetime that is not a positive whole number of seconds", () => {
    for (const ttlSeconds of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        createStudioAuth({
          cookieName: "ok",
          secretEnv: SECRET,
          ttlSeconds,
          roles: [{ id: "a", passphraseEnv: PASS_ARTIST }],
        }),
      ).toThrow(/ttlSeconds/);
    }
  });

  it("lets only a role marked canReset reset a record", () => {
    expect(auth.canReset("operator")).toBe(true);
    expect(auth.canReset("artist")).toBe(false);
  });

  it("honors a shorter time to live", async () => {
    const short = createStudioAuth({
      cookieName: "kit_studio",
      secretEnv: SECRET,
      ttlSeconds: 60,
      roles: [{ id: "artist", passphraseEnv: PASS_ARTIST }],
    });
    const token = (await short.issue("artist")) as string;
    const expires = Number(token.split(".")[1]);
    const now = Math.floor(Date.now() / 1000);
    expect(expires).toBeGreaterThanOrEqual(now + 59);
    expect(expires).toBeLessThanOrEqual(now + 60);
    expect(short.setCookie(token)).toContain("Max-Age=60");
  });
});

describe("cookies on the wire", () => {
  it("reads its own cookie from a request that carries others", async () => {
    const token = (await auth.issue("artist")) as string;
    const request = new Request("https://site.test/studio", {
      headers: { cookie: `theme=dark; kit_studio=${token}; other=1` },
    });
    expect(await auth.roleFrom(request)).toBe("artist");
  });

  it("finds no role on a request without its cookie", async () => {
    expect(await auth.roleFrom(new Request("https://site.test/"))).toBeNull();
    const token = (await auth.issue("artist")) as string;
    const request = new Request("https://site.test/", {
      headers: { cookie: `other_studio=${token}` },
    });
    expect(await auth.roleFrom(request)).toBeNull();
  });

  it("sets a twelve-hour cookie that scripts cannot read", () => {
    const header = auth.setCookie("tok");
    expect(header.startsWith("kit_studio=tok; Path=/;")).toBe(true);
    for (const part of ["Max-Age=43200", "Secure", "HttpOnly", "SameSite=lax"]) {
      expect(header).toContain(part);
    }
  });

  it("refuses to write a token that could break out of the cookie", () => {
    expect(() => auth.setCookie("tok; Path=/evil")).toThrow(/token/);
    expect(() => auth.setCookie("a b")).toThrow(/token/);
  });

  it("clears the cookie by expiring it at once", () => {
    expect(auth.clearCookie()).toMatch(/^kit_studio=; Path=\/; Expires=[^;]+; Max-Age=0;/);
  });

  it("reads one cookie by name, decoded, and nothing when it is absent", () => {
    expect(readCookie("a=1; kit_studio=x%2Ey; b=2", "kit_studio")).toBe("x.y");
    expect(readCookie("a=1", "kit_studio")).toBeUndefined();
    expect(readCookie(null, "kit_studio")).toBeUndefined();
  });
});
