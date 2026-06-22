import { wcagContrast } from "culori";

const PAIRS = [
  ["background", "foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["card", "card-foreground"],
];

function extractBlock(css, selector) {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m");
  const match = css.match(re);
  if (!match) return {};
  const vars = {};
  for (const decl of match[1].split(";")) {
    const m = decl.match(/--([\w-]+)\s*:\s*(.+)/);
    if (m) vars[m[1].trim()] = m[2].trim();
  }
  return vars;
}

export function checkContrast(cssText, opts) {
  const findings = [];
  for (const [theme, selector] of [
    ["light", ":root"],
    ["dark", ".dark"],
  ]) {
    const vars = extractBlock(cssText, selector);
    if (Object.keys(vars).length === 0) continue;
    for (const [bg, fg] of PAIRS) {
      if (!vars[bg] || !vars[fg]) continue;
      const ratio = wcagContrast(vars[bg], vars[fg]);
      if (Number.isFinite(ratio) && ratio < opts.minRatio) {
        findings.push({
          severity: "warn",
          code: "contrast-low",
          message: `${theme}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1 (< ${opts.minRatio})`,
        });
      }
    }
  }
  return findings;
}
