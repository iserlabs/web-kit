/**
 * The Xenia Network - member registry, selectors, and JSON-LD builder.
 *
 * Fleet-wide source of truth, consumed by every affiliated site via
 * `@iserlabs/web-kit/network`. PURE DATA + PURE FUNCTIONS ONLY - no React, no
 * app imports - so any consumer (Next app, CLI, test) can import it.
 */

export type MemberRole = "brand" | "engine";

export type RouteBy = { kind: "market"; label: string } | { kind: "need"; label: string };

export interface NetworkMember {
  /** stable slug */
  id: string;
  name: string;
  role: MemberRole;
  /** absolute URL we link to (may be a temporary host until DNS cutover) */
  url: string;
  /** one-line descriptor for the hub */
  blurb: string;
  /** how the hub router lists this member */
  routeBy: RouteBy;
  /**
   * Whether the member's footer shows the "Guest care by Xenia Hospitality
   * Operations" credit. True for the management brands whose guest care Ops runs
   * (Palisade) and Steadfast; false for Xenia Operations (it IS Ops, no
   * self-credit), Streamlined (self-manage systems/advisory, provides no guest
   * care), and Sun Mountain Stays (runs guest care in-house by design).
   */
  footerGuestCareCredit: boolean;
}

export const XENIA_NETWORK = {
  name: "The Xenia Network",
  // The Network now lives on its own subdomain; the apex xenia.host is the
  // Xenia Hospitality Operations marketing site (member id "xenia-ops").
  url: "https://network.xenia.host",
  tagline: "Founder-led hospitality companies sharing one operating standard.",
} as const;

export const STREAMLINED_ID = "streamlined";

/**
 * Default false = Streamlined is MUTED on management-brand footers
 * (channel-conflict guard, spec §7.2). Flip to true to include it everywhere.
 */
export const includeStreamlinedInBrandFooters = false;

export const networkMembers: readonly NetworkMember[] = [
  {
    id: "palisade",
    name: "Palisade Stays",
    role: "brand",
    url: "https://palisadestays.com",
    blurb:
      "Founder-led STR & furnished-rental management for Northern New Jersey and the Lower Hudson Valley.",
    routeBy: { kind: "market", label: "Northern NJ & Lower Hudson Valley" },
    footerGuestCareCredit: true,
  },
  {
    id: "sun-mountain-stays",
    name: "Sun Mountain Stays",
    role: "brand",
    url: "https://sunmountainstays.com",
    blurb: "Founder-led, in-house short-term-rental management in Colorado Springs, Colorado.",
    routeBy: { kind: "market", label: "Colorado Springs, Colorado" },
    // In-house guest care by design, so no Xenia Operations guest-care credit.
    footerGuestCareCredit: false,
  },
  {
    id: "xenia-ops",
    name: "Xenia Operations",
    role: "engine",
    url: "https://xenia.host",
    blurb:
      "Remote, done-for-you hospitality operations desk: guest messaging, coordination, escalation.",
    routeBy: { kind: "need", label: "Run it for me, remotely" },
    footerGuestCareCredit: false,
  },
  {
    id: "steadfast",
    name: "Steadfast",
    role: "engine",
    url: "https://steadfast.xenia.host",
    blurb:
      "Field property care: turnover support, inspections, preventative care, photo/video reporting.",
    routeBy: { kind: "need", label: "Care for the physical property" },
    footerGuestCareCredit: true,
  },
  {
    id: "streamlined",
    name: "Streamlined Stays",
    role: "engine",
    url: "https://streamlinedstr.com",
    blurb:
      "Nationwide STR systems, automation, and consulting for owner-operators and portfolio managers who self-manage.",
    routeBy: {
      kind: "need",
      label: "Run it myself, smarter (systems & automation)",
    },
    footerGuestCareCredit: false,
  },
];

export function memberById(id: string): NetworkMember | undefined {
  return networkMembers.find((m) => m.id === id);
}

/** Members for the footer peer block on the site whose member id is `currentId`. */
export function footerMembersFor(currentId: string): NetworkMember[] {
  const current = memberById(currentId);
  const muteStreamlined = current?.role === "brand" && !includeStreamlinedInBrandFooters;
  return networkMembers.filter((m) => {
    if (m.id === currentId) return false;
    if (muteStreamlined && m.id === STREAMLINED_ID) return false;
    return true;
  });
}

export function managementBrands(): NetworkMember[] {
  return networkMembers.filter((m) => m.role === "brand");
}

export function engines(): NetworkMember[] {
  return networkMembers.filter((m) => m.role === "engine");
}

/** "Palisade Stays & Sun Mountain Stays" */
export function brandListLabel(): string {
  const names = managementBrands().map((m) => m.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

type JsonLd = Record<string, unknown>;

/** @id for the network Organization node. */
export const NETWORK_ID = `${XENIA_NETWORK.url}#network`;

/** The Network's home, the human-facing link target for member badges. */
export const XENIA_NETWORK_HOME = "https://network.xenia.host";

/**
 * Canonical `memberOf` reference every member site emits in its own Organization
 * JSON-LD. The `@id` ties each member back to the single network node defined in
 * `networkGraph()`; `name` + `url` keep it self-contained for crawlers that read
 * the member page in isolation. Pass to `organization({ memberOf })`.
 */
export const xeniaNetworkMemberOf = {
  "@type": "Organization",
  "@id": NETWORK_ID,
  name: XENIA_NETWORK.name,
  url: XENIA_NETWORK_HOME,
} as const;

/**
 * Shared membership copy so every member's footer badge and homepage trust band
 * read identically. Brand names stay verbatim; only connective prose lives here.
 */
export const MEMBERSHIP_COPY = {
  kicker: "Part of The Xenia Network",
  standard: "Held to one standard.",
  tagline: XENIA_NETWORK.tagline,
  /** apex landing (footer badge) */
  homeHref: XENIA_NETWORK_HOME,
  /** roster page ("Explore the network →") */
  exploreHref: XENIA_NETWORK.url,
} as const;

/**
 * JSON-LD @graph for The Xenia Network: one parent Organization whose
 * `subOrganization` lists every member, with each member emitting `memberOf`
 * back to the parent. Uses parentOrganization/subOrganization/memberOf - never
 * `sameAs` (spec §5).
 */
export function networkGraph(): { "@context": string; "@graph": JsonLd[] } {
  const memberNode = (m: NetworkMember): JsonLd => ({
    "@type": "Organization",
    "@id": `${m.url}#org`,
    name: m.name,
    url: m.url,
    memberOf: { "@id": NETWORK_ID },
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": NETWORK_ID,
        name: XENIA_NETWORK.name,
        url: XENIA_NETWORK.url,
        description: XENIA_NETWORK.tagline,
        subOrganization: networkMembers.map((m) => ({ "@id": `${m.url}#org` })),
      },
      ...networkMembers.map(memberNode),
    ],
  };
}
