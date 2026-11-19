import { describe, expect, it } from "vitest";
import { type Approval, resolveCopy } from "./copy";
import { DAY_CHAPTERS, planDay } from "./day";
import { ALL_APPROVED, FIXTURES, yaleFixture } from "./fixtures";
import type { GuideBrand } from "./brand";
import type { GuideModel } from "./model";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";

function build(m: GuideModel, brand: GuideBrand, approvals: Approval[] = []) {
  const copy = resolveCopy(m, { approvals, brandLabels: brand.labels });
  return planGuide(m, copy, { page: `/guides/${m.slug}`, phone: brand.phone });
}
function html(m: GuideModel, brand: GuideBrand, approvals: Approval[] = []) {
  return renderGuideHtml({
    plan: build(m, brand, approvals),
    brand,
    body: "day",
    serviceWorker: { url: "/guides/sw.js", scope: "/guides/" },
    head: { canonical: `https://example.invalid/guides/${m.slug}` },
  });
}
const visible = (h: string) =>
  h
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("planDay", () => {
  it.each(FIXTURES)("$id: the day comes first, numbered in reading order, Help last", ({ model, brand }) => {
    const d = planDay(build(model, brand));
    const nums = [...d.day.map((c) => c.number), ...d.rest.map((c) => c.number), d.help.number];
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    for (const c of d.day) expect(DAY_CHAPTERS).toContain(c.id);
    for (const c of d.rest) expect(DAY_CHAPTERS).not.toContain(c.id);
    expect(d.stops[0]?.id).toBe("cover");
    expect(d.stops.at(-1)?.id).toBe("help");
    expect(d.stops).toHaveLength(d.day.length + d.rest.length + 2);
  });

  it.each(FIXTURES)("$id: each quick answer sits once, at the head of its chapter", ({ model, brand }) => {
    const plan = build(model, brand);
    const d = planDay(plan);
    for (const c of d.day) {
      const firstNonAnswer = c.items.findIndex((i) => i.kind !== "answer");
      if (firstNonAnswer >= 0)
        expect(c.items.slice(firstNonAnswer).some((i) => i.kind === "answer")).toBe(false);
    }
    const ids = [
      ...d.day.flatMap((c) => c.items.flatMap((i) => ("id" in i && i.id ? [i.id] : []))),
      ...d.rest.flatMap((c) => c.answers.map((a) => a.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Yale: the door answer is the door line without the sentence the cover prints, then its steps", () => {
    const plan = build(yaleFixture, FIXTURES[0]?.brand as GuideBrand);
    const d = planDay(plan);
    const arrival = d.day.find((c) => c.id === "arrival");
    const door = arrival?.items.find((i) => i.kind === "answer" && i.id === "door");
    expect(door).toBeTruthy();
    const coverDoor = plan.cover.rows.find((r) => r.id === "door");
    if (door?.kind === "answer" && coverDoor?.kind === "text" && door.text)
      expect(door.text.startsWith(coverDoor.text)).toBe(false);
    if (door?.kind === "answer") expect(door.steps?.length).toBeGreaterThan(0);
  });

  it("the Arrival photo sits under the answer the house names, and nothing else of the chapter plates shows", () => {
    const brand = FIXTURES[0]?.brand as GuideBrand;
    const plan = build(yaleFixture, brand);
    const d = planDay({ ...plan, day: { plateUnder: "park" } }, { plateUnder: "park" });
    const arrival = d.day.find((c) => c.id === "arrival");
    const withPhoto = arrival?.items.filter((i) => i.kind === "answer" && i.photos?.length) ?? [];
    const plate = plan.chapters.find((c) => c.id === "arrival")?.plate;
    if (plate) {
      expect(withPhoto).toHaveLength(1);
      expect(withPhoto[0]?.kind === "answer" && withPhoto[0].id).toBe("park");
    } else expect(withPhoto).toHaveLength(0);
  });
});

describe("the Day rail page", () => {
  it.each(FIXTURES)("$id: every in-page link lands on an element on the page", ({ model, brand }) => {
    for (const h of [html(model, brand), html(model, brand, ALL_APPROVED)]) {
      const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const [, ref] of h.matchAll(/href="#([^"]+)"/g)) expect(ids, ref).toContain(ref);
      const all = [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(all).size, "ids are unique").toBe(all.length);
    }
  });

  it.each(FIXTURES)("$id: one h1, tel:911 once, the rail and its dialog once", ({ model, brand }) => {
    const h = html(model, brand);
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h.match(/href="tel:911"/g)).toHaveLength(1);
    expect(h.match(/<nav class="rl"/g)).toHaveLength(1);
    expect(h.match(/<dialog class="rl-sheet"/g)).toHaveLength(1);
    expect(h).toContain('closedby="any"');
    expect(h).toContain('aria-label="Contents"');
    expect(h).toContain('aria-label="Back"');
    expect(h).toContain('aria-label="Next"');
    expect(h).toContain('aria-label="Close"');
  });

  it.each(FIXTURES)("$id: the day body adds no words but the rail's", ({ model, brand }) => {
    const plan = build(model, brand);
    const classic = visible(
      renderGuideHtml({ plan, brand, head: { canonical: "https://example.invalid/x" } }),
    );
    const day = visible(html(model, brand));
    const words = (s: string) => new Set(s.split(/[^A-Za-z']+/).filter(Boolean));
    const before = words(classic);
    const added = [...words(day)].filter((w) => !before.has(w));
    expect(added.filter((w) => !["Contents"].includes(w))).toEqual([]);
  });

  it("the default body is unchanged: no rail, no day line", () => {
    const brand = FIXTURES[0]?.brand as GuideBrand;
    const plan = build(yaleFixture, brand);
    const h = renderGuideHtml({ plan, brand, head: { canonical: "https://example.invalid/x" } });
    expect(h).not.toContain('class="rl"');
    expect(h).not.toContain("c-rail");
    expect(h).toContain('class="find"');
  });

  it("the worker saves no photo the day body leaves out", () => {
    const brand = FIXTURES[0]?.brand as GuideBrand;
    const plan = build(yaleFixture, brand);
    const d = planDay(plan, plan.day);
    const h = html(yaleFixture, brand);
    const list = JSON.parse(
      (/data-offline="([^"]*)"/.exec(h)?.[1] ?? "[]").replace(/&quot;/g, '"'),
    ) as string[];
    for (const p of d.dropped) expect(list).not.toContain(p.src);
  });
});
