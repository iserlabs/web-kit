import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { LETTERHEAD_IDS, letterheadPlainText, renderLetterhead } from "./letterheads.mjs";

/**
 * 2026-11-24, Phil Berger device email: raw Amazon addresses split mid-code on a phone and the rows
 * hand-typed "1)". A links row may carry link text, and a numbered block prints its own numerals.
 */
const config = {
  siteUrl: "https://example.com",
  wordmark: "Example Stays",
  tagline: "Short term rental management",
  markUrl: "https://example.com/mark.png",
  markAlt: "Example Stays",
  displayFont: "Georgia, serif",
  bodyFont: "Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#fbf8f0",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [],
  letterhead: { headerUrl: "https://example.com/header.png", photoUrl: "https://example.com/photo.jpg", footer: "Example Stays" },
};
const person = { name: "Jake Lee", title: "Founder", email: "hello@example.com" };
const url = "https://www.amazon.com/dp/B0CC6QZZNF";
const email = {
  subject: "Devices",
  greeting: "Hi Phil,",
  blocks: [{ type: "links", numbered: true, rows: [{ label: "Smart lock: Schlage Encode Plus.", href: url, text: "Schlage Encode Plus on Amazon" }] }],
};

describe("links block", () => {
  for (const id of LETTERHEAD_IDS) {
    it(`${id}: shows link text, keeps the href, numbers the row`, () => {
      const html = renderLetterhead(id, config, person, email, "");
      expect(html).toContain(`href="${url}"`);
      expect(html).toContain(">Schlage Encode Plus on Amazon</a>");
      expect(html).toContain(">1)</td>");
    });
  }
  it("plain text keeps the full address and the numeral", () => {
    const txt = letterheadPlainText(email, person);
    expect(txt).toContain(`1) Smart lock: Schlage Encode Plus.\n${url}`);
  });
  it("a row without text still shows its address (old emails unchanged)", () => {
    const html = renderLetterhead(LETTERHEAD_IDS[0], config, person, { ...email, blocks: [{ type: "links", rows: [{ label: "x", href: url }] }] }, "");
    expect(html).toContain(`>${url}</a>`);
    expect(html).not.toContain(">1)</td>");
  });
});
