import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatementBrand, StatementModel } from "./index.js";
import { formatCents, validate } from "./index.mjs";

const BRAND_FILES: StatementBrand[] = ["sun-mountain", "palisade", "columbus", "xenia"];
const EM = String.fromCharCode(0x2014);

function load(name: string): StatementModel {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as StatementModel;
}

/** Copy a fixture, let the test break one thing, and return what validate says. */
// biome-ignore lint/suspicious/noExplicitAny: the tests plant breaks in a loosely typed copy
function planted(name: string, mutate: (m: any) => void): string[] {
  // biome-ignore lint/suspicious/noExplicitAny: same
  const m: any = load(name);
  mutate(m);
  return validate(m);
}

describe("fixtures", () => {
  for (const name of BRAND_FILES) {
    it(`${name} validates clean`, () => {
      expect(validate(load(name))).toEqual([]);
    });
  }
});

describe("one planted break per rule gives a named error", () => {
  it("schema string must be exact", () => {
    const errs = planted("sun-mountain", (m) => {
      m.schema = "owner-statement/2";
    });
    expect(errs.some((e) => e.startsWith("schema:"))).toBe(true);
  });

  it("only a final statement renders", () => {
    const errs = planted("sun-mountain", (m) => {
      m.status = "draft";
    });
    expect(errs.some((e) => e.startsWith("status:"))).toBe(true);
  });

  it("the moves row must equal the move, with the sign the direction implies", () => {
    const off = planted("sun-mountain", (m) => {
      m.summary.rows[3].month += 1;
    });
    expect(off.some((e) => e.startsWith("moves:"))).toBe(true);
    const wrongSign = planted("columbus", (m) => {
      m.moves.direction = "to_owner";
    });
    expect(wrongSign.some((e) => e.startsWith("moves:"))).toBe(true);
  });

  it("a foot that is off by one cent is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.summary.rows[0].month += 1;
    });
    expect(errs.some((e) => e.startsWith("foot:"))).toBe(true);
  });

  it("a subtotal that does not equal its rows is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.groups[0].subtotal.cells.revenue += 1;
    });
    expect(errs.some((e) => e.startsWith("subtotal:"))).toBe(true);
  });

  it("a gap in the refs is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.groups[0].rows[1].ref = "A-3";
    });
    expect(errs.some((e) => e.startsWith("refs:"))).toBe(true);
  });

  it("a repeated ref is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.groups[0].rows[1].ref = "A-1";
    });
    expect(errs.some((e) => e.startsWith("refs:"))).toBe(true);
  });

  it("cost refs run B-1 onward and settlement refs run C-1 onward", () => {
    const b = planted("sun-mountain", (m) => {
      m.costs.rows[0].ref = "B-2";
    });
    expect(b.some((e) => e.startsWith("refs:"))).toBe(true);
    const c = planted("xenia", (m) => {
      m.settlement.rows[1].ref = "C-5";
    });
    expect(c.some((e) => e.startsWith("refs:"))).toBe(true);
  });

  it("a summary row at zero is named (the writer drops it)", () => {
    const errs = planted("sun-mountain", (m) => {
      m.summary.rows.splice(1, 0, { label: "Costs: other", role: "cost", month: 0, ytd: null });
    });
    expect(errs.some((e) => e.startsWith("zero-row:"))).toBe(true);
  });

  it("a stay row that is all zeros is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.groups[0].rows.push({
        ref: "A-7",
        cells: { dates: "Oct 31", channel: "Airbnb", nights: 0, revenue: 0, share: 0 },
      });
    });
    expect(errs.some((e) => e.startsWith("zero-row:"))).toBe(true);
  });

  for (const word of [
    "approximate",
    "variance",
    "estimate",
    "You earned",
    "Not a final statement",
  ]) {
    it(`the word "${word}" is named`, () => {
      const errs = planted("palisade", (m) => {
        m.attention.push(`This is an ${word} line`);
      });
      expect(errs.some((e) => e.startsWith("words:") && e.includes(word))).toBe(true);
    });
  }

  it("an em dash and an exclamation mark are named", () => {
    const dash = planted("palisade", (m) => {
      m.attention.push(`One ${EM} two`);
    });
    expect(dash.some((e) => e.startsWith("words:") && e.includes("em dash"))).toBe(true);
    const bang = planted("palisade", (m) => {
      m.owner.greeting = "Sam!";
    });
    expect(bang.some((e) => e.startsWith("words:") && e.includes("exclamation"))).toBe(true);
  });

  it("a null date with no reason is named, unless nothing moves", () => {
    const errs = planted("columbus", (m) => {
      m.moves.dateUnknown = null;
    });
    expect(errs.some((e) => e.startsWith("date:"))).toBe(true);
    expect(
      planted("palisade", (m) => {
        m.moves.dateUnknown = null;
      }),
    ).toEqual([]);
  });

  it("year to date: unknown needs a reason and a null on every row", () => {
    const reason = planted("sun-mountain", (m) => {
      m.summary.ytd.reason = null;
    });
    expect(reason.some((e) => e.startsWith("ytd:"))).toBe(true);
    const stray = planted("sun-mountain", (m) => {
      m.summary.rows[0].ytd = 100;
    });
    expect(stray.some((e) => e.startsWith("ytd:"))).toBe(true);
    const missing = planted("xenia", (m) => {
      m.summary.rows[1].ytd = null;
    });
    expect(missing.some((e) => e.startsWith("ytd:"))).toBe(true);
  });

  it("a year to date foot that does not add up is named", () => {
    const errs = planted("xenia", (m) => {
      m.summary.rows[1].ytd += 1;
    });
    expect(errs.some((e) => e.startsWith("foot:"))).toBe(true);
  });

  it("a costs subtotal that does not equal its rows is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.costs.subtotal.cents -= 1;
    });
    expect(errs.some((e) => e.startsWith("subtotal:"))).toBe(true);
  });

  it("a source address must be a web address", () => {
    const errs = planted("sun-mountain", (m) => {
      m.sources[0].href = "javascript:alert(1)";
    });
    expect(errs.some((e) => e.startsWith("shape:") && e.includes("href"))).toBe(true);
  });

  it("a source address may be a site path starting with one slash", () => {
    const errs = planted("sun-mountain", (m) => {
      m.sources[0].href = "/notes/october";
    });
    expect(errs).toEqual([]);
  });

  it("a source address is refused when it is another scheme or protocol-relative", () => {
    for (const bad of [
      "//evil.example/x",
      "data:text/html,hi",
      "javascript:alert(1)",
      "mailto:a@b.co",
      "ftp://x.co/y",
      "notes/october",
      "",
    ]) {
      const errs = planted("sun-mountain", (m) => {
        m.sources[0].href = bad;
      });
      expect(
        errs.some((e) => e.startsWith("shape:") && e.includes("sources[0]")),
        bad,
      ).toBe(true);
    }
  });

  it("money must be whole cents", () => {
    const errs = planted("sun-mountain", (m) => {
      m.summary.rows[0].month = 3746.79;
    });
    expect(errs.some((e) => e.startsWith("cents:"))).toBe(true);
  });

  it("a missing top-level piece is named in plain words", () => {
    const errs = planted("sun-mountain", (m) => {
      m.owner = undefined;
    });
    expect(errs.some((e) => e.startsWith("shape:") && e.includes("owner"))).toBe(true);
  });

  it("a thing that is not a statement gets one plain answer", () => {
    expect(validate(null)).toEqual(["shape: the statement is not an object"]);
  });

  it("an unknown brand is named", () => {
    const errs = planted("sun-mountain", (m) => {
      m.brand = "other";
    });
    expect(errs.some((e) => e.startsWith("brand:"))).toBe(true);
  });
});

describe("formatCents", () => {
  it("formats dollars with grouping", () => {
    expect(formatCents(170901)).toBe("$1,709.01");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(1)).toBe("$0.01");
    expect(formatCents(4619631)).toBe("$46,196.31");
  });
  it("puts a negative in parentheses", () => {
    expect(formatCents(-34671, { parens: true })).toBe("($346.71)");
  });
  it("without parens, a negative uses a minus sign", () => {
    expect(formatCents(-34671)).toBe("-$346.71");
  });
  it("refuses a figure that is not whole cents", () => {
    expect(() => formatCents(1.5)).toThrow();
    expect(() => formatCents(Number.NaN)).toThrow();
  });
});
