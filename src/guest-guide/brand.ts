/**
 * Brand tokens for the Alpenglow guide. Each site holds its own values; the kit
 * holds the type, the checks and the CSS writer. `validateBrand` refuses a
 * brand that would print low-contrast text, a dark field, a banned face, or
 * (for the Xenia lock) any blue.
 */
import type { TemplateLabelId } from "./copy";

/** The eight fields, in the order the chapters meet them. `paper` is Help and the colophon. */
export type FieldId = "arrival" | "first" | "house" | "know" | "rules" | "out" | "near" | "paper";

export const FIELD_IDS: readonly FieldId[] = [
  "arrival",
  "first",
  "house",
  "know",
  "rules",
  "out",
  "near",
  "paper",
];

/** A typeface. `family` is the CSS family name (a next/font variable works too). */
export type Face = { family: string; fallback: string; weight: number; opsz?: boolean };

export type BrandId =
  | "sun-mountain"
  | "columbus"
  | "palisade"
  | "euclid"
  | "peak"
  | "grand-colorado"
  | "bluebill"
  | "fixture";

export type GuideBrand = {
  id: BrandId;
  name: string;
  wordmark:
    | { kind: "text"; text: string; face: "wordmark" | "display"; sub?: string }
    | { kind: "image"; src: string; width: number; height: number; alt: string };
  /** Small mark in the sky (the Sun Mountain roundel, mono ink). */
  mark?: { src: string; width: number; height: number };
  faces: {
    /** House name, 80 px. */
    display: Face;
    /** Chapter heads 30 px and index questions 22 px (display family at 400). */
    head: Face;
    /** Body 18/1.6; labels at the strong weight, 15 px. */
    text: Face & { strong: number };
    /** Large answers 64 px and hanging numerals 36 px at `large`. */
    figure: Face & { large: number };
    /** Cinzel, Sun Mountain only. */
    wordmark?: Face;
  };
  ink: string;
  sec: string;
  /** Hanging numerals 36 px and large figures (3:1 floor). */
  accent: string;
  /** Labels 15 px and up (4.5:1 floor). */
  accentText: string;
  onPhoto: string;
  button: { fill: string; ink: string; doneFill: string; doneInk: string };
  fields: Record<FieldId, string>;
  phone: "never" | "allowed";
  /** Xenia lock: refuse blue and navy hues. */
  noBlue?: boolean;
  /** Service-worker cache prefix, e.g. "sms-guides". */
  cachePrefix: string;
  /** This brand's live (v1) labels, where they differ from the kit defaults. */
  labels?: Partial<Record<TemplateLabelId, string>>;
};
