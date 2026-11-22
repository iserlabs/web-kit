"use client";
import {
  type CSSProperties,
  createElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "./hooks";
import { groupIntoLines, splitWords } from "./text-lines";

export interface HeadlineRevealProps {
  /** Plain text of the headline. Screen readers get this exact string, once. */
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  /** Per-line delay in ms. Default 90. */
  staggerMs?: number;
  /** Per-line duration in ms. Default 800. */
  durationMs?: number;
  /** Play as soon as it renders (a hero headline) instead of waiting to scroll into view. */
  immediate?: boolean;
  style?: CSSProperties;
}

/**
 * Mask reveal for big serif titles: each visual line rises out of its own clip. Pure CSS
 * transitions, no library. Runs once. The real text sits in a visually hidden span and the
 * split copy is aria-hidden, so assistive tech reads the headline whole. Reduced motion
 * swaps the rise for a short fade. Needs motion.css.
 */
export function HeadlineReveal({
  text,
  as = "h2",
  className,
  staggerMs = 90,
  durationMs = 800,
  immediate = false,
  style,
}: HeadlineRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const words = useMemo(() => splitWords(text), [text]);
  const [lines, setLines] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<"armed" | "done">("armed");
  const reduced = useReducedMotion();

  // Measure which words share a line, after fonts settle and again on width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    const measure = () => {
      const ws = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
      if (!ws.length) return;
      const next = groupIntoLines(
        words,
        ws.map((w) => w.offsetTop),
      );
      setLines((prev) =>
        prev && prev.length === next.length && prev.every((l, i) => l === next[i]) ? prev : next,
      );
    };
    measure();
    (document.fonts?.ready ?? Promise.resolve()).then(() => !dead && measure());
    let w = el.clientWidth;
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (el.clientWidth !== w) {
              w = el.clientWidth;
              setLines(null);
            }
          });
    ro?.observe(el);
    return () => {
      dead = true;
      ro?.disconnect();
    };
  }, [words]);

  // After a width change the lines were cleared: re-measure from the plain-word render.
  useLayoutEffect(() => {
    if (lines !== null) return;
    const el = ref.current;
    if (!el) return;
    const ws = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    if (ws.length)
      setLines(
        groupIntoLines(
          words,
          ws.map((w) => w.offsetTop),
        ),
      );
  }, [lines, words]);

  // Play once.
  useEffect(() => {
    const el = ref.current;
    if (!el || phase === "done") return;
    if (immediate || reduced || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setPhase("done"));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("done");
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase, immediate, reduced]);

  const vars = {
    "--wk-hr-dur": `${durationMs}ms`,
    "--wk-hr-stagger": `${staggerMs}ms`,
    ...style,
  } as CSSProperties;
  const visual =
    lines === null ? (
      <span className="wk-hr__line">
        <span className="wk-hr__inner" style={{ "--i": 0 } as CSSProperties}>
          {words.map((w, i) => (
            <span key={`${i}-${w}`} data-w="">
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </span>
    ) : (
      lines.map((l, i) => (
        <span className="wk-hr__line" key={`${i}-${l}`}>
          <span className="wk-hr__inner" style={{ "--i": i } as CSSProperties}>
            {l}
          </span>
        </span>
      ))
    );

  return createElement(
    as,
    { ref, className: `wk-hr${className ? ` ${className}` : ""}`, "data-hr": phase, style: vars },
    <span className="wk-hr__sr">{text}</span>,
    <span aria-hidden="true">{visual}</span>,
  );
}
