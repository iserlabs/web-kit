/**
 * The v2 guest guide model ("Alpenglow"). It extends the v0.16 `GuestGuide`
 * types and never replaces them: `GuestGuide` and `validateGuide` keep working.
 *
 * Three rules shape every type here:
 * 1) Every fact a guest acts on carries a source and the day it was checked.
 * 2) A fact not on record is an `Unknown`, never a guess. It prints only as its
 *    own live line, or as the approved unknown line.
 * 3) There is no field for an entry code. The guide says where the code
 *    arrives, never what it is.
 */
import type { HeldLine } from "./copy";
import type {
  GuestAddress,
  GuideItem,
  GuidePhoto,
  GuideSectionId,
  LocalPick,
  Sourced,
} from "./types";

/** A fact not on record. Never a guess. Printed only as its liveLine, or as the approved unknown line. */
export type Unknown = {
  unknown: true;
  /** Why it is missing, for the reviewer. Never printed. */
  reason: string;
  /** The guest line this guide already prints for the gap today, verbatim (Grand Colorado: "Filled in before arrival"). */
  liveLine?: string;
  source: string;
  checked: string;
};

/** A sourced value, or an honest gap. */
export type Slot<T = string> = Sourced<T> | Unknown;

export const isUnknown = (s: unknown): s is Unknown =>
  typeof s === "object" && s !== null && (s as { unknown?: unknown }).unknown === true;

/** The chapters a guide can have, in page order. */
export type ChapterId =
  | "arrival"
  | "first-hour"
  | "house"
  | "good-to-know"
  | "rules"
  | "checkout"
  | "nearby"
  | "help";

export const CHAPTER_ORDER: readonly ChapterId[] = [
  "arrival",
  "first-hour",
  "house",
  "good-to-know",
  "rules",
  "checkout",
  "nearby",
  "help",
];

export type ItemV2 = GuideItem & {
  /** Unique in the guide. Default: `${sectionId}.${kebab(label)}`. Used by quick find, figures, order and drafts. */
  key?: string;
  /** Rows read together under one sub-head ("Heat", "Cooling"). */
  group?: string;
  /** Where the thing is, set as its own line. */
  where?: string;
  /** The house: the level this room is on. */
  level?: string;
  /** The house: the photograph of this room, a photos[].src. */
  photo?: string;
  /** The house: more photographs of the same room. */
  more?: string[];
  /** The house: set the label as a room name. */
  room?: boolean;
  /** Last day this is true (YYYY-MM-DD). The build fails after it; the page prints "Until <day>". */
  validThrough?: string;
  /** A short how-to video for this row (Euclid's KeyCafe pickup). Loads nothing until tapped. */
  video?: VideoV2;
};

/**
 * A video placed on a row. `preload="none"` and a poster set only when the
 * row nears the window, so it adds 0 KB to the first load. The same never-place
 * rules as a photo apply.
 */
export type VideoV2 = {
  src: string;
  /** MIME type of `src`, e.g. "video/mp4". */
  type: string;
  poster: string;
  /** What the video shows, for its accessible name. */
  alt: string;
  width: number;
  height: number;
  /** A WebVTT captions file, when there is speech. */
  captions?: string;
  ai?: boolean;
  rights?: "confirmed" | "unconfirmed";
  shows?: ("door" | "garage-door" | "code" | "neighbor-number" | "defect")[];
  source: string;
  checked: string;
};

/** A row whose fact is not on record (blankets, a door landmark). */
export type UnknownItem = { key?: string; label: string; fact: Unknown };

export type SectionV2 = {
  id: GuideSectionId;
  title: string;
  intro?: string;
  items: ItemV2[];
  /** Rows not on record. Shown only as their liveLine, or with the approved unknown line. */
  unknowns?: UnknownItem[];
  /** Rows that are a link and nothing else (a snow report, the webcams, a lost-item form). */
  links?: LinkItem[];
};

/** A row that is one link: printed as a plain 44 px row, an external link marked as one. */
export type LinkItem = {
  /** Default: `${sectionId}.${kebab(label)}`. */
  key?: string;
  /** The live link text, verbatim. */
  label: string;
  /** https://, or a path on the same site starting with "/". */
  href: string;
  source: string;
  checked: string;
};

export type PhotoV2 = GuidePhoto & {
  /** Generated imagery. Never placed. */
  ai?: boolean;
  /** Unconfirmed rights. Never placed. */
  rights?: "confirmed" | "unconfirmed";
  /** What a camera sees that a guide may not show. Any entry means never placed. */
  shows?: ("door" | "garage-door" | "code" | "neighbor-number" | "defect")[];
  /** The attribution the photo's license requires, verbatim ("Photo: Jane Doe"). Printed in the colophon when the photo is placed. */
  credit?: string;
};

export type WifiV2 =
  | { kind: "printed"; network: Sourced; password: Sourced }
  | { kind: "open"; network: Sourced }
  /** The Wi-Fi arrives in a message (Bluebill). The cover shows this live line and no Copy. */
  | { kind: "in-message"; line: Sourced }
  /** Not on record (Peak with the env unset, Euclid "held"). */
  | { kind: "unknown"; fact: Unknown };

export type ContactV2 = {
  /** The live help line, verbatim ("Message us in your booking app. We answer any hour."). */
  label: string;
  /** Printed only when the brand's phone policy allows it. */
  phone?: string;
  sms?: boolean;
  source: string;
  checked: string;
};

