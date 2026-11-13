/**
 * Letterheads: a whole business email, framed in the client's own brand.
 *
 * The sibling of signatures.mjs, and bound by the same email rules: nested
 * presentation tables, inline styles only, no stylesheet, no classes, no flex,
 * no grid, no background images, never wider than 600px. Web fonts are named
 * first in each stack for Apple Mail and fall back cleanly where Gmail strips
 * them, so every layout has to read well in Georgia and Helvetica alone.
 *
 * Two rules that are easy to break:
 * 1) The header is an image with its background painted in (opaque, matching
 *    the paper). Gmail's dark mode recolors html but never images, so a
 *    transparent dark logo vanishes on dark gray, and an opaque one shows as a
 *    clean light band.
 * 2) The words survive with images off. A header image carries the wordmark
 *    as alt text, and nothing the reader needs lives only in a picture.
 *
 * An email is { subject, blocks }, and a block is one of:
 *   { type: "p", text }                 a paragraph
 *   { type: "lead", text }              the opening paragraph, set larger
 *   { type: "link", label, href, note } the one link the email exists to send
 *   { type: "button", label, href, note } one painted button: the label is its only text, the
 *                                       address rides in the plain-text part (label, then URL)
 *   { type: "list", intro, items }      numbered items, typed as 1) 2) 3)
 *   { type: "close", text }             the sign-off line ("Best,")
 */

import { isUnfilled } from "./unfilled.mjs";

const MAX_WIDTH = 600;

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const table = (inner, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${style}">${inner}</table>`;

/** A hex color `w` of the way from `a` to `b` (both #rrggbb); falls back to `a` on anything else. */
const mix = (a, b, w) => {
  const rgb = (h) =>
    /^#[0-9a-f]{6}$/i.test(h ?? "")
      ? [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
      : null;
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return a;
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i] - v) * w)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const BREAK = "overflow-wrap:break-word;word-break:normal;";
/** A long address in a sentence may break at any character, so it never pushes a phone sideways. */
const ANYWHERE = "overflow-wrap:anywhere;word-break:break-word;";
/** A table's row label gives way before its figures do: at a soft hyphen first, at any character as a last resort. */
const LABEL_WRAP = "overflow-wrap:anywhere;";
/**
 * Dictionary break points for the long words a statement's row labels carry. A soft hyphen is
 * invisible unless the word must break, which only happens on the narrowest phones, and it works
 * where automatic hyphenation does not: a mail app with no dictionary, or one that dropped the
 * language (and automatic hyphenation also splits short words like "pay-out" that should wrap whole).
 */
const BREAK_POINTS = [
  "adjust-ment",
  "adjust-ments",
  "clean-ing",
  "com-mis-sion",
  "ex-pens-es",
  "main-te-nance",
  "man-age-ment",
  "oc-cu-pan-cy",
  "pay-outs",
  "pro-ceeds",
  "re-im-burse-ment",
  "re-im-burse-ments",
  "res-er-va-tions",
  "rev-e-nue",
  "turn-over",
];
const BREAKS = new Map(BREAK_POINTS.map((w) => [w.replaceAll("-", ""), w.split("-")]));
const softHyphens = (text) =>
  text.replace(/[A-Za-z]{7,}/g, (w) => {
    const parts = BREAKS.get(w.toLowerCase());
    if (!parts) return w;
    const out = [];
    let at = 0;
    for (const p of parts) {
      out.push(w.slice(at, at + p.length));
      at += p.length;
    }
    return out.join("&shy;");
  });
/**
 * A side margin that is `px` on the 600px letter (`box` is the sheet's width inside any border)
 * and shrinks with a narrower screen (about 10px at 320), so the narrowest phone gets the room
 * back without a media query, which Gmail compose drops.
 */
const side = (px, box = MAX_WIDTH) => `${+((px / box) * 100).toFixed(4)}%`;
/** An address printed as text, with a soft break after each slash so it wraps at a slash, not mid-word. */
const url = (href) => esc(href).replace(/([^/])\/(?!\/)/g, "$1/<wbr>");

/** Letterhead-only tokens, with defaults drawn from the brand-pack tokens. */
const tokens = (c) => {
  const l = c.letterhead ?? {};
  return {
    paper: l.paper ?? c.ground,
    surround: l.surround ?? l.paper ?? c.ground,
    rule: l.rule ?? c.brand,
    line: l.line ?? "#e2ded6",
    soft: l.soft ?? "#5d5a55",
    link: l.link ?? c.ink,
    buttonBackground: l.buttonBackground ?? c.ink,
    buttonText: l.buttonText ?? l.paper ?? c.ground,
    headerUrl: l.headerUrl,
    headerWidth: l.headerWidth ?? 240,
    headerAlt: l.headerAlt ?? c.wordmark,
    // A tightly cropped header for left-aligned layouts, so the mark meets the text edge.
    headerLeftUrl: l.headerLeftUrl ?? l.headerUrl,
    photoUrl: l.photoUrl ?? c.photoUrl,
    photoAlt: l.photoAlt ?? "",
    address: l.address,
    footer: l.footer ?? null,
    mastheadContact: l.mastheadContact ?? true,
  };
};

