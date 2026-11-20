/** The credit's CSS. xenia-credit.css carries the same rules for sites that are not React (a test keeps them equal). */
export const XENIA_CREDIT_CSS = `.xc{display:inline-flex;flex-wrap:wrap;align-items:center;column-gap:10px;row-gap:2px;min-height:44px;color:var(--xc-muted);text-decoration:none}
.xc__x{display:block;width:20px;height:auto;flex:none;transition:transform .35s ease,filter .35s ease}
.xc__by{font-size:var(--xc-size,14px);line-height:1.2}
.xc__name{font-family:var(--xc-serif,"Cormorant Garamond",Georgia,serif);font-weight:500;font-size:21px;line-height:1.15;letter-spacing:.005em;color:var(--xc-fg,currentColor);padding-bottom:3px;background:linear-gradient(var(--xc-gold,#b8975a),var(--xc-gold,#b8975a)) 0 100%/0% 1px no-repeat;transition:background-size .4s ease}
.xc:hover .xc__name,.xc:focus-visible .xc__name{background-size:100% 1px}
.xc:hover .xc__x,.xc:focus-visible .xc__x{transform:rotate(90deg);filter:brightness(1.12) saturate(1.1)}
.xc:focus-visible{outline:2px solid var(--xc-ring,currentColor);outline-offset:6px;border-radius:2px}
@media (max-width:480px){.xc__name{font-size:19px}}
@media (prefers-reduced-motion:reduce){.xc__x,.xc__name{transition:none}.xc:hover .xc__x,.xc:focus-visible .xc__x{transform:none}}`;
