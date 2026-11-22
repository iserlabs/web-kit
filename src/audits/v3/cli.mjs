import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { recordV3Baseline, runV3Audit } from "./index.mjs";

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** The URL to audit: --url wins, then the site's audit config baseUrl. */
async function resolveUrl(args, siteDir) {
  const given = flag(args, "--url");
  if (given) return given;
  const cfg = join(siteDir, "web-kit.audits.config.mjs");
  if (existsSync(cfg)) {
    const mod = await import(pathToFileURL(resolve(cfg)).href);
    if (mod.default?.v3?.url) return mod.default.v3.url;
  }
  return null;
}

/**
 * `web-kit audit --tier v3 [siteDir] --url <live url> [--scope marketing|app|document|email]
 *  [--max-pages N] [--emails <dir>] [--only C01,C02] [--json <file>] [--record-baseline]`
 * Returns { lines, code }. Exit code 1 means a failure that is not in the baseline.
 */
export async function runV3Cli(args) {
  const valueFlags = new Set([
    "--url",
    "--scope",
    "--max-pages",
    "--emails",
    "--only",
    "--json",
    "--tier",
  ]);
  let siteDir = process.cwd();
  for (let i = 0; i < args.length; i++) {
    if (valueFlags.has(args[i])) i++;
    else if (!args[i].startsWith("--")) {
      siteDir = resolve(args[i]);
      break;
    }
  }
  const url = await resolveUrl(args, siteDir);
  if (!url) {
    return {
      lines: [
        "web-kit v3: no URL to audit. Pass --url https://your-site (a live or preview address), never a guess.",
      ],
      code: 2,
    };
  }
  const opts = {
    siteDir,
    scope: flag(args, "--scope") ?? "marketing",
    maxPages: Number(flag(args, "--max-pages") ?? 6),
    emailsDir: flag(args, "--emails") ? resolve(flag(args, "--emails")) : null,
    only: flag(args, "--only")?.split(","),
  };
  if (args.includes("--record-baseline")) {
    const out = await recordV3Baseline(url, opts);
    return {
      lines: [
        ...out.lines,
        `web-kit v3: baseline recorded, ${out.baseline.recorded} failing checks written to ${out.baseline.path}`,
      ],
      code: 0,
    };
  }
  const out = await runV3Audit(url, opts);
  const jsonOut = flag(args, "--json");
  if (jsonOut)
    writeFileSync(
      jsonOut,
      `${JSON.stringify({ url, summary: out.summary, results: out.results }, null, 2)}\n`,
    );
  const unproven = out.results.filter((r) => r.status === "UNPROVEN").length;
  const strict = args.includes("--strict") && unproven > 0;
  return {
    lines: strict
      ? [...out.lines, `web-kit v3: --strict, ${unproven} UNPROVEN checks block`]
      : out.lines,
    code: out.blocking || strict ? 1 : 0,
  };
}