/** The header image, or a visible unfilled state where it will go. */
const header = (c, t, width = t.headerWidth, align = "center") =>
  isUnfilled(t.headerUrl)
    ? `<div style="display:inline-block;padding:14px 18px;border:2px dashed ${c.accent};color:${c.accent};font-family:${c.bodyFont};font-size:13px;">No letterhead image yet: ${esc(c.wordmark)}</div>`
    : `<a href="${esc(c.siteUrl)}" style="text-decoration:none;display:inline-block;"><img src="${esc(t.headerUrl)}" width="${width}" alt="${esc(t.headerAlt)}" style="display:${align === "center" ? "inline-block" : "block"};width:${width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:${c.ink};font-family:${c.displayFont};font-size:22px;"></a>`;

const siteLabel = (c) => c.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * Body blocks, one renderer per layout voice. `s` holds the type settings for
 * the layout; every layout prints every block, so no option drops a word.
 */
function body(email, c, t, s) {
  const P = `margin:0 0 18px 0;font-family:${s.font};font-size:${s.size}px;line-height:1.6;color:${c.ink};`;
  // A web address written in a sentence stays in the sentence and becomes a
  // plain underlined link, in the brand's link color. The "link" block is a
  // button with its own rows; this is for "...a call with me here: <address>"
  // where the sender wants one line, not a button (Jake, 2026-11-06).
  const prose = (text) =>
    esc(text).replace(
      /https?:\/\/[^\s<]+?(?=[.,;:!?)]*(?:\s|$))/g,
      (u) =>
        `<a href="${u}" style="color:${t.link};text-decoration:underline;${ANYWHERE}">${u}</a>`,
    );
  return email.blocks
    .map((b) => {
      switch (b.type) {
        case "p":
          return `<p style="${P}">${prose(b.text)}</p>`;
        case "lead":
          return `<p style="${P}font-family:${s.leadFont ?? s.font};font-size:${s.leadSize}px;line-height:1.6;">${esc(b.text)}</p>`;
        case "close":
          return `<p style="${P}">${esc(b.text)}</p>`;
        case "list": {
          const rows = b.items
            .map(
              (item, i) =>
                `<tr><td valign="top" style="width:34px;padding:10px 0;font-family:${s.font};font-size:${s.size}px;line-height:1.55;color:${s.numeral ?? c.accent};${s.listRule ? `border-bottom:1px solid ${t.line};` : ""}">${i + 1})</td><td style="padding:10px 0;font-family:${s.font};font-size:${s.size}px;line-height:1.55;color:${c.ink};${s.listRule ? `border-bottom:1px solid ${t.line};` : ""}">${esc(item)}</td></tr>`,
            )
            .join("");
          return `${b.intro ? `<p style="${P}margin-bottom:6px;">${esc(b.intro)}</p>` : ""}${table(rows, `margin:0 0 24px 0;${s.listRule ? `border-top:1px solid ${t.line};` : ""}`)}`;
        }
        case "figures": {
          const last = b.rows.length - 1;
          const rows = b.rows
            .map(([label, amount], i) => {
              const strong = i === last && b.emphasizeLast !== false;
              const cell = `padding:${strong ? "14px" : "10px"} 0;${strong ? `border-top:2px solid ${t.rule};` : ""}border-bottom:1px solid ${t.line};font-family:${s.font};font-size:${strong ? s.size + 1 : s.size}px;line-height:1.3;color:${c.ink};${strong ? "font-weight:700;" : ""}`;
              const money = strong ? `font-size:${s.size + 8}px;` : "";
              return `<tr><td style="${cell}">${esc(label)}</td><td align="right" style="${cell}${money}text-align:right;white-space:nowrap;padding-left:12px;width:1%;">${esc(amount)}</td></tr>`;
            })
            .join("");
          return `${b.intro ? `<p style="${P}margin-bottom:6px;">${esc(b.intro)}</p>` : ""}${table(rows, `margin:0 0 24px 0;border-top:1px solid ${t.line};`)}`;
        }
        case "heading":
          return `<p style="margin:30px 0 12px 0;padding-top:16px;border-top:1px solid ${t.line};font-family:${c.bodyFont};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:1.4;color:${c.accent};">${esc(b.text)}</p>`;
        case "table": {
          // A real data table: header cells carry scope, the first column reads left, the rest right
          // (figures line up), and `align` overrides per column. Sized for a phone at 600px max.
          // Figures never wrap, so on the narrowest phone (320) the row labels give way instead:
          // they hyphenate, and break anywhere only when no hyphen fits. At 600 nothing changes.
          const al = (i) => b.align?.[i] ?? (i === 0 ? "left" : "right");
          const cell = (i, head, strong) =>
            `padding:${head ? "8px" : "11px"} ${i === b.columns.length - 1 ? 0 : 10}px ${head ? "8px" : "11px"} 0;text-align:${al(i)};vertical-align:top;border-bottom:1px solid ${head ? t.rule : t.line};font-family:${head ? c.bodyFont : s.font};font-size:${head ? 12 : s.size - 1}px;line-height:1.35;color:${head ? t.soft : c.ink};${head ? "font-weight:700;letter-spacing:.06em;text-transform:uppercase;" : ""}${strong ? "font-weight:700;" : ""}${i === 0 ? LABEL_WRAP : "white-space:nowrap;"}`;
          const head = `<tr>${b.columns.map((h, i) => `<th scope="col" style="${cell(i, true)}">${esc(h)}</th>`).join("")}</tr>`;
          const rows = b.rows
            .map(
              (r, ri) =>
                `<tr>${r.map((v, i) => (i === 0 ? `<th scope="row" style="${cell(i, false, true)}">${softHyphens(esc(v))}</th>` : `<td style="${cell(i, false, b.strongColumn === i)}">${esc(v)}</td>`)).join("")}</tr>`,
            )
            .join("");
          const note = b.note
            ? `<p style="margin:-14px 0 24px 0;font-family:${c.bodyFont};font-size:14px;line-height:1.5;color:${t.soft};">${esc(b.note)}</p>`
            : "";
          return `${b.intro ? `<p style="${P}margin-bottom:8px;">${esc(b.intro)}</p>` : ""}<table lang="en" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px 0;">${b.caption ? `<caption style="text-align:left;padding:0 0 6px 0;font-family:${c.bodyFont};font-size:13px;color:${t.soft};">${esc(b.caption)}</caption>` : ""}${head}${rows}</table>${note}`;
        }
        case "bars": {
          // A horizontal bar chart built from table cells, so Gmail and Outlook draw it with no image
          // or SVG. Each bar is scaled to the largest value; the printed figure is the accessible value.
          const max = Math.max(...b.rows.map(([, v]) => v));
          const rows = b.rows
            .map(([label, v, shown]) => {
              const pct = Math.max(1, Math.round((v / max) * 100));
              const bar = table(
                `<tr><td width="${pct}%" style="width:${pct}%;height:14px;background-color:${b.color ?? c.accent};font-size:0;line-height:0;">&nbsp;</td>${pct < 100 ? `<td style="font-size:0;line-height:0;">&nbsp;</td>` : ""}</tr>`,
              );
              const td = `padding:7px 0;border-bottom:1px solid ${t.line};vertical-align:middle;font-family:${s.font};font-size:${s.size - 2}px;line-height:1.3;color:${c.ink};`;
              return `<tr><td style="${td}width:30%;padding-right:10px;">${esc(label)}</td><td aria-hidden="true" style="${td}">${bar}</td><td style="${td}width:1%;white-space:nowrap;text-align:right;padding-left:10px;font-weight:700;">${esc(shown ?? v)}</td></tr>`;
            })
            .join("");
          const note = b.note
            ? `<p style="margin:-14px 0 24px 0;font-family:${c.bodyFont};font-size:14px;line-height:1.5;color:${t.soft};">${esc(b.note)}</p>`
            : "";
          return `${b.intro ? `<p style="${P}margin-bottom:8px;">${esc(b.intro)}</p>` : ""}${table(rows, `margin:0 0 24px 0;border-top:1px solid ${t.line};`)}${note}`;
        }
        case "kpis": {
          // Owner statement tiles, two across so a phone holds them: big figure, plain label, the
          // denominator under it. Table cells only, so Gmail and Outlook draw them the same.
          // Each figure sits on its own card (Jake, 2026-11-10: "more elegant and aesthetically
          // beautiful cards"): a tinted ground halfway between the paper and the surround, a hairline
          // border, a short brand rule, a small spaced label, the figure in the display face. Cards in
          // one row share a height because they are cells of the same row.
          const card = mix(t.paper, t.surround, 0.45);
          const gap = `<td width="2%" style="width:2%;min-width:12px;font-size:0;line-height:0;">&nbsp;</td>`;
          const tile = (k) =>
            `<td width="49%" valign="top" align="center" style="width:49%;vertical-align:top;text-align:center;padding:18px 18px 18px 18px;background-color:${card};border:1px solid ${t.line};border-radius:10px;">` +
            `<div style="width:22px;height:2px;background-color:${t.rule};font-size:0;line-height:0;margin:0 auto 12px auto;">&nbsp;</div>` +
            `<div style="font-family:${c.bodyFont};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;line-height:1.35;color:${t.soft};">${esc(k.label)}</div>` +
            `<div style="font-family:${c.displayFont};font-size:32px;line-height:1.1;color:${c.ink};padding-top:8px;font-variant-numeric:lining-nums tabular-nums;letter-spacing:-.01em;">${esc(k.value)}</div>` +
            (k.note
              ? `<div style="font-family:${c.bodyFont};font-size:13px;line-height:1.45;color:${t.soft};padding-top:6px;">${esc(k.note)}</div>`
              : "") +
            `</td>`;
          const rows = [];
          for (let i = 0; i < b.tiles.length; i += 2) {
            if (i)
              rows.push(
                `<tr><td colspan="3" height="12" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>`,
              );
            rows.push(
              `<tr>${tile(b.tiles[i])}${gap}${b.tiles[i + 1] ? tile(b.tiles[i + 1]) : `<td width="49%" style="width:49%;"></td>`}</tr>`,
            );
          }
          return table(rows.join(""), "margin:4px 0 26px 0;border-collapse:separate;");
        }
        case "ledger": {
          // One column of money that foots top to bottom: plain lines, a landing (sub), the total.
          const rows = b.rows
            .map((r) => {
              const total = r.kind === "total";
              const sub = r.kind === "sub";
              const cell = `padding:${total ? "14px" : "10px"} 0;${total ? `border-top:2px solid ${t.rule};` : sub ? `border-top:1px solid ${t.rule};` : ""}${total ? "" : `border-bottom:1px solid ${t.line};`}font-family:${s.font};font-size:${total ? s.size + 1 : s.size}px;line-height:1.35;color:${c.ink};${total || sub ? "font-weight:700;" : ""}vertical-align:baseline;`;
              const amount = total ? `font-size:${s.size + 8}px;` : "";
              const note = r.note
                ? `<div style="font-family:${c.bodyFont};font-size:${b.noteSize ?? 13}px;line-height:1.4;font-weight:400;color:${t.soft};padding-top:2px;">${esc(r.note)}</div>`
                : "";
              const link = r.href
                ? `<div style="font-family:${c.bodyFont};font-size:14px;line-height:1.4;font-weight:400;padding-top:4px;"><a href="${esc(r.href)}" style="color:${t.link};text-decoration:underline;">${esc(r.linkText ?? "View")}</a></div>`
                : "";
              return `<tr><td style="${cell}">${esc(r.label)}${note}${link}</td><td align="right" style="${cell}${amount}text-align:right;white-space:nowrap;padding-left:12px;width:1%;font-variant-numeric:tabular-nums;">${esc(r.value)}</td></tr>`;
            })
            .join("");
          return table(rows, `margin:0 0 24px 0;border-top:1px solid ${t.line};`);
        }
        case "links": {
          // Several links in one ruled panel, so they never stack two panels' rules.
          const rows = b.rows
            .map(
              (r, i) =>
                `<tr><td style="padding:14px 0;${i ? `border-top:1px solid ${t.line};` : ""}font-family:${s.font};font-size:${s.size}px;line-height:1.5;color:${c.ink};">${esc(r.label)}<br><a href="${esc(r.href)}" style="color:${t.link};text-decoration:underline;word-break:break-word;">${esc(r.href)}</a></td></tr>`,
            )
            .join("");
          return table(
            rows,
            `margin:0 0 22px 0;border-top:1px solid ${t.rule};border-bottom:1px solid ${t.rule};`,
          );
        }
        case "link":
          return s.link(b);
        case "button":
          return ctaButton(c, t, b);
        default:
          throw new Error(`Unknown letterhead block type "${b.type}"`);
      }
    })
    .join("\n");
}

