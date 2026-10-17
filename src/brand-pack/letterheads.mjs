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

const BREAK = "word-break:break-word;overflow-wrap:anywhere;";

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
    headerUrl: l.headerUrl,
    headerWidth: l.headerWidth ?? 240,
    headerAlt: l.headerAlt ?? c.wordmark,
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
  return email.blocks
    .map((b) => {
      switch (b.type) {
        case "p":
          return `<p style="${P}">${esc(b.text)}</p>`;
        case "lead":
          return `<p style="${P}font-family:${s.leadFont ?? s.font};font-size:${s.leadSize}px;line-height:1.45;">${esc(b.text)}</p>`;
        case "close":
          return `<p style="${P}margin-bottom:22px;">${esc(b.text)}</p>`;
        case "list": {
          const rows = b.items
            .map(
              (item, i) =>
                `<tr><td valign="top" style="width:34px;padding:10px 0;font-family:${s.font};font-size:${s.size}px;line-height:1.55;color:${s.numeral ?? c.accent};${s.listRule ? `border-bottom:1px solid ${t.line};` : ""}">${i + 1})</td><td style="padding:10px 0;font-family:${s.font};font-size:${s.size}px;line-height:1.55;color:${c.ink};${s.listRule ? `border-bottom:1px solid ${t.line};` : ""}">${esc(item)}</td></tr>`,
            )
            .join("");
          return `${b.intro ? `<p style="${P}margin-bottom:6px;">${esc(b.intro)}</p>` : ""}${table(rows, `margin:0 0 24px 0;${s.listRule ? `border-top:1px solid ${t.line};` : ""}`)}`;
        }
        case "link":
          return s.link(b);
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
    `<tr><td style="padding:0 0 8px 0;"><a href="${esc(b.href)}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:13px 22px;background-color:${c.ink};color:${t.paper};font-family:${c.bodyFont};font-size:15px;font-weight:600;letter-spacing:.02em;text-decoration:none;border-radius:3px;${BREAK}">${esc(b.button ?? b.href)}</a></td></tr>` +
      (b.button
        ? `<tr><td style="padding:0;font-family:${c.bodyFont};font-size:14px;line-height:1.5;color:${t.soft};${BREAK}"><a href="${esc(b.href)}" style="color:${t.soft};display:inline-block;padding:6px 0;">${esc(b.href)}</a></td></tr>`
        : "") +
      (b.note
        ? `<tr><td style="padding:8px 0 0 0;font-family:${c.bodyFont};font-size:15px;color:${c.ink};">${esc(b.note)}</td></tr>`
        : ""),
    "margin:4px 0 26px 0;",
  );

/**
 * A pasted signature made fit for a letterhead without changing a word: its
 * links get a tappable height, no text runs under 13px, nothing refuses to wrap
 * or holds a fixed width past a phone screen, and a tel: link
 * becomes plain text, since mail apps link phone numbers themselves and a call
 * link at the foot of a letter is not the business phone a reader hunts for.
 */
export function letterheadSignature(html) {
  return String(html)
    .replace(/<a\b[^>]*href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, "<span>$1</span>")
    .replace(
      /<a\b([^>]*?)style="([^"]*)"/gi,
      (m, pre, st) => `<a${pre}style="${st};display:inline-block;padding:10px 0"`,
    )
    .replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, (m, px) =>
      Number(px) < 13 ? "font-size:13px" : m,
    )
    .replace(/white-space:\s*nowrap;?/gi, "")
    .replace(/(<div\b[^>]*style="[^"]*?)width:\s*(\d+(?:\.\d+)?)px/gi, (m, pre, px) =>
      Number(px) > 120 ? `${pre}width:100%;max-width:${Math.round(Number(px))}px` : m,
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
  `<div style="background-color:${t.surround};padding:24px 12px;">${table(`<tr><td align="center" style="padding:0;">${table(`<tr><td style="padding:0;">${inner}</td></tr>`, `max-width:${MAX_WIDTH}px;`)}</td></tr>`)}</div>`;

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
      `<p style="margin:0 0 18px 0;font-family:${c.displayFont};font-size:17px;line-height:1.6;color:${c.ink};">${b.label ? `${esc(b.label)}<br>` : ""}<a href="${esc(b.href)}" style="color:${t.link};${BREAK}">${esc(b.href)}</a>${b.note ? `<br>${esc(b.note)}` : ""}</p>`,
  };
  return `<div style="background-color:#ffffff;padding:24px 20px;">${table(`<tr><td style="padding:0;">${body(email, c, t, s)}<div style="padding-top:6px;">${sig}</div></td></tr>`, `max-width:${MAX_WIDTH}px;`)}</div>`;
}

