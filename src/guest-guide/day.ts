/**
 * The "Day rail" body (Jake's pick, body board round 2, 2026-11-19): the day a
 * guest lives (Arrival, First hour, The house, Checkout) runs down one colored
 * line with every fact as a stop on it, each quick answer first in its own
 * chapter; the rest of the guide reads as printed sections; a slim rail fixed
 * to the bottom of the window names the chapter and opens the list of
 * chapters, so any chapter is two taps away.
 *
 * `planDay` only regroups a finished `Plan`: every word it returns is a word
 * the plan already prints, nothing is reworded, and the cover is untouched.
 * What the cover already prints (the Wi-Fi network and password, the check-out
 * time, the door line) is not printed twice. Framework-free.
 */
import type { FieldId } from "./brand";
import type { ChapterId } from "./model";
import type { Block, ChapterPlan, PlacedPhoto, Plan, StepItem } from "./plan";

/** Per house placement of the few photos the day line keeps (`LookV2.day`). */
export type DayLook = {
  /** The quick answer the Arrival photo sits under. Default: "door". */
  plateUnder?: string;
  /** Photos (by src) set as a small captioned sheet in The house, after its quick answers.
   * Default: the photos of the house's quick-answer rows. */
  sheet?: string[];
};

/** One quick answer on the line: its question as the label, then the live answer. */
export type DayAnswer = {
  kind: "answer";
  id: string;
  label: string;
  /** The line before the answer (the lock line before the door line). */
  lead?: string;
  text?: string;
  where?: string;
  until?: string;
  steps?: StepItem[];
  video?: Extract<Block, { kind: "item" }>["video"];
  photos?: PlacedPhoto[];
  /** A time the cover does not print (check-out). */
  time?: string;
};

/** A labeled fact on the line, set smaller than an answer. */
export type DayRow = {
  kind: "row";
  id?: string;
  label: string;
  text: string;
  where?: string;
  until?: string;
  video?: Extract<Block, { kind: "item" }>["video"];
};

export type DayItem =
  | DayAnswer
  | DayRow
  | { kind: "more"; block: Block }
  | { kind: "sheet"; photos: PlacedPhoto[] };

export type DayChapter = {
  id: ChapterId;
  number: number;
  /** The chapter's printed head ("Arrival", "In the apartment"). */
  name: string;
  field: FieldId;
  items: DayItem[];
};

/** A printed section after the day: its answers first, then its blocks as the live page sets them. */
export type RestChapter = {
  id: ChapterId;
  number: number;
  name: string;
  field: FieldId;
  answers: DayAnswer[];
  blocks: Block[];
};

export type RailStop = { id: string; name: string; num: string; field: FieldId | "arrival" };

export type DayPlan = {
  day: DayChapter[];
  rest: RestChapter[];
  help: { number: number; name: string };
  /** Cover first (named as the cover prints it), then every chapter in reading order. */
  stops: RailStop[];
  /** Photos the plan placed that the day body does not show (dropped from the offline list). */
  dropped: PlacedPhoto[];
};

export const DAY_CHAPTERS: readonly ChapterId[] = ["arrival", "first-hour", "house", "checkout"];

/** The sentence the cover prints, taken off the front of a body that starts with it. */
function afterCover(text: string, cover: string | undefined): string {
  if (!cover) return text;
  const t = text.trim();
  const c = cover.trim();
  if (t === c) return "";
  if (t.startsWith(c)) return t.slice(c.length).trim();
  return t;
}

/** "The network is X." (and its password) is what the cover prints; the rest of the row is the answer. */
const NETWORK_SENTENCE = /^\s*The network is [^.]*\.\s*/;

const photosOf = (b: Block): PlacedPhoto[] => (b.kind === "item" && b.photos ? b.photos : []);
const plates = (c: ChapterPlan): PlacedPhoto[] =>
  Array.isArray(c.plate) ? [...c.plate] : c.plate ? [c.plate] : [];