/**
 * A link as a button. With a `button` label the address prints under it, so it
 * survives a plain-text reader; without one the address itself is the button
 * text, which keeps the email's words exactly what the sender wrote.
 */
const button = (c, t, b, font) =>
  `${b.label ? `<p style="margin:0 0 10px 0;font-family:${font};font-size:17px;line-height:1.5;color:${c.ink};">${esc(b.label)}</p>` : ""}` +
  table(
    `<tr><td style="padding:0 0 8px 0;"><a href="${esc(b.href)}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:13px 22px;background-color:${c.ink};color:${t.paper};font-family:${c.bodyFont};font-size:15px;font-weight:600;letter-spacing:.02em;text-decoration:none;border-radius:3px;${BREAK}">${b.button ? esc(b.button) : url(b.href)}</a></td></tr>` +
      (b.button
        ? `<tr><td style="padding:0;font-family:${c.bodyFont};font-size:14px;line-height:1.5;color:${t.soft};${BREAK}"><a href="${esc(b.href)}" style="color:${t.soft};display:inline-block;padding:6px 0;">${url(b.href)}</a></td></tr>`
        : "") +
      (b.note
        ? `<tr><td style="padding:8px 0 0 0;font-family:${c.bodyFont};font-size:15px;color:${c.ink};">${esc(b.note)}</td></tr>`
        : ""),
    "margin:4px 0 26px 0;",
  );

