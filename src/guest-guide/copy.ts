/**
 * The held-copy layer. Live copy is any wording the live guide prints today, or
 * words taken verbatim from it. Everything written for Alpenglow is a held line:
 * it prints only once Jake has approved its section for that house (or the whole
 * brand). With zero approvals a guide renders from live copy alone.
 *
 * The kit owns the template labels (live defaults and Alpenglow drafts). Each
 * house owns its own drafts in `model.drafts`. Approvals live per site.
 */
import { type ChapterId, type GuideModel, itemKey } from "./model";

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
  | { kind: "price-cell"; table: string; item: string }
  /**
   * A short answer in place of a live body. `key` is an item key, or the
   * reserved "parking" (the Arrival parking paragraph) or "contact" (the Help
   * line). `replaces` carries the live body verbatim for the approval board.
   */
  | { kind: "item-body"; key: string };

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
  /** Short answers in place of live bodies, keyed by item key, "parking" or "contact". */
  bodies: Record<string, Line>;
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

const SECTION_OF_CHAPTER: Record<ChapterId, ApprovalSection> = {
  arrival: "arrival",
  "first-hour": "first-hour",
  house: "house",
  "good-to-know": "good-to-know",
  rules: "rules",
  checkout: "checkout",
  nearby: "nearby",
  help: "help",
};

/**
 * The chapter an item-body key lands in: "parking" is Arrival, "contact" is
 * Help, an item key is its section (an item moved into Arrival, as the Wi-Fi
 * and Read-this-first rows are, still answers to its own section's approval).
 */
function chapterOfKey(key: string, model?: Pick<GuideModel, "sections">): ChapterId | undefined {
  if (key === "parking") return "arrival";
  if (key === "contact") return "help";
  for (const s of model?.sections ?? [])
    if (s.items.some((i) => itemKey(s.id, i) === key)) return s.id;
  const prefix = key.split(".")[0] as ChapterId;
  return prefix in SECTION_OF_CHAPTER ? prefix : undefined;
}

/** The approval section a held line belongs to. */
export function sectionOf(
  t: DraftTarget,
  model?: Pick<GuideModel, "tables" | "sections">,
): ApprovalSection {
  switch (t.kind) {
    case "item-body": {
      const chapter = chapterOfKey(t.key, model);
      // An unresolvable key gets a section no approval names, so it never prints.
      return chapter ? SECTION_OF_CHAPTER[chapter] : ("unresolved" as ApprovalSection);
    }
    case "chapter-head":
    case "subhead":
      return SECTION_OF_CHAPTER[t.chapter];
    case "quick-find":
      return "quick-find";
    case "cover-line":
      return "cover";
    case "if-code-fails":
    case "landmark":
      return "arrival";
    case "price-cell": {
      const table = model?.tables.find((x) => x.title === t.table);
      return table ? SECTION_OF_CHAPTER[table.chapter] : "rules";
    }
  }
}

/** Whether an approval for `section` covers this house. */
export function approved(
  approvals: readonly Approval[],
  section: ApprovalSection,
  slug: string,
): boolean {
  return approvals.some(
    (a) => a.section === section && (a.scope === "brand" || a.scope === `house:${slug}`),
  );
}

/** The template labels that belong to an approval section other than "template-labels". */
const LABEL_SECTION: Partial<Record<TemplateLabelId, ApprovalSection>> = {
  unknownLine: "unknowns",
};

/**
 * Every printed label and line for one house, live by default, each held line
 * only where its section is approved for this house. Pure: no clock, no I/O.
 */
