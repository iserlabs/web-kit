import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { checkBrandPack } from "./brand-pack.mjs";

const adopted = { dependencies: { "@iserlabs/web-kit": "github:iserlabs/web-kit#v0.6.0" } };

const goodConfig = {
  siteUrl: "https://x.com",
  wordmark: "X",
  tagline: "T",
  markUrl: "https://x.com/m.png",
  markAlt: "X",
  displayFont: "Georgia, serif",
  bodyFont: "Arial, sans-serif",
  ink: "#000000",
  ground: "#ffffff",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [{ name: "A", title: "B", email: "a@x.com", phone: "1" }],
};

const run = (opts: Record<string, unknown>) =>
  checkBrandPack("/site", {
    readJson: () => adopted,
    exists: () => true,
    loadConfig: async () => goodConfig,
    ...opts,
  });

const codes = async (opts: Record<string, unknown>) =>
  (await run(opts)).map((f: { code: string }) => f.code);

describe("checkBrandPack", () => {
  it("passes a site with a complete brand pack", async () => {
    expect(await run({})).toEqual([]);
  });

  it("says nothing about a site that has not adopted web-kit", async () => {
    expect(await run({ readJson: () => ({ dependencies: {} }) })).toEqual([]);
  });

  it("says nothing about the template itself", async () => {
    expect(
      await run({
        readJson: (p: string) =>
          p.endsWith("web-kit.template.json") ? { template: true } : adopted,
      }),
    ).toEqual([]);
  });

  it("flags an adopted site with no brand pack", async () => {
    expect(await codes({ exists: () => false })).toContain("brand-pack-missing");
  });

  it("accepts a documented opt-out", async () => {
    expect(
      await run({
        exists: () => false,
        readJson: () => ({
          ...adopted,
          "web-kit": {
            brandPack: {
              skip: true,
              reason: "internal surface, no outside recipient",
              date: "2026-09-01",
            },
          },
        }),
      }),
    ).toEqual([]);
  });

  it("rejects an opt-out with no reason", async () => {
    expect(
      await codes({
        exists: () => false,
        readJson: () => ({
          ...adopted,
          "web-kit": { brandPack: { skip: true, date: "2026-09-01" } },
        }),
      }),
    ).toContain("brand-pack-skip-unreasoned");
  });

  it("rejects an opt-out with no date", async () => {
    expect(
      await codes({
        exists: () => false,
        readJson: () => ({ ...adopted, "web-kit": { brandPack: { skip: true, reason: "later" } } }),
      }),
    ).toContain("brand-pack-skip-unreasoned");
  });

  it("passes the config's own findings through", async () => {
    expect(await codes({ loadConfig: async () => ({ ...goodConfig, shareCard: null }) })).toContain(
      "brand-pack-unpicked",
    );
  });

  it("flags a config that exists but whose routes do not", async () => {
    expect(await codes({ exists: (p: string) => !p.includes("app/brand") })).toContain(
      "brand-pack-routes-missing",
    );
  });

  it("reports a config that throws rather than passing vacuously", async () => {
    expect(
      await codes({
        loadConfig: async () => {
          throw new Error("boom");
        },
      }),
    ).toContain("brand-pack-invalid");
  });
});
