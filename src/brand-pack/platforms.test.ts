import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { PLATFORM_IDS, PLATFORMS } from "./platforms.mjs";

type Frame = {
  id: string;
  cardWidth: number;
  cardHeight: number;
  showsTitle: boolean;
  showsDescription: boolean;
  showsDomain: boolean;
  note: string;
};

describe("platform frames", () => {
  it("covers the seven surfaces a client link actually lands on", () => {
    expect(PLATFORM_IDS).toEqual([
      "imessage",
      "whatsapp",
      "slack",
      "linkedin",
      "x",
      "facebook",
      "google",
    ]);
  });

  it("gives every frame a real pixel size, not a ratio to be inferred", () => {
    for (const p of PLATFORMS as Frame[]) {
      expect(p.cardWidth, `${p.id} width`).toBeGreaterThan(0);
      expect(p.cardHeight, `${p.id} height`).toBeGreaterThan(0);
    }
  });

  it("keeps at least one near-square frame, which is the crop that kills a card", () => {
    const ratios = (PLATFORMS as Frame[]).map((p) => p.cardWidth / p.cardHeight);
    expect(Math.min(...ratios)).toBeLessThan(1.3);
  });

  it("keeps at least one wide frame at roughly 1.91:1", () => {
    const ratios = (PLATFORMS as Frame[]).map((p) => p.cardWidth / p.cardHeight);
    expect(Math.max(...ratios)).toBeGreaterThan(1.8);
  });

  it("says of every frame whether it shows the title, description and domain", () => {
    for (const p of PLATFORMS as Frame[]) {
      expect(typeof p.showsTitle, p.id).toBe("boolean");
      expect(typeof p.showsDescription, p.id).toBe("boolean");
      expect(typeof p.showsDomain, p.id).toBe("boolean");
    }
  });

  it("gives every frame a note explaining what it does to the card", () => {
    for (const p of PLATFORMS as Frame[]) expect(p.note.length).toBeGreaterThan(0);
  });
});
