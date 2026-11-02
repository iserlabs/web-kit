import { describe, expect, it, vi } from "vitest";
import {
  type Drawing,
  fitWithin,
  NOT_OPENED,
  SEND_LIMIT,
  SHRINK_ABOVE,
  STILL_TOO_BIG,
  shrinkForForm,
} from "./shrink-photo";

const file = (bytes: number, type = "image/jpeg") =>
  new File([new Uint8Array(bytes)], "IMG_0001.jpg", { type });

const drawing = (sizes: number[], w = 6000, h = 4000): Drawing & { calls: number[] } => {
  const calls: number[] = [];
  return {
    calls,
    decode: async () => ({ width: w, height: h, draw: null }),
    encode: async (_i, size, q) => {
      calls.push(q);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(2400);
      return new Blob([new Uint8Array(sizes[calls.length - 1] ?? 1)], { type: "image/jpeg" });
    },
  };
};

describe("fitWithin", () => {
  it("scales the long edge to 2400 and keeps the shape, and never enlarges", () => {
    expect(fitWithin(6000, 4000)).toEqual({ width: 2400, height: 1600 });
    expect(fitWithin(3000, 4500)).toEqual({ width: 1600, height: 2400 });
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});

describe("shrinking a photograph for the poster form", () => {
  it("sends a small photograph as it is", async () => {
    const f = file(SHRINK_ABOVE - 1);
    const d = drawing([]);
    const out = await shrinkForForm(f, d);
    expect(out).toEqual({ ok: true, file: f });
    expect(d.calls).toEqual([]);
  });

  it("redraws an 8 MB photograph as a JPEG that fits under 4 MB", async () => {
    const out = await shrinkForForm(file(8 * 1048576), drawing([1_500_000]));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.file.type).toBe("image/jpeg");
    expect(out.file.name).toBe("photo.jpg");
    expect(out.file.size).toBeLessThanOrEqual(SEND_LIMIT);
  });

  it("tries lower quality when the first copy is still over 4 MB, then gives up in words", async () => {
    const d = drawing([SEND_LIMIT + 1, 2_000_000]);
    const ok = await shrinkForForm(file(9 * 1048576), d);
    expect(ok.ok).toBe(true);
    expect(d.calls).toEqual([0.85, 0.7]);
    const bad = await shrinkForForm(
      file(9 * 1048576),
      drawing([SEND_LIMIT + 1, SEND_LIMIT + 1, SEND_LIMIT + 1]),
    );
    expect(bad).toEqual({ ok: false, error: STILL_TOO_BIG });
  });

  it("says how to export a JPEG when the browser cannot open the photograph", async () => {
    const d: Drawing = {
      decode: vi.fn().mockRejectedValue(new Error("cannot decode")),
      encode: vi.fn(),
    };
    const out = await shrinkForForm(file(6 * 1048576, "image/heic"), d);
    expect(out).toEqual({ ok: false, error: NOT_OPENED });
    expect(NOT_OPENED).toContain("export it as a JPEG");
    expect(NOT_OPENED).not.toMatch(/!|—/);
  });

  it("redraws a large photograph of a kind the form would not accept as it is", async () => {
    const out = await shrinkForForm(file(1000, "image/avif"), drawing([500_000]));
    expect(out.ok && out.file.type).toBe("image/jpeg");
  });
});
