import { describe, expect, it } from "vitest";
import { pageMeta } from "./index";

const base = { title: "Home", description: "Welcome", canonical: "https://x.com/" };

describe("pageMeta", () => {
  it("maps core fields and defaults type to website", () => {
    const m = pageMeta(base);
    expect(m.title).toBe("Home");
    expect(m.canonical).toBe("https://x.com/");
    expect(m.openGraph.type).toBe("website");
    expect(m.openGraph.url).toBe("https://x.com/");
  });

  it("uses summary_large_image when an image is present", () => {
    const m = pageMeta({ ...base, image: "https://x.com/og.png" });
    expect(m.twitter.card).toBe("summary_large_image");
    expect(m.openGraph.images).toEqual([{ url: "https://x.com/og.png" }]);
  });

  it("falls back to summary with no image", () => {
    expect(pageMeta(base).twitter.card).toBe("summary");
  });

  it("turns alternates into a hreflang language map", () => {
    const m = pageMeta({
      ...base,
      locale: "en",
      alternates: [
        { hreflang: "en", href: "https://x.com/" },
        { hreflang: "es", href: "https://x.com/es/" },
      ],
    });
    expect(m.languages).toEqual({ en: "https://x.com/", es: "https://x.com/es/" });
    expect(m.openGraph.locale).toBe("en");
  });
});
