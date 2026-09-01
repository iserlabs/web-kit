import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { renderSignature, SIGNATURE_IDS, SIGNATURE_VARIANTS } from "./signatures.mjs";

const config = {
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Front Range short-term rental management",
  markUrl: "https://sunmountainstays.com/brand/mark-128.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#ffffff",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [],
};

const person = {
  name: "Jake Lee",
  title: "Founder",
  email: "hello@sunmountainstays.com",
  phone: "201.321.5446",
  link: { label: "Book a call", href: "https://sunmountainstays.com/contact" },
};

const all = (): [string, string][] =>
  SIGNATURE_IDS.map((id: string) => [id, renderSignature(id, config, person)]);

describe("signature variants", () => {
  it("ships exactly five, with distinct ids", () => {
    expect(SIGNATURE_IDS).toHaveLength(5);
    expect(new Set(SIGNATURE_IDS).size).toBe(5);
    expect(SIGNATURE_VARIANTS.map((v: { id: string }) => v.id)).toEqual(SIGNATURE_IDS);
  });

  it("gives every variant a label and a one-line note for the board", () => {
    for (const v of SIGNATURE_VARIANTS) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.note.length).toBeGreaterThan(0);
    }
  });

  it("throws on an unknown variant rather than falling back silently", () => {
    expect(() => renderSignature("nope", config, person)).toThrow(/nope/);
  });

  it("builds every variant out of presentation tables", () => {
    for (const [id, html] of all()) {
      const table = parse(html).querySelector("table");
      expect(table, `${id} has no table`).toBeTruthy();
      expect(table?.getAttribute("role"), `${id} table is not presentational`).toBe("presentation");
    }
  });

  it("uses inline styles only, with no stylesheet and no classes", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} has a style block`).not.toContain("<style");
      expect(html, `${id} uses a class`).not.toContain("class=");
    }
  });

  it("avoids layout features email clients do not support", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} uses flex`).not.toContain("display:flex");
      expect(html, `${id} uses grid`).not.toContain("display:grid");
      expect(html, `${id} uses a background image`).not.toContain("background-image");
    }
  });

  it("keeps every variant within 600px", () => {
    for (const [id, html] of all()) {
      for (const m of html.matchAll(/max-width:\s*(\d+)px/g)) {
        expect(Number(m[1]), `${id} is wider than 600px`).toBeLessThanOrEqual(600);
      }
    }
  });

  it("gives every image an alt, an explicit size and display:block", () => {
    for (const [id, html] of all()) {
      for (const img of parse(html).querySelectorAll("img")) {
        expect(img.getAttribute("alt"), `${id} image has no alt`).toBeTruthy();
        expect(img.getAttribute("width"), `${id} image has no width`).toBeTruthy();
        expect(img.getAttribute("height"), `${id} image has no height`).toBeTruthy();
        expect(img.getAttribute("style"), `${id} image is not block`).toContain("display:block");
      }
    }
  });

  it("styles every link inline, since email clients repaint an unstyled link", () => {
    for (const [id, html] of all()) {
      for (const a of parse(html).querySelectorAll("a")) {
        expect(a.getAttribute("style"), `${id} link is unstyled`).toContain("color:");
        expect(a.getAttribute("style"), `${id} link is underlined`).toContain(
          "text-decoration:none",
        );
      }
    }
  });

  it("renders the person's real details and invents nothing", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} drops the name`).toContain("Jake Lee");
      expect(html, `${id} drops the email`).toContain("hello@sunmountainstays.com");
    }
  });

  it("writes no em dash", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} contains an em dash`).not.toContain("\u2014");
    }
  });

  it("omits the logo entirely in the single-line variant", () => {
    expect(
      parse(renderSignature("single-line", config, person)).querySelectorAll("img"),
    ).toHaveLength(0);
  });

  it("carries the person's link in the two-column variant", () => {
    const html = renderSignature("two-column", config, person);
    expect(html).toContain("https://sunmountainstays.com/contact");
    expect(html).toContain("Book a call");
  });

  it("omits the link column when the person has no link", () => {
    const html = renderSignature("two-column", config, { ...person, link: undefined });
    expect(html).not.toContain("Book a call");
  });

  it("escapes a value that would otherwise break the markup", () => {
    const html = renderSignature("ruled", config, { ...person, title: 'Founder & "Chief"' });
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });
});
