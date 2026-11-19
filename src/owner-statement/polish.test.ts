import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ShareCardTree, StatementBrand, StatementModel } from "./index.js";
import {
  BRANDS,
  renderStatement,
  renderStatementShareCard,
  statementShareMeta,
  validate,
} from "./index.mjs";

/**
 * The 2026-11-13 polish pass: one block per confirmed finding, each named by its number in the
 * pass (breaker 1 to 7, design audit 8 to 13), so a later change that undoes a repair fails here.
 */
const LOGO = { src: "/logo.png", alt: "The sender", width: 994, height: 192 };
const BRAND_FILES: StatementBrand[] = ["sun-mountain", "palisade", "columbus", "xenia"];

// biome-ignore lint/suspicious/noExplicitAny: the tests plant breaks in a loosely typed copy
type Loose = any;

function load(name: string): StatementModel {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as StatementModel;
}
const loose = (name: string): Loose => load(name);
const html = (m: StatementModel) => renderStatement(m, { logo: LOGO }).html;
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
const texts = (n: ShareCardTree | string): string[] =>
  typeof n === "string" ? [n] : n.children.flatMap(texts);

/** Recompute every group subtotal from its rows, the way a careless edit would leave it "balanced". */
function resum(m: Loose) {
  for (const g of m.groups) {
    for (const c of g.columns) {
      if (c.kind === "text") continue;
      g.subtotal.cells[c.key] = g.rows.reduce((t: number, r: Loose) => t + r.cells[c.key], 0);
    }
  }
  let n = 0;
  for (const g of m.groups) for (const r of g.rows) r.ref = `A-${++n}`;
}

describe("finding 3: the summary is checked against the stay tables", () => {
  it("every fixture still validates", () => {
    for (const name of BRAND_FILES) expect(validate(load(name)), name).toEqual([]);
  });

  it("42 stays under a summary that still shows the first month's figures is named", () => {
    const m = loose("sun-mountain");
    const g0 = m.groups[0];
    m.groups = Array.from({ length: 6 }, (_, i) => {
      const g = structuredClone(g0);
      g.property = `Property ${i + 1}`;
      g.rows = Array.from({ length: 7 }, (_, k) => structuredClone(g0.rows[k % g0.rows.length]));
      return g;
    });
    resum(m);
    const errors = validate(m);
    expect(errors.some((e) => e.startsWith("cross-check:")), errors.join("\n")).toBe(true);
  });

  it("a refund row inside a group, summary left as it was, is named", () => {
    const m = loose("sun-mountain");
    const g = m.groups[0];
    const r = structuredClone(g.rows[0]);
    for (const c of g.columns) if (c.kind === "money") r.cells[c.key] = -r.cells[c.key];
    r.cells.nights = 0;
    g.rows.push(r);
    resum(m);
    expect(validate(m).join("\n")).toMatch(/^cross-check: .*Money in: booked revenue/m);
  });

  it("one cent moved between summary rows, stays unchanged, is named", () => {
    const m = loose("sun-mountain");
    const inn = m.summary.rows.find((r: Loose) => r.role === "in");
    const cost = m.summary.rows.find((r: Loose) => r.role === "cost");
    inn.month += 1;
    cost.month -= 1;
    expect(validate(m).join("\n")).toMatch(/cross-check: .*\$3,746\.79.*\$3,746\.80/);
  });

  it("a month with no stays, or a group with no money column, is not cross-checked", () => {
    const m = loose("sun-mountain");
    m.groups = [];
    expect(validate(m).filter((e) => e.startsWith("cross-check"))).toEqual([]);
  });
});

describe("finding 4: a missing text cell", () => {
  it("prints an empty cell, never the word undefined", () => {
    const m = loose("sun-mountain");
    delete m.groups[0].rows[1].cells.channel;
    const out = html(m);
    expect(out).not.toContain("undefined");
  });

  it("a text cell that is not text is refused by validate", () => {
    const m = loose("sun-mountain");
    m.groups[0].rows[1].cells.channel = 42;
    expect(validate(m).join("\n")).toMatch(/A-2 channel/);
  });
});

