import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { initBrandPack } from "./init.mjs";

function harness(existing: string[] = []) {
  const files = new Map<string, string>();
  const result = (opts = {}) =>
    initBrandPack("/site", {
      write: (p: string, c: string) => files.set(p, c),
      // Match a directory probe exactly and a file by its tail, so marking
      // "src/app" as present does not also mark every file inside it.
      exists: (p: string) => existing.some((e) => p === `/site/${e}` || p.endsWith(e)),
      ...opts,
    });
  return { files, result };
}

const configOf = (files: Map<string, string>) =>
  [...files.entries()].find(([p]) => p.endsWith("brand-pack.config.mjs"))?.[1] ?? "";

describe("initBrandPack", () => {
  it("writes the config and all three board routes", () => {
    const { files, result } = harness();
    const out = result();
    expect(out.written.some((p: string) => p.endsWith("brand-pack.config.mjs"))).toBe(true);
    expect(out.written.some((p: string) => p.includes("brand/page.tsx"))).toBe(true);
    expect(out.written.some((p: string) => p.includes("brand/signature/page.tsx"))).toBe(true);
    expect(out.written.some((p: string) => p.includes("brand/share/page.tsx"))).toBe(true);
    expect(files.size).toBe(out.written.length);
  });

  it("writes the per-variant card route so the board shows real renders", () => {
    const { result } = harness();
    expect(result().written.some((p: string) => p.includes("brand/share/card/[variant]"))).toBe(
      true,
    );
  });

  it("wires the site's own open-graph image from the picked variant", () => {
    const { result } = harness();
    expect(result().written.some((p: string) => p.endsWith("opengraph-image.tsx"))).toBe(true);
  });

  it("refuses to overwrite an existing config", () => {
    const { files, result } = harness(["brand-pack.config.mjs"]);
    const out = result();
    expect(out.skipped.some((p: string) => p.endsWith("brand-pack.config.mjs"))).toBe(true);
    expect([...files.keys()].some((p) => p.endsWith("brand-pack.config.mjs"))).toBe(false);
  });

  it("keeps a site's existing open-graph image rather than clobbering it", () => {
    const { files, result } = harness(["opengraph-image.tsx"]);
    const out = result();
    expect(out.skipped.some((p: string) => p.endsWith("opengraph-image.tsx"))).toBe(true);
    expect([...files.keys()].some((p) => p.endsWith("opengraph-image.tsx"))).toBe(false);
  });

  it("seeds every unresolved token with the sentinel, never a guess", () => {
    const { files, result } = harness();
    result();
    const config = configOf(files);
    expect(config).toContain("__UNFILLED__");
    expect(config).not.toContain("example.com");
    expect(config).not.toContain("Jane Doe");
  });

  it("writes a config with no runtime import, so a broken install cannot silence the gate", () => {
    const { files, result } = harness();
    result();
    expect(configOf(files)).not.toMatch(/^import /m);
    expect(configOf(files)).toContain("@type");
  });

  it("leaves shareCard unpicked so the audit fails until the client picks", () => {
    const { files, result } = harness();
    result();
    expect(configOf(files)).toContain("shareCard: null");
  });

  it("writes routes under src/app when the site uses a src directory", () => {
    const { result } = harness(["src/app"]);
    const out = result();
    expect(out.written.some((p: string) => p.includes("/site/src/app/brand/page.tsx"))).toBe(true);
  });

  it("writes routes under app when the site has no src directory", () => {
    const { result } = harness();
    expect(result().written.some((p: string) => p.includes("/site/app/brand/page.tsx"))).toBe(true);
  });

  it("points every scaffolded file at the config with the right number of hops", () => {
    const { files, result } = harness(["src/app"]);
    result();
    for (const [path, contents] of files) {
      const spec = contents.match(/from "((?:\.\.\/)+brand-pack\.config\.mjs)"/)?.[1];
      if (!spec) continue;
      const hops = (spec.match(/\.\.\//g) ?? []).length;
      const depth = path.replace("/site/", "").split("/").length - 1;
      expect(hops, `${path} points up ${hops} but sits ${depth} deep`).toBe(depth);
    }
  });

  it("writes no em dash into any scaffolded file", () => {
    const { files, result } = harness();
    result();
    for (const [p, c] of files) expect(c, p).not.toContain("\u2014");
  });
});
