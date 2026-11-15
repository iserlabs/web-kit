// GENERATED from the sign-kit src/lib/signer-email-core.ts (the Specimen). Do not edit by hand:
// change the kit's file and run `pnpm emails:vendor-webkit <this repo>` in the kit.
// kit-core-sha256: 7ab0275694fa3cfd0da9266141b7a199cdc9974565b7f5004f7a1ad8ce91b1ac (kit commit 2c0a8fc when generated)
/**
 * The Specimen: the ONE email design for every signing and form email across Jake's businesses
 * (picked by Jake on the round 2 board, 2026-11-14, over the Track, which was rejected).
 *
 * This file imports nothing. It holds the whole design and three ways to describe a message to it:
 *
 * - renderSignerEmail(EmailModel)   the confirmation a signer gets after signing (waiting or complete)
 * - renderOperatorEmail(OperatorModel)  the alert the business inbox gets when someone signs
 * - renderReceiptEmail(ReceiptModel)    the receipt for a form (a sheet of what was received)
 *
 * All three build a SpecimenModel and call renderSpecimen(), the layout itself. Sites that cannot
 * depend on the kit keep a byte-for-byte copy (`pnpm emails:vendor <site repo>`); the web-kit mail
 * framework gets the same layout as a generated module (`pnpm emails:vendor-webkit <web-kit repo>`),
 * so there is one design and one place to change it.
 *
 * The design: a tinted ground with the business's real logo centered at the top, one large sentence
 * saying what happened, one full-width button, then the thing itself drawn as a sheet of paper (its
 * title, its terms, and one signature line per party: a signed name sits on its line, an unsigned
 * one shows "Signature needed"), a quiet footer. No colored header band and no step track.
 *
 * Mechanics, chosen for the inboxes that actually exist:
 * - tables and inline styles; one small <style> for light-only and phone sizes (a progressive
 *   extra: the email is complete without it)
 * - 600px maximum, fluid under that; body copy 16px or more, nothing under 13px
 * - every painted cell carries BOTH bgcolor and style, so Outlook's Word engine keeps the colors
 * - web font first with a deliberate system fallback (Iowan Old Style, Charter, Georgia; Helvetica
 *   Neue, Arial), never a Times New Roman fallback
 * - the logo is a hosted image with alt text and its own background painted in; the wordmark is
 *   live text when there is no logo, so images off still shows the name
 * - the button is a plain link in every client with a VML twin for Outlook
 * - the page declares itself light-only and switches off phone auto-linking
 * - the preview line is a hidden preheader, padded so body text cannot follow it into the list
 * - "book a call" is an inline text link in the footer, never a button
 * - a plain-text twin is always built, so no send ever goes out html-only
 *
 * No phone number appears anywhere on these emails. Contact is the reply.
 */
export function esc(s) {
    return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}
/** "A", "A and B", "A, B and C". */
export function joinNames(names) {
    if (names.length <= 1)
        return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
/** Roles read once each: ["owner", "owner", "manager"] becomes "owner and manager". */
function uniqueRoles(waiting) {
    const seen = [];
    for (const w of waiting) {
        const r = (w.role ?? "").toLowerCase();
        if (r && !seen.includes(r))
            seen.push(r);
    }
    return joinNames(seen);
}
/** Keeps "6:59 PM MST" on one line so a receipt never breaks as "6:59 / PM MST". */
export function keepTogether(s) {
    return s.replace(/(\d{1,2}:\d{2}) (AM|PM)( [A-Z]{2,5})?/g, (_m, t, ap, z) => `${t}\u00a0${ap}${z ? `\u00a0${z.trim()}` : ""}`);
}
function plain(s) {
    return s.replace(/\u00a0/g, " ");
}
/* ------------------------------------------------------------- contrast -- */
function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m)
        return null;
    let h = m[1];
    if (h.length === 3)
        h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function isHex(v) {
    return typeof v === "string" && hexToRgb(v) !== null;
}
function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return 0;
    const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two hex colors. */
