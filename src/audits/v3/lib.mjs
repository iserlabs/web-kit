import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared pieces of the v3 audit: result helpers, the decisions file, the fact sheet and the
 * brand scales. Everything here is plain Node, no browser.
 */

/** The 17 geometries every phone-and-desktop check holds across (name, width, height, mobile). */
export const GEOMETRIES = [
  ["iphone-se-1", 320, 568, true],
  ["iphone-se", 375, 667, true],
  ["iphone-13", 390, 844, true],
  ["iphone-16-pro", 402, 874, true],
  ["iphone-15-pro-max", 430, 932, true],
  ["iphone-13-landscape", 844, 390, true],
  ["iphone-se-landscape", 667, 375, true],
  ["pixel-7", 412, 915, true],
  ["ipad-portrait", 768, 1024, true],
  ["ipad-mini", 744, 1133, true],
  ["ipad-pro", 1024, 1366, true],
  ["ipad-landscape", 1366, 1024, true],
  ["laptop-13", 1280, 800, false],
  ["laptop-16", 1512, 982, false],
  ["desktop-1080", 1920, 1080, false],
  ["desktop-1440", 1440, 900, false],
  ["desktop-short", 1440, 600, false],
];

/** Tier of every check. T1 and T3 failures can be waived by a reason in DECISIONS.md. */
export const TIERS = {
  C01: "T1",
  C02: "T3",
  C03: "T3",
  C04: "T3",
  C05: "T1",
  C06: "T1",
  C07: "T3",
  C08: "T1",
  C09: "T1",
  C10: "T1",
  C11: "T1",
  C12: "T1",
  C13: "T1",
  C14: "T1",
  C15: "T2",
  C16: "T3",
  C17: "T2",
  C18: "T2",
  C19: "T2",
  C20: "T2",
  C21: "T2",
  C22: "T1",
  C23: "T2",
  C24: "T2",
  C25: "T2",
  C26: "T2",
  C27: "T2",
  C28: "T2",
  C29: "T2",
  C30: "T2",
  C31: "T1",
  C32: "T1",
  C33: "T2",
  C34: "T2",
  C35: "T2",
  C36: "T1",
  C37: "warn",
  C38: "T1",
  C39: "T3",
  C40: "T3",
  C41: "T2",
  C42: "T1",
  C43: "T2",
  C44: "T2",
  C45: "T2",
  C46: "T2",
  C47: "T2",
};

/** Which checks each kind of surface runs (boards 93, 94, 95). Marketing runs everything. */
const T1_NO_LAYOUT = Object.keys(TIERS).filter(
  (id) => TIERS[id] === "T1" && !["C22", "C38"].includes(id),
);
export const SCOPES = {
  marketing: null,
  app: ["C20", "C25", "C27", "C29", "C30", "C44", ...T1_NO_LAYOUT],
  document: ["C01", "C03", "C05", "C11", "C17", "C18", "C20", "C34", "C35", "C36", "C44"],
  email: ["C11", "C20", "C34", "C36", "C44", "C46"],
};

/**
 * Judgment-heavy checks start as warnings, not blockers (Jake, 2026-11-22). Each carries a dated
 * probation: until that date a failure prints as WARN; after it the same failure blocks, with no
 * code change. Edit a date here to extend a check that misfired, or delete the line to block now.
 */
export const PROBATION = {
  C14: "2026-12-22",
  C15: "2026-12-22",
  C16: "2026-12-22",
  C18: "2026-12-22",
  C22: "2026-12-22",
  C32: "2026-12-22",
  C38: "2026-12-22",
  C40: "2026-12-22",
};

/** True while a check's probation date has not passed. `today` is a YYYY-MM-DD string. */
export const onProbation = (id, today) => !!PROBATION[id] && today <= PROBATION[id];

export const STATUS = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", UNPROVEN: "UNPROVEN" };

