import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as artist from "./index";

/** Every function a site can import. Phase 2 appends to this list; removing a name
    is a breaking change for every site on the module. */
const FUNCTIONS = [
  "catalogIds",
  "cleanOverlay",
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
  "formatTitleLine",
  "groupByAvailability",
  "hasAvailabilityData",
  "hasCvContent",
  "isFullyDocumented",
  "isPurchasable",
  "loginHandler",
  "merge",
  "mergeAll",
  "mergeCv",
  "missingFields",
  "newestFirst",
  "readCookie",
  "sanitizeStoredOverlay",
  "showsHandler",
  "workHandler",
];

/** The value sets the studio validates against. Sites read these to build forms. */
const VALUES = [
  "AVAILABILITY",
  "LIFECYCLE",
  "PRICE_CURRENCY",
  "PRICE_VISIBILITY",
  "PUBLISH",
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

  it("takes a site's config as written, its cookie and store names included", () => {
    const config = {
      catalogPrefix: "JP-",
      studio: {
        cookieName: "jp_studio",
        secretEnv: "STUDIO_SECRET",
        roles: [
          { id: "julian", passphraseEnv: "STUDIO_PASS_JULIAN" },
          { id: "jake", passphraseEnv: "STUDIO_PASS_JAKE", canReset: true },
        ],
        storeKey: "studio:julian:overlays",
      },
    } as const satisfies artist.ArtistConfig;
    const auth = artist.createStudioAuth(config.studio);
    const store = artist.createStudioStore({ key: config.studio.storeKey });
    expect(auth.cookieName).toBe("jp_studio");
    expect(store.key).toBe("studio:julian:overlays");
    expect(auth.canReset("jake")).toBe(true);
    expect(auth.canReset("julian")).toBe(false);
  });
});
