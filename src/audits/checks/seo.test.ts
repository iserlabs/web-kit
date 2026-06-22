import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { checkSeoMeta } from "./seo.mjs";

const good = `<html><head>
  <title>Home</title>
  <meta name="description" content="Welcome">
  <link rel="canonical" href="https://x.com/">
  <meta property="og:title" content="Home">
  <meta property="og:description" content="Welcome">
  <meta name="twitter:card" content="summary_large_image">
</head><body><h1>Home</h1><img src="a.jpg" alt="A"></body></html>`;

const codes = (html: string) =>
  checkSeoMeta(html, { route: "/" }).map((f: { code: string }) => f.code);

describe("checkSeoMeta", () => {
  it("passes a complete page", () => {
    expect(checkSeoMeta(good, { route: "/" })).toEqual([]);
  });

  it("flags a missing title and description", () => {
    const c = codes("<html><head></head><body><h1>x</h1></body></html>");
    expect(c).toContain("seo-title-missing");
    expect(c).toContain("seo-description-missing");
  });

  it("flags zero or multiple h1s", () => {
    expect(codes("<html><body></body></html>")).toContain("seo-h1-count");
    expect(codes("<html><body><h1>a</h1><h1>b</h1></body></html>")).toContain("seo-h1-count");
  });

  it("flags an image with no alt", () => {
    const c = codes(`<html><body><h1>x</h1><img src="a.jpg"></body></html>`);
    expect(c).toContain("seo-img-alt");
  });
});
