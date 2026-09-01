export interface BrandPackPerson {
  name: string;
  title: string;
  email: string;
  phone: string;
  /** Optional per-person booking or inquiry link shown by the two-column variant. */
  link?: { label: string; href: string };
}

export interface BrandPackConfig {
  siteUrl: string;
  wordmark: string;
  tagline: string;
  markUrl: string;
  markAlt: string;
  displayFont: string;
  bodyFont: string;
  ink: string;
  ground: string;
  brand: string;
  accent: string;
  /** Photograph used by the share cards that carry one. Absolute URL. */
  photoUrl?: string;
  /** id of the picked share card variant. Null until the client picks. */
  shareCard: string | null;
  /** id of the picked signature variant. Null until the client picks. */
  signature?: string | null;
  people: BrandPackPerson[];
  /** Replace one of the five with a renderer written for this client. */
  overrides?: {
    signatures?: Record<string, (config: BrandPackConfig, person: BrandPackPerson) => string>;
    shareCards?: Record<string, (config: BrandPackConfig) => unknown>;
  };
}

export declare const BRAND_PACK_FILENAME: string;
export declare const UNFILLED: string;
export declare function defineBrandPack(config: BrandPackConfig): BrandPackConfig;
export declare function validateBrandPackConfig(
  config: unknown,
): { severity: string; code: string; message: string }[];
export declare function loadBrandPackConfig(siteDir: string): Promise<BrandPackConfig>;
