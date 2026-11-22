"use client";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadGsap } from "./gsap-loader";
import { useReducedMotion } from "./hooks";

export interface MotionContextValue {
  /** Visitor asked for reduced motion: every motion part shows its still version. */
  reduced: boolean;
  /** GSAP and ScrollTrigger are loaded and registered. Always false while reduced. */
  ready: boolean;
  /** Lenis smooth scroll is running. */
  smooth: boolean;
}

const MotionContext = createContext<MotionContextValue>({
  reduced: false,
  ready: false,
  smooth: false,
});
export const useMotion = (): MotionContextValue => useContext(MotionContext);

export interface MotionProviderProps {
  children: ReactNode;
  /** Smooth scroll is opt-in per site. Default off. */
  smoothScroll?: boolean;
  /** Lenis options when smoothScroll is on. */
  lenisOptions?: { lerp?: number; wheelMultiplier?: number };
}

/**
 * Registers GSAP + ScrollTrigger once and, if the site opts in, starts Lenis.
 * Everything is skipped under prefers-reduced-motion, and torn down if the visitor
 * flips the setting mid-visit. Refreshes triggers and returns to top on route change.
 */
export function MotionProvider({
  children,
  smoothScroll = false,
  lenisOptions,
}: MotionProviderProps) {
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [smooth, setSmooth] = useState(false);
  const lenisRef = useRef<{ scrollTo: (n: number, o?: { immediate?: boolean }) => void } | null>(
    null,
  );
  const opts = useRef(lenisOptions);
  opts.current = lenisOptions;

  useEffect(() => {
    if (reduced) {
      setReady(false);
      setSmooth(false);
      return;
    }
    let dead = false;
    let cleanup: (() => void) | undefined;
    loadGsap()
      .then(async ({ gsap, ScrollTrigger }) => {
        if (dead) return;
        ScrollTrigger.config({ ignoreMobileResize: true });
        if (smoothScroll) {
          const { default: Lenis } = await import("lenis");
          if (dead) return;
          const lenis = new Lenis({
            lerp: opts.current?.lerp ?? 0.09,
            wheelMultiplier: opts.current?.wheelMultiplier ?? 1,
            smoothWheel: true,
          });
          const onScroll = () => ScrollTrigger.update();
          lenis.on("scroll", onScroll);
          const tick = (t: number) => lenis.raf(t * 1000);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
          lenisRef.current = lenis;
          setSmooth(true);
          cleanup = () => {
            gsap.ticker.remove(tick);
            lenis.off("scroll", onScroll);
            lenis.destroy();
            lenisRef.current = null;
          };
        }
        setReady(true);
      })
      .catch(() => {
        /* GSAP failed to load: parts fall back to their still versions */
      });
    return () => {
      dead = true;
      cleanup?.();
      setSmooth(false);
    };
  }, [reduced, smoothScroll]);

  // Route change: top of page, fresh trigger positions.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    lenisRef.current?.scrollTo(0, { immediate: true });
    loadGsap()
      .then(({ ScrollTrigger }) => ScrollTrigger.refresh())
      .catch(() => {});
  }, [pathname, reduced]);

  const value = useMemo(
    () => ({ reduced, ready: ready && !reduced, smooth }),
    [reduced, ready, smooth],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}
