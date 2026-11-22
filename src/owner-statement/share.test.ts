import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ShareCardTree, StatementBrand, StatementModel } from "./index.js";
import {
  BRANDS,
  formatCents,
  renderStatementShareCard,
  SHARE_CARD_SAFE,
  SHARE_CARD_SIZE,
  statementShareMeta,
} from "./index.mjs";

const BRAND_FILES: StatementBrand[] = ["sun-mountain", "palisade", "columbus", "xenia"];
const PLACE: Record<StatementBrand, { place: string; street?: string }> = {
  "sun-mountain": { place: "Springfield, CO" },
  palisade: { place: "Springfield, NJ" },
  columbus: { place: "Middletown, NY", street: "52 and 89 Cottage St" },
  xenia: { place: "Cleveland, Ohio" },
};
const PHOTO = "https://example.com/photos/home.jpg";
const MARK = "https://example.com/brand/mark.png";

function load(name: string): StatementModel {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as StatementModel;
}

/** The fixture moved to November 2026, the month the new template starts. */
function november(name: StatementBrand): StatementModel {
  const m = load(name);
  m.month = "2026-11";
  m.monthLabel = "November 2026";
  m.monthShort = "November";
  return m;
}

/** Anything that reads as money: a dollar sign, thousands commas, or a figure with cents. */
const MONEY = /\$|\d,\d{3}|\d\.\d{2}\b/;

const strings = (o: unknown): string[] =>
  typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(strings) : [];

const texts = (n: ShareCardTree | string): string[] =>
  typeof n === "string" ? [n] : n.children.flatMap(texts);

const nodes = (n: ShareCardTree | string): ShareCardTree[] =>
  typeof n === "string" ? [] : [n, ...n.children.flatMap(nodes)];

describe("statementShareMeta", () => {
  it("prints the picked tags: month, owner statement and property; brand and place", () => {
    const meta = statementShareMeta(november("palisade"), { place: "Englewood, New Jersey" });
    expect(meta.title).toBe("November 2026 owner statement · 200 Oak Street");
    expect(meta.description).toBe("Palisade Stays · Englewood, New Jersey");
    expect(meta.siteName).toBe("Palisade Stays");
    expect(meta.imageAlt).toBe("Palisade Stays owner statement, November 2026, 200 Oak Street");
    expect(meta.imageWidth).toBe(1200);
    expect(meta.imageHeight).toBe(630);
  });

  it("a business with a short name: the preview carries the short name, never a client's name", () => {
    const meta = statementShareMeta(november("xenia"), PLACE.xenia);
    expect(meta.siteName).toBe("Xenia");
    expect(meta.description).toBe("Xenia · Cleveland, Ohio");
    expect(meta.imageAlt).toBe("Xenia owner statement, November 2026, The Euclid Grand");
    expect(strings(meta).join("\n")).not.toMatch(/Roam North|Hospitality Operations/);
  });

  it("when the property is the brand, the street leads the description and the alt drops the repeat", () => {
    const meta = statementShareMeta(november("columbus"), PLACE.columbus);
    expect(meta.title).toBe("November 2026 owner statement · The Columbus Hotel");
    expect(meta.description).toBe("52 and 89 Cottage St · Middletown, NY");
    expect(meta.imageAlt).toBe("The Columbus Hotel owner statement, November 2026");
  });

  it("needs the street when the property is the brand, and always needs the place", () => {
    expect(() => statementShareMeta(november("columbus"), { place: "Middletown, NY" })).toThrow(
      /street/,
    );
    expect(() =>
      statementShareMeta(november("palisade"), {} as unknown as { place: string }),
    ).toThrow(/place/);
  });

  it("carries the image address only when it is handed one", () => {
    const m = november("xenia");
    expect(statementShareMeta(m, PLACE.xenia).image).toBeUndefined();
    expect(
      statementShareMeta(m, { ...PLACE.xenia, imageUrl: "/s/x/opengraph-image" }).image,
    ).toEqual({
      url: "/s/x/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Xenia owner statement, November 2026, The Euclid Grand",
    });
  });

  it("never lets a dollar figure, an owner name or a stay count out, even from a model full of them", () => {
    for (const name of BRAND_FILES) {
      const m = november(name);
      m.owner = { ...m.owner, name: "Margaret Whitfield-Oyelaran", greeting: "Margaret" };
      m.moves = {
        ...m.moves,
        headline: "Paid to Margaret: $12,345.67",
        line: "for 14 stays and 61 nights",
        sentence: "Margaret, we sent you $12,345.67 for 14 stays.",
      };
      const meta = statementShareMeta(m, PLACE[name]);
      const out = strings(meta).join("\n");
      expect(out, name).not.toMatch(MONEY);
      expect(out, name).not.toMatch(/Margaret|Whitfield|Oyelaran/);
      expect(out, name).not.toMatch(/\d+\s+stays?\b/i);
      expect(out, name).not.toMatch(/\d+\s+nights?\b/i);
      for (const c of [m.moves.cents, ...m.summary.rows.map((r) => Math.abs(r.month))]) {
        expect(out).not.toContain(formatCents(c));
      }
      for (const word of ["Roam North", m.owner.key]) expect(out).not.toContain(word);
    }
  });

  it("refuses a place or street that would carry money or the owner's name onto the card", () => {
    const m = november("palisade");
    expect(() => statementShareMeta(m, { place: "Englewood, NJ, $4,200.00" })).toThrow(/money/);
    expect(() => statementShareMeta(m, { place: `${m.owner.name}'s house` })).toThrow(/owner/);
  });

  it("refuses a model that does not validate, so a broken statement never gets a card", () => {
    const m = november("palisade");
    m.status = "draft" as "final";
    expect(() => statementShareMeta(m, PLACE.palisade)).toThrow(/status/);
  });

  it("the words are plain: no em dash, no exclamation mark", () => {
    for (const name of BRAND_FILES) {
      const out = strings(statementShareMeta(november(name), PLACE[name])).join("");
      expect(out).not.toContain(String.fromCharCode(0x2014));
      expect(out).not.toContain("!");
    }
  });
});

