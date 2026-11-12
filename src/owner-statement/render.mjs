import { BRANDS } from "./brands.mjs";
import { formatCents } from "./format.mjs";
import { statementCss } from "./styles.mjs";
import { validate } from "./validate.mjs";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
const fmt = (cents) => formatCents(cents, { parens: true });
const DASH = "&ndash;";

/** A link target a statement may carry: a web address, a path, or a page anchor. */
const SAFE_HREF = /^(https?:\/\/|\/(?!\/)|\.{1,2}\/|#)/i;
const safeHref = (href) => (typeof href === "string" && SAFE_HREF.test(href) ? href : null);

function longDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}
function shortDate(iso) {
  const [, m, d] = String(iso).split("-").map(Number);
  return `${(MONTHS[(m ?? 1) - 1] ?? "").slice(0, 3)} ${d}`;
}

const cell = (column, value) => {
  if (column.kind === "money") return fmt(value);
  if (column.kind === "int") return String(value);
  return esc(value);
};

/** Which columns stay on a phone: the first, plus the last two figure columns (money before count). */
function phoneColumns(columns) {
  const indexes = (kind) => columns.flatMap((c, i) => (i > 0 && c.kind === kind ? [i] : []));
  const money = indexes("money");
  const counts = indexes("int");
  const keep = new Set([0, ...money.slice(-2)]);
  const need = 2 - Math.min(2, money.length);
  if (need > 0) for (const i of counts.slice(-need)) keep.add(i);
  return keep;
}

function trackFor(column, wide) {
  if (column.kind === "money") return wide ? "6.4rem" : "5.4rem";
  if (column.kind === "int") return "3rem";
  return "minmax(0,.8fr)";
}

function gridVars(columns, keep) {
  const phone = ["3.2rem"];
  const wide = ["3.2rem"];
  columns.forEach((c, i) => {
    const first = i === 0;
    wide.push(first ? "minmax(0,1.3fr)" : trackFor(c, true));
    if (keep.has(i)) phone.push(first ? "minmax(0,1fr)" : trackFor(c, false));
  });
  return `--os-cols-phone:${phone.join(" ")};--os-cols-wide:${wide.join(" ")}`;
}

function renderSummary(m) {
  const s = m.summary;
  const known = s.ytd.known;
  const rows = s.rows
    .map((r) => {
      const ytd = known ? fmt(r.ytd) : DASH;
      return `<li class="os__row--${r.role}"><span class="os__lb">${esc(r.label)}<span class="os__dots"></span></span><span class="os__num">${fmt(r.month)}</span><span class="os__num os__y${known ? "" : " os__c--minor"}">${ytd}</span></li>`;
    })
    .join("");
  const note = known
    ? ""
    : `<p class="os__ytd-none">${esc(s.columns.ytd)}: ${DASH} ${esc(String(s.ytd.reason).replace(/\.$/, ""))}.</p>`;
  const mod = known ? " os__colhead--ytd" : "";
  return `<section class="os__sec"><h2 class="os__cap os__h">${esc(s.title)}</h2><div class="os__colhead${mod}" aria-hidden="true"><span></span><span>${esc(s.columns.month)}</span><span class="os__y${known ? "" : " os__c--minor"}">${esc(s.columns.ytd)}</span></div><ol class="os__rows${known ? " os__rows--ytd" : ""}">${rows}</ol>${note}</section>`;
}

function renderDetail(detail) {
  const lines = detail
    .map(
      (d) =>
        `<li${d.strong ? ' class="os__strong"' : ""}><span class="os__lb">${esc(d.label)}<span class="os__dots"></span></span><span class="os__num">${fmt(d.cents)}</span></li>`,
    )
    .join("");
  return `<ol class="os__rows">${lines}</ol>`;
}

