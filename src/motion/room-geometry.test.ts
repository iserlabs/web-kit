import { describe, expect, it } from "vitest";
import { bounds, overviewPose, type RoomVolume, roomPose, stepIndex } from "./room-geometry";
import { groupIntoLines, splitWords } from "./text-lines";

const vol = (id: string, x: number, y: number): RoomVolume => ({
  id,
  label: id,
  position: [x, y, 0],
  size: [1.5, 1.5, 2.4],
  photos: [{ src: "a.jpg", alt: "a" }],
});

describe("room geometry", () => {
  const vs = [vol("a", 0, 0), vol("b", 3, 0), vol("c", 0, 1.7)];
  it("bounds covers every volume", () => {
    const b = bounds(vs);
    expect(b.min).toEqual([-0.75, -0.75, -1.2]);
    expect(b.max).toEqual([3.75, 2.45, 1.2]);
    expect(bounds([]).size).toEqual([0, 0, 0]);
  });
  it("overview is farther on a narrow screen than a wide one, and looks at the center", () => {
    const wide = overviewPose(vs, 16 / 9);
    const tall = overviewPose(vs, 9 / 16);
    expect(tall.position[2]).toBeGreaterThan(wide.position[2]);
    expect(wide.target).toEqual(bounds(vs).center);
  });
  it("room pose sits in front of the volume, centered on it", () => {
    const p = roomPose(vs[1] as RoomVolume, 16 / 9);
    expect(p.target).toEqual([3, 0, 0]);
    expect(p.position[0]).toBe(3);
    expect(p.position[2]).toBeGreaterThan(1.2);
  });
  it("steps through photos with wrap", () => {
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});

describe("headline line grouping", () => {
  it("groups words by line position", () => {
    const w = splitWords("A quiet house   on the hill");
    expect(w).toEqual(["A", "quiet", "house", "on", "the", "hill"]);
    expect(groupIntoLines(w, [0, 0, 1, 60, 60, 120])).toEqual(["A quiet house", "on the", "hill"]);
  });
  it("empty and single", () => {
    expect(groupIntoLines([], [])).toEqual([]);
    expect(groupIntoLines(["x"], [0])).toEqual(["x"]);
  });
});
