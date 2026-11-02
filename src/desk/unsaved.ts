"use client";

/**
 * Unsaved work on the Desk, asked about in one place.
 *
 * WHY (Build 5 final review, done in Build 7). Each pane with a rail kept its own "dirty" flag
 * and asked before opening another record in its own list, but the shell's tab bar never asked:
 * switching from Public events or Forms to any other tab with unsaved rail edits dropped them
 * without a word. Now every pane reports into one registry the shell owns, and the shell asks
 * before it changes tab, whichever control asked for the change (the rail, the phone tabs, a
 * pane's own link, the palette, a Today line).
 *
 * Saying yes clears every flag, so a tab change that also opens a record never asks twice.
 *
 * The registry is plain data so it can be tested without a browser (the suite runs in Node).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

export const LEAVE_QUESTION = "You have changes that are not saved. Leave without saving them?";

export type UnsavedRegistry = {
  set: (source: string, dirty: boolean) => void;
  any: () => boolean;
  clear: () => void;
  /** True when nothing is unsaved, or when the person agreed to drop it (which clears every flag). */
  mayLeave: (ask?: (q: string) => boolean) => boolean;
};

export function createUnsavedRegistry(): UnsavedRegistry {
  const dirty = new Set<string>();
  return {
    set: (source, d) => {
      if (d) dirty.add(source);
      else dirty.delete(source);
    },
    any: () => dirty.size > 0,
    clear: () => dirty.clear(),
    mayLeave: (ask = (q) => window.confirm(q)) => {
      if (dirty.size === 0) return true;
      if (!ask(LEAVE_QUESTION)) return false;
      dirty.clear();
      return true;
    },
  };
}

/**
 * The decision, as plain data: staying put never asks; leaving with nothing unsaved never asks;
 * leaving with unsaved work leaves only if the person said yes.
 */
export function leaveDecision(input: {
  to: string;
  from: string;
  dirty: boolean;
  confirmed: boolean;
}): "leave" | "stay" {
  if (input.to === input.from || !input.dirty) return "leave";
  return input.confirmed ? "leave" : "stay";
}

/**
 * Ask (at most once) before going from one tab to another. Callers run this FIRST and do no side
 * effect when it says no, so a "stay" leaves the screen exactly as it was. A yes clears every
 * flag, so the guarded tab setter that follows does not ask again.
 */
export function mayLeaveFor(
  reg: UnsavedRegistry,
  from: string,
  to: string,
  ask?: (q: string) => boolean,
): boolean {
  if (to === from || !reg.any()) return true;
  return leaveDecision({ to, from, dirty: true, confirmed: reg.mayLeave(ask) }) === "leave";
}

export const UnsavedContext = createContext<UnsavedRegistry | null>(null);

/** One registry for the life of the component that makes it. */
export function useUnsavedRegistry(): UnsavedRegistry {
  const ref = useRef<UnsavedRegistry | null>(null);
  if (!ref.current) ref.current = createUnsavedRegistry();
  return ref.current;
}

/**
 * A pane's handle. Inside the shell it reports to the shell's registry; rendered alone (a test,
 * a page of its own) it keeps a registry of its own and behaves exactly as the panes did before.
 */
export function useUnsavedWork(source: string): {
  setDirty: (d: boolean) => void;
  mayLeave: () => boolean;
} {
  const shared = useContext(UnsavedContext);
  const own = useUnsavedRegistry();
  const reg = shared ?? own;
  const setDirty = useCallback((d: boolean) => reg.set(source, d), [reg, source]);
  const mayLeave = useCallback(() => reg.mayLeave(), [reg]);
  /* A pane that goes away takes its flag with it: whatever it held is gone either way. */
  useEffect(() => () => reg.set(source, false), [reg, source]);
  return useMemo(() => ({ setDirty, mayLeave }), [setDirty, mayLeave]);
}
