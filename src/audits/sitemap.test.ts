import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { parseSitemap } from "./sitemap.mjs";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:4321/</loc></url>
  <url><loc>http://localhost:4321/rooms</loc></url>
</urlset>`;

describe("parseSitemap", () => {
  it("extracts route paths and strips the base URL", () => {
    expect(parseSitemap(xml, "http://localhost:4321")).toEqual(["/", "/rooms"]);
  });

  it("returns an empty array for a sitemap with no urls", () => {
    expect(parseSitemap("<urlset></urlset>", "http://localhost:4321")).toEqual([]);
  });
});
