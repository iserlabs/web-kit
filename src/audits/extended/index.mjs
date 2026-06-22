import { loadAuditConfig } from "../config.mjs";
import { startPreview, waitForReady } from "../preview.mjs";
import { parseSitemap } from "../sitemap.mjs";
import { runAxe } from "./axe.mjs";
import { runLighthouse } from "./lighthouse.mjs";

const DEFAULT_LH = { performance: 0.9, seo: 0.95, "best-practices": 1.0, accessibility: 0.9 };
const DEFAULT_CWV = { lcp: 2500, cls: 0.1 };

/** Pure: turn one route's Lighthouse result into threshold findings. */
export function gradeLighthouse(
  { scores, metrics },
  { lighthouseThresholds, cwvThresholds },
  route,
) {
  const findings = [];
  for (const [cat, min] of Object.entries(lighthouseThresholds)) {
    const s = scores[cat];
    if (s != null && s < min) {
      findings.push({
        severity: "warn",
        code: `lh-${cat}`,
        message: `${cat} ${s.toFixed(2)} < ${min}`,
        route,
      });
    }
  }
  if (metrics.lcp != null && metrics.lcp > cwvThresholds.lcp) {
    findings.push({
      severity: "warn",
      code: "cwv-lcp",
      message: `LCP ${Math.round(metrics.lcp)}ms > ${cwvThresholds.lcp}ms`,
      route,
    });
  }
  if (metrics.cls != null && metrics.cls > cwvThresholds.cls) {
    findings.push({
      severity: "warn",
      code: "cwv-cls",
      message: `CLS ${metrics.cls.toFixed(3)} > ${cwvThresholds.cls}`,
      route,
    });
  }
  return findings;
}

async function resolveRoutes(config) {
  if (config.extended?.routes?.length) return config.extended.routes;
  if (config.routes?.length) return config.routes;
  try {
    const res = await fetch(`${config.baseUrl}/sitemap.xml`);
    const routes = parseSitemap(await res.text());
    if (routes.length) return routes;
  } catch {
    // fall through
  }
  return ["/"];
}

export async function runExtendedAudit(
  siteDir,
  { lighthouseImpl = runLighthouse, axeImpl = runAxe } = {},
) {
  const config = await loadAuditConfig(siteDir);
  const ext = config.extended ?? {};
  const lighthouseThresholds = { ...DEFAULT_LH, ...(ext.lighthouse?.thresholds ?? {}) };
  const cwvThresholds = { ...DEFAULT_CWV, ...(ext.cwv?.thresholds ?? {}) };
  const server = startPreview(config.previewCommand);
  try {
    await waitForReady(config.baseUrl, config.readyTimeoutMs);
    const routes = await resolveRoutes(config);
    let findings = [];
    for (const route of routes) {
      const url = config.baseUrl + route;
      if (ext.lighthouse !== false) {
        findings.push(
          ...gradeLighthouse(
            await lighthouseImpl(url, ext.lighthouse ?? {}),
            { lighthouseThresholds, cwvThresholds },
            route,
          ),
        );
      }
      if (ext.axe !== false) {
        findings.push(...(await axeImpl(url, ext.axe ?? {})).map((f) => ({ ...f, route })));
      }
    }
    const sev = config.severity ?? {};
    findings = findings
      .filter((f) => sev[f.code] !== "off")
      .map((f) => (sev[f.code] ? { ...f, severity: sev[f.code] } : f));
    return findings;
  } finally {
    await server.stop();
  }
}
