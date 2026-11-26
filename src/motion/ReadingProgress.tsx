import type { CSSProperties } from "react";

export interface ReadingProgressProps {
  /** Bar color. Default the site ink (--wk-ink). */
  color?: string;
  /** Bar height in px. Default 3. */
  height?: number;
  className?: string;
}

/**
 * A thin bar across the top that fills as the visitor reads down the page. Pure CSS
 * (animation-timeline: scroll()), no JavaScript, server-safe. Hidden where the browser has no
 * scroll timelines and under reduced motion, so it never shows a wrong or frozen value.
 * Decorative: hidden from screen readers. Needs motion.css.
 */
export function ReadingProgress({ color, height, className }: ReadingProgressProps) {
  const style = {
    ...(color ? { "--wk-progress": color } : {}),
    ...(height ? { "--wk-progress-h": `${height}px` } : {}),
  } as CSSProperties;
  return (
    <div
      className={`wk-progress${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={style}
    />
  );
}
