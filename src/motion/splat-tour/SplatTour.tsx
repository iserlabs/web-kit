"use client";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "../hooks";
import { keyIntent, type MoveIntent, startPose, type TourStart } from "./controls";
import type { SplatPlayer } from "./scene";

export interface SplatPhoto {
  src: string;
  alt: string;
  caption?: string;
}

export interface SplatTourProps {
  /** The scan file (.spz, .ply, .splat, .ksplat, .sog). Fetched only after the visitor taps the button. */
  src: string;
  /** A real photo of the room, shown until the tap and whenever the 3D view cannot run. */
  poster: SplatPhoto;
  /** The still gallery shown instead of the 3D view under reduced motion. Empty: the poster alone. */
  stills?: SplatPhoto[];
  /** Accessible name for the section, e.g. "3D walk-through of the living room". */
  label: string;
  /** Text on the button. Default "Walk through it". */
  buttonLabel?: string;
  /** Where the visitor stands when the tour opens. */
  start?: TourStart;
  /** Turn an upside-down phone scan upright (COLMAP and Brush output). Default true. */
  flipY?: boolean;
  /** Color behind the scan. Default a warm paper white. */
  background?: string;
  /** Give up and show the photo after this many ms. Default 60000. */
  timeoutMs?: number;
  /** Called when the 3D view is up, e.g. for an analytics event. */
  onOpen?: () => void;
  /** Called with the reason when the 3D view could not start. */
  onError?: (error: Error) => void;
  className?: string;
}

type State = "idle" | "loading" | "ready" | "error";

const loadScene = () => import("./scene");

const CONTROLS: Array<{ intent: MoveIntent; label: string; text: string }> = [
  { intent: "turnLeft", label: "Turn left", text: "Turn left" },
  { intent: "forward", label: "Step forward", text: "Forward" },
  { intent: "back", label: "Step back", text: "Back" },
  { intent: "turnRight", label: "Turn right", text: "Turn right" },
];

/**
 * A real photo with a "Walk through it" button. Only the tap loads three.js, the Spark scan
 * player and the scan file. Drag to look; arrow keys or W A S D move and turn, Page Up and Page
 * Down look up and down, Home goes back to the start, Esc closes. Under reduced motion it is a
 * still gallery and the player never loads. If the 3D view cannot start, the photo stays, a
 * message says why and the still gallery shows. Needs motion.css.
 */
export function SplatTour({
  src,
  poster,
  stills,
  label,
  buttonLabel = "Walk through it",
  start,
  flipY = true,
  background = "#f4efe6",
  timeoutMs = 60000,
  onOpen,
  onError,
  className,
}: SplatTourProps) {
  const reduced = useReducedMotion();
  const uid = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const player = useRef<SplatPlayer | null>(null);
  const run = useRef(0);
  // Put focus back on the button once it is on screen again (after Close, Esc or a failure).
  const focusOpen = useRef(false);
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gallery = useMemo(() => (stills?.length ? stills : [poster]), [stills, poster]);

  const stop = useCallback(() => {
    run.current += 1;
    player.current?.dispose();
    player.current = null;
  }, []);

  const close = useCallback(() => {
    stop();
    setState("idle");
    setProgress(null);
    focusOpen.current = true;
  }, [stop]);

  const open = useCallback(async () => {
    if (reduced || state === "loading" || state === "ready") return;
    const host = stageRef.current;
    if (!host) return;
    const mine = ++run.current;
    setState("loading");
    setError(null);
    setProgress(null);
    try {
      const pose = startPose(start);
      const { startSplatPlayer } = await loadScene();
      const p = await startSplatPlayer(host, {
        src,
        start: pose,
        flipY,
        background,
        timeoutMs,
        onProgress: (f) => mine === run.current && setProgress(f),
      });
      if (mine !== run.current) {
        p.dispose(); // closed or unmounted while it loaded
        return;
      }
      player.current = p;
      setState("ready");
      onOpen?.();
      queueMicrotask(() => host.focus({ preventScroll: true }));
    } catch (e) {
      if (mine !== run.current) return;
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("SplatTour: the 3D view could not start.", err);
      setError(err.message);
      setState("error");
      focusOpen.current = true;
      onError?.(err);
    }
  }, [reduced, state, start, src, flipY, background, timeoutMs, onOpen, onError]);

  useEffect(() => {
    if (!focusOpen.current || (state !== "idle" && state !== "error")) return;
    focusOpen.current = false;
    openRef.current?.focus({ preventScroll: true });
  }, [state]);

  // Reduced motion switched on mid-visit, or the part unmounts: free the GPU.
  useEffect(() => {
    if (reduced && player.current) close();
  }, [reduced, close]);
  useEffect(() => stop, [stop]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (state !== "ready") return;
    const intent = keyIntent(e.key);
    if (!intent) return;
    e.preventDefault();
    if (intent === "exit") close();
    else player.current?.act(intent);
  };

  const helpId = `${uid}-help`;
  const pct = progress === null ? "" : ` ${Math.round(progress * 100)}%`;

  return (
    <section
      className={`wk-st${className ? ` ${className}` : ""}`}
      aria-label={label}
      data-state={reduced ? "still" : state}
    >
      {reduced ? null : (
        <div className="wk-st__live">
          {state === "ready" ? null : (
            <img
              className="wk-st__poster"
              src={poster.src}
              alt={poster.alt}
              loading="lazy"
              decoding="async"
            />
          )}
          <div
            ref={stageRef}
            className="wk-st__stage"
            role="application"
            aria-roledescription="3D walk-through"
            aria-label={label}
            aria-describedby={helpId}
            tabIndex={state === "ready" ? 0 : -1}
            hidden={state !== "ready" && state !== "loading"}
            onKeyDown={onKeyDown}
          />
          <p id={helpId} className="wk-st__help" hidden={state !== "ready"}>
            Drag to look around. Arrow keys or W A S D move and turn. Esc closes.
          </p>

          {state === "idle" || state === "error" ? (
            <div className="wk-st__bar">
              <button ref={openRef} type="button" className="wk-st__open" onClick={open}>
                {state === "error" ? "Try again" : buttonLabel}
              </button>
            </div>
          ) : null}
          {state === "loading" ? (
            <p className="wk-st__status" role="status">
              Loading the 3D walk-through{pct}
            </p>
          ) : null}
          {state === "error" ? (
            <p className="wk-st__status wk-st__status--error" role="alert">
              The 3D walk-through could not start on this device. The photos below show the room.
              {error ? <span className="wk-st__why"> ({error})</span> : null}
            </p>
          ) : null}
          {state === "ready" ? (
            <div className="wk-st__bar" role="toolbar" aria-label="Move through the room">
              {CONTROLS.map((c) => (
                <button
                  key={c.intent}
                  type="button"
                  className="wk-st__ctl"
                  aria-label={c.label}
                  onClick={() => player.current?.act(c.intent)}
                >
                  {c.text}
                </button>
              ))}
              <button type="button" className="wk-st__close" onClick={close}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      )}

      <ul className="wk-st__stills" aria-label={`${label}: photos`}>
        {gallery.map((p, i) => (
          <li key={`${i}-${p.src}`}>
            <figure>
              <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
              {p.caption ? <figcaption>{p.caption}</figcaption> : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