export function resolveCopy(model: GuideModel, opts: ResolveOptions): Copy {
  const show = opts.drafts === "show";
  const ok = (s: ApprovalSection) => show || approved(opts.approvals, s, model.slug);

  const labels = {} as Record<TemplateLabelId, Line | null>;
  for (const [id, l] of Object.entries(TEMPLATE_LABELS) as [
    TemplateLabelId,
    (typeof TEMPLATE_LABELS)[TemplateLabelId],
  ][]) {
    const live = opts.brandLabels?.[id] ?? l.live;
    const section = LABEL_SECTION[id] ?? "template-labels";
    if (ok(section))
      labels[id] = { text: l.alpenglow, from: live === l.alpenglow ? "live" : "approved" };
    else labels[id] = live === null ? null : { text: live, from: "live" };
  }

  const copy: Copy = {
    drafts: show ? "show" : "hide",
    labels,
    alpenglowLabels: ok("template-labels"),
    chapterHeads: {},
    subheads: {},
    quickFind: {},
    coverLines: {},
    priceCells: {},
    bodies: {},
    unknownLine: ok("unknowns") ? labels.unknownLine : null,
    unknownsOn: ok("unknowns"),
    codeDelivery: { text: model.entry.codeDelivery.value, from: "live" },
  };

  if (
    model.entry.codeDeliveryNext?.guestyConfirmed &&
    (show || approved(opts.approvals, "door-timing", model.slug))
  ) {
    copy.codeDelivery = { text: model.entry.codeDeliveryNext.text, from: "approved" };
  }

  if (model.entry.ifCodeFails)
    copy.ifCodeFails = { steps: model.entry.ifCodeFails.value, from: "live" };
  const landmark = model.entry.landmark;
  if (landmark && !("unknown" in landmark)) copy.landmark = { text: landmark.value, from: "live" };

  for (const d of model.drafts ?? []) {
    if (!ok(sectionOf(d.at, model))) continue;
    const line: Line = { text: d.text, from: "approved" };
    const t = d.at;
    switch (t.kind) {
      case "chapter-head":
        copy.chapterHeads[t.chapter] = line;
        break;
      case "subhead":
        copy.subheads[`${t.chapter}|${t.group}`] = line;
        break;
      case "quick-find":
        copy.quickFind[t.ref] = {
          question: { text: t.question, from: "approved" },
          ...(t.answer ? { answer: { text: t.answer, from: "approved" as From } } : {}),
        };
        break;
      case "cover-line":
        copy.coverLines[t.row] = line;
        break;
      case "if-code-fails":
        // A live ladder outranks a draft one: drafts never replace live steps.
        if (!copy.ifCodeFails) copy.ifCodeFails = { steps: t.steps, from: "approved" };
        break;
      case "landmark":
        if (!copy.landmark) copy.landmark = { text: t.text, from: "approved" };
        break;
      case "price-cell":
        copy.priceCells[`${t.table}|${t.item}`] = line;
        break;
      case "item-body":
        copy.bodies[t.key] = line;
        break;
    }
  }
  return copy;
}

/** Every held string for a house and the kit labels: what must never appear with zero approvals. */
export function heldStrings(
  model: GuideModel,
  brandLabels?: Partial<Record<TemplateLabelId, string>>,
): string[] {
  const out = new Set<string>();
  for (const [id, l] of Object.entries(TEMPLATE_LABELS) as [
    TemplateLabelId,
    (typeof TEMPLATE_LABELS)[TemplateLabelId],
  ][]) {
    const live = brandLabels?.[id] ?? l.live;
    // Short or shared words ("In", "Wi-Fi") are not distinctive; only a label that differs from its live value and is long enough to grep for counts.
    if (l.alpenglow && l.alpenglow !== live && l.alpenglow.length >= 6) out.add(l.alpenglow);
  }
  for (const d of model.drafts ?? []) {
    if (d.at.kind === "quick-find") {
      out.add(d.at.question);
      if (d.at.answer) out.add(d.at.answer);
    } else if (d.at.kind === "if-code-fails") for (const s of d.at.steps) out.add(s);
    else if (d.at.kind === "landmark") out.add(d.at.text);
    if (d.text && d.at.kind !== "if-code-fails") out.add(d.text);
  }
  if (model.entry.codeDeliveryNext) out.add(model.entry.codeDeliveryNext.text);
  return [...out];
}

/** The live text an item-body draft replaces, read from the model so the board never drifts from it. */
function liveBody(t: DraftTarget, model: GuideModel): string | undefined {
  if (t.kind !== "item-body") return undefined;
  if (t.key === "contact") return model.contact.label;
  if (t.key === "parking") return "value" in model.parking ? model.parking.value : undefined;
  for (const s of model.sections)
    for (const i of s.items) if (itemKey(s.id, i) === t.key) return i.body;
  return undefined;
}

/** One row per held line, beside the live wording it replaces, for the drafts preview table. */
export function draftTable(model: GuideModel): {
  section: ApprovalSection;
  held: string;
  live: string;
  why: string;
}[] {
  const rows = (model.drafts ?? []).map((d) => ({
    section: sectionOf(d.at, model),
    held:
      d.at.kind === "quick-find"
        ? [d.at.question, d.at.answer].filter(Boolean).join(" / ")
        : d.at.kind === "if-code-fails"
          ? d.at.steps.join(" / ")
          : d.text,
    live: d.replaces ?? liveBody(d.at, model) ?? "(none)",
    why: d.why,
  }));
  if (model.entry.codeDeliveryNext)
    rows.push({
      section: "door-timing",
      held: model.entry.codeDeliveryNext.text,
      live: model.entry.codeDelivery.value,
      why: model.entry.codeDeliveryNext.guestyConfirmed
        ? `Guesty check-in-day message confirmed ${model.entry.codeDeliveryNext.guestyConfirmed.on}`
        : "Waiting on Guesty check-in-day confirmation",
    });
  return rows;
}
