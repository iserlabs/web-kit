/** Pure timeline math for ScrollSequence, kept free of DOM and GSAP so it is unit-tested. */

export interface SequenceTimes {
  /** Cross-fade start time of stage i (index 0 is unused: stage 0 is visible at t=0). */
  fadeAt: number[];
  /** Time at which each stage becomes the current one (caption midpoint). */
  marks: number[];
  total: number;
}

export function buildSequenceTimes(stageCount: number, hold = 1, fade = 1): SequenceTimes {
  const n = Math.max(1, Math.floor(stageCount));
  const fadeAt: number[] = [0];
  const marks: number[] = [0];
  let t = hold * 0.6;
  for (let i = 1; i < n; i++) {
    fadeAt.push(t);
    marks.push(t + fade * 0.5);
    t += fade + hold;
  }
  return { fadeAt, marks, total: t };
}

/** Index of the stage current at timeline time `t`. */
export function stageAt(marks: number[], t: number): number {
  let cur = 0;
  for (let k = 0; k < marks.length; k++) if (t >= (marks[k] ?? 0)) cur = k;
  return cur;
}

/** 0..1 fill for the progress segment of stage `r` at time `t` (phone rail). */
export function segmentFill(
  marks: number[],
  total: number,
  fade: number,
  r: number,
  t: number,
): number {
  const start = r === 0 ? 0 : (marks[r] ?? 0) - fade * 0.5;
  const nextMark = marks[r + 1];
  const end = nextMark !== undefined ? nextMark - fade * 0.5 : total;
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}

/** Focal x% for a stage: wide screens keep the locked camera centered; tall screens use the stage point. */
export function focalFor(phone: boolean, phoneFocal: number | undefined): number {
  return phone ? (phoneFocal ?? 50) : 50;
}

/** Pin length in px for a stage count: roughly 1 viewport of scroll per stage, never under 2.5. */
export function pinLength(stageCount: number, viewportH: number, perStage = 1): number {
  return Math.round(viewportH * Math.max(2.5, (stageCount - 1) * perStage + 0.6));
}
