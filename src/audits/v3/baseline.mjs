import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { STATUS } from "./lib.mjs";

/**
 * The per-site baseline: the v3 failures a live site already had on the day it was recorded.
 * A run fails only on failures that are not in this file. New sites start with no file, which
 * means every failure is new.
 */
export const baselinePath = (siteDir) => join(siteDir, ".web-kit", "v3-baseline.json");

export function loadBaseline(siteDir) {
  if (!siteDir) return null;
  const p = baselinePath(siteDir);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    throw new Error(
      `${p} is not valid JSON; fix or delete it (a broken baseline must not pass quietly)`,
    );
  }
}

/** Failures worth recording: real FAILs that no decision waives. Warnings and UNPROVEN stay out. */
export function recordBaseline(siteDir, results, meta = {}) {
  const failures = {};
  for (const r of results) {
    if (r.status === STATUS.FAIL && !r.waived)
      failures[r.id] = { count: r.count, items: [...r.items] };
  }
  const file = { version: 1, recordedAt: new Date().toISOString(), url: meta.url ?? "", failures };
  const p = baselinePath(siteDir);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(file, null, 2)}\n`);
  return { path: p, recorded: Object.keys(failures).length };
}

/**
 * Marks each FAIL as known when every one of its items is already in the baseline (or, for a
 * failure with no items, when its check ID is). Anything else stays a new failure.
 */
export function applyBaseline(results, baseline) {
  if (!baseline) return results;
  return results.map((r) => {
    if (r.status !== STATUS.FAIL || r.waived) return r;
    const b = baseline.failures?.[r.id];
    if (!b) return r;
    const old = new Set(b.items ?? []);
    const fresh = r.items.filter((i) => !old.has(i));
    if (r.items.length ? fresh.length === 0 : true) return { ...r, known: true };
    return { ...r, newItems: fresh };
  });
}
