import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatementBrand, StatementModel } from "./index.js";
import { BANNED_WORDS, BRANDS, formatCents, renderStatement } from "./index.mjs";

const BRAND_FILES: StatementBrand[] = ["sun-mountain", "palisade", "columbus", "xenia"];
const EM = String.fromCharCode(0x2014);
const LOGO = { src: "/logo.png", alt: "The sender", width: 994, height: 192 };

function load(name: string): StatementModel {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as StatementModel;
}

function render(name: string, opts: Partial<Parameters<typeof renderStatement>[1]> = {}) {
  return renderStatement(load(name), { logo: LOGO, pdfHref: "/statement.pdf", ...opts });
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Brand names that may only appear on their own statement. */
const NAMES: Record<StatementBrand, string[]> = {
  "sun-mountain": ["Sun Mountain"],
  palisade: ["Palisade"],
  columbus: ["Columbus"],
  xenia: ["Xenia", "Roam North"],
};

describe("what the page carries", () => {
  for (const name of BRAND_FILES) {
    it(`${name}: month, masthead, refs, subtotals and the call line`, () => {
      const m = load(name);
      const { html, title } = render(name);
      expect(html).toContain(m.business);
      expect(html).toContain(m.monthLabel);
      expect(html).toContain(m.owner.name);
      expect(html).toContain(m.moves.headline);
      expect(html).toContain(m.moves.line);
      expect(title).toContain(m.monthLabel);
      for (const g of m.groups) {
        for (const r of g.rows) expect(html).toContain(`>${r.ref}<`);
        expect(html).toContain(g.subtotal.label);
        expect(html).toContain(g.title);
        expect(html).toContain(g.property);
      }
      for (const r of m.costs?.rows ?? []) expect(html).toContain(`>${r.ref}<`);
      for (const r of m.settlement?.rows ?? []) expect(html).toContain(`>${r.ref}<`);
      for (const a of m.attention) expect(html).toContain(a.replace("'", "&#39;"));
      expect(html).toContain(m.prepared.by);
    });
  }

  it("the big number is the move, with one line under it", () => {
    const sms = render("sun-mountain").html;
    expect(sms).toContain('class="os__big"');
    expect(sms).toContain(">$1,709.01<");
    expect(sms).toContain("by bank transfer, November 2, 2026");
    const ch = render("columbus").html;
    expect(ch).toContain(`>${formatCents(load("columbus").moves.cents)}<`);
    expect(ch).toContain("due date not set yet");
  });

  it("nothing moves: the big words say so, not $0.00", () => {
    const { html } = render("palisade");
    expect(html).toContain(">Nothing moves<");
    expect(html).not.toContain('class="os__big">$0.00');
  });

  it("each subtotal figure is printed", () => {
    const m = load("sun-mountain");
    const html = render("sun-mountain").html;
    expect(html).toContain(formatCents(m.groups[0]?.subtotal.cells.revenue as number));
    expect(html).toContain(formatCents(m.groups[0]?.subtotal.cells.share as number));
  });

  it("a negative figure reads in parentheses", () => {
    expect(render("sun-mountain").html).toContain("($346.71)");
  });

  it("year to date unknown: a dash and the reason, once", () => {
    const m = load("sun-mountain");
    const { html } = render("sun-mountain");
    expect(count(html, m.summary.ytd.reason as string)).toBe(1);
    expect(html).toContain('class="os__ytd-none"');
    expect(html).toContain(">&ndash;<");
  });

  it("year to date known: a column of figures and the brand's label", () => {
    const m = load("xenia");
    const { html } = render("xenia");
    expect(html).toContain(m.summary.columns.ytd);
    expect(html).not.toContain("os__ytd-none");
    expect(html).toContain(formatCents(m.summary.rows[1]?.ytd as number, { parens: true }));
  });

  it("the Download PDF link is there when asked, and absent when not", () => {
    expect(render("sun-mountain").html).toContain('href="/statement.pdf"');
    expect(render("sun-mountain").html).toContain("Download PDF");
    const bare = renderStatement(load("sun-mountain"), { logo: LOGO });
    expect(bare.html).not.toContain("Download PDF");
  });

  for (const name of BRAND_FILES) {
    it(`${name}: exactly one call link, plain, inside one sentence`, () => {
      const { html } = render(name);
      expect(count(html, 'href="https://jakejjlee.com/meet"')).toBe(1);
      expect(html).toContain(
        'Questions on any figure: reply to the email, or book a call at <a href="https://jakejjlee.com/meet">jakejjlee.com/meet</a>.',
      );
    });
  }

  it("one details per row with a breakdown, closed on screen, summary carries the ref", () => {
    for (const name of BRAND_FILES) {
      const m = load(name);
      const withDetail = m.groups.flatMap((g) => g.rows).filter((r) => r.detail?.length).length;
      const { html } = render(name);
      expect(count(html, "<details")).toBe(withDetail);
      expect(count(html, "<summary")).toBe(withDetail);
      expect(html).not.toMatch(/<details[^>]* open/);
    }
    const html = render("sun-mountain").html;
    expect(html).toMatch(/<summary[^>]*><span class="os__ref">A-1<\/span>/);
    expect(html).toContain("Management fee, 15%");
  });

  it("costs: dated, and the invoice is a link only when there is an address", () => {
    const sms = render("sun-mountain").html;
    expect(sms).toContain('<a href="https://example.com/invoices/hot-tub">');
    expect(sms).toContain('<time datetime="2026-10-01">');
    const ps = render("palisade").html;
    expect(ps).toContain("Furnishings and supplies, invoice 0");
    expect(ps).not.toContain('href="null"');
    expect(count(ps, 'href="https://example.com/invoices/')).toBe(2);
  });

  it("settlement only when present", () => {
    expect(render("xenia").html).toContain("Settlement with");
    expect(render("sun-mountain").html).not.toContain("Settlement");
  });

  it("sources, and the sign-off with who prepared it and when", () => {
    const html = render("sun-mountain").html;
    expect(html).toContain("Reservations export, October 2026 (pulled November 1)");
    expect(html).toContain("Jake Lee");
    expect(html).toContain("November 1, 2026");
  });

  it("the logo carries its size and alt text", () => {
    const html = render("sun-mountain", {
      logo: { src: "data:image/png;base64,AAAA", alt: 'Mark "one"', width: 994, height: 192 },
    }).html;
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('alt="Mark &quot;one&quot;"');
    expect(html).toContain('width="994"');
    expect(html).toContain('height="192"');
  });
});

describe("escaping", () => {
  const evil = "<script>alert(1)</script>";

  it("text from the model never becomes markup", () => {
    const m = load("sun-mountain");
    m.attention.push(evil);
    const first = m.summary.rows[0];
    if (first) first.label = `Money in: ${evil}`;
    const row = m.groups[0]?.rows[0];
    if (row?.detail?.[0]) row.detail[0].label = evil;
    if (m.groups[0]) m.groups[0].note = evil;
    m.sources.push({ label: evil, file: null, href: null });
    m.owner.name = evil;
    const { html, title } = renderStatement(m, { logo: LOGO });
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(title).not.toContain("<");
  });

  it("an address that is not web or relative is not made a link", () => {
    const m = load("sun-mountain");
    const cost = m.costs?.rows[0];
    if (cost) cost.href = "javascript:alert(1)";
    expect(() => renderStatement(m, { logo: LOGO })).toThrow(/href/);
    expect(() =>
      renderStatement(load("sun-mountain"), { logo: LOGO, pdfHref: "javascript:alert(1)" }),
    ).toThrow(/pdfHref/);
  });

  it("refuses a statement that does not validate", () => {
    const m = load("sun-mountain");
    m.status = "draft" as "final";
    expect(() => renderStatement(m, { logo: LOGO })).toThrow(/status/);
  });
});

describe("one brand per page", () => {
  for (const name of BRAND_FILES) {
    it(`${name}: no other business name reaches the HTML or CSS`, () => {
      const { html, css } = render(name);
      for (const other of BRAND_FILES) {
        if (other === name) continue;
        for (const word of NAMES[other]) {
          expect(html, `${name} html mentions ${word}`).not.toContain(word);
          expect(css, `${name} css mentions ${word}`).not.toContain(word);
        }
      }
    });
  }
});

describe("words and marks", () => {
  for (const name of BRAND_FILES) {
    it(`${name}: no em dash, no exclamation mark, none of the banned words`, () => {
      const { html, css, title } = render(name);
      const text = `${html}\n${css}\n${title}`;
      expect(text).not.toContain(EM);
      expect(text).not.toContain("!");
      for (const w of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(w.toLowerCase());
      expect(text).not.toContain("variance");
    });
  }
});

/** Every top-level selector must start with the root class. */
function unscoped(css: string): string[] {
  const out: string[] = [];
  const walk = (src: string) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i);
      if (open < 0) break;
      const head = src.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth++;
        if (src[j] === "}") depth--;
        j++;
      }
      const body = src.slice(open + 1, j - 1);
      if (head.startsWith("@media") || head.startsWith("@supports")) walk(body);
      else if (head.startsWith("@page") || head.startsWith("@font-face")) {
        // page rules cannot be scoped; they are the print sheet itself
      } else {
        for (const sel of head.split(",")) {
          if (!sel.trim().startsWith(".os")) out.push(sel.trim());
        }
      }
      i = j;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  return out;
}

