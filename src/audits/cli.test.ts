import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { runRequiredAudit } from "./index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = join(here, "__fixtures__", "static-site");

describe("runRequiredAudit (end-to-end against a static server)", () => {
  it("crawls the served site and reports the incomplete page", async () => {
    const findings = await runRequiredAudit(siteDir);
    const codes = findings.map((f: { code: string }) => f.code);
    expect(codes).toContain("seo-description-missing");
    expect(codes).toContain("seo-canonical-missing");
  }, 20000);
});