/**
 * The email's one primary action, as a bulletproof button: a table cell painted twice (the
 * `bgcolor` attribute and `background-color`), holding a link that is itself the padded tap area
 * with its own text color. No image and no background image, so it reads with images off; both
 * colors are set explicitly, so Gmail's forced dark mode inverts the pair together and the label
 * stays readable. 14px padding around a 22px line gives a 50px target. The address is never
 * printed in the html; the plain-text part carries it under the label.
 */
function ctaButton(c, t, b) {
  if (typeof b.label !== "string" || b.label.trim() === "") {
    throw new Error('A "button" block needs a label');
  }
  if (typeof b.href !== "string" || !/^https?:\/\/\S/.test(b.href)) {
    throw new Error('A "button" block needs an href that is a web address');
  }
  const bg = esc(t.buttonBackground);
  const fg = esc(t.buttonText);
  const cell = `<td bgcolor="${bg}" style="background-color:${bg};border-radius:4px;mso-padding-alt:14px 26px;"><a href="${esc(b.href)}" style="display:block;padding:14px 26px;font-family:${c.bodyFont};font-size:17px;line-height:22px;font-weight:600;letter-spacing:.01em;color:${fg};text-decoration:none;text-align:center;border-radius:4px;${BREAK}">${esc(b.label)}</a></td>`;
  const inner = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;max-width:100%;"><tr>${cell}</tr></table>`;
  return table(
    `<tr><td align="left" style="padding:0;">${inner}</td></tr>` +
      (b.note
        ? `<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:15px;line-height:1.5;color:${c.ink};">${esc(b.note)}</td></tr>`
        : ""),
    "margin:6px 0 26px 0;",
  );
}

