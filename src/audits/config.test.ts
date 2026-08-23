import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { loadAuditConfig } from "./config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => join(here, "__fixtures__", name);

describe("loadAuditConfig", () => {
  it("loads a site config and applies defaults", async () => {
    const cfg = await loadAuditConfig(fx("site-clean"));
    expect(cfg.baseUrl).toBe("http://localhost:4321");
    /* Was 30000, which is under the cold `next build` that previewCommand usually runs, so
       the audit passed on a warm .next and failed on a cold one for reasons that had
       nothing to do with the site. Measured at 20.2s to compile on a nine-module starter. */
    expect(cfg.readyTimeoutMs).toBe(180000);
    expect(cfg.contrast.minRatio).toBe(4.5);
  });

  it("throws a clear error when the config file is missing", async () => {
    await expect(loadAuditConfig(fx("does-not-exist"))).rejects.toThrow(/web-kit\.audits\.config/);
  });
});
