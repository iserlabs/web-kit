import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRAND_PACK_FILENAME,
  loadBrandPackConfig,
  validateBrandPackConfig,
} from "../../brand-pack/config.mjs";

const ROUTE_DIRS = ["src/app/brand", "app/brand"];

function defaultReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Every new client site and major redesign ships the signature and link
 * preview boards at /brand. This check is what makes that hold without anyone
 * remembering it.
 *
 * The opt-out is deliberately awkward. A bare `skip: true` is how a gate
 * quietly stops meaning anything, so it has to carry a reason and a date.
 */
export async function checkBrandPack(siteDir, opts = {}) {
  const readJson = opts.readJson ?? defaultReadJson;
  const exists = opts.exists ?? existsSync;
  const loadConfig = opts.loadConfig ?? loadBrandPackConfig;

  const findings = [];
  const err = (code, message) => findings.push({ severity: "error", code, message });

  const pkg = readJson(join(siteDir, "package.json"));
  if (!pkg) return findings;

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (!deps["@iserlabs/web-kit"]) return findings;

  const marker = readJson(join(siteDir, "web-kit.template.json"));
  if (marker?.template === true || pkg["web-kit"]?.template === true) return findings;

  const configPath = join(siteDir, BRAND_PACK_FILENAME);
  if (!exists(configPath)) {
    const skip = pkg["web-kit"]?.brandPack;
    if (skip?.skip === true) {
      if (!skip.reason || !skip.date) {
        err(
          "brand-pack-skip-unreasoned",
          'package.json "web-kit".brandPack.skip needs both a reason and a date',
        );
      }
      return findings;
    }
    err(
      "brand-pack-missing",
      `No ${BRAND_PACK_FILENAME}. Run \`web-kit brand-pack init\`, or declare a dated opt-out in package.json.`,
    );
    return findings;
  }

  if (!ROUTE_DIRS.some((d) => exists(join(siteDir, d)))) {
    err(
      "brand-pack-routes-missing",
      `${BRAND_PACK_FILENAME} exists but no /brand route does. Run \`web-kit brand-pack init\`.`,
    );
  }

  let config;
  try {
    config = await loadConfig(siteDir);
  } catch (e) {
    err("brand-pack-invalid", `${BRAND_PACK_FILENAME} could not be loaded: ${e.message}`);
    return findings;
  }

  findings.push(...validateBrandPackConfig(config));
  return findings;
}
