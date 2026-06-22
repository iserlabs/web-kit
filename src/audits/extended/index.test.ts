import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { gradeLighthouse, runExtendedAudit } from "./index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = join(here, "..", "__fixtures__", "static-site-ext");
const thresholds = {
  lighthouseThresholds: { performance: 0.9, seo: 0.95 },
  cwvThresholds: { lcp: 2500, cls: 0.1 },
};

describe("gradeLighthouse (pure)", () => {
  it("flags below-threshold category scores and bad CWV", () => {
    const codes = gradeLighthouse(
      { scores: { performance: 0.6, seo: 1 }, metrics: { lcp: 4000, cls: 0.2, tbt: 0 } },
      thresholds,
      "/",
    ).map((f: { code: string }) => f.code);
    expect(codes).toContain("lh-performance");
    expect(codes).toContain("cwv-lcp");
    expect(codes).toContain("cwv-cls");
    expect(codes).not.toContain("lh-seo");
  });

  it("passes a clean result", () => {
    expect(
      gradeLighthouse(
        { scores: { performance: 0.95, seo: 1 }, metrics: { lcp: 1200, cls: 0.01, tbt: 0 } },
        thresholds,
        "/",
      ),
    ).toEqual([]);
  });
});

describe("runExtendedAudit (orchestration, injected runners)", () => {
  it("crawls the fixture server and aggregates lighthouse + axe findings", async () => {
    const fakeLh = async () => ({
      scores: { performance: 0.5, seo: 1 },
      metrics: { lcp: 1000, cls: 0, tbt: 0 },
    });
    const fakeAxe = async () => [
      { severity: "warn", code: "a11y-axe-color-contrast", message: "x" },
    ];
    const findings = await runExtendedAudit(siteDir, { lighthouseImpl: fakeLh, axeImpl: fakeAxe });
    const codes = findings.map((f: { code: string }) => f.code);
    expect(codes).toContain("lh-performance");
    expect(codes).toContain("a11y-axe-color-contrast");
  }, 30000);
});
