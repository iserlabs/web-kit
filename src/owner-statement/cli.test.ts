import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BIN = new URL("../../bin/web-kit.mjs", import.meta.url).pathname;
const FIXTURE = (name: string) => new URL(`./fixtures/${name}.json`, import.meta.url).pathname;

// A 1x1 transparent PNG: enough for the CLI to read a size and inline it.
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function run(...args: string[]) {
  const r = spawnSync("node", [BIN, "owner-statement", ...args], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("web-kit owner-statement", () => {
  it("validate passes a good model", () => {
    const r = run("validate", FIXTURE("sun-mountain"));
    expect(r.code).toBe(0);
    expect(r.out).toContain("OK");
  });

  it("validate names every problem and exits 1", () => {
    const dir = mkdtempSync(join(tmpdir(), "os-cli-"));
    const bad = JSON.parse(readFileSync(FIXTURE("sun-mountain"), "utf8"));
    bad.status = "draft";
    bad.groups[0].subtotal.cells.revenue += 1;
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify(bad));
    const r = run("validate", file);
    expect(r.code).toBe(1);
    expect(r.out).toContain("status:");
    expect(r.out).toContain("subtotal:");
  });

  it("render writes a standalone file with the logo inlined", () => {
    const dir = mkdtempSync(join(tmpdir(), "os-cli-"));
    const logo = join(dir, "logo.png");
    writeFileSync(logo, Buffer.from(PNG_1X1, "base64"));
    const out = join(dir, "page.html");
    const r = run("render", FIXTURE("palisade"), "--logo", logo, "--out", out);
    expect(r.code).toBe(0);
    const html = readFileSync(out, "utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<meta name="robots" content="noindex"');
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("October 2026");
    expect(html).toContain("<style>");
    expect(html).toContain("fonts.googleapis.com");
  });

  it("render refuses a model that does not validate and writes nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "os-cli-"));
    const logo = join(dir, "logo.png");
    writeFileSync(logo, Buffer.from(PNG_1X1, "base64"));
    const bad = JSON.parse(readFileSync(FIXTURE("palisade"), "utf8"));
    bad.status = "draft";
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify(bad));
    const out = join(dir, "page.html");
    const r = run("render", file, "--logo", logo, "--out", out);
    expect(r.code).toBe(1);
    expect(r.out).toContain("status:");
    expect(() => readFileSync(out)).toThrow();
  });

  it("render needs a logo and an output file", () => {
    expect(run("render", FIXTURE("palisade")).code).toBe(1);
  });

  it("an unknown subcommand prints usage", () => {
    const r = run("nope");
    expect(r.code).toBe(1);
    expect(r.out).toContain("Usage: web-kit owner-statement");
  });
});