export function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}
/** The first candidate that reads at 4.5:1 on the background, else the last. */
export function readable(bg, ...candidates) {
    const usable = candidates.filter(isHex);
    return usable.find((c) => contrast(c, bg) >= 4.5) ?? usable[usable.length - 1] ?? "#000000";
}
function mix(a, b, t) {
    const A = hexToRgb(a) ?? [0, 0, 0];
    const B = hexToRgb(b) ?? [255, 255, 255];
    return `#${A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
}
export const FALLBACK = {
    paper: "#fbf8f1",
    ground: "#f3ede1",
    ink: "#1b1a16",
    muted: "#6b6455",
    rule: "#e5dac4",
    band: "#1b1a16",
};
/**
 * Every pair the email paints is checked here, not assumed: ink and muted on the paper, the deep
 * color against the paper it must carry as the button, the button's text and the accent. A token
 * that would fail 4.5:1 is replaced by one that passes rather than shipped unreadable.
 */
export function makePalette(t) {
    const paper = t.paper;
    const ink = readable(paper, t.ink, FALLBACK.ink);
    const muted = readable(paper, t.muted, FALLBACK.muted, ink);
    const bandWanted = isHex(t.band) ? t.band : FALLBACK.band;
    const band = contrast(paper, bandWanted) >= 4.5 ? bandWanted : ink;
    const bandText = readable(band, t.bandText, paper, "#ffffff");
    const bandAccent = isHex(t.accent) ? t.accent : readable(band, bandText);
    return { paper, ground: t.ground, ink, muted, rule: t.rule, band, bandText, bandAccent };
}
/* ----------------------------------------------------------- type stacks -- */
export const SANS_STACK = "'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";
export const SERIF_NEWSREADER = "Newsreader,'Iowan Old Style',Charter,Georgia,serif";
export const SERIF_GARAMOND = "'EB Garamond',Garamond,'Iowan Old Style',Charter,Georgia,serif";
export const WORDMARK_CINZEL = "Cinzel,'Trajan Pro',Georgia,serif";
export const FONTS_NEWSREADER = "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Instrument+Sans:wght@400;500;600;700&display=swap";
export const FONTS_GARAMOND = "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap";
/** The default faces: Newsreader and Instrument Sans with the deliberate fallbacks. */
export const DEFAULT_FACES = { serif: SERIF_NEWSREADER, sans: SANS_STACK, wordmark: SERIF_NEWSREADER };
/** A stack must never fall to Times New Roman: strip it and make sure Georgia is the serif floor. */
function stack(s, generic) {
    const cleaned = s
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p && !/^'?times new roman'?$/i.test(p) && p !== "serif" && p !== "sans-serif");
    if (generic === "serif" && !cleaned.some((p) => /georgia/i.test(p)))
        cleaned.push("Georgia");
    if (generic === "sans-serif" && !cleaned.some((p) => /arial|helvetica/i.test(p)))
        cleaned.push("Arial");
    return `${cleaned.join(",")},${generic}`;
}
/* --------------------------------------------------------------- layout -- */
const PAD = "&zwnj;&nbsp;".repeat(90);
const T = (inner, attrs = "") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;
const gap = (h) => `<div style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div>`;
const sp = (h) => `<tr><td height="${h}" style="height:${h}px;font-size:1px;line-height:${h}px">&nbsp;</td></tr>`;
function colors(p) {
    const tint = mix(p.bandAccent, p.paper, 0.14);
    return {
        paper: p.paper,
        ground: p.ground,
        ink: p.ink,
        muted: p.muted,
        mutedOnGround: readable(p.ground, p.muted, p.ink),
        rule: p.rule,
        deep: p.band,
        onDeep: p.bandText,
        gold: p.bandAccent,
        accent: readable(tint, p.band, p.ink),
        tint,
        tint2: mix(p.bandAccent, p.paper, 0.3),
    };
}
/** `[label](https://url)` becomes an inline link; everything else is escaped. */
function inline(text, link) {
    return esc(text).replace(/\[([^\]]+)\]\((https:[^)]+)\)/g, (_m, l, u) => `<a href="${u}" style="color:${link};text-decoration:underline;text-underline-offset:3px">${l}</a>`);
}
function stripLinks(text) {
    const urls = [];
    const t = text.replace(/\[([^\]]+)\]\((https:[^)]+)\)/g, (_m, l, u) => {
        urls.push(u);
        return /^[^\s]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(l) ? u : `${l}: ${u}`;
    });
    return { text: t, urls };
}
function button(href, label, c, sans) {
    const safe = esc(href);
    return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safe}" style="height:56px;v-text-anchor:middle;width:544px" arcsize="10%" fillcolor="${c.deep}" stroke="f"><w:anchorlock/><center style="color:${c.onDeep};font-family:Arial,sans-serif;font-size:17px;font-weight:bold">${esc(label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${c.deep}" style="background:${c.deep};border-radius:6px"><a href="${safe}" style="display:block;height:56px;line-height:56px;padding:0 28px;font-family:${sans};font-size:17px;font-weight:600;color:${c.onDeep};text-align:center;text-decoration:none">${esc(label)}</a></td></tr></table><!--<![endif]-->`;
}
function para(t, c, font, o) {
    if (!t)
        return "";
    return `<p style="margin:${o.mt ?? 0}px 0 0;font-family:${font};font-size:${o.size ?? 17}px;line-height:${o.lh ?? 26}px;color:${o.color};text-align:${o.align ?? "left"};word-wrap:break-word">${inline(t, o.link ?? c.accent)}</p>`;
}
/** The layout itself: the one place the Specimen is drawn. Pure: no network, clock or environment. */
export function renderSpecimen(m) {
    const c = colors(m.palette);
    const serif = stack(m.faces.serif, "serif");
    const sans = stack(m.faces.sans, "sans-serif");
    const wordmarkFont = stack(m.faces.wordmark, "serif");
    const sheet = m.sheet;
    const wordmark = `<span style="font-family:${wordmarkFont};font-size:15px;line-height:21px;letter-spacing:.14em;text-transform:uppercase;color:${c.ink}">${esc(m.brandName)}</span>`;
    const img = (l, w) => {
        const h = Math.round((w * l.height) / l.width);
        return `<img src="${esc(l.src)}" width="${w}" height="${h}" alt="${esc(l.alt)}" bgcolor="${c.ground}" style="display:block;width:${w}px;max-width:100%;height:auto;border:0;margin:0 auto;background:${c.ground};font-family:${serif};font-size:18px;line-height:24px;color:${c.ink}">`;
    };
    let head;
    if (m.logo?.markOnly) {
        head = `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">${img(m.logo, 64)}</td></tr><tr><td align="center" style="padding-top:12px">${wordmark}</td></tr></table>`;
    }
    else if (m.logo) {
        head = `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">${img(m.logo, Math.min(m.logo.width, 210))}</td></tr></table>`;
    }
    else {
        head = `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">${wordmark}</td></tr></table>`;
    }
    const rows = sheet.rows
        .map((r) => `<tr><td valign="top" width="34%" style="padding:11px 12px 11px 0;border-top:1px solid ${c.rule};font-family:${sans};font-size:14px;line-height:21px;color:${c.muted}">${esc(r.label)}</td><td valign="top" style="padding:11px 0;border-top:1px solid ${c.rule};font-family:${serif};font-size:17px;line-height:24px;color:${c.ink};word-wrap:break-word">${esc(r.value)}</td></tr>`)
        .concat(sheet.reference
        ? [
            `<tr><td valign="top" width="34%" style="padding:11px 12px 11px 0;border-top:1px solid ${c.rule};font-family:${sans};font-size:14px;line-height:21px;color:${c.muted}">${esc(sheet.reference.label)}</td><td valign="top" style="padding:11px 0;border-top:1px solid ${c.rule};font-family:${sans};font-size:16px;line-height:24px;letter-spacing:.04em;color:${c.ink};word-wrap:break-word">${esc(sheet.reference.value)}</td></tr>`,
        ]
        : [])
        .join("");
    const sigs = (sheet.signatures ?? [])
        .map((p) => {
        const role = p.role ? `, ${esc(p.role)}` : "";
        return `${sp(22)}<tr><td colspan="2" style="padding:0 0 4px;font-family:${serif};font-style:italic;font-size:${p.signed ? 28 : 17}px;line-height:34px;color:${p.signed ? c.deep : c.muted}">${p.signed ? esc(p.name) : "Signature needed"}</td></tr>
<tr><td colspan="2" height="1" style="height:1px;font-size:1px;line-height:1px;border-top:1px ${p.signed ? "solid" : "dashed"} ${p.signed ? c.ink : "#8a8678"}">&nbsp;</td></tr>
<tr><td colspan="2" style="padding:6px 0 0;font-family:${sans};font-size:13px;line-height:19px;color:${c.muted}">${esc(p.name)}${role}. ${p.signed ? (p.when ? `Signed ${esc(keepTogether(p.when))}` : "Signed") : "Has not signed yet"}</td></tr>`;
    })
        .join("");
    const stamp = `<table role="presentation" align="right" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${c.tint}" style="background:${c.tint};border-radius:4px;padding:5px 10px;font-family:${sans};font-size:13px;line-height:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${c.accent};white-space:nowrap">${esc(m.status)}</td></tr></table>`;
    const sheetHtml = `${T(`<tr><td class="px" bgcolor="${c.paper}" style="background:${c.paper};border:1px solid ${c.tint2};padding:30px 32px 30px">
