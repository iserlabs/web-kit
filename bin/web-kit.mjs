#!/usr/bin/env node
import { runDoctor } from "../src/doctor/index.mjs";

const [cmd, maybeDir] = process.argv.slice(2);
const dir = maybeDir || process.cwd();

if (cmd === "doctor") {
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
  console.log("web-kit audit: not implemented until Phase 2");
  process.exit(0);
}

console.log("Usage: web-kit <doctor|audit> [siteDir]");
process.exit(cmd ? 1 : 0);
