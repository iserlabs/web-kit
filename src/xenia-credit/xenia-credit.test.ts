import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { XENIA_GOLD_X } from "./mark";
import { XENIA_CREDIT_CSS } from "./styles";

const here = join(process.cwd(), "src", "xenia-credit");

describe("xenia credit", () => {
  it("is the exact words with no trailing period, linking to the apex", async () => {
    const src = readFileSync(join(here, "index.tsx"), "utf8");
    expect(src).toContain('by: "Powered by"');
    expect(src).toContain('name: "Xenia Hospitality Operations"');
    expect(src).toContain('href: "https://xenia.host"');
    expect(src).not.toContain("ops.xenia.host");
    // a real space between the two spans, so the link reads "Powered by Xenia ..." and not "byXenia"
    expect(src).toContain('{XENIA_CREDIT.by}</span>{" "}');
  });

  it("inlines the real gold X as a PNG", () => {
    expect(XENIA_GOLD_X.startsWith("data:image/png;base64,")).toBe(true);
    const file = readFileSync(join(here, "gold-x.png")).toString("base64");
    expect(XENIA_GOLD_X).toBe(`data:image/png;base64,${file}`);
  });

  it("keeps the plain CSS file and the React styles identical", () => {
    const css = readFileSync(join(here, "xenia-credit.css"), "utf8")
      .split("\n")
      .slice(1)
      .join("\n")
      .trim();
    expect(XENIA_CREDIT_CSS.trim()).toBe(css);
  });

  it("keeps a 44px target and honors reduced motion", () => {
    expect(XENIA_CREDIT_CSS).toContain("min-height:44px");
    expect(XENIA_CREDIT_CSS).toContain("prefers-reduced-motion");
  });
});
