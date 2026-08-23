import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  /**
   * Long enough to BUILD the site, because that is what previewCommand usually does.
   *
   * 30s was the old default and it is under the cold `next build` of an ordinary marketing
   * site, so the audit passed when .next happened to be warm and failed when it did not,
   * which says nothing about whether the site is sound. Measured on a starter with nine
   * modules installed: 20.2s to compile before `next start` even boots. A repo that wants
   * to catch a genuinely hung server sooner can still set its own.
   */
  readyTimeoutMs: 180000,
  routes: null,
  pageTypes: {},
  expectedSchema: {},
  contrast: { cssFile: "src/app/globals.css", minRatio: 4.5 },
  headers: { requireCsp: true },
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
    severity: { ...DEFAULTS.severity, ...(user.severity ?? {}) },
  };
}
