import { checkHeaders } from "./checks/headers.mjs";
import { checkJsonLd } from "./checks/jsonld.mjs";
import { checkSeoMeta } from "./checks/seo.mjs";

function applySeverity(findings, severity) {
  const out = [];
  for (const f of findings) {
    const override = severity[f.code];
    if (override === "off") continue;
    out.push(override ? { ...f, severity: override } : f);
  }
  return out;
}

export async function crawlRoutes({ baseUrl, routes, config, fetchImpl = fetch }) {
  const findings = [];
  for (const route of routes) {
    const res = await fetchImpl(baseUrl + route);
    const html = await res.text();
    const pageType = config.pageTypes[route];
    const expectedTypes = (pageType && config.expectedSchema[pageType]) || [];

    findings.push(...checkSeoMeta(html, { route }));
    findings.push(...checkJsonLd(html, { route, expectedTypes }));
    findings.push(...checkHeaders(res.headers, { route, requireCsp: config.headers.requireCsp }));
  }
  return applySeverity(findings, config.severity);
}
