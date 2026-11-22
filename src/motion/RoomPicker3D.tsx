"use client";
import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useInView, useReducedMotion } from "./hooks";
import { type RoomVolume, stepIndex } from "./room-geometry";

export type { RoomVolume } from "./room-geometry";

export interface RoomPicker3DProps {
  volumes: RoomVolume[];
  /** Accessible name for the whole picker. */
  label: string;
  /** Image shown until three.js has loaded (and as the LCP-safe first paint). */
  poster?: { src: string; alt: string };
  /** One-line instruction shown at the foot, e.g. "Hover a room, click to fly in." */
  hint?: string;
  /** Text on the back button. Default "Back to the building". */
  backLabel?: string;
  /** Called when a room is entered, e.g. to send an analytics event. */
  onEnter?: (id: string) => void;
  className?: string;
}

// three.js and R3F load only here, and only after the picker is near the viewport.
const Scene = lazy(() => import("./RoomPickerScene"));

type Mode = "overview" | "flying" | "room";

/**
 * 3D room picker: volumes from props, hover or tap labels, camera flight to a room, then a
 * cross-fade to that room's photo. Reduced motion skips the flight and cross-fades directly.
 * Chips make every room reachable by keyboard and on phones. Needs motion.css.
 */
export function RoomPicker3D({
  volumes,
  label,
  poster,
  hint,
  backLabel = "Back to the building",
  onEnter,
  className,
}: RoomPicker3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const seen = useInView(rootRef);
  const reduced = useReducedMotion();
  const uid = useId();

  const [sceneReady, setSceneReady] = useState(false);
  const [mode, setMode] = useState<Mode>("overview");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [front, setFront] = useState<0 | 1>(0);
  const [slots, setSlots] = useState<[string, string]>(["", ""]);
  const [viewOn, setViewOn] = useState(false);
  const coarse = useRef(false);

  useEffect(() => {
    coarse.current = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  }, []);

  const active = volumes.find((v) => v.id === activeId);
  const hovered = volumes.find((v) => v.id === hoverId);

  const showPhoto = useCallback(
    (v: RoomVolume, i: number) => {
      const next = (front === 0 ? 1 : 0) as 0 | 1;
      setSlots((s) => {
        const c: [string, string] = [s[0], s[1]];
        c[next] = v.photos[i]?.src ?? "";
        return c;
      });
      setFront(next);
      setPhotoIdx(i);
    },
    [front],
  );

  const focusBack = () => queueMicrotask(() => backRef.current?.focus({ preventScroll: true }));

  const enter = useCallback(
    (id: string) => {
      const v = volumes.find((x) => x.id === id);
      if (!v || mode !== "overview") return;
      lastFocus.current = document.activeElement as HTMLElement | null;
      setHoverId(null);
      setTip(null);
      setActiveId(id);
      setPhotoIdx(0);
      setSlots([v.photos[0]?.src ?? "", ""]);
      setFront(0);
      onEnter?.(id);
      // Preload the first photo so the cross-fade never shows a blank frame.
      const img = new Image();
      img.src = v.photos[0]?.src ?? "";
      if (reduced || !sceneReady) {
        // No flight: direct cross-fade to the photo.
        setMode("room");
        setViewOn(true);
        focusBack();
      } else {
        setMode("flying");
      }
    },
    [volumes, mode, reduced, sceneReady, onEnter],
  );

  const onFlightDone = useCallback((id: string | null) => {
    if (id) {
      setMode("room");
      setViewOn(true);
      focusBack();
    } else {
      setMode("overview");
      lastFocus.current?.focus?.({ preventScroll: true });
    }
  }, []);

  const leave = useCallback(() => {
    if (mode !== "room") return;
    setViewOn(false);
    if (reduced || !sceneReady) {
      setActiveId(null);
      setMode("overview");
      lastFocus.current?.focus?.({ preventScroll: true });
    } else {
      setMode("flying");
      setTimeout(() => setActiveId(null), 320);
    }
  }, [mode, reduced, sceneReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== "room" || !active) return;
      if (e.key === "Escape") leave();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        showPhoto(
          active,
          stepIndex(photoIdx, active.photos.length, e.key === "ArrowRight" ? 1 : -1),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, active, photoIdx, leave, showPhoto]);

  const onHover = useCallback((id: string | null, x: number, y: number) => {
    if (coarse.current) return;
    setHoverId(id);
    const r = rootRef.current?.getBoundingClientRect();
    setTip(id && r ? { x: x - r.left, y: y - r.top } : null);
  }, []);

  const onPick = useCallback(
    (id: string) => {
      if (mode !== "overview") return;
      // Touch: first tap names the room, second tap enters it.
      if (coarse.current && hoverId !== id) {
        setHoverId(id);
        setTip({ x: 16, y: 16 });
      } else enter(id);
    },
    [mode, hoverId, enter],
  );

  const tipStyle: CSSProperties = tip
    ? { transform: `translate3d(${Math.round(tip.x + 18)}px, ${Math.round(tip.y + 18)}px, 0)` }
    : { transform: "scale(var(--wk-popover-start))" };

  return (
    <section
      ref={rootRef}
      className={`wk-rp${className ? ` ${className}` : ""}`}
      aria-label={label}
    >
      {poster && !sceneReady ? (
        <img className="wk-rp__poster" src={poster.src} alt={poster.alt} />
      ) : null}
      <div className="wk-rp__canvas" aria-hidden="true">
        {seen ? (
          <Suspense fallback={null}>
            <Scene
              volumes={volumes}
              hoverId={hoverId}
              activeId={activeId}
              reduced={reduced}
              onHover={onHover}
              onPick={onPick}
              onFlightDone={onFlightDone}
              onReady={() => setSceneReady(true)}
            />
          </Suspense>
        ) : null}
      </div>

      <div
        className="wk-rp__tip"
        data-on={!!hovered && mode === "overview"}
        style={tipStyle}
        aria-hidden="true"
      >
        {hovered ? (
          <>
            {hovered.sublabel ? <small>{hovered.sublabel}</small> : null}
            {hovered.label}
          </>
        ) : null}
      </div>

      {mode === "overview" ? (
        <nav className="wk-rp__chips" aria-label={`${label}: rooms`}>
          {volumes.map((v) => (
            <button
              key={`${uid}-${v.id}`}
              type="button"
              aria-current={hoverId === v.id}
              onClick={() => enter(v.id)}
              onMouseEnter={() => setHoverId(v.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(v.id)}
              onBlur={() => setHoverId(null)}
            >
              {v.label}
            </button>
          ))}
        </nav>
      ) : null}
      {hint && mode === "overview" ? <p className="wk-rp__hint">{hint}</p> : null}

      <div
        className="wk-rp__view"
        data-on={viewOn}
        data-fast={reduced || !sceneReady}
        aria-hidden={!viewOn}
        inert={!viewOn}
      >
        {[0, 1].map((i) => (
          <img
            key={i}
            className="wk-rp__photo"
            src={slots[i] || undefined}
            alt={i === front && active ? (active.photos[photoIdx]?.alt ?? active.label) : ""}
            data-show={viewOn && front === i && !!slots[i]}
          />
        ))}
        <button ref={backRef} type="button" className="wk-rp__back" onClick={leave}>
          {backLabel}
        </button>
        {active ? (
          <>
            <div className="wk-rp__meta">
              {active.sublabel ? <small>{active.sublabel}</small> : null}
              <h3>{active.label}</h3>
              {active.summary ? <p>{active.summary}</p> : null}
            </div>
            {active.photos.length > 1 ? (
              <div className="wk-rp__thumbs">
                {active.photos.map((p, i) => (
                  <button
                    key={p.src}
                    type="button"
                    aria-label={`Photo ${i + 1} of ${active.photos.length}`}
                    aria-current={i === photoIdx}
                    onClick={() => showPhoto(active, i)}
                  >
                    <img src={p.src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
