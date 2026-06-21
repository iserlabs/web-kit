import { readFileSync } from "node:fs";
import { join } from "node:path";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function runDoctor(siteDir) {
  const findings = [];
  const add = (severity, code, message) => findings.push({ severity, code, message });

  const pkg = readJson(join(siteDir, "package.json"));
  if (!pkg) {
    return { adopted: false, ok: true, findings: [] };
  }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (!deps["@iserlabs/web-kit"]) {
    return { adopted: false, ok: true, findings: [] };
  }

  if (!pkg.packageManager || !String(pkg.packageManager).startsWith("pnpm@")) {
    add("error", "no-pnpm-pin", "packageManager is not pinned to pnpm@<version>");
  }
  if (pkg.name === "iser-labs-starter") {
    add("error", "placeholder-name", 'package.json "name" is still "iser-labs-starter"');
  }

  const biome = readJson(join(siteDir, "biome.json"));
  if (biome) {
    const ext = Array.isArray(biome.extends) ? biome.extends : biome.extends ? [biome.extends] : [];
    if (!ext.some((e) => String(e).includes("@iserlabs/web-kit"))) {
      add("warn", "biome-not-extending", "biome.json does not extend @iserlabs/web-kit/biome");
    }
  }

  const ts = readJson(join(siteDir, "tsconfig.json"));
  if (ts && !String(ts.extends || "").includes("@iserlabs/web-kit")) {
    add(
      "warn",
      "tsconfig-not-extending",
      "tsconfig.json does not extend @iserlabs/web-kit/tsconfig",
    );
  }

  const scripts = pkg.scripts || {};
  if (!Object.values(scripts).some((s) => String(s).includes("web-kit audit"))) {
    add("info", "no-audit-wiring", "no `web-kit audit` script wired yet (Phase 2)");
  }

  const ok = !findings.some((f) => f.severity === "error");
  return { adopted: true, ok, findings };
}
