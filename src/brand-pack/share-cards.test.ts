import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { CARD_SIZE, renderShareCard, SHARE_CARD_IDS, SHARE_CARD_VARIANTS } from "./share-cards.mjs";

const config = {
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Front Range short-term rental management",
  markUrl: "https://sunmountainstays.com/brand/mark-512.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "Newsreader",
  bodyFont: "Instrument Sans",
  ink: "#0d2318",
  ground: "#f7f4ec",
  brand: "#c8912f",
  accent: "#b0492b",
  photoUrl: "https://sunmountainstays.com/brand/share.jpg",
  shareCard: "mark-rule",
  people: [],
};

// biome-ignore lint/suspicious/noExplicitAny: walking an untyped plain tree
const text = (node: any): string =>
  // biome-ignore lint/suspicious/noExplicitAny: walking an untyped plain tree
  typeof node === "string" ? node : (node?.children ?? []).map((c: any) => text(c)).join(" ");

describe("share card variants", () => {
  it("ships exactly five, with distinct ids", () => {
    expect(SHARE_CARD_IDS).toHaveLength(5);
    expect(new Set(SHARE_CARD_IDS).size).toBe(5);
    expect(SHARE_CARD_VARIANTS.map((v: { id: string }) => v.id)).toEqual(SHARE_CARD_IDS);
  });

  it("renders at the one size every platform crops from", () => {
    expect(CARD_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("throws on an unknown variant", () => {
    expect(() => renderShareCard("nope", config)).toThrow(/nope/);
  });

  it("gives every card an explicit size and a background", () => {
    for (const id of SHARE_CARD_IDS) {
      const node = renderShareCard(id, config);
      expect(node.style.width, `${id} width`).toBe(1200);
      expect(node.style.height, `${id} height`).toBe(630);
      expect(node.style.backgroundColor, `${id} has no ground`).toBeTruthy();
    }
  });

  it("sets display flex on every element with more than one child, which Satori requires", () => {
    // biome-ignore lint/suspicious/noExplicitAny: walking an untyped plain tree
    const walk = (n: any): void => {
      if (typeof n === "string") return;
      const kids = n.children ?? [];
      if (kids.length > 1)
        expect(n.style?.display, `${n.tag} with ${kids.length} children`).toBe("flex");
      // biome-ignore lint/suspicious/noExplicitAny: walking an untyped plain tree
      kids.forEach((k: any) => walk(k));
    };
    for (const id of SHARE_CARD_IDS) walk(renderShareCard(id, config));
  });

  it("takes every word from the config and invents none", () => {
    const allowed = `${config.wordmark} ${config.tagline}`;
    for (const id of SHARE_CARD_IDS) {
      const words = text(renderShareCard(id, config)).trim();
      if (!words) continue;
      for (const w of words.split(/\s+/)) {
        expect(allowed.includes(w), `${id} invented the word "${w}"`).toBe(true);
      }
    }
  });

  it("writes no text at all in the photo-mark variant", () => {
    expect(text(renderShareCard("photo-mark", config)).trim()).toBe("");
  });

  it("falls back to the mark card when a photo variant has no photograph", () => {
    const node = renderShareCard("photo-scrim", { ...config, photoUrl: undefined });
    expect(node.fallbackFrom).toBe("photo-scrim");
  });

  it("writes no em dash", () => {
    for (const id of SHARE_CARD_IDS) {
      expect(text(renderShareCard(id, config))).not.toContain("\u2014");
    }
  });
});
