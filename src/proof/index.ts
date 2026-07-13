/**
 * The Operating Record — the founder's owner-attested career totals, and the
 * single canonical proof dataset shared verbatim by every Xenia Network site's
 * "Operating Record" proof strip. PURE DATA ONLY — no React, no app imports —
 * so any consumer (Next app, CLI, test) can import it.
 *
 * STRICT-CANONICAL: these exact figures publish identically on all member sites
 * (Palisade Stays, Sun Mountain Stays, Streamlined Stays, Xenia Operations,
 * Steadfast). The whole point is to kill the per-site drift that
 * previously stated one record as 237/240 STRs, 16,100+/16,500+/16,000+/14,000+
 * reservations, 500+/600+ claims, etc. Consistency across the network IS the
 * proof of "held to one standard".
 *
 * Sites that cannot yet bump their pinned web-kit ref keep a verbatim port at
 * `src/content/operating-record.ts` plus an invariant test asserting these exact
 * values, so the test is the drift guard until the port is replaced by a direct
 * import of this module.
 *
 * Numbers are owner-attested. To revise, change them HERE first, then re-sync the
 * ports — never edit a single site's figures in isolation.
 */

export interface OperatingRecordStat {
  /** Display value, verbatim — may carry a prefix/suffix: "237", "16,100+", "$89.5M+". */
  value: string;
  /** Lower-case descriptor, e.g. "reservations facilitated". */
  label: string;
}

export interface OperatingRecord {
  /** Framing eyebrow shown above the ledger. */
  eyebrow: string;
  /** Provenance stamp rendered beside the Ξ network mark. */
  stamp: string;
  /** The 8-stat ledger, in reading order (row-major across a 2×4 grid). */
  stats: readonly OperatingRecordStat[];
}

/**
 * The canonical record. Reading order is deliberate: scale → reach → depth.
 * Row 1 establishes the footprint (units, launches, volume, dollars); row 2 the
 * relationships and breadth (clients, markets, companies, claims).
 */
export const OPERATING_RECORD: OperatingRecord = {
  eyebrow: "The operating record behind the work",
  stamp: "Attested · as of 2026",
  stats: [
    { value: "273+", label: "STRs operated" },
    { value: "120", label: "listings launched" },
    { value: "16,900+", label: "reservations facilitated" },
    { value: "$94.5M+", label: "real estate stewarded" },
    { value: "78", label: "clients served" },
    { value: "28", label: "markets · 8 states" },
    { value: "9", label: "hospitality companies built" },
    { value: "670+", label: "claims filed" },
  ],
} as const;