/** A check's raw answer becomes a printed result. */
export function makeResult(id, title, tier, raw) {
  const count = raw.count ?? raw.fails?.length ?? 0;
  if (raw.error) {
    return {
      id,
      title,
      tier,
      status: STATUS.UNPROVEN,
      reason: `check could not run: ${raw.error}`,
      count: 0,
      items: [],
    };
  }
  const items = (raw.fails ?? []).map((f) => String(f.item ?? f).slice(0, 120));
  if (items.length) {
    return {
      id,
      title,
      tier,
      status: tier === "warn" ? STATUS.WARN : STATUS.FAIL,
      reason: raw.fails[0].detail ? `${raw.fails[0].detail}` : `first: ${items[0]}`,
      count,
      items,
    };
  }
  if (raw.unproven) {
    return { id, title, tier, status: STATUS.UNPROVEN, reason: raw.unproven, count: 0, items: [] };
  }
  return { id, title, tier, status: STATUS.PASS, reason: raw.note ?? "", count: 0, items: [] };
}

/** One plain line per result. */
export function formatLine(r) {
  const tag = r.waived ? "PASS" : r.status;
  const extra =
    (r.waived ? ` [waived in DECISIONS.md: ${r.waived}]` : r.known ? " [known: in baseline]" : "") +
    (r.probation ? ` [probation until ${r.probation}, does not block yet]` : "");
  const n =
    !r.waived && (r.status === STATUS.FAIL || r.status === STATUS.WARN) ? ` (${r.count})` : "";
  return `${tag.padEnd(9)}${r.id} [${r.tier}] ${r.title}${r.reason ? `: ${r.reason}` : ""}${n}${extra}`;
}

/** DECISIONS.md: a line that names a check ID and gives a real reason waives that check. */
export function loadDecisions(siteDir) {
  const waivers = new Map();
  if (!siteDir) return waivers;
  const p = join(siteDir, "docs", "design", "DECISIONS.md");
  if (!existsSync(p)) return waivers;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const ids = [...line.matchAll(/\bC(\d{2})\b/g)].map((m) => `C${m[1]}`);
    if (!ids.length) continue;
    const reason = line
      .replace(/\bC\d{2}\b/g, "")
      .replace(/[|*_`#>\-:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (reason.split(" ").length >= 3) for (const id of ids) waivers.set(id, reason.slice(0, 100));
  }
  return waivers;
}

/** docs/design/FACTS.md: `| claim | where | source | match |` rows. Null when the file is missing. */
export function loadFacts(siteDir) {
  if (!siteDir) return null;
  const p = join(siteDir, "docs", "design", "FACTS.md");
  if (!existsSync(p)) return null;
  const bad = /^(no|unsourced|missing|guess|\?)?$/i;
  const rows = readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|\s*:?-/.test(l))
    .slice(1)
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    )
    .filter((c) => c.length >= 3 && c[0])
    .map((c) => ({ claim: c[0], sourced: !bad.test(c[2] ?? "") && !bad.test(c[3] ?? "yes") }))
    .filter((r) => r.sourced);
  return {
    rows,
    text: rows
      .map((r) => r.claim)
      .join(" \n ")
      .toLowerCase(),
  };
}

/** docs/design/scales.json: { radius: [px], fontSizes: [px] | {desktop,phone}, spacing: [px] }. */
export function loadScales(siteDir) {
  if (!siteDir) return null;
  const p = join(siteDir, "docs", "design", "scales.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Stored backwards so the banned list is not itself read as using the faces it bans. */
const rev = (s) => s.split("").reverse().join("");
export const BANNED_FACES = [
  [rev("fireS tnemurtsnI"), /^instrument\s*serif/i],
  [rev("secnuarF"), new RegExp(`^${rev("secnuarf")}`, "i")],
  [rev("retnI"), new RegExp(`^${rev("retni")}(\\s*(tight|display|var\\w*))?$`, "i")],
  [rev("tsieG"), new RegExp(`^${rev("tsieg")}(\\s*sans)?$`, "i")],
  [rev("kseetorG ecapS"), /^space\s*grotesk/i],
  [rev("riafyalP"), /^playfair/i],
];
export const BANNED_FACES_REFRESHED = "2026-11-22";
export const faceName = rev;

/** "$1,200.50" and "1200.50" meet as the same number token. */
export const digitsOf = (s) => s.replace(/[^0-9.]/g, "").replace(/\.$/, "");