/**
 * A pasted signature made fit for a letterhead without changing a word: its
 * links get a tappable height, contact text reads at 15px (small capitals 13px), nothing refuses to wrap
 * or holds a fixed width past a phone screen, and a tel: link
 * becomes plain text, since mail apps link phone numbers themselves and a call
 * link at the foot of a letter is not the business phone a reader hunts for.
 * Pass { logo: false } under a letterhead header, so the mark shows once.
 */
export function letterheadSignature(html, { logo = true, name, nameSize = 22 } = {}) {
  const BLANK = "(?:\\s|&nbsp;|\u00a0)*";
  const out = logo
    ? String(html)
    : String(html)
        .replace(/<img\b[^>]*>/gi, "")
        // spacer divs and divider rules that only made room beside the logo
        .replace(new RegExp(`<div\\b[^>]*>${BLANK}</div>`, "gi"), "")
        .replace(new RegExp(`<td\\b[^>]*>${BLANK}</td>`, "gi"), "")
        // contact items stack one per line, so a phone never strands a separator dot
        .replace(
          new RegExp(
            `<span\\b[^>]*>(?:${BLANK}|<span>${BLANK}</span>)*(?:·|&middot;|&#183;)(?:${BLANK}|<span>${BLANK}</span>)*</span>`,
            "gi",
          ),
          "<br>",
        )
        // a link that only wrapped the logo is now empty, and an empty link has no name
        .replace(/<a\b[^>]*>\s*<\/a>/gi, "")
        // the cell that held the logo, now empty or holding an empty link
        .replace(/<td\b[^>]*>\s*(?:<a\b[^>]*>\s*<\/a>)?\s*<\/td>/gi, "")
        // and the divider and gutter that sat beside it
        .replace(/(<td\b[^>]*style="[^"]*?)border-left:[^;"]*;?/gi, "$1")
        .replace(
          /(<td\b[^>]*style="[^"]*?)padding:\s*0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+\d+px/gi,
          "$1padding:0",
        )
        .replace(
          /(<td\b[^>]*style="[^"]*?padding:\s*[\d.]+(?:px)?\s+[\d.]+(?:px)?\s+[\d.]+(?:px)?\s+)[\d.]+(?:px)?/gi,
          "$10",
        )
        // one rhythm: each live signature's own gaps and line heights give way to one spacing
        .replace(/(<div\b[^>]*style="[^"]*?)padding-top:\s*[\d.]+px;?/gi, "$1")
        .replace(/(<(?:div|td)\b[^>]*style="[^"]*?)line-height:\s*[^;"]+/gi, "$1line-height:1.6");
  const named = name
    ? out.replace(
        new RegExp(
          `(<(?:div|span)\\b[^>]*style="[^"]*?)font-size:\\s*\\d+px([^"]*"[^>]*>\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</(?:div|span)>)`,
          "i",
        ),
        `$1font-size:${nameSize}px$2`,
      )
    : out;
  return (
    named
      .replace(
        /<a\b[^>]*href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
        '<span style="display:inline-block;padding:4px 0">$1</span>',
      )
      .replace(
        /<a\b([^>]*?)style="([^"]*)"/gi,
        (m, pre, st) => `<a${pre}style="${st};display:inline-block;padding:4px 0"`,
      )
      // contact text reads at 15px beside 18px body; small capital labels keep 13px
      .replace(
        /style="([^"]*)"/gi,
        (m, st) =>
          `style="${st.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, (f, px) => {
            const floor = /text-transform:\s*uppercase|letter-spacing:\s*(?:0?\.[1-9]|[1-9])/i.test(
              st,
            )
              ? 13
              : 15;
            return Number(px) < floor ? `font-size:${floor}px` : f;
          })}"`,
      )
      .replace(/white-space:\s*nowrap;?/gi, "")
      // and the signature spans the letter, so its rules run the full width
      .replace(/<table\b([^>]*?)style="/i, '<table$1style="width:100%;')
      .replace(/(<div\b[^>]*style="[^"]*?)width:\s*(\d+(?:\.\d+)?)px/gi, (m, pre, px) =>
        Number(px) > 120 ? `${pre}width:100%` : m,
      )
  );
}

