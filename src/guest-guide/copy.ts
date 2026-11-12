/**
 * The held-copy layer. Live copy is any wording the live guide prints today, or
 * words taken verbatim from it. Everything written for Alpenglow is a held line:
 * it prints only once Jake has approved its section for that house (or the whole
 * brand). With zero approvals a guide renders from live copy alone.
 *
 * The kit owns the template labels (live defaults and Alpenglow drafts). Each
 * house owns its own drafts in `model.drafts`. Approvals live per site.
 */
import type { ChapterId } from "./model";

export type TemplateLabelId =
  | "quickFindHead"
  | "coverIn"
  | "coverOut"
  | "coverWifi"
  | "coverPassword"
  | "coverDoor"
  | "coverPark"
  | "coverHelp"
  | "copyButton"
  | "copyButtonFind"
  | "copied"
  | "readFirst"
  | "chapter.arrival"
  | "arrivalParking"
  | "arrivalWifi"
  | "ifCodeFailsHead"
  | "landmarkHead"
  | "unknownLine"
  | "savedLine"
  | "emergencies"
  | "checked"
  | "directions";

/**
 * Kit-owned. `live` is the v1 wording (null: v1 prints nothing there, so the
 * slot is omitted in live-only mode); `alpenglow` is held until approved.
 * `coverPassword` alpenglow "" means the password folds into the Wi-Fi row.
 * `checked` is the colophon lead: live prints the day, Alpenglow the month.
 */
export const TEMPLATE_LABELS: Record<TemplateLabelId, { live: string | null; alpenglow: string }> =
  {
    quickFindHead: { live: "Quick find", alpenglow: "10 questions" },
    coverIn: { live: "Check-in", alpenglow: "In" },
    coverOut: { live: "Check-out", alpenglow: "Out" },
    coverWifi: { live: "Wi-Fi", alpenglow: "Wi-Fi" },
    coverPassword: { live: "Password", alpenglow: "" },
    coverDoor: { live: "Getting in", alpenglow: "Door" },
    coverPark: { live: "Parking", alpenglow: "Park" },
    coverHelp: { live: "Help", alpenglow: "Help" },
    copyButton: { live: "Copy", alpenglow: "Copy password" },
    copyButtonFind: { live: "Copy", alpenglow: "Copy" },
    copied: { live: "Copied", alpenglow: "Copied" },
    readFirst: { live: "Read this first", alpenglow: "Read this first" },
    "chapter.arrival": { live: "Getting in", alpenglow: "Arrival" },
    arrivalParking: { live: "Parking", alpenglow: "Parking" },
    arrivalWifi: { live: "Wi-Fi", alpenglow: "Wi-Fi" },
    ifCodeFailsHead: { live: null, alpenglow: "If the code does not work" },
    landmarkHead: { live: null, alpenglow: "Finding the front door" },
    unknownLine: { live: null, alpenglow: "Not confirmed yet. Message us in your booking app." },
    savedLine: {
      live: "Save this guide to your phone. Open it from your Home Screen, even with no signal.",
      alpenglow: "Add this guide to your Home Screen. It opens with no signal.",
    },
    emergencies: { live: "Emergencies", alpenglow: "Emergencies" },
    checked: { live: "Checked", alpenglow: "Checked" },
    directions: { live: "Directions", alpenglow: "Directions" },
  };

export type DraftTarget =
  | { kind: "chapter-head"; chapter: ChapterId }
  | { kind: "subhead"; chapter: ChapterId; group: string }
  | { kind: "quick-find"; ref: string; question: string; answer?: string }
  | { kind: "cover-line"; row: "door" | "parking" }
  | { kind: "if-code-fails"; steps: string[] }
  | { kind: "landmark"; text: string }
  | { kind: "price-cell"; table: string; item: string };

export type HeldLine = {
  at: DraftTarget;
  text: string;
  /** The live wording it replaces, verbatim, for the approval board. */
  replaces?: string;
  why: string;
  writtenBy: string;
  writtenOn: string;
};

export type ApprovalSection =
  | "template-labels"
  | "cover"
  | "quick-find"
  | "arrival"
  | "first-hour"
  | "house"
  | "good-to-know"
  | "rules"
  | "checkout"
  | "nearby"
  | "help"
  | "unknowns"
  | "door-timing";

export type Approval = {
  section: ApprovalSection;
  scope: "brand" | `house:${string}`;
  by: "Jake";
  /** YYYY-MM-DD */
  on: string;
  /** Board link or message reference. */
  source: string;
};

/** Where a printed line came from. */
export type From = "live" | "approved";
export type Line = { text: string; from: From };

/** Every label and line the page prints that is not a fact, each marked live or approved. */
export type Copy = {
  /** The mode a reviewer asked for: "show" prints every held line (the drafts preview only). */
  drafts: "hide" | "show";
  /** A template label, or null when it is not printed. */
  labels: Record<TemplateLabelId, Line | null>;
  /** True when the Alpenglow cover labels (In, Out, Door, Park) are on. */
  alpenglowLabels: boolean;
  chapterHeads: Partial<Record<ChapterId, Line>>;
  /** Keyed `${chapter}|${group}`. */
  subheads: Record<string, Line>;
  /** Keyed by quick-find ref. */
  quickFind: Record<string, { question: Line; answer?: Line }>;
  coverLines: { door?: Line; parking?: Line };
  ifCodeFails?: { steps: string[]; from: From };
  landmark?: Line;
  /** Keyed `${table}|${item}`. */
  priceCells: Record<string, Line>;
  /** The line printed for an Unknown: approved unknown line, or null (then each Unknown's liveLine or nothing). */
  unknownLine: Line | null;
  /** The door-code timing sentence: live verbatim, or the confirmed and approved next wording. */
  codeDelivery: Line;
  /** Unknown rows (blankets and similar) print with the unknown line once "unknowns" is approved. */
  unknownsOn: boolean;
};

export type ResolveOptions = {
  approvals: readonly Approval[];
  /** The brand's own live labels, where they differ from the kit defaults. */
  brandLabels?: Partial<Record<TemplateLabelId, string>>;
  /** The drafts preview: every held line printed in place. Never on a production build. */
  drafts?: "hide" | "show";
};
