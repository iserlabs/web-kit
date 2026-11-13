import { describe, expect, it } from "vitest";
import { resolveCopy } from "./copy";
import { FIXTURE_TODAY, sunMountainBrand, yaleFixture } from "./fixtures";
import type { GuideModel } from "./model";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";
import { validateModel } from "./validate";

const S = { source: "fixture", checked: "2026-11-11" };

function withLinks(): GuideModel {
  const m = structuredClone(yaleFixture);
  const know = m.sections.find((s) => s.id === "good-to-know");
  if (know)
    know.links = [
      { label: "Snow report", href: "https://example.invalid/snow", ...S },
      { label: "Lost an item? Tell us", href: "/lost", ...S },
    ];
  m.look.quickFind = [...(m.look.quickFind ?? []).slice(0, 9), "good-to-know.snow-report"];
  return m;
}

const render = (m: GuideModel) => {
  const plan = planGuide(m, resolveCopy(m, { approvals: [] }));
  return {
    plan,
    html: renderGuideHtml({
      plan,
      brand: sunMountainBrand,
      head: { canonical: "https://example.invalid/g" },
    }),
  };
};

describe("link rows", () => {
  it("render as plain row links, the external one marked, each with its own anchor", () => {
    const { html, plan } = render(withLinks());
    expect(html).toMatch(
      /<p class="row-link" id="i-good-to-know-snow-report"><a href="https:\/\/example.invalid\/snow">Snow report<span aria-hidden="true"> ↗<\/span><span class="vh"> \(another site\)<\/span><\/a><\/p>/,
    );
    expect(html).toMatch(/<a href="\/lost">Lost an item\? Tell us<\/a>/);
    expect(plan.ids).toContain("i-good-to-know-snow-report");
  });

  it("a quick-find ref may point at a link row", () => {
    const { plan } = render(withLinks());
    const row = plan.quickFind.rows.find((r) => r.ref === "good-to-know.snow-report");
    expect(row).toMatchObject({ question: "Snow report", href: "#i-good-to-know-snow-report" });
  });

  it("validates clean, and refuses an unsafe or empty link", () => {
    const m = withLinks();
    expect(
      validateModel(m, { today: FIXTURE_TODAY }).filter((p) => !p.includes("portrait crop")),
    ).toEqual([]);
    const bad = withLinks();
    const know = bad.sections.find((s) => s.id === "good-to-know");
    if (know?.links) {
      know.links[0] = { label: " ", href: "javascript:alert(1)", ...S };
      know.links[1] = { label: "Webcams", href: "//evil.invalid", ...S };
    }
    const p = validateModel(bad, { today: FIXTURE_TODAY });
    expect(p.some((x) => x.includes("link has no label"))).toBe(true);
    expect(p.filter((x) => x.includes("must be https:// or a path"))).toHaveLength(2);
  });

  it("a section holding only links is a real section", () => {
    const m = withLinks();
    const know = m.sections.find((s) => s.id === "good-to-know");
    if (know) know.items = [];
    m.look.readFirst = undefined;
    m.look.quickFind = ["wifi"];
    expect(validateModel(m, { today: FIXTURE_TODAY }).some((p) => p.includes("has no rows"))).toBe(
      false,
    );
    expect(render(m).plan.chapters.some((c) => c.id === "good-to-know")).toBe(true);
  });
});

describe("photo credits", () => {
  it("prints the credit of each placed photo once in the colophon, and never a credit for an unplaced photo", () => {
    const m = structuredClone(yaleFixture);
    for (const p of m.photos) {
      if (p.src.includes("exterior-2") || p.src.includes("living-1"))
        p.credit = "Photo: A. Photographer";
      if (p.src.includes("deck-dining")) p.credit = "Photo: Never Placed";
    }
    const { plan, html } = render(m);
    expect(plan.colophon.credits).toEqual(["Photo: A. Photographer"]);
    expect(html.match(/Photo: A\. Photographer/g)).toHaveLength(1);
    expect(html).not.toContain("Never Placed");
  });

  it("no credits, no line", () => {
    expect(render(yaleFixture).plan.colophon.credits).toEqual([]);
  });
});
