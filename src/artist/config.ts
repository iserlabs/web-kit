import type { StudioAuthOptions } from "./studio-auth";

/**
 * One artist site's settings for the module. A site keeps them in
 * `src/artist.config.ts`, written `as const satisfies ArtistConfig` so role ids stay
 * literal types.
 *
 * Every name here is the site's own, so a site that already has a studio keeps its
 * cookie, its store key and its catalog numbers when it adopts the module. New
 * settings are only ever added as optional fields.
 */
export interface ArtistConfig<R extends string = string> {
  /** Prefix for generated catalog ids: "JP-" gives "JP-0001". */
  catalogPrefix: string;
  /** The artist's name as printed on the site, for schema and the press kit. */
  artistName?: string;
  /** The IANA time zone show dates are read in. Default "America/New_York". */
  timeZone?: string;
  /** The site's series, in the order the site lists them. */
  series?: readonly { id: string; title: string }[];
  studio: StudioAuthOptions<R> & {
    /** The Upstash key holding the studio's per-work overlays. */
    storeKey: string;
    /** The Upstash key holding the site's shows. Unset means the site keeps no shows. */
    showsKey?: string;
  };
  /** The press kit, when the site has one. */
  press?: {
    /** The Upstash key holding the press kit's current token. */
    tokenKey: string;
  };
}
