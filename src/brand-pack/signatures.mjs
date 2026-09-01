/**
 * Five email signature layouts, rendered from the client's own brand tokens.
 *
 * These are EMAIL html, not web html. The rules that follow are the reason the
 * markup looks dated: nested presentation tables, inline styles only, no
 * stylesheet, no classes, no flex, no grid, no background images, no web fonts,
 * and never wider than 600px. Gmail, Outlook and Apple Mail each strip a
 * different subset of modern CSS, and a signature that relies on any of it
 * arrives broken in at least one of them.
 */

const MAX_WIDTH = 600;

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const T_OPEN = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:${MAX_WIDTH}px;">`;
const T_CLOSE = "</table>";

const tel = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;

const link = (href, text, color, font, size) =>
  `<a href="${esc(href)}" style="color:${color};text-decoration:none;font-family:${font};font-size:${size}px;">${esc(text)}</a>`;

const mark = (c, size) =>
  `<img src="${esc(c.markUrl)}" width="${size}" height="${size}" alt="${esc(c.markAlt)}" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;">`;

const dot = (c) => `<span style="color:${c.brand};font-size:11px;padding:0 7px;">&#183;</span>`;

const contactLine = (c, p) =>
  [
    link(tel(p.phone), p.phone, c.ink, c.bodyFont, 12),
    link(`mailto:${p.email}`, p.email, c.ink, c.bodyFont, 12),
    link(c.siteUrl, c.siteUrl.replace(/^https?:\/\//, ""), c.ink, c.bodyFont, 12),
  ].join(dot(c));

const nameBlock = (c, p) =>
  `<div style="font-family:${c.displayFont};font-size:18px;line-height:23px;color:${c.ink};font-weight:600;">${esc(p.name)}</div>` +
  `<div style="font-family:${c.bodyFont};font-size:10px;line-height:15px;color:${c.accent};text-transform:uppercase;letter-spacing:1.7px;font-weight:600;padding-top:3px;">${esc(p.title)}</div>` +
  `<div style="font-family:${c.displayFont};font-size:14px;line-height:19px;color:${c.ink};padding-top:4px;">${esc(c.wordmark)}</div>`;

const rule = (color, width) =>
  `<div style="width:${width};height:1px;background-color:${color};font-size:1px;line-height:1px;">&nbsp;</div>`;

function ruled(c, p) {
  return `${T_OPEN}
<tr><td style="padding:0;">${T_OPEN}
<tr>
  <td style="padding:0 16px 0 0;vertical-align:middle;">${mark(c, 64)}</td>
  <td style="padding:0 16px 0 0;vertical-align:middle;"><div style="width:1px;height:56px;background-color:${c.brand};font-size:1px;line-height:1px;">&nbsp;</div></td>
  <td style="padding:0;vertical-align:middle;">${nameBlock(c, p)}</td>
</tr>${T_CLOSE}</td></tr>
<tr><td style="padding:12px 0 0 0;">${rule(c.brand, "100%")}</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:17px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

function singleLine(c, p) {
  return `${T_OPEN}
<tr><td style="padding:0;font-family:${c.bodyFont};font-size:12px;line-height:18px;color:${c.ink};">
<span style="font-family:${c.displayFont};font-size:14px;color:${c.ink};font-weight:600;">${esc(p.name)}</span>${dot(c)}<span style="color:${c.accent};">${esc(p.title)}</span>${dot(c)}<span>${esc(c.wordmark)}</span>${dot(c)}${link(tel(p.phone), p.phone, c.ink, c.bodyFont, 12)}${dot(c)}${link(`mailto:${p.email}`, p.email, c.ink, c.bodyFont, 12)}
</td></tr>
${T_CLOSE}`;
}

function stacked(c, p) {
  return `${T_OPEN}
<tr><td style="padding:0 0 10px 0;">${mark(c, 56)}</td></tr>
<tr><td style="padding:0;">${nameBlock(c, p)}</td></tr>
<tr><td style="padding:10px 0 0 0;">${rule(c.brand, "72px")}</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:19px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

function twoColumn(c, p) {
  const right = p.link
    ? `<td style="padding:0 0 0 20px;vertical-align:middle;border-left:1px solid ${c.brand};white-space:nowrap;">${link(p.link.href, p.link.label, c.accent, c.bodyFont, 12)}</td>`
    : "";
  // The identity cell needs its own right padding whenever a link column
  // follows, or the wordmark runs into the divider. Email clients give a
  // border-left no gutter of its own.
  const identityPad = p.link ? "0 22px 0 0" : "0";
  return `${T_OPEN}
<tr><td style="padding:0;">${T_OPEN}
<tr>
  <td style="padding:0 18px 0 0;vertical-align:middle;">${mark(c, 48)}</td>
  <td style="padding:${identityPad};vertical-align:middle;">${nameBlock(c, p)}</td>
  ${right}
</tr>${T_CLOSE}</td></tr>
<tr><td style="padding:12px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:17px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

function tintedCard(c, p) {
  return `${T_OPEN}
<tr><td style="padding:18px 22px;background-color:${c.ink};">${T_OPEN}
<tr>
  <td style="padding:0 16px 0 0;vertical-align:middle;">${mark(c, 44)}</td>
  <td style="padding:0;vertical-align:middle;">
    <div style="font-family:${c.displayFont};font-size:17px;line-height:22px;color:${c.ground};font-weight:600;">${esc(p.name)}</div>
    <div style="font-family:${c.bodyFont};font-size:10px;line-height:15px;color:${c.brand};text-transform:uppercase;letter-spacing:1.7px;font-weight:600;padding-top:3px;">${esc(p.title)}</div>
  </td>
</tr>${T_CLOSE}</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:17px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

const RENDERERS = {
  ruled,
  "single-line": singleLine,
  stacked,
  "two-column": twoColumn,
  "tinted-card": tintedCard,
};

export const SIGNATURE_VARIANTS = [
  {
    id: "ruled",
    label: "Ruled letterhead",
    note: "Mark left, brand rule, identity stacked right, contact line under a hairline.",
  },
  {
    id: "single-line",
    label: "Single line",
    note: "One typographic line, no logo. The smallest footprint in a long reply chain.",
  },
  {
    id: "stacked",
    label: "Stacked lockup",
    note: "Mark above the name, for a brand whose mark carries the recognition.",
  },
  {
    id: "two-column",
    label: "Two column",
    note: "A brand rule between the identity and a booking or inquiry link.",
  },
  {
    id: "tinted-card",
    label: "Tinted card",
    note: "The identity reversed out of a brand-colored block, contact line beneath.",
  },
];

export const SIGNATURE_IDS = SIGNATURE_VARIANTS.map((v) => v.id);

export function renderSignature(variantId, config, person) {
  const override = config.overrides?.signatures?.[variantId];
  if (override) return override(config, person);
  const renderer = RENDERERS[variantId];
  if (!renderer) {
    throw new Error(`Unknown signature variant "${variantId}". Known: ${SIGNATURE_IDS.join(", ")}`);
  }
  return renderer(config, person);
}
