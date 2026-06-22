import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { checkContrast } from "./contrast.mjs";

const goodCss = `
:root { --background: oklch(1 0 0); --foreground: oklch(0.145 0 0);
        --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0); }
.dark { --background: oklch(0.145 0 0); --foreground: oklch(0.985 0 0);
        --primary: oklch(0.922 0 0); --primary-foreground: oklch(0.205 0 0); }`;

const badCss = `
:root { --background: oklch(1 0 0); --foreground: oklch(0.95 0 0);
        --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0); }`;

describe("checkContrast", () => {
  it("passes a palette with sufficient contrast", () => {
    expect(checkContrast(goodCss, { minRatio: 4.5 })).toEqual([]);
  });

  it("flags a low-contrast foreground/background pair", () => {
    const codes = checkContrast(badCss, { minRatio: 4.5 }).map((f: { code: string }) => f.code);
    expect(codes).toContain("contrast-low");
  });
});
