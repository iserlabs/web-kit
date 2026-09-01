/**
 * The sentinel `brand-pack init` writes wherever it could not resolve a real
 * value, and the one test for whether a field is still standing empty.
 *
 * This module imports nothing, on purpose. Both the config loader and the two
 * renderers need the test, and putting it in `config.mjs` would make the
 * renderers import the file that already imports them.
 */

/**
 * Written by `brand-pack init` wherever it could not resolve a real value.
 * It is deliberately unmistakable: it must never look like real copy, and the
 * audit fails while any survive.
 */
export const UNFILLED = "__UNFILLED__";

/** True when a field is missing, blank, or still carries the sentinel. */
export const isUnfilled = (value) =>
  typeof value !== "string" || value.trim() === "" || value.includes(UNFILLED);
