/**
 * Small byte helpers shared inside the artist module: the studio cookie's signature
 * and the press token both need them. Not part of the public surface, so the barrel
 * does not export this file.
 */

/** base64url without padding, the form a cookie value or a web address carries. */
export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time over equal-length inputs. A length mismatch returns early, which is
    harmless wherever both sides always have the same public length: signatures, and
    press tokens checked for shape first. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