describe("css", () => {
  it("every rule sits under the root class, so it cannot leak into a site", () => {
    for (const name of BRAND_FILES) expect(unscoped(render(name).css)).toEqual([]);
  });

  it("print: letter size, page numbers, details forced open, buttons hidden", () => {
    const { css } = render("sun-mountain");
    expect(css).toMatch(/@page[^{]*\{[^}]*size:\s*letter/);
    expect(css).toContain('content: "Page " counter(page) " of " counter(pages)');
    expect(css).toContain("@bottom-right");
    expect(css).toMatch(
      /@media print[\s\S]*details:not\(\[open\]\)::details-content[\s\S]*content-visibility:\s*visible/,
    );
    expect(css).toMatch(/@media print[\s\S]*\.os__actions[\s\S]*display:\s*none/);
  });

  it("phone first: the base rules have no min-width gate", () => {
    const { css } = render("sun-mountain");
    expect(css).toContain("@media (min-width");
    expect(css).toMatch(/\.os__sheet\s*\{/);
  });

  it("only Palisade carries the gold side stripe", () => {
    for (const name of BRAND_FILES) {
      const stripe = render(name).css.includes("os__stripe");
      expect(stripe).toBe(name === "palisade");
    }
    expect(BRANDS.palisade.stripe).toBeTruthy();
    expect(BRANDS.columbus.stripe).toBeNull();
  });

  it("font stacks read a variable a site can set, with the brand face as the fallback", () => {
    const css = render("sun-mountain").css;
    expect(css).toContain('var(--font-newsreader, "Newsreader")');
    expect(css).toContain('var(--font-instrument-sans, "Instrument Sans")');
    expect(render("palisade").css).toContain('var(--font-geist-mono, "Geist Mono")');
  });

  it("a site can override the stacks", () => {
    const css = render("sun-mountain", { fonts: { display: "Fancy, serif" } }).css;
    expect(css).toContain("Fancy, serif");
  });

  it("no dark theme", () => {
    for (const name of BRAND_FILES) {
      const css = render(name).css;
      expect(css).not.toContain("prefers-color-scheme");
      expect(css).toContain("color-scheme: light");
    }
  });
});

function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (v[0] ?? 0) + 0.7152 * (v[1] ?? 0) + 0.0722 * (v[2] ?? 0);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe("brand tokens", () => {
  for (const id of BRAND_FILES) {
    it(`${id}: text colors clear 4.5:1 on the paper`, () => {
      const t = BRANDS[id];
      expect(contrast(t.ink, t.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.soft, t.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, t.paper)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("no brand uses Inter or a bare system face as its display or text face", () => {
    for (const id of BRAND_FILES) {
      for (const stack of [BRANDS[id].display, BRANDS[id].text]) {
        expect(stack).not.toMatch(/\bInter\b/);
        expect(stack.trim().startsWith("system-ui")).toBe(false);
      }
    }
  });
});
