import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module, no types needed
import { runDoctor } from "./index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => join(here, "__fixtures__", name);

describe("runDoctor", () => {
  it("skips sites that have not adopted the kit", () => {
    const r = runDoctor(fx("not-adopted"));
    expect(r.adopted).toBe(false);
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("passes a clean adopted site", () => {
    const r = runDoctor(fx("adopted-clean"));
    expect(r.adopted).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.findings.filter((f: { severity: string }) => f.severity === "error")).toHaveLength(0);
  });

  it("flags a placeholder name and missing pnpm pin as errors", () => {
    const r = runDoctor(fx("placeholder"));
    expect(r.adopted).toBe(true);
    expect(r.ok).toBe(false);
    const codes = r.findings.map((f: { code: string }) => f.code);
    expect(codes).toContain("placeholder-name");
    expect(codes).toContain("no-pnpm-pin");
  });
});
