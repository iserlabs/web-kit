/**
 * Motion tokens: the house defaults from web-craft-ceiling 5g, in one place.
 * Durations are seconds (GSAP units); `ms` mirrors them for CSS and timers.
 */

/** Interface motion lives in the 150 to 250ms band. 600ms reads as broken. */
export const UI_MIN_MS = 150;
export const UI_MAX_MS = 250;
export const UI_DEFAULT_MS = 200;

/** Exits run about 20% shorter than the matching entrance. */
export const EXIT_RATIO = 0.8;

export const PRESS_SCALE = 0.97;
export const POPOVER_START_SCALE = 0.95;
export const STAGGER_MS = 30;

/** Cinematic (non-UI) scene motion: scroll sequences, camera flights. */
export const SCENE_FLIGHT_S = 1.2;
export const SCENE_FADE_S = 0.9;

export type Bezier = readonly [number, number, number, number];

export const easings = {
  /** Things entering. */
  out: [0.22, 0.61, 0.36, 1],
  /** Things moving on screen. */
  inOut: [0.65, 0, 0.35, 1],
  /** Things leaving (paired with the shorter exit duration). */
  in: [0.4, 0, 1, 1],
} as const satisfies Record<string, Bezier>;

export type EaseName = keyof typeof easings;

export const toCss = (b: Bezier): string => `cubic-bezier(${b.join(",")})`;

/** GSAP ease names that match the CSS curves closely enough to share a feel. */
export const gsapEase = { out: "power2.out", inOut: "power2.inOut", in: "power2.in" } as const;

export const clampUiMs = (ms: number): number => Math.min(UI_MAX_MS, Math.max(UI_MIN_MS, ms));

/** Exit duration for a given entrance duration, never below the 150ms floor. */
export const exitMs = (enterMs: number): number =>
  Math.max(UI_MIN_MS, Math.round(enterMs * EXIT_RATIO));

export const staggerDelayMs = (index: number, stepMs: number = STAGGER_MS): number =>
  Math.max(0, Math.floor(index)) * stepMs;

export const tokens = {
  duration: { ms: UI_DEFAULT_MS, min: UI_MIN_MS, max: UI_MAX_MS, exitMs: exitMs(UI_DEFAULT_MS) },
  ease: easings,
  pressScale: PRESS_SCALE,
  popoverStartScale: POPOVER_START_SCALE,
  staggerMs: STAGGER_MS,
} as const;

/** CSS custom properties, ready to paste in `:root` (also shipped in motion.css). */
export const cssVariables = (): Record<string, string> => ({
  "--wk-dur": `${UI_DEFAULT_MS}ms`,
  "--wk-dur-exit": `${exitMs(UI_DEFAULT_MS)}ms`,
  "--wk-ease-out": toCss(easings.out),
  "--wk-ease-in-out": toCss(easings.inOut),
  "--wk-ease-in": toCss(easings.in),
  "--wk-press-scale": String(PRESS_SCALE),
  "--wk-popover-start": String(POPOVER_START_SCALE),
  "--wk-stagger": `${STAGGER_MS}ms`,
});
