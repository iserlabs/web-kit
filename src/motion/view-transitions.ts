/** View Transitions API wrapper with a plain fallback (web-craft-ceiling 5c). DOM-injectable for tests. */

export interface VTDocument {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<unknown> };
}

export function supportsViewTransitions(
  doc: VTDocument | undefined = typeof document === "undefined"
    ? undefined
    : (document as VTDocument),
): boolean {
  return !!doc && typeof doc.startViewTransition === "function";
}

export interface RunOptions {
  /** Visitor prefers reduced motion: skip the transition, just run the update. */
  reduced?: boolean;
  doc?: VTDocument;
}

/**
 * Run `update` (the thing that changes the page) inside a view transition when the browser
 * supports it and motion is allowed; otherwise run it plainly. Never throws because of the
 * transition itself, and always resolves after the update ran.
 */
export async function runViewTransition(
  update: () => void | Promise<void>,
  opts: RunOptions = {},
): Promise<"transition" | "plain"> {
  const doc = opts.doc ?? (typeof document === "undefined" ? undefined : (document as VTDocument));
  if (opts.reduced || !doc || !supportsViewTransitions(doc)) {
    await update();
    return "plain";
  }
  try {
    const t = doc.startViewTransition?.(update);
    await t?.finished;
    return "transition";
  } catch {
    // An aborted transition (for example a duplicate view-transition-name) still ran the update.
    return "transition";
  }
}
