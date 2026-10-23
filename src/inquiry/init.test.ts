import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { initInquiry } from "./init.mjs";

const root = mkdtempSync(join(tmpdir(), "wk-inquiry-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("web-kit inquiry init", () => {
  it("writes the component and example config, prints the route, never overwrites", () => {
    const site = join(root, "site");
    mkdirSync(join(site, "src"), { recursive: true });
    const a = initInquiry(site);
    expect(a.written.map((p: string) => p.replace(site, ""))).toEqual([
      "/src/components/inquiry/inquiry-flow.tsx",
      "/src/content/inquiry-flow.ts",
    ]);
    expect(a.routeSnippet).toContain("createInquiryRoute");
    writeFileSync(a.written[1]!, "// mine");
    const b = initInquiry(site);
    expect(b.written).toEqual([]);
    expect(b.skipped).toHaveLength(2);
    expect(readFileSync(a.written[1]!, "utf8")).toBe("// mine");
  });

  it("the scaffold holds the mobile rules and no brand names or new fonts/colors", () => {
    const site = join(root, "rules");
    mkdirSync(join(site, "src"), { recursive: true });
    const { written } = initInquiry(site);
    const ui = readFileSync(written[0]!, "utf8");
    const all = ui + readFileSync(written[1]!, "utf8");
    expect(ui).toContain('type="button"');
    expect(ui).toContain("aria-pressed");
    expect(ui).toContain("min-h-12");
    expect(ui).toContain("text-base");
    expect(ui).toContain("prefers-reduced-motion");
    // A color transition on a chosen answer dips to about 1.6:1 text contrast mid-way (v0.12.0).
    expect(ui.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\btransition(-colors|-all)?\b/);
    expect(ui).toContain('autoComplete="email"');
    expect(ui).toContain('type="tel"');
    expect(ui.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\b(fixed|sticky)\b/);
    expect(ui).not.toMatch(/font-\[|#[0-9a-f]{3,6}\b|text-\[1[0-5]px\]|text-xs/);
    expect(all).not.toMatch(/palisade|sun mountain|streamlined|xenia|steadfast|90 ?north/i);
  });

  it("the scaffolded component renders on the server (first screen, then the contact screen)", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const site = join(root, "render");
    mkdirSync(join(site, "src"), { recursive: true });
    const { written } = initInquiry(site);
    const kit = pathToFileURL(resolve(__dirname, "index.ts")).href;
    const comp = written[0]!.replace(/\.tsx$/, ".render.tsx");
    const cfg = written[1]!.replace(/\.ts$/, ".render.ts");
    writeFileSync(cfg, readFileSync(written[1]!, "utf8").replace("@iserlabs/web-kit/inquiry", kit));
    writeFileSync(
      comp,
      `import React from "react";\n${readFileSync(written[0]!, "utf8")}`
        .replace("@iserlabs/web-kit/inquiry", kit)
        .replace("@/content/inquiry-flow", pathToFileURL(cfg).href),
    );
    const mod = await import(/* @vite-ignore */ pathToFileURL(comp).href);
    const html = renderToStaticMarkup(createElement(mod.InquiryFlow, {}));
    expect(html).toContain("Question 1 of 3");
    expect(html).toContain("What are you looking for?");
    expect((html.match(/<button type="button" aria-pressed="false"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("<input");
  });
});
