/** Pure camera math for RoomPicker3D. Kept free of three.js so it is unit-tested in plain Node. */

export type Vec3 = readonly [number, number, number];

export interface RoomVolume {
  id: string;
  label: string;
  sublabel?: string;
  /** Center of the box in scene units. */
  position: Vec3;
  /** Width, height, depth. */
  size: Vec3;
  /** Photos shown after the camera arrives. At least one. */
  photos: { src: string; alt: string }[];
  summary?: string;
  color?: string;
}

export interface Pose {
  position: Vec3;
  target: Vec3;
}

export const FOV_DEG = 30;
export const tanHalfFov = (fov = FOV_DEG): number => Math.tan((fov * Math.PI) / 360);

export function bounds(volumes: RoomVolume[]): { min: Vec3; max: Vec3; center: Vec3; size: Vec3 } {
  if (!volumes.length)
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0] };
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const v of volumes) {
    for (let i = 0; i < 3; i++) {
      const p = v.position[i] ?? 0;
      const h = (v.size[i] ?? 0) / 2;
      min[i] = Math.min(min[i] ?? Infinity, p - h);
      max[i] = Math.max(max[i] ?? -Infinity, p + h);
    }
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  return { min, max, center, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Camera that frames every volume with a little air, slightly above the middle. */
export function overviewPose(volumes: RoomVolume[], aspect: number, fov = FOV_DEG): Pose {
  const b = bounds(volumes);
  const t = tanHalfFov(fov);
  const a = Math.max(0.2, aspect);
  const dist = Math.max(b.size[1] / 2 / t, b.size[0] / 2 / (t * a)) * 1.15 + b.size[2] / 2 + 0.6;
  const elev = a < 1 ? 0.42 : 0.2;
  return {
    position: [
      b.center[0],
      b.center[1] + dist * Math.sin(elev),
      b.center[2] + dist * Math.cos(elev),
    ],
    target: b.center,
  };
}

/** Camera that fills the frame with one volume's front face. */
export function roomPose(v: RoomVolume, aspect: number, fov = FOV_DEG): Pose {
  const t = tanHalfFov(fov);
  const a = Math.max(0.2, aspect);
  const dist = Math.max(((v.size[1] / 2) * 1.22) / t, ((v.size[0] / 2) * 1.1) / (t * a));
  return {
    position: [v.position[0], v.position[1], v.position[2] + v.size[2] / 2 + dist],
    target: [v.position[0], v.position[1], v.position[2]],
  };
}

/** Index after a keyboard step, wrapping both ways. */
export const stepIndex = (cur: number, n: number, dir: 1 | -1): number =>
  n <= 0 ? 0 : (cur + dir + n) % n;