${T(`<tr><td valign="top" class="dt" style="font-family:${serif};font-size:26px;line-height:32px;color:${c.ink}">${esc(sheet.title)}</td><td valign="top" align="right" width="116">${stamp}</td></tr>${sheet.place ? `<tr><td colspan="2" style="padding:4px 0 0;font-family:${sans};font-size:15px;line-height:22px;color:${c.muted}">${sheet.place.split("\n").map(esc).join("<br>")}</td></tr>` : ""}${sheet.caption ? `<tr><td colspan="2" style="padding:4px 0 0;font-family:${sans};font-size:15px;line-height:22px;color:${c.muted}">${esc(sheet.caption)}</td></tr>` : ""}${sp(18)}`)}
${rows ? T(rows, 'style="border-collapse:collapse"') : ""}
${sheet.signatures?.length ? T(sigs) : ""}
</td></tr>`)}${["96", "92"]
        .map((w) => T(`<tr><td align="center" style="padding:0">${T(`<tr><td width="${w}%" height="5" bgcolor="${c.paper}" style="width:${w}%;height:5px;font-size:1px;line-height:1px;background:${c.paper};border:1px solid ${c.tint2};border-top:0">&nbsp;</td></tr>`, `align="center" style="width:${w}%"`)}</td></tr>`))
        .join("")}`;
    const body = T(`<tr><td class="px" bgcolor="${c.ground}" style="background:${c.ground};padding:40px 28px 36px;border-top:4px solid ${c.gold}">
${head}
<h1 class="h1" style="margin:30px 0 0;font-family:${serif};font-size:34px;line-height:40px;font-weight:400;color:${c.ink};text-align:center">${esc(m.headline)}</h1>
${m.lead.map((t, i) => para(t, c, sans, { color: c.mutedOnGround, align: "center", mt: i ? 10 : 12 })).join("")}
${m.button ? `${gap(24)}${button(m.button.url, m.button.label, c, sans)}` : ""}
${gap(28)}
${sheetHtml}
${(m.attach ?? []).map((t, i) => para(t, c, sans, { size: 14, lh: 21, color: c.mutedOnGround, align: "center", mt: i ? 4 : 18 })).join("")}
${(m.after ?? []).map((t) => para(t, c, sans, { color: c.ink, align: "center", mt: 26 })).join("")}
${m.signoff ? `<p style="margin:14px 0 0;text-align:center;font-family:${serif};font-style:italic;font-size:26px;line-height:32px;color:${c.deep}">${esc(m.signoff.name)}</p>${para(m.signoff.title, c, sans, { size: 14, lh: 20, color: c.mutedOnGround, align: "center" })}` : ""}
${gap(30)}
${para(m.footer.reply, c, sans, { size: 14, lh: 22, color: c.mutedOnGround, align: "center" })}
${para(m.footer.fine, c, sans, { size: 13, lh: 20, color: c.mutedOnGround, align: "center", mt: 6 })}
${para(m.footer.legal, c, sans, { size: 13, lh: 20, color: c.mutedOnGround, align: "center", mt: 6 })}
</td></tr>`);
    const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--><title>${esc(m.subject)}</title>${m.fontsHref ? `<link href="${esc(m.fontsHref)}" rel="stylesheet">` : ""}