export function planDay(plan: Plan, look: DayLook = {}): DayPlan {
  const cover = plan.cover;
  const coverDoor = cover.rows.find((r) => r.id === "door" && r.kind === "text");
  const coverDoorText = coverDoor && coverDoor.kind === "text" ? coverDoor.text : undefined;
  const coverPrintsWifi = cover.rows.some(
    (r) => r.kind === "wifi" && Boolean(r.network || r.password),
  );
  const coverOut = cover.rows.find((r) => r.kind === "times");
  const coverPrintsOut = Boolean(coverOut && coverOut.kind === "times" && coverOut.outValue);

  // Working copies of each chapter's blocks; a block taken as an answer leaves its chapter.
  const all = [...plan.chapters];
  const blocks = new Map<ChapterId, Block[]>(all.map((c) => [c.id, [...c.blocks]]));
  const answers = new Map<ChapterId, DayAnswer[]>();
  const push = (c: ChapterId, a: DayAnswer) => answers.set(c, [...(answers.get(c) ?? []), a]);
  // A group sub-head that only introduced a block taken as an answer ("Heat", "Cooling") goes with it.
  const take = (c: ChapterId, b: Block) => {
    const list = blocks.get(c);
    if (!list) return;
    const i = list.indexOf(b);
    if (i < 0) return;
    const before = list[i - 1];
    const groupHead = before?.kind === "sub" && Boolean(before.id?.includes("group"));
    list.splice(groupHead ? i - 1 : i, groupHead ? 2 : 1);
  };
  // Whether a chapter had facts of its own is read before any answer leaves it.
  const hadFacts = new Set(
    all
      .filter((c) =>
        c.blocks.some((b) => b.kind === "item" || b.kind === "figure" || b.kind === "unknown"),
      )
      .map((c) => c.id),
  );
  const arrival = blocks.get("arrival") ?? [];
  const usedPhotos = new Set<string>();

  for (const row of plan.quickFind.rows) {
    const ref = row.href.slice(1);
    if (row.ref === "wifi" || ref === "wifi") {
      const w = arrival.find((b) => b.kind === "wifi");
      if (w?.kind !== "wifi") continue;
      take("arrival", w);
      const rows = w.rows.filter((b) => b.kind === "item");
      const first = rows[0];
      const rest = rows.slice(1);
      let text: string | undefined;
      if (coverPrintsWifi) {
        text =
          first && first.kind === "item" ? first.body.replace(NETWORK_SENTENCE, "").trim() : "";
      } else {
        text = [w.line, first && first.kind === "item" ? first.body : undefined]
          .filter(Boolean)
          .join(" ");
      }
      if (text) push("arrival", { kind: "answer", id: "wifi", label: row.question, text });
      // Any further Wi-Fi rows stay on the line as rows, after the answers.
      if (rest.length) blocks.set("arrival", [...(blocks.get("arrival") ?? []), ...rest]);
      continue;
    }
    if (row.ref === "door" || ref === "door") {
      const i = arrival.findIndex((b) => b.kind === "p" && b.id === "door");
      if (i < 0) continue;
      const door = arrival[i] as Extract<Block, { kind: "p" }>;
      const before = arrival[i - 1];
      const lead = before && before.kind === "p" && !before.id ? before : undefined;
      const after = arrival[i + 1];
      const steps = after && after.kind === "steps" && !after.head ? after : undefined;
      take("arrival", door);
      if (lead) take("arrival", lead);
      if (steps) take("arrival", steps);
      push("arrival", {
        kind: "answer",
        id: "door",
        label: row.question,
        lead: lead?.text,
        text: afterCover(door.text, coverDoorText) || undefined,
        steps: steps?.items,
      });
      continue;
    }
    if (row.ref === "parking" || ref === "park") {
      const i = arrival.findIndex((b) => b.kind === "sub" && b.id === "park");
      if (i < 0) continue;
      const sub = arrival[i] as Block;
      const body = arrival[i + 1];
      take("arrival", sub);
      if (body && body.kind === "p") take("arrival", body);
      push("arrival", {
        kind: "answer",
        id: "park",
        label: row.question,
        text: body && body.kind === "p" ? body.text : undefined,
      });
      continue;
    }
    if (row.ref === "checkout") {
      if (coverPrintsOut || !row.answer) continue;
      const target = plan.chapters.some((c) => c.id === "checkout") ? "checkout" : "arrival";
      push(target, { kind: "answer", id: `${target}-time`, label: row.question, time: row.answer });
      continue;
    }
    // An item, an unknown, a figure, a note or a link row: it moves to the head of its chapter.
    for (const c of all) {
      const list = blocks.get(c.id) ?? [];
      const b = list.find(
        (x) =>
          (x.kind === "item" ||
            x.kind === "figure" ||
            x.kind === "unknown" ||
            x.kind === "note" ||
            x.kind === "link") &&
          x.id === ref,
      );
      if (!b) continue;
      take(c.id, b);
      const a: DayAnswer = { kind: "answer", id: ref, label: row.question };
      if (b.kind === "item") {
        a.text = b.body;
        a.where = b.where;
        a.until = b.until;
        a.video = b.video;
        a.photos = b.photos;
      } else if (b.kind === "figure" || b.kind === "unknown" || b.kind === "note") a.text = b.text;
      else if (b.kind === "link") {
        // A link row keeps its own block (and its link) right after the answer's label.
        blocks.set(c.id, [b, ...(blocks.get(c.id) ?? [])]);
        continue;
      }
      push(c.id, a);
      break;
    }
  }

  // A chapter's intro line goes when the chapter has facts of its own (the line is the quick find now).
  for (const c of all) {
    if (c.id === "arrival") continue;
    const list = blocks.get(c.id) ?? [];
    const first = list[0];
    if (hadFacts.has(c.id) && first && first.kind === "p" && !first.id && !first.tone) list.shift();
  }

  // Photos: the Arrival photo under one answer, a small sheet in The house, nothing else.
  const arrivalPlate = all.find((c) => c.id === "arrival");
  const plate = arrivalPlate ? plates(arrivalPlate) : [];
  if (plate.length) {
    const list = answers.get("arrival") ?? [];
    const under = list.find((a) => a.id === (look.plateUnder ?? "door")) ?? list[0];
    if (under) {
      under.photos = [...plate];
      for (const p of plate) usedPhotos.add(p.src);
    }
  }
  const houseAnswers = answers.get("house") ?? [];
  const placed = new Map<string, PlacedPhoto>();
  for (const c of all) {
    for (const p of plates(c)) placed.set(p.src, p);
    for (const b of c.blocks) for (const p of photosOf(b)) placed.set(p.src, p);
  }
  const sheetSrcs = look.sheet ?? houseAnswers.flatMap((a) => (a.photos ?? []).map((p) => p.src));
  const sheet = sheetSrcs.map((s) => placed.get(s)).filter((p): p is PlacedPhoto => Boolean(p));
  for (const p of sheet) usedPhotos.add(p.src);
  // Answer photos other than the Arrival plate go to the sheet or nowhere: one photo, once.
  for (const list of answers.values())
    for (const a of list)
      if (a.photos) a.photos = a.photos.filter((p) => plate.some((q) => q.src === p.src));

  // Number the chapters in the order they now read: the day, then the rest, then Help.
  const present = all.filter((c) => c.id !== "help");
  const dayList = present.filter((c) => DAY_CHAPTERS.includes(c.id));
  const restList = present.filter((c) => !DAY_CHAPTERS.includes(c.id));
  let n = 0;
  const day: DayChapter[] = dayList.map((c) => {
    const items: DayItem[] = [...(answers.get(c.id) ?? [])];
    if (c.id === "house" && sheet.length) items.push({ kind: "sheet", photos: sheet });
    for (const b of blocks.get(c.id) ?? []) items.push(...dayItemsOf(b));
    return { id: c.id, number: ++n, name: c.head.text, field: c.field, items };
  });
  const rest: RestChapter[] = restList.map((c) => ({
    id: c.id,
    number: ++n,
    name: c.head.text,
    field: c.field,
    answers: answers.get(c.id) ?? [],
    blocks: blocks.get(c.id) ?? [],
  }));
  const help = { number: ++n, name: plan.help.head.text };

  // The cover stop is named as the cover's h1 reads.
  const coverName = (
    cover.kind === "type" ? (cover.typeTitle ?? [cover.name]) : (cover.nameLines ?? [cover.name])
  ).join(" ");
  const stops: RailStop[] = [
    { id: "cover", name: coverName, num: "", field: "arrival" },
    ...day.map((c) => ({ id: c.id, name: c.name, num: String(c.number), field: c.field })),
    ...rest.map((c) => ({ id: c.id, name: c.name, num: String(c.number), field: c.field })),
    { id: "help", name: help.name, num: String(help.number), field: plan.help.field },
  ];

  const dropped = [...placed.values()].filter(
    (p) => !usedPhotos.has(p.src) && p.src !== cover.photo?.portrait.src,
  );
  return { day, rest, help, stops, dropped };
}

/** A block on the day line: labeled facts as rows (each a stop), everything else printed as it stands. */
function dayItemsOf(b: Block): DayItem[] {
  switch (b.kind) {
    case "item":
      return [
        {
          kind: "row",
          id: b.id,
          label: b.label,
          text: b.body,
          where: b.where,
          until: b.until,
          video: b.video,
        },
      ];
    case "figure":
      return [{ kind: "row", id: b.id, label: b.label ?? "", text: b.text }];
    case "display":
      return [{ kind: "row", label: b.label, text: b.value }];
    case "unknown":
    case "note":
      return [{ kind: "row", id: b.id, label: b.label, text: b.text }];
    case "wifi": {
      const out: DayItem[] = [];
      if (b.line) out.push({ kind: "row", id: "wifi", label: b.head, text: b.line });
      for (const r of b.rows) out.push(...dayItemsOf(r));
      return out;
    }
    default:
      return [{ kind: "more", block: b }];
  }
}
