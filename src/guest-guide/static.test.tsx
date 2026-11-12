import { afterEach, describe, expect, it, vi } from "vitest";
import { type Approval, heldStrings, resolveCopy } from "./copy";
import {
  ALL_APPROVED,
  columbusBrand,
  FIXTURES,
  sunMountainBrand,
  wifiInMessageFixture,
  yaleFixture,
} from "./fixtures";
import type { GuideModel } from "./model";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";

const brandFor = (m: GuideModel) => (m.slug === "52-cottage" ? columbusBrand : sunMountainBrand);

function render(m: GuideModel, approvals: Approval[] = [], drafts: "hide" | "show" = "hide") {
  const brand = brandFor(m);
  const copy = resolveCopy(m, { approvals, brandLabels: brand.labels, drafts });
  const plan = planGuide(m, copy, { page: `/guides/${m.slug}`, phone: brand.phone });
  return renderGuideHtml({
    plan,
    brand,
    serviceWorker: { url: "/guides/sw.js", scope: "/guides/" },
    head: { canonical: `https://example.invalid/guides/${m.slug}` },
  });
}

/** The visible text of the page, tags and the inline CSS and script removed, entities decoded. */
const visible = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

afterEach(() => {
  vi.useRealTimers();
});

describe("renderGuideHtml", () => {
  it("the frozen-clock and shifted-clock renders are byte-identical (R4)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T03:00:00Z"));
    const a = render(yaleFixture, ALL_APPROVED);
    vi.setSystemTime(new Date("2031-07-19T22:45:00+14:00"));
    const b = render(yaleFixture, ALL_APPROVED);
    expect(b).toBe(a);
  });

  it.each(FIXTURES)(
    "$id: one h1, every img with width, height and alt, tel:911 once",
    ({ model }) => {
      for (const html of [render(model), render(model, ALL_APPROVED)]) {
        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
          expect(img, img).toMatch(/\swidth="\d+"/);
          expect(img, img).toMatch(/\sheight="\d+"/);
          expect(img, img).toMatch(/\salt="/);
        }
        expect(html.match(/href="tel:911"/g)).toHaveLength(1);
      }
    },
  );

  it.each(FIXTURES)("$id with zero approvals holds no held string (R13)", ({ model, brand }) => {
    const text = visible(render(model));
    for (const s of heldStrings(model, brand.labels)) expect(text, s).not.toContain(s);
  });

  it("with one approval, exactly that section's lines appear", () => {
    const ok: Approval[] = [
      { section: "house", scope: "house:yale", by: "Jake", on: "2026-11-11", source: "test" },
    ];
    const text = visible(render(yaleFixture, ok));
    expect(text).toContain("Who sleeps in which bedroom?");
    expect(text).toContain("Bins out Tuesday by 9:00 AM");
    expect(text).not.toContain("Too warm upstairs, too cold?");
    expect(text).not.toContain("10 questions");
    expect(text).not.toContain("Front door and keypad");
  });

  it("prints the live door timing on the cover and in full in Arrival (R6)", () => {
    const text = visible(render(yaleFixture));
    const live = yaleFixture.entry.codeDelivery.value;
    expect(text).toContain(live);
    expect(text).toContain("the day before you arrive");
    expect(text).not.toContain("on check-in day.");
  });

  it("carries the brand's faces and fields in its CSS (R2) and the light-only head (R10)", () => {
    const html = render(yaleFixture);
    expect(html).toContain('--display:"Newsreader",Georgia, serif;');
    expect(html).toContain('<meta name="color-scheme" content="light only">');
    expect(html).toContain('<meta name="theme-color" content="#e9c2a4">');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<link rel="canonical" href="https://example.invalid/guides/yale">');
    expect(html).toContain(
      '<meta property="og:url" content="https://example.invalid/guides/yale">',
    );
  });

  it("hides Copy without JavaScript and reserves the saved line, hidden until saved", () => {
    const html = render(yaleFixture);
    expect(html).toContain("<noscript><style>.gg .copy{display:none}</style></noscript>");
    expect(html).toMatch(/<span class="saved" data-saved="">Save this guide to your phone/);
    expect(html).not.toMatch(/data-saved="" data-on/);
  });

  it("marks every cover essential", () => {
    const html = render(yaleFixture);
    // Address with its Directions link, times, Wi-Fi, password, door, parking, help.
    expect((html.match(/data-essential=""/g) ?? []).length).toBe(7);
  });

  it("Wi-Fi in a message: no Copy button and no QR", () => {
    const html = render(wifiInMessageFixture);
    expect(html).not.toContain("data-copy=");
    expect(html).not.toContain('class="qr"');
  });

  it("brand phone 'never' prints no phone even when the model has one", () => {
    const m = structuredClone(yaleFixture);
    m.contact.phone = "(555) 010-0100";
    const html = render(m);
    expect(html).not.toContain("555");
    expect(html).not.toContain("sms:");
  });

  it("the nonce reaches the inline style and script", () => {
    const copy = resolveCopy(yaleFixture, { approvals: [] });
    const html = renderGuideHtml({
      plan: planGuide(yaleFixture, copy),
      brand: sunMountainBrand,
      nonce: "abc123",
      head: { canonical: "https://example.invalid/guides/yale" },
    });
    expect(html).toMatch(/<script nonce="abc123">/);
    expect(html).toMatch(/<style nonce="abc123">/);
  });

  it("the drafts preview prints the held lines in place", () => {
    const text = visible(render(yaleFixture, [], "show"));
    expect(text).toContain("10 questions");
    expect(text).toContain("Front door and keypad");
  });
});