const contactLines = (c, t, p, color, font, size, sep = "<br>") =>
  [
    p.phone &&
      `<a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ""))}" style="color:${color};text-decoration:none;">${esc(p.phone)}</a>`,
    p.email &&
      `<a href="mailto:${esc(p.email)}" style="color:${color};text-decoration:none;">${esc(p.email)}</a>`,
    `<a href="${esc(c.siteUrl)}" style="color:${color};text-decoration:none;">${esc(siteLabel(c))}</a>`,
  ]
    .filter(Boolean)
    .map((x) => `<span style="font-family:${font};font-size:${size}px;">${x}</span>`)
    .join(sep);

const nameBlock = (c, t, p, align = "left") =>
  `<div style="text-align:${align};font-family:${c.displayFont};font-size:22px;line-height:1.25;color:${c.ink};">${esc(p.name)}</div>` +
  `<div style="text-align:${align};font-family:${c.bodyFont};font-size:13px;line-height:1.5;letter-spacing:.14em;text-transform:uppercase;color:${t.soft};padding-top:3px;">${esc(p.title)}</div>`;

const shell = (c, t, inner) =>
  `<div style="background-color:${t.surround};padding:20px 6px;">${table(`<tr><td align="center" style="padding:0;">${table(`<tr><td style="padding:0;">${inner}</td></tr>`, `max-width:${MAX_WIDTH}px;`)}</td></tr>`)}</div>`;

const footerLine = (c, t, color) =>
  t.footer
    ? `<div style="text-align:center;padding:18px 8px 2px;font-family:${c.bodyFont};font-size:13px;line-height:1.6;letter-spacing:.08em;color:${color};">${esc(t.footer)}${t.address ? `<br>${esc(t.address)}` : ""}</div>`
    : "";

/* ------------------------------------------------------------------ layouts */

/** 0+: the plain letter set properly. No header; the signature carries the brand. */
function setLetter(email, c, p, sig) {
  const t = tokens(c);
  const s = {
    font: c.displayFont,
    size: 17,
    leadSize: 17,
    link: (b) =>
      `<p style="margin:0 0 18px 0;font-family:${c.displayFont};font-size:17px;line-height:1.6;color:${c.ink};">${b.label ? `${esc(b.label)}<br>` : ""}<a href="${esc(b.href)}" style="color:${t.link};${BREAK}">${url(b.href)}</a>${b.note ? `<br>${esc(b.note)}` : ""}</p>`,
  };
  return `<div style="background-color:#ffffff;padding:24px 20px;">${table(`<tr><td style="padding:0;">${body(email, c, t, s)}<div style="padding-top:6px;">${sig}</div></td></tr>`, `max-width:${MAX_WIDTH}px;`)}</div>`;
}

/** Paper: centered header on a paper sheet, a brand rule, serif text, ruled link panel. */
function paper(email, c, p, sig) {
  const t = tokens(c);
  const s = {
    font: c.displayFont,
    size: 18,
    leadSize: 18,
    listRule: true,
    link: (b) =>
      table(
        `<tr><td style="border-top:1px solid ${t.rule};border-bottom:1px solid ${t.rule};padding:18px 0 12px;text-align:left;">` +
          (b.label
            ? `<div style="font-family:${c.displayFont};font-size:18px;line-height:1.6;color:${c.ink};">${esc(b.label)}</div>`
            : "") +
          `<div style="font-family:${c.displayFont};font-size:17px;line-height:1.5;${BREAK}"><a href="${esc(b.href)}" style="color:${t.link};display:inline-block;padding:10px 0;">${url(b.href)}</a></div>` +
          (b.note
            ? `<div style="font-family:${c.displayFont};font-size:17px;color:${c.ink};padding-top:6px;">${esc(b.note)}</div>`
            : "") +
          `</td></tr>`,
        "margin:6px 0 24px 0;",
      ),
  };
  return shell(
    c,
    t,
    `<div style="background-color:${t.paper};border:1px solid ${t.line};">
<div style="text-align:center;padding:30px 24px 22px;background-color:${t.paper};">${header(c, t)}</div>
<div style="height:1px;line-height:1px;font-size:1px;background-color:${t.rule};margin:0 20px;">&nbsp;</div>
<div style="padding:30px ${side(20, MAX_WIDTH - 2)} 0;">${body(email, c, t, s)}</div>
<div style="padding:14px ${side(20, MAX_WIDTH - 2)} 30px;">${sig ? `${email.blocks.at(-1)?.type === "link" ? "" : `<div style="height:1px;line-height:1px;font-size:1px;background-color:${t.line};margin:0 0 20px 0;">&nbsp;</div>`}${sig}` : `<div style="text-align:center;">${nameBlock(c, t, p, "center")}<div style="padding-top:10px;text-align:center;line-height:1.8;">${contactLines(c, t, p, c.ink, c.bodyFont, 14)}</div></div>`}</div>
</div>${footerLine(c, t, t.soft)}`,
  );
}

