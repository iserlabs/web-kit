import { describe, expect, it, vi } from "vitest";
import {
  onReducedMotionChange,
  prefersReducedMotion,
  REDUCED_QUERY,
  reducedDistance,
  reducedDuration,
} from "./reduced-motion";
import { runViewTransition, supportsViewTransitions } from "./view-transitions";

const win = (matches: boolean) => {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  return {
    listeners,
    matchMedia: vi.fn((q: string) => ({
      matches: q === REDUCED_QUERY ? matches : false,
      addEventListener: (_: "change", cb: (e: { matches: boolean }) => void) => listeners.push(cb),
      removeEventListener: (_: "change", cb: (e: { matches: boolean }) => void) =>
        listeners.splice(listeners.indexOf(cb), 1),
    })),
  };
};

describe("reduced motion", () => {
  it("is false on the server (no window) so server markup is the full version", () => {
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(prefersReducedMotion(undefined, true)).toBe(true);
    expect(prefersReducedMotion({})).toBe(false);
  });
  it("reads the media query", () => {
    expect(prefersReducedMotion(win(true))).toBe(true);
    expect(prefersReducedMotion(win(false))).toBe(false);
  });
  it("subscribes and unsubscribes", () => {
    const w = win(false);
    const cb = vi.fn();
    const off = onReducedMotionChange(cb, w);
    w.listeners[0]?.({ matches: true });
    expect(cb).toHaveBeenCalledWith(true);
    off();
    expect(w.listeners).toHaveLength(0);
    expect(onReducedMotionChange(cb, undefined)()).toBeUndefined();
  });
  it("drops distance, keeps a short duration", () => {
    expect(reducedDistance(true, 40)).toBe(0);
    expect(reducedDistance(false, 40)).toBe(40);
    expect(reducedDuration(true, 900)).toBe(200);
    expect(reducedDuration(false, 900)).toBe(900);
  });
});

describe("view transitions wrapper", () => {
  it("runs the update plainly when reduced, even if supported", async () => {
    const start = vi.fn();
    const update = vi.fn();
    expect(
      await runViewTransition(update, { reduced: true, doc: { startViewTransition: start } }),
    ).toBe("plain");
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
  it("falls back when unsupported", async () => {
    const update = vi.fn();
    expect(supportsViewTransitions({})).toBe(false);
    expect(await runViewTransition(update, { doc: {} })).toBe("plain");
    expect(update).toHaveBeenCalledOnce();
  });
  it("uses the API when supported and survives an aborted transition", async () => {
    const update = vi.fn();
    const ok = {
      startViewTransition: vi.fn((u: () => void) => {
        u();
        return { finished: Promise.resolve() };
      }),
    };
    expect(await runViewTransition(update, { doc: ok })).toBe("transition");
    expect(update).toHaveBeenCalledOnce();
    const bad = {
      startViewTransition: vi.fn(() => ({ finished: Promise.reject(new Error("abort")) })),
    };
    expect(await runViewTransition(vi.fn(), { doc: bad })).toBe("transition");
  });
});