<style>:root{color-scheme:light only;supported-color-schemes:light}body{margin:0;padding:0;-webkit-text-size-adjust:100%;text-size-adjust:100%}img{-ms-interpolation-mode:bicubic}@media (max-width:480px){.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:28px!important;line-height:34px!important}.dt{font-size:22px!important;line-height:28px!important}}</style></head>
<body style="margin:0;padding:0;background:${c.ground}" bgcolor="${c.ground}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:13px;line-height:13px;color:${c.ground};mso-hide:all">${esc(m.preheader)}${PAD}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.ground}" style="background:${c.ground}"><tr><td align="center" style="padding:0">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<div style="max-width:600px;margin:0 auto;text-align:left">${body}</div>
<!--[if mso]></td></tr></table><![endif]--></td></tr></table>
</body></html>`;
    const lines = [m.headline, ""];
    for (const t of m.lead)
        lines.push(stripLinks(t).text);
    if (m.button)
        lines.push("", `${m.button.label}: ${m.button.url}`);
    for (const t of m.attach ?? [])
        lines.push(t);
    lines.push("", sheet.title);
    if (sheet.place)
        lines.push(sheet.place);
    if (sheet.caption)
        lines.push(sheet.caption);
    for (const r of sheet.rows)
        lines.push(`${r.label}: ${r.value}`);
    if (sheet.reference)
        lines.push(`${sheet.reference.label}: ${sheet.reference.value}`);
    if (sheet.signatures?.length) {
        lines.push("");
        for (const p of sheet.signatures)
            lines.push(`${p.name}${p.role ? `, ${p.role}` : ""}: ${p.signed ? `signed${p.when ? ` ${plain(p.when)}` : ""}` : "has not signed yet"}`);
    }
    for (const t of m.after ?? [])
        lines.push("", stripLinks(t).text);
    if (m.signoff)
        lines.push("", m.signoff.name, ...(m.signoff.title ? [m.signoff.title] : []));
    lines.push("");
    if (m.footer.reply)
        lines.push(stripLinks(m.footer.reply).text);
    if (m.footer.fine)
        lines.push(m.footer.fine);
    lines.push(m.footer.legal);
    return { subject: m.subject, html, text: lines.join("\n") };
}
/* ----------------------------------------------------------- subject -- */
/** "November 11, 2026, 6:59 PM MST" or "November 11, 2026 at 6:59:12 PM MST" to "November 11, 2026". */
export function signedDay(signedWhen) {
    const m = /^([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(signedWhen.trim());
    return m ? m[1] : "";
}
/**
 * The subject, built to be found by search and skimmed in a list (Jake, 2026-11-14):
 * who or where, then the document, then what happened and the day it happened.
 *
 *   309 Cranbrook Circle | Management Agreement | Signed by Michael Williams, November 11, 2026
 *   309 Cranbrook Circle | Management Agreement | Fully signed, November 11, 2026
 */
export function subjectFor(m) {
    const day = signedDay(m.signedWhen);
    const what = m.waiting.length === 0 ? "Fully signed" : `Signed by ${m.signedBy}`;
    return `${m.subjectPlace ? `${m.subjectPlace} | ` : ""}${m.docTitle} | ${what}${day ? `, ${day}` : ""}`;
}
const FOOTER_REPLY = (brand, bookUrl) => `Reply to this email and it reaches ${brand}. Or [book a call](${bookUrl}).`;
/* ----------------------------------------------- the signer's email -- */
/**
 * The confirmation a signer gets after signing. Pure: no network, no clock, no environment, so it
 * can be rendered to a file and read before anything is ever sent.
 */
export function renderSignerEmail(m) {
    const complete = m.waiting.length === 0;
    const names = joinNames(m.waiting.map((w) => w.name));
    const verb = m.waiting.length > 1 ? "need" : "needs";
    const roles = uniqueRoles(m.waiting);
    const place = Array.isArray(m.place) ? m.place : [m.place];
    const subject = subjectFor(m);
    const when = m.signedWhen ? keepTogether(m.signedWhen) : "";
    const lead = [];
    if (complete) {
        lead.push(m.completeDetail || "Every party has signed.");
        if (m.nextStep)
            lead.push(`${m.nextStep.what}: ${m.nextStep.when}.`);
    }
    else {
        // A role reads well here only when it is a short title ("manager"). A long legal capacity
        // garbles once lowercased and joined, so it falls back to a plain sentence.
        const shortRoles = roles && m.waiting.every((w) => !(w.role ?? "").includes(",") && (w.role ?? "").trim().split(/\s+/).length <= 3);
        lead.push(shortRoles
            ? `The ${roles} still ${verb} to sign, so the agreement is not complete yet.`
            : `${names} still ${verb} to sign, so the agreement is not complete yet.`);
        lead.push(m.completion.detail);
    }
    const signatures = [
        ...(m.others ?? []).map((o) => ({ name: o.name, role: o.role, signed: true, when: o.when })),
        { name: m.signedBy, role: m.signedRole, signed: true, when },
        ...m.waiting.map((w) => ({ name: w.name, role: w.role, signed: false })),
    ];
    // The signer sits first on the sheet.
    signatures.sort((a, b) => (a.name === m.signedBy ? -1 : b.name === m.signedBy ? 1 : 0));
    const fine = [...(m.fineprint ?? []), "Keep this email for your records."].join(" ");
    const sm = {
        subject,
        preheader: complete
            ? `Your ${m.docTitle} with ${m.brandName} is signed and complete.`
            : `${names} still ${verb} to sign. ${m.completion.title}.`,
        palette: m.palette,
        faces: m.faces,
        fontsHref: m.fontsHref,
        brandName: m.brandName,
        logo: m.logo ?? (m.mark ? { src: m.mark.src, width: 256, height: 256, alt: m.brandName, markOnly: true } : undefined),
        headline: complete ? "Your agreement is signed and complete." : "Your signature is recorded.",
        lead,
        status: complete ? "Complete" : `Signed ${signatures.filter((s) => s.signed).length} of ${signatures.length}`,
        button: m.button ? { url: m.button.url, label: complete ? "Open your signed copy" : "Open your copy" } : undefined,
        attach: m.note,
        sheet: {
            title: m.docTitle,
            place: place.join("\n"),
            rows: m.terms.map((t) => ({ label: t.label, value: Array.isArray(t.value) ? t.value.join("; ") : t.value })),
            signatures,
        },
        footer: { reply: FOOTER_REPLY(m.brandName, m.bookUrl), fine, legal: m.legalLine },
    };
    return renderSpecimen(sm);
}
/** The alert the business inbox gets when someone signs: who, when, what is left, the record. */
export function renderOperatorEmail(m) {
    const complete = m.waiting.length === 0;
    const subject = subjectFor({ waiting: m.waiting, subjectPlace: m.subjectPlace, docTitle: m.docTitle, signedBy: m.signedBy, signedWhen: m.signedWhen });
    const names = joinNames(m.waiting.map((w) => w.name));
    const verb = m.waiting.length > 1 ? "have" : "has";
    const sm = {
        subject,
        preheader: complete ? `${m.signedBy} signed. The agreement is complete.` : `${m.signedBy} signed. ${names} ${verb} not signed yet.`,
        palette: m.palette,
        faces: m.faces,
        fontsHref: m.fontsHref,
        brandName: m.brandName,
        logo: m.logo,
        headline: complete ? `${m.signedBy} signed. It is complete.` : `${m.signedBy} signed.`,
        lead: [complete ? "Every party has signed. The executed agreement is attached." : `${names} ${verb} not signed yet.`],
        status: complete ? "Complete" : "Waiting",
        button: m.button ? { url: m.button.url, label: m.button.label ?? "Open the signed agreement" } : undefined,
        attach: m.note,
        sheet: {
            title: "Signature record",
            place: m.place,
            rows: m.record.map((t) => ({ label: t.label, value: Array.isArray(t.value) ? t.value.join("; ") : t.value })),
            signatures: [
                { name: m.signedBy, signed: true, when: keepTogether(m.signedWhen) },
                ...m.waiting.map((w) => ({ name: w.name, role: w.role, signed: false })),
            ],
        },
        footer: { reply: "Sent to the business inbox when someone signs.", legal: m.legalLine },
    };
    return renderSpecimen(sm);
}
/** The receipt for a form: a sheet of what was received and the reference. No signature lines. */
export function renderReceiptEmail(m) {
    return renderSpecimen({
        subject: m.subject,
        preheader: m.lead.find((l) => !/^(hello|hi|dear)\b/i.test(l)) ?? m.headline,
        palette: m.palette,
        faces: m.faces,
        fontsHref: m.fontsHref,
        brandName: m.brandName,
        logo: m.logo,
        headline: m.headline,
        lead: m.lead,
        status: m.status ?? "Received",
        sheet: { title: m.sheetTitle, caption: m.caption, rows: m.received, reference: m.reference },
        after: m.after,
        signoff: m.signoff,
        footer: { legal: m.legalLine },
    });
}
/* ------------------------------------------------------------------ lint -- */
const EM_DASH = String.fromCharCode(8212);
/**
 * The cheap checks, as a list of problems (empty means clean). Pure string work, a few milliseconds
 * per email, so every state of every agreement can be checked on each test run. It does not
 * replace looking at a render; it catches what a change to the markup or the copy would silently
 * break.
 */
export function lintSignerEmail(m) {
    const { subject, html, text } = m;
    const problems = [];
    const bad = (cond, msg) => {
        if (cond)
            problems.push(msg);
    };
    const visible = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!doctype html>/i, "");
    const body = visible.replace(/<head>[\s\S]*?<\/head>/i, "");
    const sizes = [...body.replace(/<td[^>]*>&nbsp;<\/td>/g, "").matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1])).filter((n) => n > 2);
    bad(html.length > 90000, `html is ${html.length} bytes; Gmail clips at about 102,000`);
    bad(Math.min(...sizes) < 13, `a font size under 13px (${Math.min(...sizes)})`);
    bad(subject.length === 0 || subject.length > 200, `subject length ${subject.length}`);
    bad(!/^[^|]+ \| [^|]+ \| .+$/.test(subject) && !/^[^|]+ \| .+$/.test(subject), "subject is not Place | Document | what happened");
    bad((html + text + subject).includes(EM_DASH), "an em dash");
    bad(/!/.test(`${body.replace(/<[^>]+>/g, "")}${text}${subject}`), "an exclamation mark");
    bad(/tel:|\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/.test(body + text), "a phone number or tel: link");
    bad(/<script\b/i.test(html), "a <script>");
    bad(/prefers-color-scheme\s*:\s*dark/i.test(html), "a dark-mode style");
    bad(/Times New Roman/i.test(html), "a Times New Roman fallback");
    bad(!/name="format-detection"/.test(html), "phone auto-linking is not switched off");
    bad(!/content="light only"/.test(html), "the page does not declare itself light-only");
    bad((html.match(/&zwnj;&nbsp;/g)?.length ?? 0) < 60, "the preheader is not padded");
    bad(/<img\b(?![^>]*\balt=)/.test(html), "an image with no alt attribute");
    bad(/<img\b[^>]*\balt=""/.test(html), "an image with empty alt text");
    bad(/\d{1,2}:\d{2} (AM|PM)/.test(body), "a time that can break across lines");
    bad(/\d{1,2}:\d{2}:\d{2}/.test(body + text), "a time with seconds");
    const bare = [...body.matchAll(/<(\w+)\b([^>]*style="[^"]*background:[^"]*"[^>]*)>/g)].filter(([, tag, attrs]) => !["a", "img", "div"].includes(tag) && !/bgcolor=/.test(attrs));
    bad(bare.length > 0, `a painted background with no bgcolor on <${bare[0]?.[1]}>`);
    const buttons = body.match(/height:56px;line-height:56px/g)?.length ?? 0;
    bad(buttons > 1, `${buttons} buttons`);
    bad(/book a call<\/a>/.test(body) && !/Or <a [^>]*>book a call<\/a>\./.test(body), "book a call is not an inline link");
    bad(/<a [^>]*href="(?!https:\/\/)[^"]*"/.test(body), "a link that is not https");
    bad(text.trim().length < 80, "the plain-text part is missing or empty");
    bad(/<[a-z][^>]*>|&nbsp;|&amp;|\u00a0/.test(text), "markup or a non-breaking space leaked into the plain text");
    bad(/>undefined<|\[object Object\]|NaN/.test(body + text), "an undefined value leaked into the email");
    return problems;
}