/**
 * Masthead: the printed-letterhead convention. Header left, the firm's contact
 * block right, a full rule, then the letter on open white. Reads as a company
 * writing, where paper reads as a person writing.
 */
function masthead(email, c, p, sig) {
  const t = tokens(c);
  const s = {
    font: c.displayFont,
    size: 18,
    leadSize: 18,
    numeral: c.accent,
    link: (b) =>
      table(
        `<tr><td width="3" style="width:3px;background-color:${t.rule};font-size:1px;line-height:1px;">&nbsp;</td><td style="padding:4px 0 4px 18px;">` +
          (b.label
            ? `<div style="font-family:${c.displayFont};font-size:18px;line-height:1.5;color:${c.ink};">${esc(b.label)}</div>`
            : "") +
          `<div style="font-family:${c.displayFont};font-size:19px;line-height:1.4;padding-top:6px;${BREAK}"><a href="${esc(b.href)}" style="color:${t.link};display:inline-block;padding:10px 0;">${url(b.href)}</a></div>` +
          (b.note
            ? `<div style="font-family:${c.bodyFont};font-size:15px;color:${c.ink};padding-top:6px;">${esc(b.note)}</div>`
            : "") +
          `</td></tr>`,
        "margin:6px 0 26px 0;",
      ),
  };
  const contact = `<div style="text-align:right;line-height:1.7;">${contactLines(c, t, p, c.ink, c.bodyFont, 13)}${t.address ? `<br><span style="font-family:${c.bodyFont};font-size:13px;color:${t.soft};">${esc(t.address)}</span>` : ""}</div>`;
  return shell(
    c,
    { ...t, surround: t.paper },
    `<div style="background-color:${t.paper};">
${table(`<tr><td valign="middle" style="padding:8px 0 18px 0;">${header(c, { ...t, headerUrl: t.headerLeftUrl }, Math.min(t.headerWidth, 260), "left")}</td>${t.mastheadContact ? `<td valign="middle" style="padding:8px 0 18px 16px;">${contact}</td>` : ""}</tr>`)}
<div style="height:2px;line-height:2px;font-size:2px;background-color:${t.rule};">&nbsp;</div>
<div style="padding:30px 0 6px;">${body(email, c, t, s)}</div>
<div style="padding:0 0 26px;">${sig ?? `${nameBlock(c, t, p)}`}</div>
${
  t.footer
    ? `<div style="height:1px;line-height:1px;font-size:1px;background-color:${t.line};">&nbsp;</div>
<div style="padding:14px 0 0;font-family:${c.bodyFont};font-size:13px;line-height:1.6;color:${t.soft};">${esc(t.footer)}</div>`
    : ""
}
</div>`,
  );
}

/**
 * Postcard: a real photograph of the place across the top, the header under
 * it, sans text and the link as a button. Falls back to paper, and says so,
 * when the brand has no photograph to give it.
 */
function postcard(email, c, p, sig) {
  const t = tokens(c);
  if (isUnfilled(t.photoUrl))
    return `<!-- postcard: no photoUrl, rendered paper -->${paper(email, c, p, sig)}`;
  const s = {
    font: c.displayFont,
    size: 17,
    leadFont: c.displayFont,
    leadSize: 19,
    numeral: c.accent,
    link: (b) => button(c, t, b, c.bodyFont),
  };
  return shell(
    c,
    t,
    `<div style="background-color:${t.paper};">
<img src="${esc(t.photoUrl)}" width="${MAX_WIDTH}" alt="${esc(t.photoAlt)}" style="display:block;width:100%;max-width:${MAX_WIDTH}px;height:auto;border:0;">
<div style="text-align:center;padding:22px 24px 18px;background-color:${t.paper};">${header(c, t, Math.min(t.headerWidth, 300))}</div>
<div style="height:1px;line-height:1px;font-size:1px;background-color:${t.rule};margin:0 40px;">&nbsp;</div>
<div style="padding:28px ${side(34)} 8px;">${body(email, c, t, s)}</div>
<div style="padding:0 ${side(34)} 30px;">${sig ?? nameBlock(c, t, p)}</div>
</div>${footerLine(c, t, t.soft)}`,
  );
}