describe("finding 5: dates are checked and printed safely", () => {
  it("a timestamp or a written-out prepared date is refused by name", () => {
    for (const bad of ["2026-11-05T23:30:00-07:00", "November 5, 2026", "2026-13-01", "2026-02-30"]) {
      const m = loose("sun-mountain");
      m.prepared.date = bad;
      expect(validate(m).join("\n"), bad).toMatch(/date: prepared\.date must read YYYY-MM-DD/);
    }
  });

  it("a cost date that is not YYYY-MM-DD is refused by name", () => {
    const m = loose("sun-mountain");
    m.costs.rows[0].date = "11/03/2026";
    expect(validate(m).join("\n")).toMatch(/date: B-1 date must read YYYY-MM-DD/);
  });

  it("never prints NaN or undefined in the sign-off", () => {
    const out = html(load("sun-mountain"));
    expect(out).toContain("on November 1, 2026.");
    expect(out).not.toMatch(/NaN|undefined/);
  });
});

describe("finding 7: the year to date note says its reason once, plainly", () => {
  it("no label-colon-dash stutter, the reason printed once as a sentence", () => {
    for (const name of BRAND_FILES) {
      const m = load(name);
      if (m.summary.ytd.known) continue;
      const out = html(m);
      const note = out.match(/<p class="os__ytd-none">([^<]*)<\/p>/)?.[1] ?? "";
      expect(note, name).not.toContain("&ndash;");
      expect(note, name).not.toMatch(/^Year to date: /);
      expect(note.charAt(0), name).toBe(note.charAt(0).toUpperCase());
      expect(note.endsWith("."), name).toBe(true);
      expect(count(out, String(m.summary.ytd.reason).replace(/\.$/, "").slice(1)), name).toBe(1);
    }
  });

  it("a reason that starts with the column label is not prefixed with it again", () => {
    const m = loose("sun-mountain");
    m.summary.ytd.reason = "Year to date is not shown because the close record starts with October 2026.";
    const note = html(m).match(/<p class="os__ytd-none">([^<]*)<\/p>/)?.[1];
    expect(note).toBe("Year to date is not shown because the close record starts with October 2026.");
  });
});

describe("finding 8: when nothing moves, the top says it once, in sentence case", () => {
  it("Palisade: one 'Nothing moves', no repeated headline, the line starts with a capital", () => {
    const m = loose("palisade");
    m.moves.headline = "Nothing moves between us, October 2026";
    m.moves.line = "our fee came out of Airbnb's co-host payout; no transfer, so no date";
    const out = html(m);
    const lead = out.match(/<section class="os__lead">([\s\S]*?)<\/section>/)?.[1] ?? "";
    expect(count(lead.toLowerCase(), "nothing moves")).toBe(1);
    expect(lead).toContain('<p class="os__line">Our fee came out');
  });

  it("every line under the big number starts with a capital", () => {
    for (const name of BRAND_FILES) {
      const line = html(load(name)).match(/<p class="os__line">([^<]*)</)?.[1] ?? "";
      expect(line.charAt(0), name).toBe(line.charAt(0).toUpperCase());
    }
  });
});

describe("finding 9: the label over the big number drops the month the masthead already shows", () => {
  it("strips ', October 2026' and ', at the close of October'", () => {
    const cases: [string, string][] = [
      ["From Sun Mountain Stays, October 2026", "From Sun Mountain Stays"],
      ["From you, October 2026", "From you"],
      ["From Minh to you, at the close of October", "From Minh to you"],
    ];
    for (const [headline, want] of cases) {
      const m = loose("sun-mountain");
      m.moves.headline = headline;
      m.monthLabel = "October 2026";
      m.monthShort = "October";
      const cap = html(m).match(/<section class="os__lead"><p class="os__cap">([^<]*)</)?.[1];
      expect(cap, headline).toBe(want);
    }
  });
});

describe("finding 10 and 11: summary rows", () => {
  const css = renderStatement(load("sun-mountain"), { logo: LOGO }).css;

  it("11: no disclosure triangle on a plain summary or breakdown row", () => {
    expect(css).not.toMatch(/\.os__rows li \.os__lb::before/);
    // the stays that do open keep theirs
    expect(css).toMatch(/details\.os__stay > summary \.os__ref::before/);
  });

  it("10: the leader sits on the label's last line and the figure lines up with that line", () => {
    expect(css).toMatch(/\.os__rows li\{[^}]*align-items:last baseline/);
    expect(css).toMatch(/\.os__dots\{[^}]*position:absolute/);
    expect(html(load("sun-mountain"))).toMatch(
      /<span class="os__lb"><span class="os__lt">Money in: booked revenue<\/span><span class="os__dots"><\/span><\/span>/,
    );
  });
});

