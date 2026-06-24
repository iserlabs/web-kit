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
    expect(managementBrands().map((m) => m.id)).toEqual(["palisade", "rhh", "ikoi"]);
    expect(engines().map((m) => m.id)).toEqual(["xenia-ops", "steadfast", "streamlined"]);
  });

  it("treats Streamlined Stays as an engine routed by need", () => {
    const s = memberById("streamlined");
    expect(s?.role).toBe("engine");
    expect(s?.routeBy.kind).toBe("need");
  });

  it("links Right Hand Host to the live site until DNS cutover", () => {
    expect(memberById("rhh")?.url).toBe("https://right-hand-host.vercel.app");
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
    expect(brandListLabel()).toBe("Palisade Stays, Right Hand Host & Ikoi Homes");
  });
});

describe("networkGraph", () => {
  const graph = networkGraph();
  const nodes = graph["@graph"] as Array<Record<string, unknown>>;

  it("has a parent network node with six subOrganizations", () => {
    const parent = nodes.find((n) => n["@id"] === NETWORK_ID);
    expect(parent).toBeDefined();
    expect((parent?.subOrganization as unknown[]).length).toBe(6);
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
