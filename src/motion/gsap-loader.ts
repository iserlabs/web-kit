/**
 * Lazy GSAP + ScrollTrigger loader. GSAP stays out of the first bundle: it loads the
 * first time something calls `loadGsap()`. ScrollTrigger registers exactly once.
 */
import type { gsap as GsapType } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

export interface GsapBundle {
  gsap: typeof GsapType;
  ScrollTrigger: typeof ScrollTriggerType;
}

let pending: Promise<GsapBundle> | null = null;

export function loadGsap(): Promise<GsapBundle> {
  if (typeof window === "undefined") return Promise.reject(new Error("loadGsap is browser-only"));
  if (!pending) {
    pending = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, s]) => {
      const gsap = g.gsap ?? (g as unknown as { default: typeof GsapType }).default;
      const ScrollTrigger =
        s.ScrollTrigger ?? (s as unknown as { default: typeof ScrollTriggerType }).default;
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    });
  }
  return pending;
}

/** Test hook: forget the cached load. */
export function __resetGsapLoader(): void {
  pending = null;
}