describe("renderStatementShareCard (option 1, photo and seal)", () => {
  const card = (name: StatementBrand, extra: Record<string, unknown> = {}) =>
    renderStatementShareCard(november(name), {
      photoUrl: PHOTO,
      markUrl: MARK,
      ...PLACE[name],
      ...extra,
    });

  it("is 1200 by 630 with a ground color", () => {
    expect(SHARE_CARD_SIZE).toEqual({ width: 1200, height: 630 });
    for (const name of BRAND_FILES) {
      const root = card(name);
      expect(root.style.width).toBe(1200);
      expect(root.style.height).toBe(630);
      expect(root.style.backgroundColor, name).toBeTruthy();
    }
  });

  it("is Satori-safe: display flex on every element with more than one child", () => {
    for (const name of BRAND_FILES) {
      for (const n of nodes(card(name))) {
        if (n.children.length > 1) expect(n.style.display, `${name} ${n.tag}`).toBe("flex");
      }
    }
  });

  it("every image carries its own width and height, and a div never carries a src", () => {
    for (const name of BRAND_FILES) {
      for (const n of nodes(card(name))) {
        if (n.tag === "img") {
          expect(typeof n.style.width, `${name} img width`).toBe("number");
          expect(typeof n.style.height, `${name} img height`).toBe("number");
          expect(n.src).toBeTruthy();
        } else {
          expect(n.src).toBeUndefined();
        }
      }
    }
  });

  it("prints the month large, the Owner statement line, then year and address, and nothing else", () => {
    expect(texts(card("palisade"))).toEqual([
      "November",
      "Owner statement",
      "2026 · 200 Oak Street",
    ]);
    expect(texts(card("columbus"))).toEqual([
      "November",
      "Owner statement",
      "2026 · Middletown, NY",
    ]);
    expect(texts(card("xenia"))).toEqual([
      "November",
      "Owner statement",
      "2026 · The Euclid Grand",
    ]);
  });

  it("never prints a figure, the owner's name or a stay count", () => {
    for (const name of BRAND_FILES) {
      const m = november(name);
      m.owner = { ...m.owner, name: "Margaret Whitfield", greeting: "Margaret" };
      const tree = renderStatementShareCard(m, { photoUrl: PHOTO, markUrl: MARK, ...PLACE[name] });
      const out = texts(tree).join("\n");
      expect(out).not.toMatch(MONEY);
      expect(out).not.toMatch(/Margaret|Whitfield|\d+\s+(stays?|nights?)\b/i);
    }
  });

  it("keeps the text block and the seal inside the center square the WhatsApp and Google crops show", () => {
    // The square crop is x 285 to 915; the safe box keeps a 30px margin inside it.
    expect(SHARE_CARD_SAFE).toEqual({ left: 315, width: 570 });
    for (const name of BRAND_FILES) {
      const root = card(name);
      const text = nodes(root).find((n) => n.role === "text");
      const seal = nodes(root).find((n) => n.role === "seal");
      for (const [what, n] of [
        ["text", text],
        ["seal", seal],
      ] as const) {
        expect(n, `${name} ${what}`).toBeTruthy();
        const left = Number(n?.style.left);
        const width = Number(n?.style.width);
        expect(left, `${name} ${what} left`).toBeGreaterThanOrEqual(315);
        expect(left + width, `${name} ${what} right`).toBeLessThanOrEqual(885);
      }
      expect(text?.style.alignItems).toBe("center");
      // Each line is bounded by the safe box so a long address wraps instead of leaving it.
      for (const line of text?.children ?? []) {
        if (typeof line === "string") continue;
        expect(line.style.maxWidth, `${name} line`).toBe(570);
      }
    }
  });

  it("steps a long address down to the 30px floor, then lets it wrap inside the safe box", () => {
    const short = nodes(card("sun-mountain")).find((n) => n.role === "sub");
    const m = november("sun-mountain");
    m.property = { ...m.property, label: "14820 Old Ranch Road North and Carriage House" };
    const long = nodes(
      renderStatementShareCard(m, { photoUrl: PHOTO, markUrl: MARK, place: "Monument, CO" }),
    ).find((n) => n.role === "sub");
    expect(short?.style.fontSize).toBe(34);
    expect(long?.style.fontSize).toBe(30);
    expect(long?.style.textAlign).toBe("center");
  });

  it("uses each brand's locked faces and palette from the brand tokens", () => {
    for (const name of BRAND_FILES) {
      const t = BRANDS[name].card;
      const month = nodes(card(name)).find((n) => n.role === "month");
      expect(month?.style.fontFamily).toBe(t.monthFont);
      expect(month?.style.color).toBe(t.light);
      expect(month?.style.fontSize).toBe(t.monthSize);
    }
    expect(BRANDS.palisade.card.monthFont).toBe("EB Garamond");
    expect(BRANDS.columbus.card.monthFont).toBe("Literata");
    expect(BRANDS["sun-mountain"].card.monthFont).toBe("Newsreader");
    expect(BRANDS.xenia.card.monthFont).toBe("Newsreader");
  });

  it("Palisade keeps its gold stripe; the others carry none", () => {
    const stripe = (name: StatementBrand) => nodes(card(name)).some((n) => n.role === "stripe");
    expect(stripe("palisade")).toBe(true);
    for (const name of ["sun-mountain", "columbus", "xenia"] as const) {
      expect(stripe(name)).toBe(false);
    }
  });

  it("a site may name its own loaded faces", () => {
    const month = nodes(card("xenia", { fonts: { display: "Newsreader Local" } })).find(
      (n) => n.role === "month",
    );
    expect(month?.style.fontFamily).toBe("Newsreader Local");
  });

  it("a crop places the photo at an explicit size and offset; with none it covers the card", () => {
    const photo = (extra: Record<string, unknown>) =>
      nodes(card("sun-mountain", extra)).find((n) => n.tag === "img" && n.role === "photo");
    expect(photo({})?.style).toMatchObject({ width: 1200, height: 630, objectFit: "cover" });
    expect(
      photo({ photoCrop: { width: 1200, height: 800, left: 0, top: -100 } })?.style,
    ).toMatchObject({ position: "absolute", width: 1200, height: 800, left: 0, top: -100 });
  });

  it("a missing photo renders a visible No photo supplied state instead of crashing", () => {
    for (const photoUrl of [undefined, "", "__UNFILLED__"]) {
      const tree = renderStatementShareCard(november("columbus"), {
        photoUrl,
        markUrl: MARK,
        ...PLACE.columbus,
      });
      expect(texts(tree)).toContain("No photo supplied");
      expect(nodes(tree).some((n) => n.tag === "img" && n.role === "photo")).toBe(false);
      expect(texts(tree)).toContain("November");
    }
  });

  it("a missing mark shows No mark supplied in the seal", () => {
    expect(texts(card("palisade", { markUrl: undefined }))).toContain("No mark supplied");
  });

  it("refuses a model that does not validate", () => {
    const m = november("xenia");
    m.status = "draft" as "final";
    expect(() =>
      renderStatementShareCard(m, { photoUrl: PHOTO, markUrl: MARK, ...PLACE.xenia }),
    ).toThrow(/status/);
  });
});
