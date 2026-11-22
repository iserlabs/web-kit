/** Reduced-motion and SSR helpers. Safe to import anywhere: nothing touches the DOM at import time. */

export const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export interface MediaLike {
  matchMedia?: (query: string) => {
    matches: boolean;
    addEventListener?: (type: "change", cb: (e: { matches: boolean }) => void) => void;
    removeEventListener?: (type: "change", cb: (e: { matches: boolean }) => void) => void;
  };
}

const defaultWin = (): MediaLike | undefined =>
  typeof window === "undefined" ? undefined : window;

/**
 * True when the visitor asked for reduced motion. On the server (no window) this is
 * `false` by default, so the server markup is the full version; client code re-checks
 * after mount. Pass `fallback: true` to default to the still version instead.
 */
export function prefersReducedMotion(
  win: MediaLike | undefined = defaultWin(),
  fallback = false,
): boolean {
  if (!win || typeof win.matchMedia !== "function") return fallback;
  return win.matchMedia(REDUCED_QUERY).matches;
}

/** Subscribe to changes. Returns an unsubscribe function; a no-op without matchMedia. */
export function onReducedMotionChange(
  cb: (reduced: boolean) => void,
  win: MediaLike | undefined = defaultWin(),
): () => void {
  if (!win || typeof win.matchMedia !== "function") return () => {};
  const mq = win.matchMedia(REDUCED_QUERY);
  const handler = (e: { matches: boolean }) => cb(e.matches);
  mq.addEventListener?.("change", handler);
  return () => mq.removeEventListener?.("change", handler);
}

/** Pick a duration: reduced motion keeps the time but the caller drops the distance. */
export const reducedDuration = (reduced: boolean, ms: number): number =>
  reduced ? Math.min(ms, 200) : ms;

/** Distance in px: reduced motion drops movement to nothing (cross-fade only). */
export const reducedDistance = (reduced: boolean, px: number): number => (reduced ? 0 : px);
