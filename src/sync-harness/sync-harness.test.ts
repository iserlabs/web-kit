import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The harness is bash on purpose (launchd and macOS automation permissions), so its behavior
// tests are bash too. This runs them under `pnpm test` so a red harness turns the kit red.
const script = fileURLToPath(new URL("./test/run-tests.sh", import.meta.url));

describe("sync-harness", () => {
  it("passes its runner, CLI, beat, install and replay tests", () => {
    const out = execFileSync("bash", [script], { encoding: "utf8", timeout: 240_000 });
    expect(out).toMatch(/\n\d+ passed, 0 failed\n/);
  }, 300_000);
});
