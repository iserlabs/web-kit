import { formatCents } from "./format.mjs";

export const STATEMENT_SCHEMA = "owner-statement/1";
export const BRAND_IDS = ["sun-mountain", "palisade", "columbus", "xenia"];
const DIRECTIONS = ["to_owner", "from_owner", "to_partner", "none"];
const ROLES = ["in", "cost", "fee", "set_aside", "subtotal", "moves", "balance", "share"];
const KINDS = ["text", "money", "int"];

/** Words that may never appear anywhere in a statement (spec invariant 7). */
export const BANNED_WORDS = [
  "approximate",
  "variance",
  "estimate",
  "You earned",
  "Not a final statement",
];
const EM_DASH = String.fromCharCode(0x2014);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.length > 0;
const isInt = (v) => Number.isSafeInteger(v);
const money = (c) => formatCents(c, { parens: true });

/** Every string in the model, with a readable path. */
function* strings(value, path) {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`);
  } else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

function checkWords(model, errors) {
  for (const [path, text] of strings(model, "")) {
    const lower = text.toLowerCase();
    for (const word of BANNED_WORDS) {
      if (lower.includes(word.toLowerCase())) {
        errors.push(`words: "${word}" may not appear anywhere in a statement (found in ${path})`);
      }
    }
    if (text.includes(EM_DASH)) {
      errors.push(`words: an em dash may not appear in a statement (found in ${path})`);
    }
    if (text.includes("!")) {
      errors.push(`words: an exclamation mark may not appear in a statement (found in ${path})`);
    }
  }
}

function checkCents(value, path, errors) {
  if (!isInt(value)) {
    errors.push(`cents: ${path} must be a whole number of cents, got ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

function checkTop(m, errors) {
  if (m.schema !== STATEMENT_SCHEMA) {
    errors.push(`schema: must read "${STATEMENT_SCHEMA}", got ${JSON.stringify(m.schema)}`);
  }
  if (m.status !== "final") {
    errors.push(`status: only a final statement is ever shown, this one says ${JSON.stringify(m.status)}`);
  }
  if (!BRAND_IDS.includes(m.brand)) {
    errors.push(`brand: must be one of ${BRAND_IDS.join(", ")}, got ${JSON.stringify(m.brand)}`);
  }
  for (const key of ["business", "month", "monthLabel", "monthShort", "calls"]) {
    if (!isStr(m[key])) errors.push(`shape: "${key}" is missing or empty`);
  }
  for (const key of ["owner", "property", "prepared", "moves", "summary", "stats", "email", "links"]) {
    if (!isObj(m[key])) errors.push(`shape: "${key}" is missing`);
  }
  for (const key of ["groups", "attention", "sources"]) {
    if (!Array.isArray(m[key])) errors.push(`shape: "${key}" must be a list`);
  }
  for (const [key, fields] of [
    ["owner", ["key", "name", "greeting"]],
    ["property", ["label", "line"]],
    ["prepared", ["by", "date"]],
  ]) {
    if (!isObj(m[key])) continue;
    for (const f of fields) {
      if (!isStr(m[key][f])) errors.push(`shape: "${key}.${f}" is missing or empty`);
    }
  }
}

function checkMoves(m, errors) {
  const mv = m.moves;
  if (!isObj(mv)) return;
  if (!DIRECTIONS.includes(mv.direction)) {
    errors.push(`moves: direction must be one of ${DIRECTIONS.join(", ")}, got ${JSON.stringify(mv.direction)}`);
    return;
  }
  for (const f of ["headline", "line", "sentence"]) {
    if (!isStr(mv[f])) errors.push(`shape: "moves.${f}" is missing or empty`);
  }
  if (!checkCents(mv.cents, "moves.cents", errors)) return;
  if (mv.cents < 0) errors.push("moves: moves.cents is the size of the move and cannot be negative");

  if (mv.date === null || mv.date === undefined) {
    if (mv.direction !== "none" && !isStr(mv.dateUnknown)) {
      errors.push("date: no date is set, so moves.dateUnknown must say why (for example \"due date not set yet\")");
    }
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(mv.date)) {
    errors.push(`date: moves.date must read YYYY-MM-DD, got ${JSON.stringify(mv.date)}`);
  }

  const rows = m.summary?.rows;
  if (!Array.isArray(rows)) return;
  let target = rows.findLast((r) => r?.role === "moves");
  target ??= rows.findLast((r) => r?.role === "balance");
  const expected =
    mv.direction === "to_owner" ? mv.cents : mv.direction === "none" ? 0 : -mv.cents;
  if (!target) {
    if (mv.direction !== "none") {
      errors.push("moves: the summary has no row with role \"moves\" (or \"balance\") for the money that moves");
    }
    return;
  }
  if (target.month !== expected) {
    errors.push(
      `moves: the summary row "${target.label}" is ${isInt(target.month) ? money(target.month) : String(target.month)}, but the move is ${mv.direction} ${money(mv.cents)}, so the row must read ${money(expected)}`,
    );
  }
}

function footPairs(foot) {
  if (foot === undefined || foot === null) return [];
  if (Array.isArray(foot) && foot.length === 2 && Array.isArray(foot[0]) && typeof foot[1] === "string") {
    return [foot];
  }
  return Array.isArray(foot) ? foot : [];
}

function checkSummary(m, errors) {
  const s = m.summary;
  if (!isObj(s)) return;
  if (!isStr(s.title)) errors.push('shape: "summary.title" is missing or empty');
  if (!isObj(s.columns) || !isStr(s.columns.month) || !isStr(s.columns.ytd)) {
    errors.push('shape: "summary.columns" needs a month label and a ytd label');
  }
  if (!Array.isArray(s.rows) || s.rows.length === 0) {
    errors.push('shape: "summary.rows" must be a non-empty list');
    return;
  }
  if (!isObj(s.ytd) || typeof s.ytd.known !== "boolean") {
    errors.push('shape: "summary.ytd" needs known: true or false');
    return;
  }
  let rowsOk = true;
  s.rows.forEach((r, i) => {
    const at = `summary.rows[${i}]`;
    if (!isObj(r) || !isStr(r.label) || !ROLES.includes(r.role)) {
      errors.push(`shape: ${at} needs a label and a role (${ROLES.join(", ")})`);
      rowsOk = false;
      return;
    }
    if (!checkCents(r.month, `${at}.month`, errors)) rowsOk = false;
    else if (r.month === 0 && !["moves", "balance", "subtotal"].includes(r.role)) {
      errors.push(`zero-row: "${r.label}" is zero this month, and a zero row is dropped by the writer`);
    }
    if (r.ytd !== null && r.ytd !== undefined && !checkCents(r.ytd, `${at}.ytd`, errors)) rowsOk = false;
  });

  // Invariant 9: year to date.
  if (s.ytd.known === false) {
    if (!isStr(s.ytd.reason)) {
      errors.push("ytd: year to date is unknown, so summary.ytd.reason must say why in one short line");
    }
    s.rows.forEach((r, i) => {
      if (isObj(r) && r.ytd !== null && r.ytd !== undefined) {
        errors.push(`ytd: year to date is unknown, so summary.rows[${i}].ytd must be null`);
      }
    });
  } else {
    s.rows.forEach((r, i) => {
      if (isObj(r) && !isInt(r.ytd)) {
        errors.push(`ytd: year to date is known, so summary.rows[${i}].ytd must be a figure`);
        rowsOk = false;
      }
    });
  }
  if (!rowsOk) return;

  // Invariant 3: feet.
  for (const pair of footPairs(s.foot)) {
    const [roles, targetRole] = pair;
    if (!Array.isArray(roles) || typeof targetRole !== "string") {
      errors.push("foot: each foot must read [[roles to add], target role]");
      continue;
    }
    const idx = s.rows.findLastIndex((r) => r.role === targetRole);
    if (idx < 0) {
      errors.push(`foot: there is no "${targetRole}" row for the foot to add up to`);
      continue;
    }
    const target = s.rows[idx];
    const above = s.rows.slice(0, idx).filter((r) => roles.includes(r.role));
    const sum = above.reduce((t, r) => t + r.month, 0);
    if (sum !== target.month) {
      errors.push(
        `foot: the ${roles.join(", ")} rows add up to ${money(sum)}, but "${target.label}" says ${money(target.month)}`,
      );
    }
    if (s.ytd.known) {
      const ytdSum = above.reduce((t, r) => t + r.ytd, 0);
      if (ytdSum !== target.ytd) {
        errors.push(
          `foot: in the year to date column the ${roles.join(", ")} rows add up to ${money(ytdSum)}, but "${target.label}" says ${money(target.ytd)}`,
        );
      }
    }
  }
}

function checkGroups(m, errors) {
  if (!Array.isArray(m.groups)) return;
  let next = 1;
  m.groups.forEach((g, gi) => {
    const at = `groups[${gi}]`;
    if (!isObj(g) || !Array.isArray(g.columns) || !Array.isArray(g.rows) || !isObj(g.subtotal)) {
      errors.push(`shape: ${at} needs columns, rows and a subtotal`);
      return;
    }
    if (!isStr(g.title) || !isStr(g.property)) errors.push(`shape: ${at} needs a title and a property`);
    const kinds = {};
    for (const c of g.columns) {
      if (!isObj(c) || !isStr(c.key) || !isStr(c.label) || !KINDS.includes(c.kind)) {
        errors.push(`shape: every column in ${at} needs a key, a label and a kind (${KINDS.join(", ")})`);
      } else kinds[c.key] = c.kind;
    }
    for (const r of g.rows) {
      if (!isObj(r) || !isObj(r.cells)) {
        errors.push(`shape: every row in ${at} needs a ref and cells`);
        continue;
      }
      const wanted = `A-${next}`;
      if (r.ref !== wanted) {
        errors.push(`refs: expected ${wanted} in ${at}, found ${JSON.stringify(r.ref)} (A-1 onward, no gaps, no repeats)`);
      }
      next++;
      let hasFigure = false;
      let allZero = true;
      for (const [key, kind] of Object.entries(kinds)) {
        if (kind === "text") continue;
        const v = r.cells[key];
        if (!checkCents(v, `${r.ref} ${key}`, errors)) continue;
        hasFigure = true;
        if (v !== 0) allZero = false;
      }
      if (hasFigure && allZero) {
        errors.push(`zero-row: ${r.ref} is zero in every figure column, and a zero row is dropped by the writer`);
      }
      if (Array.isArray(r.detail)) {
        r.detail.forEach((d, di) => {
          if (!isObj(d) || !isStr(d.label)) errors.push(`shape: ${r.ref} detail line ${di + 1} needs a label`);
          else checkCents(d.cents, `${r.ref} detail "${d.label}"`, errors);
        });
      }
    }
    // Invariant 4: subtotals.
    for (const [key, value] of Object.entries(g.subtotal.cells ?? {})) {
      const kind = kinds[key];
      if (kind !== "money" && kind !== "int") {
        errors.push(`subtotal: ${at} has a subtotal for "${key}", which is not a money or number column`);
        continue;
      }
      if (!isInt(value)) {
        errors.push(`cents: ${at} subtotal "${key}" must be a whole number`);
        continue;
      }
      const sum = g.rows.reduce((t, r) => t + (isInt(r?.cells?.[key]) ? r.cells[key] : 0), 0);
      if (sum !== value) {
        const show = kind === "money" ? money : String;
        errors.push(
          `subtotal: in ${at} the "${key}" rows add up to ${show(sum)}, but the subtotal says ${show(value)}`,
        );
      }
    }
  });
}

function checkRefRun(rows, letter, label, errors) {
  rows.forEach((r, i) => {
    const wanted = `${letter}-${i + 1}`;
    if (!isObj(r) || r.ref !== wanted) {
      errors.push(`refs: expected ${wanted} in ${label}, found ${JSON.stringify(r?.ref)} (${letter}-1 onward, no gaps, no repeats)`);
    }
  });
}

function checkCosts(m, errors) {
  const c = m.costs;
  if (c === null || c === undefined) return;
  if (!isObj(c) || !isStr(c.title) || !Array.isArray(c.rows)) {
    errors.push('shape: "costs" needs a title and rows, or null');
    return;
  }
  checkRefRun(c.rows, "B", "the costs", errors);
  let sum = 0;
  for (const r of c.rows) {
    if (!isObj(r) || !isStr(r.label)) {
      errors.push("shape: every cost row needs a label");
      continue;
    }
    if (checkCents(r.cents, `${r.ref} cents`, errors)) sum += r.cents;
    if (r.href !== null && r.href !== undefined && !/^https?:\/\//.test(r.href)) {
      errors.push(`shape: ${r.ref} href must be a web address or null`);
    }
  }
  if (c.subtotal !== undefined && c.subtotal !== null) {
    if (!isInt(c.subtotal.cents)) errors.push("cents: costs.subtotal.cents must be a whole number");
    else if (c.subtotal.cents !== sum) {
      errors.push(`subtotal: the cost rows add up to ${money(sum)}, but the costs subtotal says ${money(c.subtotal.cents)}`);
    }
  }
}

function checkSettlement(m, errors) {
  const s = m.settlement;
  if (s === null || s === undefined) return;
  if (!isObj(s) || !isStr(s.title) || !Array.isArray(s.rows)) {
    errors.push('shape: "settlement" needs a title and rows, or null');
    return;
  }
  checkRefRun(s.rows, "C", "the settlement", errors);
  for (const r of s.rows) {
    if (isObj(r)) checkCents(r.cents, `${r.ref} cents`, errors);
  }
}

/**
 * Check a statement model against every invariant of `owner-statement/1`.
 * Returns plain-English messages, each starting with the name of the rule it broke
 * (`schema`, `status`, `moves`, `foot`, `subtotal`, `refs`, `zero-row`, `words`, `date`, `ytd`,
 * `cents`, `shape`, `brand`). An empty list means the statement is good to render.
 */
export function validate(model) {
  if (!isObj(model)) return ["shape: the statement is not an object"];
  const errors = [];
  checkTop(model, errors);
  checkSummary(model, errors);
  checkMoves(model, errors);
  checkGroups(model, errors);
  checkCosts(model, errors);
  checkSettlement(model, errors);
  checkWords(model, errors);
  return errors;
}
