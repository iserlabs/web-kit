"use client";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from "react";
import { loadGsap } from "./gsap-loader";
import { useReducedMotion } from "./hooks";
import { buildSequenceTimes, focalFor, pinLength, segmentFill, stageAt } from "./sequence-math";

export interface SequenceStage {
  src: string;
  srcSet?: string;
  /** Required: describe the frame. The same camera shows every stage. */
  alt: string;
  width: number;
  height: number;
  /** Big caption line for the stage. */
  title: ReactNode;
  text?: ReactNode;
  /** Short label for the progress rail (defaults to the stage number). */
  railLabel?: string;
  /** Horizontal focal point in percent on tall (phone) screens. Default 50. */
  focalPhone?: number;
}

export interface ScrollSequenceProps {
  stages: SequenceStage[];
  /** Accessible name for the section. */
  label: string;
  /** Shown above the still vertical series (reduced motion) as its intro. */
  intro?: ReactNode;
  /** Small badge for illustrated imagery, e.g. "Illustration". Never on real photos. */
  badge?: string;
  /** `sizes` attribute shared by the frames. */
  sizes?: string;
  /** Scroll text under the pinned frame, e.g. "Scroll to set the room". */
  cue?: string;
  /** Viewport heights of scroll per stage. Default 1. */
  perStage?: number;
  className?: string;
}

/**
 * Pinned full-window section that cross-fades same-camera images with a caption per stage,
 * scrubbed by scroll. Markup is the pinned layout from the first paint (no layout shift);
 * under prefers-reduced-motion (CSS, no JS needed) or if GSAP fails to load it becomes
 * a still vertical series with every stage visible. Needs motion.css.
 */
export function ScrollSequence({
  stages,
  label,
  intro,
  badge,
  sizes,
  cue,
  perStage = 1,
  className,
}: ScrollSequenceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const uid = useId();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    let dead = false;
    let ctx: { revert: () => void } | undefined;
    let phoneMq: MediaQueryList | undefined;
    let onPhone: (() => void) | undefined;

    loadGsap()
      .then(({ gsap, ScrollTrigger }) => {
        if (dead) return;
        const stageEls = gsap.utils.toArray<HTMLElement>(".wk-seq__stage", root);
        const frames = stageEls.map((s) => s.querySelector<HTMLElement>(".wk-seq__frame") ?? s);
        const caps = stageEls.map((s) => s.querySelector<HTMLElement>("figcaption") ?? s);
        const rail = Array.from(root.querySelectorAll<HTMLElement>(".wk-seq__rail li"));
        const railEl = root.querySelector<HTMLElement>(".wk-seq__rail");
        const cueEl = root.querySelector<HTMLElement>(".wk-seq__cue");
        phoneMq = window.matchMedia("(max-aspect-ratio: 1/1)");
        const phone = phoneMq;
        const phoneFocals = stages.map((s) => s.focalPhone);

        ctx = gsap.context(() => {
          const fx = { x: focalFor(phone.matches, phoneFocals[0]) };
          const applyFx = () => root.style.setProperty("--wk-fx", `${fx.x.toFixed(2)}%`);
          applyFx();

          const HOLD = 1;
          const FADE = 1;
          const times = buildSequenceTimes(stageEls.length, HOLD, FADE);
          const tl = gsap.timeline({ defaults: { ease: "none" } });
          tl.to({}, { duration: HOLD * 0.6 });
          for (let i = 1; i < stageEls.length; i++) {
            const at = times.fadeAt[i] ?? 0;
            tl.to(
              frames[i] as HTMLElement,
              { opacity: 1, duration: FADE, ease: "power1.inOut" },
              at,
            );
            tl.to(
              caps[i - 1] as HTMLElement,
              { autoAlpha: 0, y: -22, duration: FADE * 0.42, ease: "power2.in" },
              at + FADE * 0.08,
            );
            tl.fromTo(
              caps[i] as HTMLElement,
              { autoAlpha: 0, y: 26 },
              {
                autoAlpha: 1,
                y: 0,
                duration: FADE * 0.42,
                ease: "power2.out",
                immediateRender: false,
              },
              at + FADE * 0.5,
            );
            tl.to(
              fx,
              {
                x: () => focalFor(phone.matches, phoneFocals[i]),
                duration: FADE,
                ease: "power1.inOut",
                onUpdate: applyFx,
              },
              at,
            );
            tl.to({}, { duration: HOLD });
          }

          ScrollTrigger.create({
            trigger: root,
            start: "top top",
            end: () => `+=${pinLength(stageEls.length, window.innerHeight, perStage)}`,
            pin: true,
            scrub: 0.6,
            animation: tl,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const t = self.progress * times.total;
              const cur = stageAt(times.marks, t);
              rail.forEach((li, r) => {
                li.classList.toggle("on", r === cur);
                li.style.setProperty(
                  "--wk-seg",
                  segmentFill(times.marks, times.total, FADE, r, t).toFixed(3),
                );
              });
              railEl?.style.setProperty("--wk-p", self.progress.toFixed(4));
              if (cueEl) cueEl.style.opacity = self.progress > 0.02 ? "0" : "1";
            },
          });
        }, root);

        onPhone = () => ScrollTrigger.refresh();
        phone.addEventListener("change", onPhone);
        root.setAttribute("data-state", "live");
      })
      .catch(() => {
        // GSAP did not load: fall back to the still vertical series.
        root.setAttribute("data-state", "still");
      });

    return () => {
      dead = true;
      if (phoneMq && onPhone) phoneMq.removeEventListener("change", onPhone);
      ctx?.revert();
      root.removeAttribute("data-state");
      root.style.removeProperty("--wk-fx");
    };
  }, [reduced, stages, perStage]);

  const first = stages[0];
  return (
    <section
      ref={rootRef}
      className={`wk-seq${className ? ` ${className}` : ""}`}
      aria-label={label}
      style={{ "--wk-stages": stages.length } as CSSProperties}
    >
      {intro ? <div className="wk-seq__intro">{intro}</div> : null}
      {badge ? <span className="wk-seq__badge">{badge}</span> : null}
      {stages.map((s, i) => (
        <figure
          className="wk-seq__stage"
          key={`${uid}-${s.src}`}
          style={{ "--wk-fx-phone": `${s.focalPhone ?? 50}%` } as CSSProperties}
        >
          <div className="wk-seq__frame">
            <img
              src={s.src}
              srcSet={s.srcSet}
              sizes={sizes}
              width={s.width}
              height={s.height}
              alt={s.alt}
              decoding="async"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </div>
          <figcaption>
            <span className="wk-seq__num">{i + 1}</span>
            <h2>{s.title}</h2>
            {s.text ? <p>{s.text}</p> : null}
          </figcaption>
        </figure>
      ))}
      <div className="wk-seq__shade" aria-hidden="true" />
      <ol className="wk-seq__rail" aria-hidden="true">
        {stages.map((s, i) => (
          <li key={`${uid}-r-${s.src}`} className={i === 0 ? "on" : undefined}>
            <span>{i + 1}</span>
            <span>{s.railLabel ?? ""}</span>
          </li>
        ))}
      </ol>
      {cue && first ? (
        <div className="wk-seq__cue" aria-hidden="true">
          <i />
          {cue}
        </div>
      ) : null}
    </section>
  );
}
