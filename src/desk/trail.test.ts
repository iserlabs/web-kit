import { describe, expect, it } from "vitest";
import { cleanTrail, describeTrail } from "./trail";
import { createVisits } from "./visits";

const { sourceOf } = createVisits({ hosts: ["example-house.org"], project: "p", team: "t" });

const T = Date.parse("2026-11-03T15:00:00Z");
const good = {
  first: { t: T - 5 * 86400000, land: "/spaces", ref: "www.google.com", utm: {} },
  visit: { t: T, land: "/plan-your-gathering", ref: "instagram.com", utm: {} },
  pages: ["/plan-your-gathering", "/spaces", "/history"],
  seen: 4,
  device: "Phone",
  lang: "en-US",
};

describe("cleaning the road in", () => {
  it("keeps the closed shape", () => {
    const t = cleanTrail(good);
    expect(t?.visit?.ref).toBe("instagram.com");
    expect(t?.pages).toHaveLength(3);
    expect(t?.device).toBe("Phone");
  });
  it("keeps only the site's own pages and no free text", () => {
    const t = cleanTrail({
      ...good,
      pages: ["/spaces", "https://evil.example/x", "javascript:alert(1)", "no-slash"],
      lang: "en-US<script>",
      visit: {
        ...good.visit,
        utm: { source: "news<b>letter", campaign: "x".repeat(300), junk: "free text" },
      },
    });
    expect(t?.pages).toEqual(["/spaces"]);
    expect(t?.lang).toBe("en-USscript");
    expect(t?.visit?.utm.source).toBe("newsbletter");
    expect(t?.visit?.utm.campaign?.length).toBe(80);
    expect(Object.keys(t?.visit?.utm ?? {})).not.toContain("junk");
  });
  it("bounds a hostile device and count and refuses a bad time", () => {
    const t = cleanTrail({
      ...good,
      device: "Toaster",
      seen: 99999,
      pages: new Array(100).fill("/a"),
    });
    expect(t?.device).toBe("");
    expect(t?.seen).toBe(500);
    expect(t?.pages).toHaveLength(25);
    expect(cleanTrail({ first: { t: 5, land: "/" }, visit: null })).toBeNull();
    expect(cleanTrail("nothing")).toBeNull();
  });
});

describe("the trail in words", () => {
  it("says where they came from, what they read and what they used", () => {
    const w = describeTrail(cleanTrail(good), sourceOf);
    expect(w?.source).toBe("Instagram");
    expect(w?.how).toContain("Instagram");
    expect(w?.how).toContain("landed on /plan-your-gathering");
    expect(w?.how).toContain("3 pages read");
    expect(w?.how).toContain("phone");
    expect(w?.returning).toBe(true);
  });
  it("calls a visit with no outside road typed or bookmarked", () => {
    const w = describeTrail(
      cleanTrail({ ...good, visit: { t: T, land: "/", ref: "", utm: {} }, first: null }),
      sourceOf,
    );
    expect(w?.source).toBe("Typed or bookmarked");
    expect(w?.how).toContain("the home page");
  });
  it("reads a newsletter tag as the newsletter", () => {
    const w = describeTrail(
      cleanTrail({
        ...good,
        visit: { t: T, land: "/", ref: "", utm: { source: "newsletter", medium: "email" } },
      }),
      sourceOf,
    );
    expect(w?.source).toBe("Newsletter");
  });
});
