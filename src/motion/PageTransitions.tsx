"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type AnchorHTMLAttributes,
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useReducedMotion } from "./hooks";
import { runViewTransition } from "./view-transitions";

type Navigate = (href: string) => Promise<void>;
const Ctx = createContext<Navigate | null>(null);

const SAFETY_MS = 2000;

/**
 * Wrap the app once (inside the root layout). Links rendered with <TransitionLink> or
 * navigations made with useTransitionNavigate() run inside a same-document view transition
 * when supported; everything else (no support, reduced motion, modified clicks) is an
 * ordinary Next navigation. Include motion.css for the cross-fade and the reduced-motion guard.
 */
export function PageTransitions({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const resolveRef = useRef<(() => void) | null>(null);

  // The new route has rendered: let the transition capture the new state.
  useEffect(() => {
    resolveRef.current?.();
    resolveRef.current = null;
  }, [pathname]);

  const navigate = useCallback<Navigate>(
    async (href) => {
      await runViewTransition(
        () =>
          new Promise<void>((resolve) => {
            resolveRef.current = resolve;
            router.push(href);
            setTimeout(resolve, SAFETY_MS);
          }),
        { reduced },
      );
    },
    [router, reduced],
  );
  const value = useMemo(() => navigate, [navigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTransitionNavigate(): Navigate {
  const nav = useContext(Ctx);
  const router = useRouter();
  return nav ?? (async (href: string) => router.push(href));
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/** Drop-in Link that navigates through a view transition. */
export function TransitionLink({ href, onClick, ...rest }: LinkProps) {
  const navigate = useTransitionNavigate();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    if (rest.target && rest.target !== "_self") return;
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return; // external
    e.preventDefault();
    void navigate(href);
  };
  return <Link href={href} onClick={handle} {...rest} />;
}
