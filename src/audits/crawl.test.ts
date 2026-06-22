import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { crawlRoutes } from "./crawl.mjs";

function fakeFetch(htmlByPath: Record<string, string>) {
  return async (url: string) => {
    const path = new URL(url).pathname;
    return {
      text: async () => htmlByPath[path] ?? "",
      headers: new Headers({ "content-security-policy": "default-src 'self'" }),
    };
  };
}

const incomplete = "<html><head></head><body></body></html>";

describe("crawlRoutes", () => {
  it("collects findings across routes and tags them", async () => {
    const findings = await crawlRoutes({
      baseUrl: "http://localhost:4321",
      routes: ["/"],
      config: { pageTypes: {}, expectedSchema: {}, headers: { requireCsp: true }, severity: {} },
      fetchImpl: fakeFetch({ "/": incomplete }),
    });
    expect(
      findings.some(
        (f: { code: string; route: string }) => f.code === "seo-title-missing" && f.route === "/",
      ),
    ).toBe(true);
  });

  it("drops findings whose code is configured 'off'", async () => {
    const findings = await crawlRoutes({
      baseUrl: "http://localhost:4321",
      routes: ["/"],
      config: {
        pageTypes: {},
        expectedSchema: {},
        headers: { requireCsp: true },
        severity: { "seo-title-missing": "off" },
      },
      fetchImpl: fakeFetch({ "/": incomplete }),
    });
    expect(findings.some((f: { code: string }) => f.code === "seo-title-missing")).toBe(false);
  });
});
