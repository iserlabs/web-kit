import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { checkHeaders } from "./headers.mjs";

const opts = { route: "/", requireCsp: true };
const codes = (h: Record<string, string>) =>
  checkHeaders(h, opts).map((f: { code: string }) => f.code);

describe("checkHeaders", () => {
  it("passes when CSP and x-content-type-options are present", () => {
    expect(
      checkHeaders(
        { "content-security-policy": "default-src 'self'", "x-content-type-options": "nosniff" },
        opts,
      ),
    ).toEqual([]);
  });

  it("flags a missing CSP as an error", () => {
    expect(codes({ "x-content-type-options": "nosniff" })).toContain("header-csp-missing");
  });

  it("works with a Headers instance", () => {
    const h = new Headers({ "content-security-policy": "default-src 'self'" });
    expect(checkHeaders(h, opts).map((f: { code: string }) => f.code)).toContain(
      "header-xcto-missing",
    );
  });
});
