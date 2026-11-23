import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { LETTERHEAD_IDS, renderLetterhead } from "./letterheads.mjs";

/**
 * The 2026-11-13 owner-statement polish pass, findings 14 and 15: the statement email's money
 * columns and small type, checked in every layout.
 */
const config = {
  siteUrl: "https://example.com",
  wordmark: "Example Stays",
  tagline: "Short term rental management",
  markUrl: "https://example.com/mark.png",
  markAlt: "Example Stays",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#fbf8f0",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [],
  letterhead: {
    headerUrl: "https://example.com/header.png",
    photoUrl: "https://example.com/photo.jpg",
    footer: "Example Stays",
  },
};
const person = { name: "Jake Lee", title: "Founder", email: "hello@example.com" };
const email = {
  subject: "s",
  blocks: [
    { type: "heading", text: "October at a glance" },
    {
      type: "table",
      columns: ["", "October", "September"],
      rows: [
        ["Revenue", "$3,746.79", "$6,159.17"],
        ["Sent to you", "$1,709.01", "$4,059.31"],
      ],
      strongColumn: 1,
    },
    { type: "figures", rows: [["Revenue", "$3,746.79"], ["Sent to you", "$1,709.01"]] },
    { type: "ledger", rows: [{ label: "Hot tub", value: "($175.00)" }] },
  ],
};
/** A live Gmail signature's small capitals, as the brands' own signatures carry them. */
const signature =
  '<table><tr><td><div style="font-family:Georgia;font-size:18px;">Jake Lee</div>' +
  '<div style="font-family:Arial;font-size:9.5px;letter-spacing:0.22em;text-transform:uppercase;">FOUNDER</div>' +
  '<div style="font-size:0px;line-height:15px;height:15px"> </div>' +
  '<div style="font-family:Arial;font-size:10px;text-transform:uppercase;">WELL PLANNED. WELL LAUNCHED.</div>' +
  '<div style="font-size:12px;">hello@example.com<span style="font-size:11px;padding:0 7px">·</span></div>' +
  '<div style="width:100%;height:1px;font-size:1px;line-height:1px"> </div></td></tr></table>';

const styleOf = (el: { getAttribute(n: string): string | undefined }) => el.getAttribute("style") ?? "";
const px = (style: string) => Number(/font-size:\s*([\d.]+)px/.exec(style)?.[1] ?? Number.NaN);

describe("finding 14: money columns keep lining figures where Gmail drops the brand face", () => {
  for (const id of LETTERHEAD_IDS) {
    it(`${id}: every figure cell names a lining sans ahead of Georgia and asks for lining tabular digits`, () => {
      const root = parse(renderLetterhead(id, config, person, email, null));
      const figures = [
        ...root.querySelectorAll("td").filter((td) => /^\(?\$[\d,]+\.\d{2}\)?$/.test(td.text.trim())),
      ];
      expect(figures.length).toBeGreaterThanOrEqual(7);
      for (const td of figures) {
        const st = styleOf(td);
        expect(st, td.text).toMatch(/font-variant-numeric:\s*lining-nums tabular-nums/);
        const family = [...st.matchAll(/font-family:([^;]+)/g)].at(-1)?.[1] ?? "";
        const helvetica = family.search(/Helvetica|Arial/);
        const georgia = family.search(/Georgia/);
        expect(helvetica, `${td.text}: ${family}`).toBeGreaterThan(-1);
        if (georgia > -1) expect(helvetica, family).toBeLessThan(georgia);
      }
      // the row labels keep the layout's own face
      const label = root.querySelectorAll("th").find((th) => th.text.trim() === "Sent to you");
      expect(styleOf(label as never)).toContain("Newsreader");
    });
  }
});

describe("finding 15: no email type under 13px", () => {
  for (const id of LETTERHEAD_IDS) {
    it(`${id}: section labels, table heads and a pasted signature's small capitals are 13px or more`, () => {
      const out = renderLetterhead(id, config, person, email, signature);
      const root = parse(out);
      for (const el of root.querySelectorAll("[style]")) {
        const size = px(styleOf(el));
        if (Number.isNaN(size) || size <= 2 || el.text.trim() === "") continue; // spacer rules and rows
        expect(size, `${el.tagName} "${el.text.trim().slice(0, 30)}"`).toBeGreaterThanOrEqual(13);
      }
      expect(out).toContain("FOUNDER");
      expect(out).toContain("WELL PLANNED. WELL LAUNCHED.");
    });
  }
});

describe("2026-11-23: a pasted signature's contact lines read at 14px on a phone", () => {
  it("raises a 12px email line to 14px and keeps small capitals at 13px", () => {
    const sig =
      '<div><div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.7px">FOUNDER</div>' +
      '<div style="font-size:12px"><a href="mailto:hello@example.com" style="font-size:12px">hello@example.com</a></div></div>';
    const out = renderLetterhead("paper", config, person, email, sig);
    expect(out).toMatch(/font-size:13px;text-transform:uppercase[^"]*">FOUNDER/);
    expect(out).toMatch(/style="font-size:14px[^"]*"><a [^>]*font-size:14px/);
    expect(out).not.toMatch(/font-size:(9\.5|12)px/);
  });
});
