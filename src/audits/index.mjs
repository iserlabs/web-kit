import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkContrast } from "./checks/contrast.mjs";
import { loadAuditConfig } from "./config.mjs";
import { crawlRoutes } from "./crawl.mjs";
import { startPreview, waitForReady } from "./preview.mjs";
import { parseSitemap } from "./sitemap.mjs";

async function resolveRoutes(config) {
  if (config.routes) return config.routes;
  const res = await fetch(`${config.baseUrl}/sitemap.xml`);
  return parseSitemap(await res.text(), config.baseUrl);
}

export async function runRequiredAudit(siteDir) {
  const config = await loadAuditConfig(siteDir);
  const server = startPreview(config.previewCommand);
  try {
    await waitForReady(config.baseUrl, config.readyTimeoutMs);
    const routes = await resolveRoutes(config);
    const findings = await crawlRoutes({ baseUrl: config.baseUrl, routes, config });

    try {
      const css = readFileSync(join(siteDir, config.contrast.cssFile), "utf8");
      for (const f of checkContrast(css, { minRatio: config.contrast.minRatio })) {
        const override = config.severity[f.code];
        if (override !== "off") findings.push(override ? { ...f, severity: override } : f);
      }
    } catch {
      // no css file configured/found — skip contrast, not fatal
    }

    return findings;
  } finally {
    server.stop();
  }
}
