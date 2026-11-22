"use client";
import { useEffect, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "./reduced-motion";

/**
 * Reduced-motion flag for React. Starts `false` on server and first client render so
 * hydration matches, then syncs after mount and follows later changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(prefersReducedMotion());
    return onReducedMotionChange(setReduced);
  }, []);
  return reduced;
}

/** True once the element has been within `rootMargin` of the viewport (stays true). */
export function useInView(ref: { current: Element | null }, rootMargin = "300px"): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, seen]);
  return seen;
}
