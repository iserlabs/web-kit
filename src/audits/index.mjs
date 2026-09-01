import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkBrandPack } from "./checks/brand-pack.mjs";
import { checkContrast } from "./checks/contrast.mjs";
import { loadAuditConfig } from "./config.mjs";
import { crawlRoutes } from "./crawl.mjs";
import { assertPortFree, startPreview, waitForReady } from "./preview.mjs";
import { parseSitemap } from "./sitemap.mjs";

async function resolveRoutes(config) {
  if (config.routes?.length) return config.routes;
  try {
    const res = await fetch(`${config.baseUrl}/sitemap.xml`);
    const routes = parseSitemap(await res.text());
    if (routes.length) return routes;
  } catch {
    // no/invalid sitemap — fall through to the home route
  }
  return ["/"]; // never audit zero routes (a vacuous pass is worse than no audit)
}

export async function runRequiredAudit(siteDir) {
  const config = await loadAuditConfig(siteDir);
  /* Before anything is spawned. An audit that cannot bind its own port must stop, not
     produce a confident answer about whatever else is listening there. */
  await assertPortFree(config.baseUrl);
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
      // no css file configured/found, so skip contrast. Not fatal.
    }

    for (const f of await checkBrandPack(siteDir)) {
      const override = config.severity[f.code];
      if (override !== "off") findings.push(override ? { ...f, severity: override } : f);
    }

    return findings;
  } finally {
    await server.stop();
  }
}