const RENDERERS = { set: setLetter, paper, masthead, postcard };

export const LETTERHEAD_VARIANTS = [
  {
    id: "set",
    label: "Same letter, set properly",
    note: "No header. Brand serif text, the signature carries the brand.",
  },
  {
    id: "paper",
    label: "Letterhead on paper",
    note: "Centered header on a paper sheet, brand rule, serif text, ruled link panel.",
  },
  {
    id: "masthead",
    label: "Masthead",
    note: "Printed-letterhead layout: header left, contact block right, full rule, open white page.",
  },
  {
    id: "postcard",
    label: "Postcard",
    note: "A band cropped from a real photograph of the place, header beneath, serif text, link as a button.",
  },
];

export const LETTERHEAD_IDS = LETTERHEAD_VARIANTS.map((v) => v.id);

/**
 * Render one email in one layout. `signatureHtml` is the sender's own signature
 * (their live Gmail one, or a brand-pack signature); without it the layout sets
 * the name, title and contact lines itself.
 */
export function renderLetterhead(variantId, config, person, email, signatureHtml) {
  const sig = signatureHtml == null ? signatureHtml : phoneSafe(signatureHtml);
  const override = config.overrides?.letterheads?.[variantId];
  if (override) return override(config, person, email, sig);
  const renderer = RENDERERS[variantId];
  if (!renderer) {
    throw new Error(
      `Unknown letterhead variant "${variantId}". Known: ${LETTERHEAD_IDS.join(", ")}`,
    );
  }
  return renderer(email, config, person, sig);
}

/**
 * A signature pasted from a live Gmail account, made unable to push a phone sideways without
 * changing how it looks on a wide screen: no line refuses to wrap, a divider drawn at a fixed
 * pixel width runs the width it is given, and a contact line may wrap after its separator dot
 * instead of running past the edge (the first iPhone SE is 320px wide).
 */
function phoneSafe(html) {
  return (
    String(html)
      .replace(/white-space:\s*nowrap;?/gi, "")
      // a width declaration only, never max-width or min-width, which already leave room
      .replace(/(<div\b[^>]*style="(?:[^"]*?;)?\s*)width:\s*(\d+(?:\.\d+)?)px/gi, (m, pre, px) =>
        Number(px) > 120 ? `${pre}width:100%` : m,
      )
      .replace(/(<span\b[^>]*>\s*(?:·|&middot;|&#183;)\s*<\/span>)(?!<wbr>)/gi, "$1<wbr>")
  );
}

/** The same email as plain text, the alternative part every letterhead ships with. */
export function letterheadPlainText(email, person) {
  const parts = email.blocks.map((b) => {
    if (b.type === "link" || b.type === "button")
      return [b.label, b.href, b.note].filter(Boolean).join("\n");
    if (b.type === "list")
      return [b.intro, ...b.items.map((x, i) => `${i + 1}) ${x}`)].filter(Boolean).join("\n\n");
    if (b.type === "figures")
      return [b.intro, ...b.rows.map(([l, a]) => `${l} ${a}`)].filter(Boolean).join("\n");
    if (b.type === "heading") return b.text.toUpperCase();
    if (b.type === "kpis")
      return b.tiles.map((k) => `${k.label}: ${k.value}${k.note ? ` (${k.note})` : ""}`).join("\n");
    if (b.type === "ledger")
      return b.rows
        .map((r) =>
          [`${r.label}: ${r.value}`, r.note, r.href && `${r.linkText ?? "View"}: ${r.href}`]
            .filter(Boolean)
            .join("\n"),
        )
        .join(b.rows.some((r) => r.href) ? "\n\n" : "\n");
    if (b.type === "links") return b.rows.map((r) => `${r.label}\n${r.href}`).join("\n\n");
    if (b.type === "table")
      return [b.intro, b.columns.join(" | "), ...b.rows.map((r) => r.join(" | ")), b.note]
        .filter(Boolean)
        .join("\n");
    if (b.type === "bars")
      return [b.intro, ...b.rows.map(([l, v, shown]) => `${l}: ${shown ?? v}`), b.note]
        .filter(Boolean)
        .join("\n");
    return b.text;
  });
  const sig = [person.name, person.title, person.phone, person.email].filter(Boolean).join("\n");
  return `${parts.join("\n\n")}\n${sig}\n`;
}

/** A whole html document around a rendered letterhead, light only. */
export function letterheadDocument(html, { subject = "", fontsHref } = {}) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">' +
    (fontsHref ? `<link href="${esc(fontsHref)}" rel="stylesheet">` : "") +
    `<title>${esc(subject)}</title></head><body style="margin:0;padding:0;">${html}</body></html>`
  );
}
