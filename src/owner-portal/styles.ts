/** Scoped styles for StatementTabs. Colors come only from the --op-* variables. */
export const STATEMENT_TABS_CSS = `
.op-tabs{font-family:var(--op-font,inherit);color:var(--op-ink,#1a1a1a);font-size:1rem;line-height:1.45;min-width:0}
.op-tabs *{box-sizing:border-box}
.op-tabs .op-list{display:flex;gap:.25rem;overflow-x:auto;scrollbar-width:none;margin:0;padding:0;max-width:100%}
.op-tabs .op-list::-webkit-scrollbar{display:none}
.op-tabs .op-years{border-bottom:1px solid var(--op-rule,#d8d4cc)}
.op-tabs .op-tab{appearance:none;background:transparent;border:0;border-bottom:3px solid transparent;color:var(--op-muted,#5c5a55);cursor:pointer;font:inherit;min-height:44px;padding:.5rem .9rem;white-space:nowrap;flex:0 0 auto}
.op-tabs .op-tab[aria-selected="true"]{color:var(--op-ink,#1a1a1a);border-bottom-color:var(--op-accent,#8a5a2b);font-weight:600}
.op-tabs .op-tab:focus-visible{outline:3px solid var(--op-accent,#8a5a2b);outline-offset:-3px}
.op-tabs .op-month{display:flex;flex-direction:column;align-items:flex-start;gap:0;min-width:5.5rem}
.op-tabs .op-month small{font-size:.8125rem;color:var(--op-muted,#5c5a55);font-weight:400;letter-spacing:.02em}
.op-tabs .op-months{margin-top:.75rem;border-bottom:1px solid var(--op-rule,#d8d4cc)}
.op-tabs .op-panel{padding-top:1rem;min-width:0}
.op-tabs .op-panel:focus-visible{outline:3px solid var(--op-accent,#8a5a2b);outline-offset:2px}
.op-tabs .op-entry{border:1px solid var(--op-rule,#d8d4cc);background:var(--op-paper,#fff);padding:1rem;margin:0 0 1rem;min-width:0}
.op-tabs .op-head{display:flex;flex-wrap:wrap;gap:.5rem .75rem;align-items:center;justify-content:space-between;margin:0 0 .75rem}
.op-tabs .op-title{font-size:1.125rem;font-weight:600;margin:0;overflow-wrap:anywhere}
.op-tabs .op-badge{display:inline-flex;align-items:center;min-height:1.75rem;padding:0 .625rem;font-size:.8125rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--op-ink,#1a1a1a);color:var(--op-ink,#1a1a1a)}
.op-tabs .op-badge[data-status="final"]{background:var(--op-ink,#1a1a1a);color:var(--op-paper,#fff)}
.op-tabs .op-badge[data-status="draft"]{border-style:dashed;border-color:var(--op-accent,#8a5a2b);color:var(--op-ink,#1a1a1a)}
.op-tabs .op-badge[data-status="waiting"]{border-color:var(--op-muted,#5c5a55);color:var(--op-muted,#5c5a55)}
.op-tabs .op-figs{display:grid;grid-template-columns:1fr auto;gap:.25rem 1rem;margin:0 0 .75rem}
.op-tabs .op-figs dt{color:var(--op-muted,#5c5a55)}
.op-tabs .op-figs dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.op-tabs .op-figs .op-bottom{font-weight:600;color:var(--op-ink,#1a1a1a)}
.op-tabs .op-note{margin:0 0 .75rem;color:var(--op-muted,#5c5a55)}
.op-tabs .op-open{display:inline-flex;align-items:center;min-height:44px;color:var(--op-ink,#1a1a1a);font-weight:600;text-decoration:underline;text-underline-offset:.2em;text-decoration-color:var(--op-accent,#8a5a2b);text-decoration-thickness:2px}
.op-tabs .op-open:focus-visible{outline:3px solid var(--op-accent,#8a5a2b);outline-offset:2px}
.op-tabs .op-empty{border:1px dashed var(--op-rule,#d8d4cc);padding:1rem;color:var(--op-muted,#5c5a55);margin:0}
`;
