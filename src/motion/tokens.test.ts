import { describe, expect, it } from "vitest";
import {
  clampUiMs,
  cssVariables,
  EXIT_RATIO,
  easings,
  exitMs,
  POPOVER_START_SCALE,
  PRESS_SCALE,
  STAGGER_MS,
  staggerDelayMs,
  toCss,
  tokens,
  UI_MAX_MS,
  UI_MIN_MS,
} from "./tokens";

describe("motion tokens (web-craft-ceiling 5g)", () => {
  it("keeps the UI band at 150 to 250ms", () => {
    expect(UI_MIN_MS).toBe(150);
    expect(UI_MAX_MS).toBe(250);
    expect(tokens.duration.ms).toBeGreaterThanOrEqual(UI_MIN_MS);
    expect(tokens.duration.ms).toBeLessThanOrEqual(UI_MAX_MS);
    expect(clampUiMs(600)).toBe(250);
    expect(clampUiMs(40)).toBe(150);
  });
  it("makes exits about 20% shorter, never under the floor", () => {
    expect(EXIT_RATIO).toBe(0.8);
    expect(exitMs(250)).toBe(200);
    expect(exitMs(200)).toBe(160);
    expect(exitMs(150)).toBe(150);
  });
  it("has the fixed scales and stagger", () => {
    expect(PRESS_SCALE).toBe(0.97);
    expect(POPOVER_START_SCALE).toBe(0.95);
    expect(STAGGER_MS).toBe(30);
    expect(staggerDelayMs(4)).toBe(120);
    expect(staggerDelayMs(-2)).toBe(0);
  });
  it("never uses linear easing", () => {
    for (const b of Object.values(easings)) expect(b).toHaveLength(4);
    expect(toCss(easings.out)).toBe("cubic-bezier(0.22,0.61,0.36,1)");
  });
  it("exports matching css variables", () => {
    const v = cssVariables();
    expect(v["--wk-dur"]).toBe("200ms");
    expect(v["--wk-dur-exit"]).toBe("160ms");
    expect(v["--wk-press-scale"]).toBe("0.97");
    expect(v["--wk-stagger"]).toBe("30ms");
  });
});
