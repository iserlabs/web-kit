/**
 * The studio door.
 *
 * More than one person holds a key and they are not the same person: on
 * julianpotulicki.com the artist owns the currency of his own portfolio and Jake
 * owns the schema and the publish decisions. So the cookie carries a role, and the
 * role is signed along with the expiry rather than stored beside it, or anyone
 * holding a valid cookie could promote themselves by editing one word of it.
 *
 * HMAC over Web Crypto, which every runtime the kit targets already has. No
 * dependency for what is one signature and one comparison.
 *
 * Fails closed at every edge: an unset secret or an unset passphrase means nobody
 * gets in, rather than everybody. A door that opens when its lock is missing is
 * worse than no door, because it looks like a door.
 *
 * The cookie value is `<role>.<expires>.<mac>`, where `<mac>` is the base64url
 * HMAC-SHA256 of `<role>.<expires>`. It must not change: every cookie a site has
 * already issued is in that format, and changing it logs everyone out.
 */

export interface StudioRoleConfig<R extends string = string> {
  /** The role's name, signed into the cookie. Letters, digits, "-" and "_" only. */
  id: R;
  /** The env var holding this role's passphrase. Unset means this role cannot log in. */
  passphraseEnv: string;
  /** May discard everything recorded about a work (the work handler's DELETE). */
  canReset?: boolean;
}

export interface StudioAuthOptions<R extends string = string> {
  /** The cookie's name, e.g. "jp_studio". Letters, digits, "-" and "_" only. */
  cookieName: string;
  /** In the order a passphrase is checked against them. */
  roles: readonly StudioRoleConfig<R>[];
  /** The env var holding the signing secret. Unset means nobody gets in. */
  secretEnv: string;
  /** How long a cookie lasts. Default twelve hours. */
  ttlSeconds?: number;
}

export interface StudioAuth<R extends string = string> {
  readonly cookieName: string;
  /** Which role, if any, this passphrase opens. Unset passphrases open nothing. */
  roleFor(passphrase: string): R | null;
  /** A signed cookie value for this role, or null when no secret is set. */
  issue(role: R): Promise<string | null>;
  /** The role this cookie value proves, or null. Expiry is inside the signature. */
  verify(token: string | undefined): Promise<R | null>;
  /** True when a secret and at least one passphrase are set. */
  configured(): boolean;
  /** Whether this role may reset a record to its base state. */
  canReset(role: R): boolean;
  /** Reads this auth's cookie from a request's Cookie header and verifies it. */
  roleFrom(request: Request): Promise<R | null>;
  /** A Set-Cookie header value carrying this token. */
  setCookie(token: string): string;
  /** A Set-Cookie header value that expires the cookie at once. */
  clearCookie(): string;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;
const SAFE_TOKEN = /^[A-Za-z0-9._-]+$/;

/** A real ArrayBuffer, not the ArrayBufferLike a TextEncoder hands back: WebCrypto's
    BufferSource will not accept the latter under strict types, and copying a few
    bytes is cheaper than casting the type system into agreeing. */
function enc(s: string): ArrayBuffer {
  const view = new TextEncoder().encode(s);
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc(payload)));
}

/** Constant-time over equal-length inputs. A length mismatch returns early, which is
    harmless for signatures because they are always the same length. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** One cookie's value from a Cookie header, decoded, or undefined when absent. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at === -1 || part.slice(0, at).trim() !== name) continue;
    const raw = part.slice(at + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  return `${name}=${value}; Path=/; Expires=${expires}; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=lax`;
}

export function createStudioAuth<const R extends string>(
  options: StudioAuthOptions<R>,
): StudioAuth<R> {
  const { cookieName, roles, secretEnv } = options;
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (!SAFE_NAME.test(cookieName)) {
    throw new Error(`createStudioAuth: "${cookieName}" is not a usable cookie name`);
  }
  if (!Number.isSafeInteger(ttl) || ttl <= 0) {
    throw new Error(`createStudioAuth: ttlSeconds must be a positive whole number, got ${ttl}`);
  }
  if (roles.length === 0) throw new Error("createStudioAuth: at least one role is required");
  for (const r of roles) {
    if (!SAFE_NAME.test(r.id)) {
      throw new Error(
        `createStudioAuth: role id "${r.id}" may use only letters, digits, "-" and "_"`,
      );
    }
  }

  const ids = new Set<string>();
  for (const r of roles) {
    if (ids.has(r.id)) throw new Error(`createStudioAuth: duplicate role id "${r.id}"`);
    ids.add(r.id);
  }

  const env = (name: string): string | undefined => process.env[name];
  const isRole = (value: string): value is R => roles.some((r) => r.id === value);

  function roleFor(passphrase: string): R | null {
    if (!passphrase) return null;
    for (const r of roles) {
      const expected = env(r.passphraseEnv);
      if (expected && safeEqual(passphrase, expected)) return r.id;
    }
    return null;
  }

  async function issue(role: R): Promise<string | null> {
    const secret = env(secretEnv);
    if (!secret || !isRole(role)) return null;
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const payload = `${role}.${expires}`;
    return `${payload}.${await sign(payload, secret)}`;
  }

  async function verify(token: string | undefined): Promise<R | null> {
    const secret = env(secretEnv);
    if (!secret || !token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [role, expires, mac] = parts;
    if (role === undefined || expires === undefined || mac === undefined) return null;
    if (!isRole(role)) return null;
    if (!/^\d+$/.test(expires) || Number(expires) < Math.floor(Date.now() / 1000)) return null;
    const expected = await sign(`${role}.${expires}`, secret);
    return safeEqual(mac, expected) ? role : null;
  }

  function configured(): boolean {
    return Boolean(env(secretEnv)) && roles.some((r) => Boolean(env(r.passphraseEnv)));
  }

  return {
    cookieName,
    roleFor,
    issue,
    verify,
    configured,
    canReset: (role) => roles.some((r) => r.id === role && r.canReset === true),
    roleFrom: (request) => verify(readCookie(request.headers.get("cookie"), cookieName)),
    setCookie: (token) => {
      if (!SAFE_TOKEN.test(token)) {
        throw new Error(
          'createStudioAuth: setCookie token may use only letters, digits, ".", "_" and "-"',
        );
      }
      return cookieHeader(cookieName, token, ttl);
    },
    clearCookie: () => cookieHeader(cookieName, "", 0),
  };
}
