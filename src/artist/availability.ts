import type { Artwork } from "./record";

/**
 * Carole 05: sold work must not be mixed into active inventory.
 *
 * Her reasoning is commercial, not tidiness: a gallery or a collector becomes
 * interested in a piece and only then discovers it is gone, and even a clearly
 * marked "sold" adds clutter to what a buyer is actually shopping. So available
 * and sold are separated at the query layer, not merely styled differently.
 *
 * A site that holds no availability data yet puts every work in `unstated`. That
 * is deliberate and honest: a work whose status nobody recorded must not be
 * presented as purchasable. The separation exists so that the moment the studio
 * sets a status, the surfaces already behave correctly.
 *
 * Every function takes the works it sorts. The kit holds no catalog of its own.
 */

export interface AvailabilityGroups<A extends Artwork = Artwork> {
  /** Offerable now. Carole's "active inventory". */
  available: A[];
  /** Sold or reserved. Shown as record and provenance, never as inventory. */
  unavailable: A[];
  /** Deliberately not for sale: kept work, studio collection, loans. */
  notForSale: A[];
  /** Status never recorded. Says nothing about acquiring the piece. */
  unstated: A[];
}

export function groupByAvailability<A extends Artwork>(works: readonly A[]): AvailabilityGroups<A> {
  const groups: AvailabilityGroups<A> = {
    available: [],
    unavailable: [],
    notForSale: [],
    unstated: [],
  };
  for (const w of works) {
    switch (w.availability) {
      case "available":
        groups.available.push(w);
        break;
      case "sold":
      case "reserved":
        groups.unavailable.push(w);
        break;
      case "not-for-sale":
        groups.notForSale.push(w);
        break;
      default:
        groups.unstated.push(w);
    }
  }
  return groups;
}

/**
 * Whether the site currently knows enough to talk about availability at all.
 * Surfaces use this to stay silent rather than render an empty "Available"
 * heading, which Carole 13 counts as a sign of an abandoned site.
 */
export function hasAvailabilityData(works: readonly Artwork[]): boolean {
  return works.some((w) => w.availability !== undefined);
}

/**
 * Carole 05 again: current work leads, older work stays visible without
 * dominating. Ordering, not exclusion, so nothing disappears from the record.
 */
const LIFECYCLE_ORDER = { current: 0, earlier: 1, archived: 2 } as const;

export function currentFirst<A extends Artwork>(works: readonly A[]): A[] {
  return [...works].sort((a, b) => LIFECYCLE_ORDER[a.lifecycle] - LIFECYCLE_ORDER[b.lifecycle]);
}

/**
 * The order a visitor should meet the work in: current before earlier before
 * archived, and within that, offerable before gone. A sold piece never outranks
 * an available one on a page a collector is browsing.
 */
export function forDisplay<A extends Artwork>(works: readonly A[]): A[] {
  const rank = (w: Artwork) =>
    w.availability === "available" ? 0 : w.availability === undefined ? 1 : 2;
  return [...works].sort(
    (a, b) => LIFECYCLE_ORDER[a.lifecycle] - LIFECYCLE_ORDER[b.lifecycle] || rank(a) - rank(b),
  );
}