function renderGroup(g, showTitle) {
  const keep = phoneColumns(g.columns);
  const minor = (i) => (keep.has(i) ? "" : " os__c--minor");
  const cls = (c, i) => `${c.kind === "text" ? "os__c" : "os__num"}${minor(i)}`;
  const head = `<div class="os__thead"><span>Ref</span>${g.columns.map((c, i) => `<span class="${cls(c, i)}">${esc(c.label)}</span>`).join("")}</div>`;
  const rows = g.rows
    .map((r) => {
      const cells = g.columns
        .map((c, i) => `<span class="${cls(c, i)}">${cell(c, r.cells[c.key])}</span>`)
        .join("");
      const note = r.note ? `<span class="os__snote">${esc(r.note)}</span>` : "";
      const inner = `<span class="os__ref">${esc(r.ref)}</span>${cells}${note}`;
      if (r.detail?.length) {
        return `<details class="os__stay"><summary class="os__srow">${inner}</summary>${renderDetail(r.detail)}</details>`;
      }
      return `<div class="os__stay os__stay--plain"><div class="os__srow">${inner}</div></div>`;
    })
    .join("");
  const subCells = g.columns
    .map((c, i) => {
      if (i === 0) return `<span class="os__c">${esc(g.subtotal.label)}</span>`;
      const v = g.subtotal.cells[c.key];
      return `<span class="${cls(c, i)}">${v === undefined ? "" : cell(c, v)}</span>`;
    })
    .join("");
  const note = g.note ? `<p class="os__gnote">${esc(g.note)}</p>` : "";
  const title = showTitle ? `<h2 class="os__cap os__h">${esc(g.title)}</h2>` : "";
  return `<section class="os__sec">${title}<h3 class="os__prop-h">${esc(g.property)}</h3><div class="os__tbl" style="${gridVars(g.columns, keep)}">${head}${rows}${note}<div class="os__srow os__ssub"><span class="os__ref"></span>${subCells}</div></div></section>`;
}

function link(href, text) {
  const safe = safeHref(href);
  return safe ? `<a href="${esc(safe)}">${esc(text)}</a>` : esc(text);
}

function renderCosts(c) {
  const rows = c.rows
    .map((r) => {
      const bits = [];
      if (r.number) bits.push(esc(`Invoice ${r.number}`));
      if (r.note)
        bits.push(r.date ? `<time datetime="${esc(r.date)}">${esc(r.note)}</time>` : esc(r.note));
      else if (r.date)
        bits.push(`<time datetime="${esc(r.date)}">${esc(shortDate(r.date))}</time>`);
      const small = bits.length ? `<span class="os__small">${bits.join(". ")}</span>` : "";
      return `<li><span class="os__cref">${esc(r.ref)}</span><span>${link(r.href, r.label)}${small}</span><span class="os__num">${fmt(r.cents)}</span></li>`;
    })
    .join("");
  const sub = c.subtotal
    ? `<li class="os__ssub"><span></span><span>${esc(c.subtotal.label)}</span><span class="os__num">${fmt(c.subtotal.cents)}</span></li>`
    : "";
  return `<section class="os__sec"><h2 class="os__cap os__h">${esc(c.title)}</h2><ol class="os__costs">${rows}${sub}</ol></section>`;
}

function renderSettlement(s) {
  const rows = s.rows
    .map(
      (r) =>
        `<li${r.role === "balance" ? ' class="os__ssub"' : ""}><span class="os__cref">${esc(r.ref)}</span><span>${esc(r.label)}</span><span class="os__num">${fmt(r.cents)}</span></li>`,
    )
    .join("");
  return `<section class="os__sec"><h2 class="os__cap os__h">${esc(s.title)}</h2><ol class="os__costs">${rows}</ol></section>`;
}

/**
 * Render one statement model to a page. Returns `{ html, css, title, fontsHref }`: one root
 * element, its stylesheet (every rule under `.os`, plus the print sheet), the document title and
 * the Google Fonts address for a standalone file. Throws, naming each problem, when the model
 * does not validate: a statement that breaks its own rules is never shown.
 */
