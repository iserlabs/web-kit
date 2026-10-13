import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as artist from "./index";

/** Every function a site can import. Phase 2 appends to this list; removing a name
    is a breaking change for every site on the module. */
const FUNCTIONS = [
  "catalogIds",
  "cleanOverlay",
  "cleanShow",
  "cleanText",
  "createStudioAuth",
  "createStudioStore",
  "currentFirst",
  "cvFromShows",
  "cvGaps",
  "cvSections",
  "forDisplay",
  "formatAvailability",
  "formatDimensionsLine",
  "formatEdition",
  "formatLabel",
  "formatMediumLine",
  "formatOpening",
  "formatPriceLine",
  "formatShowDates",
  "formatTitleLine",
  "generatePressToken",
  "groupByAvailability",
  "hasAvailabilityData",
  "hasCvContent",
  "isFullyDocumented",
  "isPressToken",
  "isPurchasable",
  "loginHandler",
  "merge",
  "mergeAll",
  "mergeCv",
  "missingFields",
  "newestFirst",
  "noticeShow",
  "onView",
  "pressKit",
  "pressTokenMatches",
  "readCookie",
  "sanitizeStoredOverlay",
  "sanitizeStoredShows",
  "showJsonLd",
  "showStatus",
  "showsHandler",
  "workHandler",
];

/** The value sets the studio validates against. Sites read these to build forms. */
const VALUES = [
  "AVAILABILITY",
  "DEFAULT_TIME_ZONE",
  "LIFECYCLE",
  "PRICE_CURRENCY",
  "PRICE_VISIBILITY",
  "PUBLISH",
  "SHOW_KINDS",
  "UNITS",
];

describe("@iserlabs/web-kit/artist", () => {
  it("exports exactly the functions sites build on", () => {
    const names = Object.entries(artist)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(names).toEqual(FUNCTIONS);
  });

  it("exports exactly the allowed-value sets the studio checks against", () => {
    const names = Object.entries(artist)
      .filter(([, value]) => typeof value !== "function")
      .map(([name]) => name)
      .sort();
    expect(names).toEqual(VALUES);
  });

  it("is published at the ./artist path", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(pkg.exports["./artist"]).toBe("./src/artist/index.ts");
  });

  it("takes a site's config as written, its cookie, store and shows names included", () => {
    const config = {
      catalogPrefix: "JP-",
      artistName: "Test Artist",
      timeZone: "America/New_York",
      series: [{ id: "test-series", title: "Test Series" }],
      studio: {
        cookieName: "jp_studio",
        secretEnv: "STUDIO_SECRET",
        roles: [
          { id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" },
          { id: "jake", passphraseEnv: "STUDIO_PASS_JAKE", canReset: true },
        ],
        storeKey: "studio:julian:overlays",
        showsKey: "studio:julian:shows",
      },
      press: { tokenKey: "studio:julian:press" },
    } as const satisfies artist.ArtistConfig;
    const auth = artist.createStudioAuth(config.studio);
    const store = artist.createStudioStore({
      key: config.studio.storeKey,
      showsKey: config.studio.showsKey,
      pressKey: config.press.tokenKey,
    });
    expect(auth.cookieName).toBe("jp_studio");
    expect(store.key).toBe("studio:julian:overlays");
    expect(store.shows.key).toBe("studio:julian:shows");
    expect(store.press.key).toBe("studio:julian:press");
    expect(auth.canReset("jake")).toBe(true);
    expect(auth.canReset("julian")).toBe(false);
  });

  it("still takes a phase-1 config with none of the new fields", () => {
    const config = {
      catalogPrefix: "JP-",
      studio: {
        cookieName: "jp_studio",
        secretEnv: "STUDIO_SECRET",
        roles: [{ id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" }],
        storeKey: "studio:julian:overlays",
      },
    } as const satisfies artist.ArtistConfig;
    const store = artist.createStudioStore({ key: config.studio.storeKey });
    expect(store.shows.key).toBeUndefined();
    expect(store.press.key).toBeUndefined();
  });
});
