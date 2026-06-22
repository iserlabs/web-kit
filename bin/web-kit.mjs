#!/usr/bin/env node
import { runDoctor } from "../src/doctor/index.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];

function positionalDir(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      i++; // skip the flag's value
      continue;
    }
    return args[i];
  }
  return process.cwd();
}

if (cmd === "doctor") {
  const dir = argv[1] || process.cwd();
  const { adopted, ok, findings } = runDoctor(dir);
  if (!adopted) {
    console.log("web-kit: site has not adopted @iserlabs/web-kit — skipping.");
    process.exit(0);
  }
  for (const f of findings) console.log(`[${f.severity}] ${f.code}: ${f.message}`);
  console.log(ok ? "web-kit doctor: OK" : "web-kit doctor: FAILED");
  process.exit(ok ? 0 : 1);
}

if (cmd === "audit") {
  const args = argv.slice(1);
  const tierIdx = args.indexOf("--tier");
  const tier = tierIdx >= 0 ? args[tierIdx + 1] : "required";
  const dir = positionalDir(args);
  if (tier === "extended") {
    console.log("web-kit audit: extended tier is Phase 2b — not yet implemented");
    process.exit(0);
  }
  const { runRequiredAudit } = await import("../src/audits/index.mjs");
  const findings = await runRequiredAudit(dir);
  for (const f of findings) {
    console.log(`[${f.severity}] ${f.code}${f.route ? ` (${f.route})` : ""}: ${f.message}`);
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  console.log(errors ? `web-kit audit: FAILED (${errors} error)` : "web-kit audit: OK");
  process.exit(errors ? 1 : 0);
}

console.log("Usage: web-kit <doctor|audit> [--tier required|extended] [siteDir]");
process.exit(cmd ? 1 : 0);