export function renderStatement(model, options) {
  const errors = validate(model);
  if (errors.length) {
    throw new Error(`owner-statement: the model does not validate:\n${errors.join("\n")}`);
  }
  const { logo, pdfHref, fonts = {} } = options ?? {};
  if (!logo || typeof logo.src !== "string" || !logo.alt || !logo.width || !logo.height) {
    throw new Error("owner-statement: options.logo needs src, alt, width and height");
  }
  if (pdfHref !== undefined && !safeHref(pdfHref)) {
    throw new Error("owner-statement: options.pdfHref must be a web address or a path");
  }
  if (!/^https?:\/\//.test(model.calls)) {
    throw new Error("owner-statement: calls must be a web address");
  }
  const tokens = BRANDS[model.brand];
  const stacks = {
    display: fonts.display ?? tokens.display,
    text: fonts.text ?? tokens.text,
    figures: fonts.figures ?? tokens.figures,
  };
  const footer = `${model.monthLabel} owner statement, ${model.property.label}`;
  const css = statementCss(tokens, stacks, { footer });

  const mv = model.moves;
  const big = mv.direction === "none" ? "Nothing moves" : fmt(mv.cents);
  const line =
    mv.date === null && mv.direction !== "none" && mv.dateUnknown
      ? `${mv.line}, ${mv.dateUnknown}`
      : mv.line;
  const pdf = pdfHref
    ? `<p class="os__actions"><a class="os__btn" href="${esc(pdfHref)}">Download PDF</a></p>`
    : "";

  let lastTitle = null;
  const groups = model.groups
    .map((g) => {
      const show = g.title !== lastTitle;
      lastTitle = g.title;
      return renderGroup(g, show);
    })
    .join("");

  const attention = model.attention.length
    ? `<section class="os__sec"><h2 class="os__cap os__h">Needs your attention</h2><ol class="os__att">${model.attention.map((a) => `<li><span>${esc(a)}</span></li>`).join("")}</ol></section>`
    : "";
  const sources = model.sources.length
    ? `<section class="os__sec"><h2 class="os__cap os__h">Sources</h2><ul class="os__src">${model.sources.map((s) => `<li>${link(s.href, s.label)}</li>`).join("")}</ul></section>`
    : "";

  const callText = model.calls.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const html =
    `<div class="os os--${esc(model.brand)}" lang="en"><article class="os__sheet${tokens.stripe ? " os__stripe" : ""}">` +
    `<header class="os__mast"><img class="os__logo" src="${esc(logo.src)}" alt="${esc(logo.alt)}" width="${esc(logo.width)}" height="${esc(logo.height)}">` +
    `<p class="os__cap">Owner statement</p><h1 class="os__month">${esc(model.monthLabel)}</h1>` +
    `<p class="os__prop">${esc(model.property.line)}<br>Prepared for ${esc(model.owner.name)}</p></header>` +
    `<section class="os__lead"><p class="os__cap">${esc(mv.headline)}</p><p class="os__big">${esc(big)}</p><p class="os__line">${esc(line)}</p>${pdf}</section>` +
    renderSummary(model) +
    groups +
    (model.costs ? renderCosts(model.costs) : "") +
    (model.settlement ? renderSettlement(model.settlement) : "") +
    attention +
    sources +
    `<footer class="os__sign"><p>${esc(model.prepared.by)} of ${esc(model.business)} prepared and reconciled this statement on ${esc(longDate(model.prepared.date))}.</p>` +
    `<p>Questions on any figure: reply to the email, or book a call at <a href="${esc(model.calls)}">${esc(callText)}</a>.</p></footer>` +
    `</article></div>`;

  return {
    html,
    css,
    title: `${model.monthLabel} owner statement | ${model.property.label}`,
    fontsHref: tokens.fontsHref,
  };
}
