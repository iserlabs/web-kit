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
  /** id of the picked letterhead layout. Null until the client picks. */
  letterheadPick?: string | null;
  /** Letterhead-only tokens; everything else comes from the fields above. */
  letterhead?: BrandPackLetterhead;
  /** Replace one of the five with a renderer written for this client. */
  overrides?: {
    signatures?: Record<string, (config: BrandPackConfig, person: BrandPackPerson) => string>;
    shareCards?: Record<string, (config: BrandPackConfig) => ShareCardNode>;
    letterheads?: Record<
      string,
      (
        config: BrandPackConfig,
        person: BrandPackPerson,
        email: LetterheadEmail,
        signatureHtml?: string,
      ) => string
    >;
  };
}

/** One of the five designs on a board: what the client is choosing between. */
export interface BrandPackVariant {
  id: string;
  label: string;
  note: string;
}

/**
 * How one surface renders a 1200x630 card. Sizes are the rendered card in CSS
 * pixels at a typical viewport, not the source file.
 */
export interface BrandPackPlatform {
  id: string;
  label: string;
  cardWidth: number;
  cardHeight: number;
  showsTitle: boolean;
  showsDescription: boolean;
  showsDomain: boolean;
  radius: number;
  note: string;
}

/**
 * A share card as a serializable tree rather than a React element, because
 * web-kit carries no React. The consumer converts it with `createElement`.
 */
export interface ShareCardNode {
  tag: string;
  style: Record<string, string | number>;
  children: (ShareCardNode | string)[];
  src?: string;
  alt?: string;
  /**
   * Set when a photo variant was asked for without a `photoUrl` and the
   * mark-and-rule card was rendered in its place, so a board can say why.
   */
  fallbackFrom?: string;
}

export declare const BRAND_PACK_FILENAME: string;
export declare const UNFILLED: string;
/** True when a field is missing, blank, or still carries the `UNFILLED` sentinel. */
export declare function isUnfilled(value: unknown): boolean;
export declare function defineBrandPack(config: BrandPackConfig): BrandPackConfig;
export declare function validateBrandPackConfig(
  config: unknown,
): { severity: string; code: string; message: string }[];
export declare function loadBrandPackConfig(siteDir: string): Promise<BrandPackConfig>;

export declare const PLATFORMS: BrandPackPlatform[];
export declare const PLATFORM_IDS: string[];

export declare const CARD_SIZE: { width: number; height: number };
export declare const SHARE_CARD_VARIANTS: BrandPackVariant[];
export declare const SHARE_CARD_IDS: string[];
export declare function renderShareCard(variantId: string, config: BrandPackConfig): ShareCardNode;

export declare const SIGNATURE_VARIANTS: BrandPackVariant[];
export declare const SIGNATURE_IDS: string[];
export declare function renderSignature(
  variantId: string,
  config: BrandPackConfig,
  person: BrandPackPerson,
): string;

export interface BrandPackLetterhead {
  /** Header image with its background painted in (opaque), so Gmail dark mode cannot hide it. */
  headerUrl: string;
  headerWidth?: number;
  headerAlt?: string;
  paper?: string;
  surround?: string;
  rule?: string;
  line?: string;
  soft?: string;
  link?: string;
  photoUrl?: string;
  photoAlt?: string;
  address?: string;
  footer?: string;
}

export type LetterheadBlock =
  | { type: "p" | "lead" | "close"; text: string }
  | { type: "link"; label?: string; href: string; note?: string; button?: string }
  | { type: "list"; intro?: string; items: string[] };

export interface LetterheadEmail {
  subject: string;
  blocks: LetterheadBlock[];
}

export declare const LETTERHEAD_VARIANTS: BrandPackVariant[];
export declare const LETTERHEAD_IDS: string[];
export declare function renderLetterhead(
  variantId: string,
  config: BrandPackConfig,
  person: BrandPackPerson,
  email: LetterheadEmail,
  signatureHtml?: string,
): string;
export declare function letterheadPlainText(
  email: LetterheadEmail,
  person: BrandPackPerson,
): string;
export declare function letterheadDocument(
  html: string,
  opts?: { subject?: string; fontsHref?: string },
): string;
export declare function letterheadSignature(html: string): string;
