import { describe, expect, it } from "vitest";
import {
  brandListLabel,
  engines,
  footerMembersFor,
  managementBrands,
  memberById,
  NETWORK_ID,
  networkGraph,
  networkMembers,
} from "./index";

describe("network registry", () => {
  it("has six members with unique ids", () => {
    expect(networkMembers).toHaveLength(6);
    expect(new Set(networkMembers.map((m) => m.id)).size).toBe(6);
  });

  it("excludes The Columbus Hotel", () => {
    expect(networkMembers.some((m) => m.name.toLowerCase().includes("columbus"))).toBe(false);
  });

  it("classifies three brands and three engines", () => {
    expect(managementBrands().map((m) => m.id)).toEqual(["palisade", "sun-mountain-stays", "ikoi"]);
    expect(engines().map((m) => m.id)).toEqual(["xenia-ops", "steadfast", "streamlined"]);
  });

  it("treats Streamlined Stays as an engine routed by need", () => {
    const s = memberById("streamlined");
    expect(s?.role).toBe("engine");
    expect(s?.routeBy.kind).toBe("need");
  });

  it("links Sun Mountain Stays to its live Colorado Springs site", () => {
    expect(memberById("sun-mountain-stays")?.url).toBe("https://sunmountainstays.com");
  });

  it("mutes Streamlined on a management-brand footer, omitting self", () => {
    const ids = footerMembersFor("palisade").map((m) => m.id);
    expect(ids).not.toContain("streamlined");
    expect(ids).not.toContain("palisade");
    expect(ids).toHaveLength(4);
  });

  it("keeps Streamlined on an engine-site footer", () => {
    const ids = footerMembersFor("xenia-ops").map((m) => m.id);
    expect(ids).toContain("streamlined");
    expect(ids).not.toContain("xenia-ops");
    expect(ids).toHaveLength(5);
  });

  it("formats the brand list label", () => {
    expect(brandListLabel()).toBe("Palisade Stays, Sun Mountain Stays & Ikoi Homes");
  });

  it("marks footerGuestCareCredit true only where guest care is run by Ops", () => {
    const credit = Object.fromEntries(networkMembers.map((m) => [m.id, m.footerGuestCareCredit]));
    expect(credit).toEqual({
      palisade: true,
      "sun-mountain-stays": false,
      ikoi: true,
      steadfast: true,
      "xenia-ops": false,
      streamlined: false,
    });
  });
});

describe("networkGraph", () => {
  const graph = networkGraph();
  const nodes = graph["@graph"] as Array<Record<string, unknown>>;

  it("has a parent network node with six subOrganizations", () => {
    const parent = nodes.find((n) => n["@id"] === NETWORK_ID);
    expect(parent).toBeDefined();
    expect(parent?.subOrganization).toHaveLength(6);
  });

  it("links members with memberOf and never sameAs", () => {
    const json = JSON.stringify(graph);
    expect(json).toContain("memberOf");
    expect(json).not.toContain("sameAs");
  });

  it("never references Columbus", () => {
    expect(JSON.stringify(graph).toLowerCase()).not.toContain("columbus");
  });
});