export type PriceTable = {
  chapter: ChapterId;
  title: string;
  rows: { item: string; price: string; note?: string }[];
  terms?: string;
  source: string;
  checked: string;
};

export type PickV2 = LocalPick & { validThrough?: string; mapUrl?: string };

export type DisplayFact = { label: string; value: string };

/** A window group a low cover can move its facts onto the arrival field for (CoverV2 fieldOn). */
export type CoverGroup = "phone" | "tablet" | "desktop";

export type CoverV2 =
  | {
      kind: "photo";
      /** The photos[].src this cover is cut from. */
      src: string;
      /** CSS object-position for a portrait and a landscape window. */
      focus: { portrait: string; landscape: string };
      /** Where the photograph is quiet, from the zone measurement. low = facts on the ground, high = facts in the sky, band = facts on the arrival field under a shortened photo. */
      layout: "low" | "high" | "band";
      nameInk: "ink" | "onPhoto";
      factsInk: "ink" | "onPhoto";
      /** A neutral shade over the bottom of the photo, from `from` (0 to 1 of the height) to `max` opacity at the bottom edge. Never above 0.35. */
      shade?: { from: number; max: number };
      /**
       * The measured last resort, low covers only: the window groups where the photo's ground cannot
       * carry the facts behind the 0.35 shade, so they sit on the arrival field there (the board's own
       * fallback). phone = upright under 700 px, tablet = upright 700 px and up, desktop = landscape
       * 700 px and up and over 500 px tall. Landscape phones and desktop windows 620 px tall or less
       * always take the side-by-side composition.
       */
      fieldOn?: CoverGroup[];
      measured: { on: string; worstName: number; worstFacts: number; tool: "design-check" };
      /** The portrait crop. Under 1170 px wide it must carry `refined`. */
      portrait: {
        src: string;
        width: number;
        height: number;
        refined?: { method: string; checkedAt100: string };
      };
      wide?: { src: string; width: number; height: number };
    }
  | {
      kind: "type";
      /** The large lines of the title, words from the house's own name and address. */
      title: string[];
      feature?: string;
      source: string;
      checked: string;
    };

export type LookV2 = {
  size?: { bedrooms?: number; sleeps: number; source: string; checked: string };
  cover: CoverV2;
  /** One item key, set as "Read this first" right after the door steps. */
  readFirst?: string;
  /** One photo (4:5 plate) or two (3:4 diptych) per chapter. Never on rules, checkout or help. */
  plates?: Partial<Record<ChapterId, string | [string, string]>>;
  /** A large figure on an item. The value must be a verbatim substring of that item's live body. */
  figures?: { key: string; value: string }[];
  /** v1 display facts, carried. */
  facts?: Partial<Record<ChapterId, DisplayFact>>;
  /** Up to 10 item keys, plus the reserved "wifi", "door", "parking", "checkout", in order. */
  quickFind?: string[];
  /** Reorder within a group, words unchanged. Key: the group name; value: item keys in order. A group listed here reads as numbered steps. */
  order?: Record<string, string[]>;
  /** Cover rows: a live first sentence, the full live text, or a jump link. Default: "lead" if 90 characters or fewer, else "link". */
  coverRows?: { door?: "lead" | "full" | "link"; parking?: "lead" | "full" | "link" };
  skip?: string[];
  captions?: Record<string, string>;
  levels?: string[];
};

export type GuideModel = {
  slug: string;
  name: string;
  /** The name split into display lines, words unchanged. Default: balanced by the CSS. */
  nameLines?: string[];
  /** Home Screen title. Default: name, if 14 characters or fewer, else the first two words of the name. */
  shortName?: string;
  /** The Home Screen icon's initials, 1 to 4 characters. Default: from the name (`iconText`). */
  iconText?: string;
  door?: Sourced;
  address: Sourced<GuestAddress> & {
    mapUrl: string;
    appleMapUrl?: string;
    pin?: Sourced<{ lat: number; lng: number }>;
  };
  checkIn: Slot;
  checkOut: Slot;
  entry: {
    lock: Sourced;
    hideLock?: boolean;
    steps: Sourced<string[]>;
    /** Printed verbatim (R6). */
    codeDelivery: Sourced;
    /** The check-in-day wording, waiting on Guesty confirmation and a door-timing approval for this house. */
    codeDeliveryNext?: {
      text: string;
      guestyConfirmed?: { on: string; by: string; source: string };
    };
    /** The door named by side and landmark. */
    landmark?: Slot;
    /** Live steps if the house already has them; drafts otherwise. */
    ifCodeFails?: Sourced<string[]>;
  };
  parking: Slot;
  wifi: WifiV2;
  contact: ContactV2;
  sections: SectionV2[];
  tables: PriceTable[];
  nearby: PickV2[];
  photos: PhotoV2[];
  look: LookV2;
  /** The named checker for the colophon. Omitted until a name is on record. */
  checkedBy?: Sourced;
  /** A time-critical change only. Empty by default. */
  notice?: Sourced & { validThrough: string };
  /** Held lines for this house. */
  drafts?: HeldLine[];
};

/** Lowercase, hyphenated, for keys and anchors. */
export function kebab(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** An item's key: its own, or `${sectionId}.${kebab(label)}`. */
export const itemKey = (sectionId: string, it: { key?: string; label: string }): string =>
  it.key ?? `${sectionId}.${kebab(it.label)}`;

/** Reserved quick-find refs that point at the arrival facts rather than an item. */
export const RESERVED_REFS = ["wifi", "door", "parking", "checkout"] as const;
export type ReservedRef = (typeof RESERVED_REFS)[number];
