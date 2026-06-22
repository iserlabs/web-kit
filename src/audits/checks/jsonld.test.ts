import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { checkJsonLd } from "./jsonld.mjs";

const withType = (json: string) =>
  `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;

describe("checkJsonLd", () => {
  it("passes when the expected @type is present", () => {
    const html = withType(JSON.stringify({ "@type": "Organization", name: "x" }));
    expect(checkJsonLd(html, { route: "/", expectedTypes: ["Organization"] })).toEqual([]);
  });

  it("flags a missing expected @type", () => {
    const html = withType(JSON.stringify({ "@type": "WebSite" }));
    const codes = checkJsonLd(html, { route: "/", expectedTypes: ["Organization"] }).map(
      (f: { code: string }) => f.code,
    );
    expect(codes).toContain("jsonld-type-missing");
  });

  it("flags invalid JSON", () => {
    const html = withType("{ not json }");
    const codes = checkJsonLd(html, { route: "/", expectedTypes: [] }).map(
      (f: { code: string }) => f.code,
    );
    expect(codes).toContain("jsonld-invalid");
  });
});
