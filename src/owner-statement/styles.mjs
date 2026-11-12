/**
 * The statement's CSS: phone first (390), a wider sheet from 600, and a print sheet for letter
 * paper. Every rule sits under `.os`, so it cannot leak into the site around it. The one thing a
 * stylesheet cannot scope is `@page`, so the page rule belongs to a named page (`page: os`) that
 * only the statement uses.
 */

/** A string safe to put between double quotes in a CSS `content` value. */
export function cssString(text) {
  return String(text)
    .replace(/[\\"]/g, "\\$&")
    .replace(/[\n\r]/g, " ")
    .replace(/</g, "\\3C ");
}

export function statementCss(tokens, stacks, { footer }) {
  const stripe = tokens.stripe
    ? `
.os__stripe{border-left:6px solid var(--os-gold)}`
    : "";
  return `
.os{--os-paper:${tokens.paper};--os-ground:${tokens.ground};--os-ink:${tokens.ink};--os-soft:${tokens.soft};--os-accent:${tokens.accent};--os-gold:${tokens.gold};--os-rule:${tokens.rule};--os-tint:${tokens.tint};--os-display:${stacks.display};--os-text:${stacks.text};--os-figures:${stacks.figures};--os-logo-h:${tokens.logoHeight}px;
 color-scheme: light;background:var(--os-ground);color:var(--os-ink);font:400 1rem/1.55 var(--os-text);font-variant-numeric:lining-nums;-webkit-text-size-adjust:100%;text-size-adjust:100%;page:os;padding:0}
.os *,.os *::before,.os *::after{box-sizing:border-box}
.os a{color:var(--os-accent);text-underline-offset:.15em}
.os a:focus-visible,.os summary:focus-visible{outline:3px solid var(--os-accent);outline-offset:2px}
.os p,.os h1,.os h2,.os h3,.os ol,.os ul{margin:0;padding:0}
.os ol,.os ul{list-style:none}
.os__sheet{position:relative;background:var(--os-paper);max-width:760px;margin:0 auto;padding:28px 18px 32px}${stripe}
.os__mast{text-align:center;border-bottom:1px solid var(--os-rule);padding-bottom:18px}
.os__logo{display:block;margin:0 auto;height:var(--os-logo-h);width:auto;max-width:100%}
.os__cap{font:500 .875rem/1.4 var(--os-text);letter-spacing:.16em;text-transform:uppercase;color:var(--os-accent)}
.os__mast .os__cap{margin-top:14px}
.os__month{margin:4px 0 6px;font:400 clamp(2rem,1.6rem + 1.6vw,2.8rem)/1.1 var(--os-display);color:var(--os-ink)}
.os__prop{margin-top:8px;color:var(--os-soft)}
.os__lead{text-align:center;padding:26px 0 22px;border-bottom:1px solid var(--os-rule)}
.os__lead .os__cap{margin-bottom:2px}
.os__big{margin-top:6px;font:500 clamp(2.4rem,1.8rem + 2.4vw,3.6rem)/1.05 var(--os-display);color:var(--os-ink)}
.os__line{margin-top:10px;color:var(--os-soft)}
.os__actions{margin-top:18px}
.os__btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;background:var(--os-ink);color:var(--os-paper);font-weight:600;text-decoration:none}
.os a.os__btn{color:var(--os-paper)}
.os__h{margin:30px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--os-rule)}
.os__num{font-family:var(--os-figures);font-variant-numeric:tabular-nums lining-nums;text-align:right;white-space:nowrap}
.os--palisade .os__num{font-size:.92em}
.os__colhead{display:grid;grid-template-columns:minmax(0,1fr) 5.6rem;column-gap:10px;font-size:.875rem;color:var(--os-soft);padding:0 0 4px}
.os__colhead span{text-align:right}
.os__colhead--ytd{grid-template-columns:minmax(0,1fr) 5.2rem 5.2rem}
.os__rows li{display:grid;grid-template-columns:minmax(0,1fr) 5.6rem;column-gap:10px;align-items:baseline;padding:8px 0}
.os__rows--ytd li{grid-template-columns:minmax(0,1fr) 5.2rem 5.2rem}
.os__lb{display:flex;align-items:baseline;gap:8px;min-width:0}
.os__rows li .os__lb::before{content:"";flex:none;width:0;height:0;border-left:6px solid var(--os-gold);border-top:4px solid transparent;border-bottom:4px solid transparent;transform:translateY(-1px)}
.os__dots{flex:1 1 auto;min-width:12px;border-bottom:2px dotted var(--os-rule);transform:translateY(-4px)}
.os__y{color:var(--os-soft)}
.os__row--subtotal,.os__row--balance{font-weight:600}
.os__rows .os__row--moves{font-weight:700;border-top:2px solid var(--os-ink);margin-top:6px;padding-top:12px}
.os__row--moves .os__lb{color:var(--os-accent)}
.os__row--moves .os__num{color:var(--os-ink)}
.os__ytd-none{margin-top:2px;font-size:.9rem;color:var(--os-soft)}
.os__prop-h{margin:16px 0 4px;font:500 1.12rem/1.3 var(--os-display);color:var(--os-ink)}
.os__thead,.os__srow{display:grid;grid-template-columns:var(--os-cols-phone);column-gap:8px;align-items:baseline}
.os__thead{padding:4px 0;font-size:.875rem;color:var(--os-soft);border-bottom:1px solid var(--os-rule)}
.os__thead .os__num{font-family:inherit}
.os__stay{border-bottom:1px solid var(--os-rule)}
.os__stay > summary,.os__stay > .os__srow{padding:11px 0;min-height:44px}
.os__stay > summary{list-style:none;cursor:pointer}
.os__stay > summary::-webkit-details-marker{display:none}
.os__stay[open] > summary{font-weight:600}
.os__ref{position:relative;padding-left:14px;color:var(--os-soft)}
.os__stay--plain .os__ref{padding-left:14px}
.os details.os__stay > summary .os__ref::before{content:"";position:absolute;left:0;top:.5em;width:0;height:0;border-left:6px solid var(--os-gold);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .12s}
.os details.os__stay[open] > summary .os__ref::before{transform:rotate(90deg)}
.os__c--minor{display:none}
.os__snote{grid-column:2 / -1;font-size:.9rem;font-weight:400;color:var(--os-soft)}
.os__stay .os__rows{padding:0 0 10px 14px}
.os__stay .os__rows li{grid-template-columns:minmax(0,1fr) 6.2rem;padding:6px 0}
.os__stay .os__rows li.os__strong{font-weight:600}
.os__gnote{margin:0;padding:8px 0;border-bottom:1px solid var(--os-rule);font-size:.9rem;color:var(--os-soft)}
.os__ssub{padding:10px 0;border-top:2px solid var(--os-ink);font-weight:700}
.os__ssub .os__ref{color:inherit}
.os__cref{color:var(--os-soft)}
.os__costs li{display:grid;grid-template-columns:3.2rem minmax(0,1fr) auto;column-gap:10px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--os-rule)}
.os__costs li.os__ssub{border-bottom:0}
.os__small{display:block;font-size:.9rem;color:var(--os-soft)}
.os__att{counter-reset:att}
.os__att li{counter-increment:att;display:grid;grid-template-columns:1.6rem minmax(0,1fr);padding:6px 0}
.os__att li::before{content:counter(att) ".";color:var(--os-accent);font-weight:600}
.os__src li{padding:3px 0;color:var(--os-soft)}
.os__sign{margin-top:30px;padding-top:16px;border-top:1px solid var(--os-rule);font-size:.95rem;color:var(--os-soft)}
.os__sign p + p{margin-top:6px}
@media (min-width:600px){
.os__colhead,.os__colhead--ytd,.os__rows li,.os__rows--ytd li{grid-template-columns:minmax(0,1fr) 6.4rem 6.4rem}
.os{padding:28px 12px 56px}
.os__sheet{padding:40px clamp(28px,4vw,56px) 36px;box-shadow:0 1px 0 var(--os-rule),0 12px 28px rgba(0,0,0,.08)}
.os__thead,.os__srow{grid-template-columns:var(--os-cols-wide);column-gap:10px}
.os__c--minor{display:block}
}
@page os{size:letter;margin:.75in .75in .85in;
@bottom-left{content:"${cssString(footer)}";font:9pt "Instrument Sans","Helvetica Neue",Arial,sans-serif;color:#4a4a4a}
@bottom-right{content: "Page " counter(page) " of " counter(pages);font:9pt "Instrument Sans","Helvetica Neue",Arial,sans-serif;color:#4a4a4a}}
@media print{
.os{background:none;padding:0;font-size:10.5pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.os__sheet{max-width:none;margin:0;padding:0;box-shadow:none}
.os__actions{display:none}
.os__thead,.os__srow{grid-template-columns:var(--os-cols-wide)}
.os__c--minor{display:block}
.os details:not([open])::details-content{content-visibility:visible}
.os__stay > summary{cursor:auto}
.os__stay,.os__rows li,.os__costs li,.os__ssub,.os__gnote,.os__att li{break-inside:avoid}
.os__h,.os__prop-h{break-after:avoid}
.os__thead{break-after:avoid}
.os__big{font-size:34pt}
.os p,.os li{orphans:3;widows:3}
}
`;
}
