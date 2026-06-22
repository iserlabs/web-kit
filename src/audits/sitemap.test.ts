import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { parseSitemap } from "./sitemap.mjs";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:4321/</loc></url>
  <url><loc>http://localhost:4321/rooms</loc></url>
</urlset>`;

describe("parseSitemap", () => {
  it("extracts route paths", () => {
    expect(parseSitemap(xml)).toEqual(["/", "/rooms"]);
  });

  it("extracts paths even when the sitemap uses the production origin (not the crawl base)", () => {
    const prod = `<urlset>
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/about</loc></url>
    </urlset>`;
    // The crawl base is localhost; the sitemap uses the canonical origin — must still yield paths.
    expect(parseSitemap(prod)).toEqual(["/", "/about"]);
  });

  it("returns an empty array for a sitemap with no urls", () => {
    expect(parseSitemap("<urlset></urlset>")).toEqual([]);
  });
});