describe("finding 12: Palisade figures", () => {
  it("are set in Instrument Sans with tabular lining figures at full size", () => {
    expect(BRANDS.palisade.figures).toMatch(/Instrument Sans/);
    expect(BRANDS.palisade.figures).not.toMatch(/Geist Mono/);
    expect(BRANDS.palisade.figureScale).toBe(1);
    expect(BRANDS.palisade.tabular).toBe(true);
    const css = renderStatement(load("palisade"), { logo: LOGO }).css;
    expect(css).toMatch(/\.os__num\{[^}]*font-variant-numeric:tabular-nums lining-nums/);
  });
});

describe("finding 1 and 2: the printed stay tables", () => {
  it("each group carries a print table whose head repeats the property and the column names", () => {
    const m = load("columbus");
    const out = html(m);
    expect(count(out, '<table class="os__ptbl"')).toBe(m.groups.length);
    for (const g of m.groups) {
      const esc = g.property.replace(/'/g, "&#39;");
      expect(out).toContain(`<th class="os__pprop" colspan="${g.columns.length + 1}" scope="colgroup">${esc}</th>`);
    }
    expect(out).toMatch(/<thead><tr><th class="os__pprop"[^>]*>[^<]*<\/th><\/tr><tr><th scope="col">Ref<\/th>/);
  });

  it("the stylesheet shows the print table only in print, and repeats its head there", () => {
    const css = renderStatement(load("columbus"), { logo: LOGO }).css;
    expect(css).toMatch(/\.os__ptbl\{display:none\}/);
    expect(css).toMatch(/@media print\{[\s\S]*\.os__tbl,\.os__prop-h\{display:none\}[\s\S]*\.os__ptbl\{display:table/);
    expect(css).toMatch(/\.os__ptbl thead\{display:table-header-group\}/);
  });

  it("a breakdown prints as one compact line under its stay, every line and figure kept", () => {
    const m = load("sun-mountain");
    const out = html(m);
    const row = m.groups[0]?.rows[0];
    const det = out.match(/<tr class="os__pdet">([\s\S]*?)<\/tr>/)?.[1] ?? "";
    for (const d of row?.detail ?? []) expect(det).toContain(d.label);
  });
});

describe("finding 6: the share tags guard the owner's name", () => {
  const PLACE = { place: "Englewood, NJ" };
  const nov = (name: StatementBrand): Loose => {
    const m = loose(name);
    m.month = "2026-11";
    m.monthLabel = "November 2026";
    m.monthShort = "November";
    return m;
  };

  it("a two-letter name is caught", () => {
    const m = nov("palisade");
    m.owner = { ...m.owner, name: "Bo Li", greeting: "Bo" };
    m.property.label = "Bo Li House";
    expect(() => statementShareMeta(m, PLACE)).toThrow(/owner's name/);
  });

  it("an accent-stripped spelling is caught", () => {
    const m = nov("palisade");
    m.owner = { ...m.owner, name: "José Peña", greeting: "José" };
    m.property.label = "Jose Pena Cottage";
    expect(() => statementShareMeta(m, PLACE)).toThrow(/owner's name/);
  });

  it("a surname that is also the street does not throw, and the address is printed whole", () => {
    const m = nov("sun-mountain");
    m.owner = { ...m.owner, name: "Mark Lark", greeting: "Mark" };
    m.property = { label: "2612 Lark Dr", line: "2612 Lark Dr, Colorado Springs, CO 80909" };
    const meta = statementShareMeta(m, { place: "Colorado Springs, CO" });
    expect(meta.title).toContain("2612 Lark Dr");
    const card = renderStatementShareCard(m, { photoUrl: "https://x.test/p.jpg", markUrl: "https://x.test/m.png" });
    expect(texts(card).join(" ")).toContain("2612 Lark Dr");
  });

  it("the same surname outside the street is still caught", () => {
    const m = nov("sun-mountain");
    m.owner = { ...m.owner, name: "Mark Lark", greeting: "Mark" };
    m.property = { label: "2612 Lark Dr", line: "2612 Lark Dr, Colorado Springs, CO 80909" };
    expect(() => statementShareMeta(m, { place: "Lark family cabin, CO" })).toThrow(/owner's name/);
  });

  it("a short name never trips on a state abbreviation", () => {
    const m = nov("sun-mountain");
    m.owner = { ...m.owner, name: "Mo Co", greeting: "Mo" };
    expect(() => statementShareMeta(m, { place: "Kansas City, MO" })).not.toThrow();
    expect(() => statementShareMeta(m, { place: "Colorado Springs, CO" })).not.toThrow();
  });
});

