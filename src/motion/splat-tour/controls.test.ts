import { describe, expect, it } from "vitest";
import {
  applyIntent,
  DEFAULT_STEP,
  dragLook,
  keyIntent,
  MAX_PITCH,
  startPose,
  type TourPose,
} from "./controls";

const home: TourPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("SplatTour keys", () => {
  it("maps arrows, W A S D, Page Up/Down, Home and Esc", () => {
    expect(keyIntent("ArrowUp")).toBe("forward");
    expect(keyIntent("w")).toBe("forward");
    expect(keyIntent("S")).toBe("back");
    expect(keyIntent("a")).toBe("left");
    expect(keyIntent("D")).toBe("right");
    expect(keyIntent("ArrowLeft")).toBe("turnLeft");
    expect(keyIntent("ArrowRight")).toBe("turnRight");
    expect(keyIntent("PageUp")).toBe("lookUp");
    expect(keyIntent("PageDown")).toBe("lookDown");
    expect(keyIntent("Home")).toBe("reset");
    expect(keyIntent("Escape")).toBe("exit");
  });
  it("lets every other key through (Tab must still leave the 3D view)", () => {
    for (const k of ["Tab", "Enter", " ", "x", "Shift", ""]) expect(keyIntent(k)).toBeNull();
  });
});

describe("SplatTour movement", () => {
  it("forward at yaw 0 walks toward -Z, back undoes it", () => {
    const f = applyIntent(home, "forward", home);
    close(f.x, 0);
    close(f.z, -DEFAULT_STEP.move);
    const b = applyIntent(f, "back", home);
    close(b.z, 0);
  });
  it("forward follows the facing after a quarter turn left", () => {
    const left90 = { ...home, yaw: Math.PI / 2 };
    const f = applyIntent(left90, "forward", home);
    close(f.x, -DEFAULT_STEP.move);
    close(f.z, 0);
  });
  it("side steps are at right angles to the facing", () => {
    const r = applyIntent(home, "right", home);
    close(r.x, DEFAULT_STEP.move);
    close(r.z, 0);
    const l = applyIntent(home, "left", home);
    close(l.x, -DEFAULT_STEP.move);
  });
  it("turning changes only the facing", () => {
    const t = applyIntent(home, "turnLeft", home);
    expect(t).toEqual({ ...home, yaw: DEFAULT_STEP.turn });
    expect(applyIntent(t, "turnRight", home).yaw).toBeCloseTo(0, 9);
  });
  it("never looks past 80 degrees up or down", () => {
    let p = home;
    for (let i = 0; i < 100; i++) p = applyIntent(p, "lookUp", home);
    expect(p.pitch).toBe(MAX_PITCH);
    for (let i = 0; i < 100; i++) p = applyIntent(p, "lookDown", home);
    expect(p.pitch).toBe(-MAX_PITCH);
    expect(dragLook(home, 0, -100000).pitch).toBe(MAX_PITCH);
  });
  it("Home returns to the start pose and exit leaves the pose alone", () => {
    const start = startPose({ position: [1, 2, 3], yawDeg: 90 });
    const moved = applyIntent(applyIntent(start, "forward", start), "turnLeft", start);
    expect(applyIntent(moved, "reset", start)).toEqual(start);
    expect(applyIntent(moved, "exit", start)).toBe(moved);
  });
  it("dragging right turns right", () => {
    expect(dragLook(home, 100, 0).yaw).toBeLessThan(0);
  });
});

describe("SplatTour start pose", () => {
  it("defaults to the origin facing -Z", () => {
    expect(startPose()).toEqual(home);
  });
  it("converts degrees and clamps the pitch", () => {
    const p = startPose({ position: [0, 1, 4], yawDeg: 180, pitchDeg: 95 });
    close(p.yaw, Math.PI);
    expect(p.pitch).toBe(MAX_PITCH);
  });
  it("refuses a pose with a non-number instead of opening at NaN", () => {
    expect(() => startPose({ position: [0, Number.NaN, 0] })).toThrow(/non-number/);
    expect(() => startPose({ yawDeg: Number.POSITIVE_INFINITY })).toThrow(/non-number/);
  });
});
