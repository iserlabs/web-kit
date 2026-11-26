/**
 * SplatTour movement, as plain math so it can be tested without a browser or a GPU.
 * A pose is where the visitor stands (x, y, z) and where they look (yaw, pitch, radians).
 * three.js cameras look down -Z, so yaw 0 faces -Z and positive yaw turns left.
 */

export interface TourPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface TourStart {
  /** Where the visitor stands when the tour opens. Default [0, 0, 0]. */
  position?: [number, number, number];
  /** Facing, in degrees. Default 0. */
  yawDeg?: number;
  /** Looking up (positive) or down (negative), in degrees. Default 0. */
  pitchDeg?: number;
}

export type MoveIntent =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "turnLeft"
  | "turnRight"
  | "lookUp"
  | "lookDown"
  | "reset"
  | "exit";

export interface StepSize {
  /** Scene units per key press. Default 0.25. */
  move: number;
  /** Radians per turn press. Default 10 degrees. */
  turn: number;
  /** Radians per look press. Default 5 degrees. */
  look: number;
}

export const DEFAULT_STEP: StepSize = { move: 0.25, turn: Math.PI / 18, look: Math.PI / 36 };

/** Looking straight up or down flips the view; stop at 80 degrees. */
export const MAX_PITCH = (80 * Math.PI) / 180;

const KEYS: Record<string, MoveIntent> = {
  ArrowUp: "forward",
  w: "forward",
  W: "forward",
  ArrowDown: "back",
  s: "back",
  S: "back",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
  ArrowLeft: "turnLeft",
  ArrowRight: "turnRight",
  PageUp: "lookUp",
  PageDown: "lookDown",
  Home: "reset",
  Escape: "exit",
};

/** The move a key asks for, or null when the key is not a tour control (let it through). */
export function keyIntent(key: string): MoveIntent | null {
  return KEYS[key] ?? null;
}

export const clampPitch = (p: number): number => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p));

const rad = (deg: number | undefined): number => ((deg ?? 0) * Math.PI) / 180;

export function startPose(start: TourStart = {}): TourPose {
  const [x, y, z] = start.position ?? [0, 0, 0];
  for (const n of [x, y, z, start.yawDeg ?? 0, start.pitchDeg ?? 0]) {
    if (!Number.isFinite(n)) throw new Error(`SplatTour: start pose has a non-number value (${n})`);
  }
  return { x, y, z, yaw: rad(start.yawDeg), pitch: clampPitch(rad(start.pitchDeg)) };
}

/** Next pose after one press. `reset` returns `home`; `exit` leaves the pose alone. */
export function applyIntent(
  pose: TourPose,
  intent: MoveIntent,
  home: TourPose,
  step: StepSize = DEFAULT_STEP,
): TourPose {
  const fx = -Math.sin(pose.yaw);
  const fz = -Math.cos(pose.yaw);
  switch (intent) {
    case "forward":
      return { ...pose, x: pose.x + fx * step.move, z: pose.z + fz * step.move };
    case "back":
      return { ...pose, x: pose.x - fx * step.move, z: pose.z - fz * step.move };
    // Right of facing is (-fz, 0, fx).
    case "right":
      return { ...pose, x: pose.x - fz * step.move, z: pose.z + fx * step.move };
    case "left":
      return { ...pose, x: pose.x + fz * step.move, z: pose.z - fx * step.move };
    case "turnLeft":
      return { ...pose, yaw: pose.yaw + step.turn };
    case "turnRight":
      return { ...pose, yaw: pose.yaw - step.turn };
    case "lookUp":
      return { ...pose, pitch: clampPitch(pose.pitch + step.look) };
    case "lookDown":
      return { ...pose, pitch: clampPitch(pose.pitch - step.look) };
    case "reset":
      return { ...home };
    case "exit":
      return pose;
  }
}

/** Drag to look: dx, dy in CSS pixels. Dragging right turns right, dragging up looks up. */
export function dragLook(pose: TourPose, dx: number, dy: number, perPx = 0.005): TourPose {
  return { ...pose, yaw: pose.yaw - dx * perPx, pitch: clampPitch(pose.pitch - dy * perPx) };
}
