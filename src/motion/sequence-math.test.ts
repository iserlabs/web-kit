import { describe, expect, it } from "vitest";
import { buildSequenceTimes, focalFor, pinLength, segmentFill, stageAt } from "./sequence-math";

describe("sequence math", () => {
  const t = buildSequenceTimes(5, 1, 1);
  it("lays out five stages like the prototype", () => {
    expect(t.fadeAt).toEqual([0, 0.6, 2.6, 4.6, 6.6]);
    expect(t.marks).toEqual([0, 1.1, 3.1, 5.1, 7.1]);
    expect(t.total).toBeCloseTo(8.6);
  });
  it("handles one stage and junk counts", () => {
    expect(buildSequenceTimes(1).marks).toEqual([0]);
    expect(buildSequenceTimes(0).marks).toEqual([0]);
  });
  it("finds the current stage", () => {
    expect(stageAt(t.marks, 0)).toBe(0);
    expect(stageAt(t.marks, 1.1)).toBe(1);
    expect(stageAt(t.marks, 99)).toBe(4);
  });
  it("fills phone segments 0..1", () => {
    expect(segmentFill(t.marks, t.total, 1, 0, 0)).toBe(0);
    expect(segmentFill(t.marks, t.total, 1, 0, 100)).toBe(1);
    expect(segmentFill(t.marks, t.total, 1, 4, t.total)).toBe(1);
  });
  it("keeps the camera centered on wide screens and pans on phones", () => {
    expect(focalFor(false, 24)).toBe(50);
    expect(focalFor(true, 24)).toBe(24);
    expect(focalFor(true, undefined)).toBe(50);
  });
  it("sizes the pin like the prototype (4.6 viewports for 5 stages)", () => {
    expect(pinLength(5, 1000)).toBe(4600);
    expect(pinLength(2, 1000)).toBe(2500);
  });
});
