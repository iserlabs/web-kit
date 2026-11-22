import { describe, expect, it } from "vitest";
import { resolveCopy } from "./copy";
import { FIXTURE_TODAY, sunMountainBrand, yaleFixture } from "./fixtures";
import type { GuideModel, VideoV2 } from "./model";
import { planGuide } from "./plan";
import { renderGuideHtml } from "./static";
import { validateModel } from "./validate";

const video: VideoV2 = {
  src: "/media/keycafe-pickup.mp4",
  type: "video/mp4",
  poster: "/media/keycafe-pickup.jpg",
  alt: "Opening the key box and taking the key",
  width: 720,
  height: 1280,
  captions: "/media/keycafe-pickup.vtt",
  source: "fixture",
  checked: "2026-11-11",
};

function withVideo(v: VideoV2 = video): GuideModel {
  const m = structuredClone(yaleFixture);
  const item = m.sections
    .find((s) => s.id === "good-to-know")
    ?.items.find((i) => i.label === "Stairs");
  if (item) item.video = v;
  return m;
}

const html = (m: GuideModel) =>
  renderGuideHtml({
    plan: planGuide(m, resolveCopy(m, { approvals: [] })),
    brand: sunMountainBrand,
    head: { canonical: "https://example.invalid/guides/yale" },
  });

describe("video block (SPEC 5.5, 11)", () => {
  it("renders with preload none and no poster request in the HTML (0 KB until tapped)", () => {
    const out = html(withVideo());
    const tag = out.match(/<video\b[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('preload="none"');
    expect(tag).toContain('data-poster="/media/keycafe-pickup.jpg"');
    expect(tag).not.toMatch(/\sposter="/);
    expect(tag).not.toMatch(/\sautoplay/);
    expect(tag).toContain('aria-label="Opening the key box and taking the key"');
    expect(tag).toContain('width="720"');
    expect(out).toContain('<source src="/media/keycafe-pickup.mp4" type="video/mp4"/>');
    // The captions file loads only on play: no track in the markup, the URL waits in data-captions.
    expect(out).not.toContain("<track");
    expect(tag).toContain('data-captions="/media/keycafe-pickup.vtt"');
  });

  it("is never placed when it shows a door, a code, or AI footage, and the validator says why", () => {
    const door = withVideo({ ...video, shows: ["door"] });
    expect(html(door)).not.toContain("<video");
    expect(
      validateModel(door, { today: FIXTURE_TODAY }).some((p) =>
        p.includes("video: may not be placed (shows door)"),
      ),
    ).toBe(true);
    expect(html(withVideo({ ...video, ai: true }))).not.toContain("<video");
  });

  it("the validator refuses a video with no alt, poster or size", () => {
    const p = validateModel(withVideo({ ...video, alt: " ", poster: "", width: 0 }), {
      today: FIXTURE_TODAY,
    });
    expect(p.some((x) => x.includes("video: no alt text"))).toBe(true);
    expect(p.some((x) => x.includes("video: needs a src and a poster"))).toBe(true);
    expect(p.some((x) => x.includes("video: needs a width and a height"))).toBe(true);
  });

  it("is not in the offline list: only the page, fonts and photos are saved", () => {
    const m = withVideo();
    const plan = planGuide(m, resolveCopy(m, { approvals: [] }), { page: "/guides/yale" });
    expect(plan.offlineUrls.some((u) => u.includes("keycafe"))).toBe(false);
  });
});
