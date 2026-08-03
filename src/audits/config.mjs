import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  readyTimeoutMs: 30000,
  routes: null,
  pageTypes: {},
  expectedSchema: {},
  contrast: { cssFile: "src/app/globals.css", minRatio: 4.5 },
  headers: { requireCsp: true },
  /* The browser tier is opt-in per site only in what it looks FOR: with no heroSelector
     it still checks overflow, clipping, tap targets, console errors and touch scrolling
     on every route, which every site should pass. */
  browser: { routes: null, heroSelector: null, heroRoutes: ["/"], minTapTarget: 44, settleMs: 2400, geometries: null },
  severity: {},
};

export async function loadAuditConfig(siteDir) {
  const path = join(siteDir, "web-kit.audits.config.mjs");
  if (!existsSync(path)) {
    throw new Error(`No web-kit.audits.config.mjs found in ${siteDir}`);
  }
  const mod = await import(pathToFileURL(resolve(path)).href);
  const user = mod.default ?? {};
  return {
    ...DEFAULTS,
    ...user,
    contrast: { ...DEFAULTS.contrast, ...(user.contrast ?? {}) },
    headers: { ...DEFAULTS.headers, ...(user.headers ?? {}) },
    browser: { ...DEFAULTS.browser, ...(user.browser ?? {}) },
    severity: { ...DEFAULTS.severity, ...(user.severity ?? {}) },
  };
}