/** Paper: centered header on a paper sheet, a brand rule, serif text, ruled link panel. */
function paper(email, c, p, sig) {
  const t = tokens(c);
  const s = {
    font: c.displayFont,
    size: 18,
    leadSize: 20,
    listRule: true,
    link: (b) =>
      table(
        `<tr><td style="border-top:1px solid ${t.rule};border-bottom:1px solid ${t.rule};padding:20px 4px;text-align:center;">` +
          (b.label
            ? `<div style="font-family:${c.displayFont};font-size:17px;color:${t.soft};">${esc(b.label)}</div>`
            : "") +
          `<div style="font-family:${c.displayFont};font-size:19px;padding-top:8px;${BREAK}"><a href="${esc(b.href)}" style="color:${t.link};display:inline-block;padding:6px 0;">${esc(b.href)}</a></div>` +
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
<div style="height:1px;line-height:1px;font-size:1px;background-color:${t.rule};margin:0 40px;">&nbsp;</div>
<div style="padding:32px 34px 8px;">${body(email, c, t, s)}</div>
<div style="padding:0 34px 30px;">${sig ?? `<div style="text-align:center;">${nameBlock(c, t, p, "center")}<div style="padding-top:10px;text-align:center;line-height:1.8;">${contactLines(c, t, p, c.ink, c.bodyFont, 14)}</div></div>`}</div>
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
            ? `<div style="font-family:${c.bodyFont};font-size:15px;line-height:1.5;color:${t.soft};">${esc(b.label)}</div>`
            : "") +
          `<div style="font-family:${c.displayFont};font-size:19px;line-height:1.4;padding-top:6px;${BREAK}"><a href="${esc(b.href)}" style="color:${t.link};display:inline-block;padding:4px 0;">${esc(b.href)}</a></div>` +
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
${table(`<tr><td valign="middle" style="padding:8px 0 18px 0;">${header(c, t, Math.min(t.headerWidth, 300), "left")}</td>${t.mastheadContact ? `<td valign="middle" style="padding:8px 0 18px 16px;">${contact}</td>` : ""}</tr>`)}
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
<div style="padding:28px 34px 8px;">${body(email, c, t, s)}</div>
<div style="padding:0 34px 30px;">${sig ?? nameBlock(c, t, p)}</div>
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
  const override = config.overrides?.letterheads?.[variantId];
  if (override) return override(config, person, email, signatureHtml);
  const renderer = RENDERERS[variantId];
  if (!renderer) {
    throw new Error(
      `Unknown letterhead variant "${variantId}". Known: ${LETTERHEAD_IDS.join(", ")}`,
    );
  }
  return renderer(email, config, person, signatureHtml);
}

/** The same email as plain text, the alternative part every letterhead ships with. */
export function letterheadPlainText(email, person) {
  const parts = email.blocks.map((b) => {
    if (b.type === "link") return [b.label, b.href, b.note].filter(Boolean).join("\n");
    if (b.type === "list")
      return [b.intro, ...b.items.map((x, i) => `${i + 1}) ${x}`)].filter(Boolean).join("\n\n");
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
