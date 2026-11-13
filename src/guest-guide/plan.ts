/**
 * The layout planner. Pure functions over a house's model and its resolved
 * copy: no DOM, no clock, no network. Every house is laid out by the same
 * rules, so a test can prove what a page holds before anything renders.
 * Ported from the Sun Mountain v1 book (book.ts, plan.ts), re-cut for the
 * Alpenglow chapters: arrival, first hour, the house, good to know, rules,
 * checkout, nearby, help.
 */
import type { FieldId } from "./brand";
import { type Copy, type Line, TEMPLATE_LABELS } from "./copy";
import {
  CHAPTER_ORDER,
  type ChapterId,
  type CoverGroup,
  type GuideModel,
  type ItemV2,
  isUnknown,
  itemKey,
  type PhotoV2,
  type PickV2,
  type Slot,
  type VideoV2,
} from "./model";
import type { LocalPickKind } from "./types";
import { unplaceable } from "./validate";

export type PlacedPhoto = PhotoV2 & { caption?: string };

export type StepItem = {
  text: string;
  label?: string;
  where?: string;
  key?: string;
  id?: string;
  video?: VideoV2;
};

export type Block =
  | { kind: "p"; text: string; id?: string; tone?: "sec" }
  | { kind: "sub"; text: string; id?: string }
  | { kind: "steps"; items: StepItem[]; head?: string; headId?: string }
  | { kind: "figure"; value: string; text: string; key?: string; id?: string; label?: string }
  | { kind: "display"; label: string; value: string }
  | {
      kind: "item";
      key: string;
      id: string;
      label: string;
      /** The label is set as a sub-head (an approved one, or a room). */
      asHead: boolean;
      body: string;
      where?: string;
      until?: string;
      photos?: PlacedPhoto[];
      video?: VideoV2;
    }
  | { kind: "unknown"; key: string; id: string; label: string; text: string }
  | { kind: "note"; key: string; id: string; label: string; text: string }
  | {
      kind: "wifi";
      head: string;
      network?: string;
      password?: string;
      copy?: string;
      line?: string;
      rows: Block[];
    }
  | {
      kind: "table";
      title: string;
      rows: { item: string; price: string; note?: string }[];
      terms?: string;
    }
  | { kind: "picks"; groups: { label: string; picks: PickPlan[] }[] }
  | { kind: "link"; key: string; id: string; label: string; href: string; external: boolean };

export type PickPlan = {
  name: string;
  address?: string;
  url: string;
  mapUrl?: string;
  note: string;
  hours?: string;
  drive?: string;
  until?: string;
};

export type ChapterPlan = {
  id: ChapterId;
  number: number;
  /** The chapter's name on its label ("Arrival", "First hour"). */
  name: string;
  /** False when the head already says the name: the label prints the number only. */
  showName: boolean;
  head: Line;
  field: FieldId;
  prevField: FieldId;
  plate?: PlacedPhoto | [PlacedPhoto, PlacedPhoto];
  blocks: Block[];
};

export type CoverRow =
  | {
      kind: "times";
      id: "times";
      label: string;
      inValue?: string;
      outLabel: string;
      outValue?: string;
    }
  | {
      kind: "wifi";
      id: "wifi" | "password";
      label: string;
      network?: string;
      password?: string;
      copy?: string;
    }
  | { kind: "text"; id: "door" | "parking" | "wifi"; label: string; text: string }
  | { kind: "link"; id: "door" | "parking" | "help"; label: string; text: string; href: string };

export type CoverPlan = {
  kind: "photo" | "type";
  layout: "low" | "high" | "band" | "type";
  name: string;
  nameLines?: string[];
  nameStep: 80 | 64 | 52 | 44;
  photo?: {
    alt: string;
    portrait: { src: string; width: number; height: number };
    wide?: { src: string; width: number; height: number };
    focus: { portrait: string; landscape: string };
    shade?: { from: number; max: number };
    nameInk: "ink" | "onPhoto";
    factsInk: "ink" | "onPhoto";
    fieldOn?: CoverGroup[];
  };
  typeTitle?: string[];
  feature?: string;
  address: string;
  /** The address without its street, when the house's name already is the street (the sky line on a high cover). */
  place?: string;
  mapUrl: string;
  appleMapUrl?: string;
  directions: string;
  rows: CoverRow[];
  /** The label column in px: 60 with the short labels, up to 104 with the live ones. */
  labelWidth: number;
  notice?: string;
};

export type QuickRow = {
  n: string;
  ref: string;
  href: string;
  question: string;
  answer?: string;
  wifi?: { network: string; password: string; copy: string; label: string };
};

export type Plan = {
  slug: string;
  name: string;
  shortName: string;
  /** The site's own icon initials, when it set them. */
  iconText?: string;
  cover: CoverPlan;
  quickFind: { head: Line; rows: QuickRow[] };
  chapters: ChapterPlan[];
  help: ChapterPlan & { contact: string; phone?: string; sms?: boolean; emergencies: string };
  colophon: {
    address: string;
    checked: string;
    saved: string;
    /** The attributions placed photos require, verbatim, in page order, each once. */
    credits: string[];
  };
  print: { wifiQr?: string };
  /** Every element id the page carries, so a test can prove each link lands. */
  ids: string[];
  /** Exactly what the service worker saves: page, extras, one phone-width URL per placed photo. */
  offlineUrls: string[];
  copy: Copy;
};

export type PlanOptions = {
  /** The page path, first in the offline list. */
  page?: string;
  /** Fonts, the manifest and icons: saved for offline use too. */
  extraUrls?: string[];
  /** The URL of a photo at a given width; must match a srcset candidate. Default: the src. */
  imageUrl?: (src: string, width: number) => string;
  /** The brand's phone policy. "never" prints no phone even if the model has one. */
  phone?: "never" | "allowed";
};

/** The phone-width variant saved for offline use, and the cover's portrait width. */
export const PHONE_WIDTH = 828;
export const COVER_WIDTH = 1170;

const FIELD_OF: Record<ChapterId, FieldId> = {
  arrival: "arrival",
  "first-hour": "first",
  house: "house",
  "good-to-know": "know",
  rules: "rules",
  checkout: "out",
  nearby: "near",
  help: "paper",
};

const NO_PLATE = new Set<ChapterId>(["rules", "checkout", "help"]);
/** Rows from any section but rules that are about the Wi-Fi gather in the Arrival Wi-Fi block. */
const WIFI_ROW = /wi-?fi|router|extender/i;
const LEAD_MAX = 90;
const ANSWER_MAX = 120;

/** "Nearby" is the v1 title; the others come from each section's own title. */
const TITLES: Partial<Record<ChapterId, string>> = { nearby: "Nearby", help: "Help" };

/** v1 labels for each kind of local pick. */
export const KIND_LABEL: Record<LocalPickKind, string> = {
  grocery: "Groceries",
  coffee: "Coffee",
  dinner: "Dinner",
  trail: "Trails",
  park: "Parks",
  "urgent-care": "Urgent care",
  er: "Emergency room",
  "day-trip": "Day trips",
  kids: "With kids",
  event: "Events",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-23" to "Oct 23, 2026". Read as a calendar date, never through a clock. */
export function formatDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : day;
}

/** "2026-11-01" to "November 2026". */
export function monthYear(day: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(day);
  return m ? `${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}` : day;
}

/** The first sentence of a live paragraph, words unchanged (v1 doorParts().lead). */
export function firstSentence(text: string): string {
  const parts = text.match(/[^.!?]+[.!?]+(?=\s+["A-Z(]|\s*$)/g);
  return (parts?.[0] ?? text).trim();
}

/**
 * The name's size step: by total length, then down a step while the longest
 * word would overflow a 320 px phone at that size.
 */
export function nameStep(name: string): 80 | 64 | 52 | 44 {
  const steps = [80, 64, 52, 44] as const;
  const len = name.length;
  let i = len <= 12 ? 0 : len <= 18 ? 1 : len <= 26 ? 2 : 3;
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  // Newsreader-class display faces run about 0.52 em a character; 272 px is a 320 px phone less its gutters.
  while (i < 3 && longest * 0.52 * Math.min(steps[i] ?? 44, (320 * (steps[i] ?? 44)) / 390) > 272)
    i++;
  return steps[i] ?? 44;
}

const anchor = (key: string) => `i-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

const SENTENCE = /(?<=[.!?])\s+/;
const BOX_SAYS = /\b911\b|\bmessage us\b|\bwe answer\b/i;

/** A help row labeled "Emergencies" or "Anything else" whose every sentence is the 911 or message-us line. */
export function restatesHelpBox(i: { label: string; body: string }): boolean {
  return (
    /^(emergenc(?:y|ies)|anything else)$/i.test(i.label.trim()) &&
    i.body.split(SENTENCE).every((s) => BOX_SAYS.test(s))
  );
}

/**
 * A caption names only what the photograph shows: the room's name without the
 * qualifiers a camera cannot see (v1 captionOf). A house can replace it.
 */
export function captionOf(p: PhotoV2, overrides?: Record<string, string>): string {
  const set = overrides?.[p.src];
  if (set) return set;
  let c = (p.room.split(",")[0] ?? p.room).trim();
  c = c.replace(/^(the shared|the|a|an)\s+/i, "");
  c = c.replace(/^(king|queen|lower-level|upstairs|downstairs|private)\s+/i, "");
  c = c.replace(/\s+(upstairs|downstairs)$/i, "");
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** A pick's name often carries its street address; the row sets them on separate lines (v1 pickParts). */
function pickParts(p: PickV2): PickPlan {
  const m = /^(.*?),\s*(\d.*)$/.exec(p.name);
  return {
    name: m?.[1] ?? p.name,
    address: m?.[2],
    url: p.url,
    mapUrl: p.mapUrl,
    note: p.note,
    hours: p.hours,
    drive: p.distance,
    until: p.validThrough ? `Until ${formatDay(p.validThrough)}` : undefined,
  };
}

/** The line an Unknown prints: the approved unknown line, else its own live line, else nothing. */
function unknownText(slot: Slot, copy: Copy): string | undefined {
  if (!isUnknown(slot)) return slot.value;
  return copy.unknownLine?.text ?? slot.liveLine;
}

function newestChecked(m: GuideModel): string {
  const days: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.checked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.checked))
        days.push(o.checked);
      for (const [k, x] of Object.entries(o)) if (k !== "drafts") visit(x);
    }
  };
  visit(m);
  return days.sort().at(-1) ?? "";
}

/** The Wi-Fi join payload for the print QR. Special characters escaped per the WIFI: URI scheme. */
function wifiPayload(m: GuideModel): string | undefined {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  if (m.wifi.kind === "printed")
    return `WIFI:T:WPA;S:${esc(m.wifi.network.value)};P:${esc(m.wifi.password.value)};;`;
  if (m.wifi.kind === "open") return `WIFI:T:nopass;S:${esc(m.wifi.network.value)};;`;
  return undefined;
}

/** Lay out one guide. */
export function planGuide(m: GuideModel, copy: Copy, opts: PlanOptions = {}): Plan {
  const L = copy.labels;
  const label = (id: keyof Copy["labels"], fallback = "") => L[id]?.text ?? fallback;
  const ids: string[] = [];
  const id = (x: string) => {
    ids.push(x);
    return x;
  };

  // Photographs: each placed once, never a skipped, AI, unconfirmed or door photo.
  const used = new Set<string>();
  const bySrc = new Map(m.photos.map((p) => [p.src, p]));
  const take = (src: string | undefined): PlacedPhoto | undefined => {
    if (!src) return undefined;
    const p = bySrc.get(src);
    if (!p || used.has(src) || m.look.skip?.includes(src) || unplaceable(p)) return undefined;
    used.add(src);
    return { ...p };
  };

  const cover = m.look.cover;
  let coverPhoto: CoverPlan["photo"];
  if (cover.kind === "photo") {
    const p = take(cover.src);
    if (p) {
      used.add(cover.portrait.src);
      if (cover.wide) used.add(cover.wide.src);
      coverPhoto = {
        alt: p.alt,
        portrait: cover.portrait,
        wide: cover.wide,
        focus: cover.focus,
        shade: cover.shade,
        nameInk: cover.nameInk,
        factsInk: cover.factsInk,
        ...(cover.fieldOn?.length ? { fieldOn: cover.fieldOn } : {}),
      };
    }
  }

  // Items by key, and the rows that move: Read this first and the Wi-Fi rows.
  const readFirstKey = m.look.readFirst;
  const wifiItems: { key: string; item: ItemV2 }[] = [];
  let readFirst: { key: string; item: ItemV2 } | undefined;
  const sectionRows = new Map<string, { key: string; item: ItemV2 }[]>();
  for (const s of m.sections) {
    const rows: { key: string; item: ItemV2 }[] = [];
    for (const item of s.items) {
      const key = itemKey(s.id, item);
      if (key === readFirstKey) readFirst = { key, item };
      else if (s.id !== "rules" && WIFI_ROW.test(item.label)) wifiItems.push({ key, item });
      else rows.push({ key, item });
    }
    sectionRows.set(s.id, rows);
  }

  const figureOf = new Map((m.look.figures ?? []).map((f) => [f.key, f.value]));
  /** The printed body: an approved short answer, else the live body verbatim. */
  const bodyOf = (key: string, item: ItemV2) => copy.bodies[key]?.text ?? item.body;
  const groupOrder = m.look.order ?? {};

  const itemBlock = (
    chapter: ChapterId,
    key: string,
    item: ItemV2,
    photos?: PlacedPhoto[],
  ): Block[] => {
    const head = copy.subheads[`${chapter}|${key}`];
    const out: Block[] = [];
    const bid = id(anchor(key));
    const body = bodyOf(key, item);
    // A figure is a verbatim piece of the printed sentence; an approved short answer without it drops the figure.
    const figure = body.includes(figureOf.get(key) ?? "\u0000") ? figureOf.get(key) : undefined;
    const until = item.validThrough ? `Until ${formatDay(item.validThrough)}` : undefined;
    const video = item.video && !unplaceable(item.video) ? item.video : undefined;
    if (figure && !video) {
      // An approved head is a sub-head; the live label stays small above the figure.
      if (head) out.push({ kind: "sub", text: head.text });
      out.push({
        kind: "figure",
        value: figure,
        text: body,
        key,
        id: bid,
        label: head ? undefined : item.label,
      });
      if (item.where) out.push({ kind: "p", text: item.where, tone: "sec" });
      return out;
    }
    out.push({
      kind: "item",
      key,
      id: bid,
      label: head?.text ?? item.label,
      asHead: Boolean(head) || Boolean(item.room),
      body,
      where: item.where,
      until,
      photos: photos?.length ? photos : undefined,
      video,
    });
    return out;
  };

  /** A group of rows under one sub-head: numbered steps when the house orders it, else rows. */
  const groupBlocks = (
    chapter: ChapterId,
    group: string,
    rows: { key: string; item: ItemV2 }[],
  ): Block[] => {
    const order = groupOrder[group];
    const head = copy.subheads[`${chapter}|${group}`]?.text ?? group;
    if (order) {
      const sorted = [...rows].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
      const headId = id(anchor(`${chapter}.group.${group}`));
      return [
        {
          kind: "steps",
          head,
          headId,
          items: sorted.map(({ key, item }) => ({
            key,
            id: id(anchor(key)),
            label: item.label,
            text: bodyOf(key, item),
            where: item.where,
            video: item.video && !unplaceable(item.video) ? item.video : undefined,
          })),
        },
      ];
    }
    return [
      { kind: "sub", text: head, id: id(anchor(`${chapter}.group.${group}`)) },
      ...rows.flatMap(({ key, item }) => itemBlock(chapter, key, item)),
    ];
  };

  const unknownBlocks = (sectionId: string): Block[] => {
    const sec = m.sections.find((s) => s.id === sectionId);
    return (sec?.unknowns ?? []).flatMap((u): Block[] => {
      const text = copy.unknownsOn ? copy.unknownLine?.text : u.fact.liveLine;
      if (!text) return [];
      const key = itemKey(sectionId, u);
      return [{ kind: "unknown", key, id: id(anchor(key)), label: u.label, text }];
    });
  };

  const sectionBlocks = (chapter: ChapterId): Block[] => {
    const sec = m.sections.find((s) => s.id === chapter);
    if (!sec) return [];
    let rows = sectionRows.get(chapter) ?? [];
    const out: Block[] = [];
    const fact = m.look.facts?.[chapter];
    if (fact) out.push({ kind: "display", label: fact.label, value: fact.value });
    if (
      sec.intro &&
      !(readFirst && m.sections.find((s) => s.id === chapter)?.items.includes(readFirst.item))
    )
      out.push({ kind: "p", text: sec.intro });

    if (chapter === "help") {
      const nearbyKinds = new Set(m.nearby.map((p) => p.kind));
      rows = rows.filter(({ item }) => {
        const dup =
          (/urgent care/i.test(item.label) && nearbyKinds.has("urgent-care")) ||
          (/emergency room/i.test(item.label) && nearbyKinds.has("er"));
        return !dup && !restatesHelpBox(item);
      });
    }

    if (chapter === "checkout") {
      if (rows.length)
        out.push({
          kind: "steps",
          items: rows.map(({ key, item }) => ({
            key,
            id: id(anchor(key)),
            label: item.label,
            text: bodyOf(key, item),
            where: item.where,
            video: item.video && !unplaceable(item.video) ? item.video : undefined,
          })),
        });
    } else if (chapter === "house") {
      // Rooms take their photographs after every chapter plate has claimed its own.
      for (const { key, item } of rows) {
        const photos = [item.photo, ...(item.more ?? [])]
          .map((src) => take(src))
          .filter((p): p is PlacedPhoto => Boolean(p))
          .map((p) => ({ ...p, caption: captionOf(p, m.look.captions) }));
        out.push(...itemBlock(chapter, key, item, photos));
      }
    } else {
      // Loose rows first, then each group where it first appears.
      const seen = new Set<string>();
      for (const r of rows) {
        const g = r.item.group;
        if (!g) out.push(...itemBlock(chapter, r.key, r.item));
        else if (!seen.has(g)) {
          seen.add(g);
          out.push(
            ...groupBlocks(
              chapter,
              g,
              rows.filter((x) => x.item.group === g),
            ),
          );
        }
      }
    }
    out.push(...unknownBlocks(chapter));
    for (const l of sec.links ?? []) {
      const key = itemKey(chapter, l);
      out.push({
        kind: "link",
        key,
        id: id(anchor(key)),
        label: l.label,
        href: l.href,
        external: /^https?:\/\//.test(l.href),
      });
    }
    return out;
  };

  const tableBlocks = (chapter: ChapterId): Block[] =>
    m.tables
      .filter((t) => t.chapter === chapter)
      .map((t) => ({
        kind: "table" as const,
        title: t.title,
        terms: t.terms,
        rows: t.rows.map((r) => ({
          ...r,
          price: copy.priceCells[`${t.title}|${r.item}`]?.text ?? r.price,
        })),
      }));

  // Arrival: code source, steps, landmark, if-code-fails, read first, parking, Wi-Fi.
  const arrival: Block[] = [];
  if (m.door) arrival.push({ kind: "p", text: m.door.value });
  if (!m.entry.hideLock) arrival.push({ kind: "p", text: m.entry.lock.value });
  arrival.push({ kind: "p", text: copy.codeDelivery.text, id: id("door") });
  arrival.push({ kind: "steps", items: m.entry.steps.value.map((text) => ({ text })) });
  const landmarkHead = L.landmarkHead?.text;
  const lm = m.entry.landmark;
  const landmarkText = copy.landmark?.text ?? (lm ? unknownText(lm, copy) : undefined);
  if (landmarkText) {
    if (landmarkHead) arrival.push({ kind: "sub", text: landmarkHead });
    arrival.push({
      kind: "p",
      text: landmarkText,
      tone: lm && isUnknown(lm) && !copy.landmark ? "sec" : undefined,
    });
  }
  if (copy.ifCodeFails)
    arrival.push({
      kind: "steps",
      head: L.ifCodeFailsHead?.text,
      items: copy.ifCodeFails.steps.map((text) => ({ text })),
    });
  if (readFirst)
    arrival.push({
      kind: "note",
      key: readFirst.key,
      id: id(anchor(readFirst.key)),
      label: label("readFirst", "Read this first"),
      text: bodyOf(readFirst.key, readFirst.item),
    });
  const parkingText = unknownText(m.parking, copy);
  if (parkingText) {
    arrival.push({
      kind: "sub",
      text: copy.subheads["arrival|parking"]?.text ?? label("arrivalParking", "Parking"),
      id: id("park"),
    });
    arrival.push({
      kind: "p",
      text: isUnknown(m.parking) ? parkingText : (copy.bodies.parking?.text ?? parkingText),
      tone: isUnknown(m.parking) ? "sec" : undefined,
    });
  }
  const wifiRows = wifiItems.flatMap(({ key, item }) => itemBlock("arrival", key, item));
  const wifiHead = copy.subheads["arrival|wifi"]?.text ?? label("arrivalWifi", "Wi-Fi");
  const w = m.wifi;
  const wifiBlock: Block =
    w.kind === "printed"
      ? {
          kind: "wifi",
          head: wifiHead,
          network: w.network.value,
          password: w.password.value,
          copy: label("copyButtonFind", "Copy"),
          rows: wifiRows,
        }
      : w.kind === "open"
        ? { kind: "wifi", head: wifiHead, network: w.network.value, rows: wifiRows }
        : {
            kind: "wifi",
            head: wifiHead,
            line: w.kind === "in-message" ? w.line.value : unknownText(w.fact, copy),
            rows: wifiRows,
          };
  id("wifi");
  arrival.push(wifiBlock);
  arrival.push(...tableBlocks("arrival"));

  // Chapters present, in order; help is its own footer chapter.
  const blocksOf = (c: ChapterId): Block[] => {
    if (c === "arrival") return arrival;
    if (c === "nearby") {
      const groups = new Map<LocalPickKind, PickPlan[]>();
      for (const p of m.nearby) groups.set(p.kind, [...(groups.get(p.kind) ?? []), pickParts(p)]);
      const picks: Block[] = groups.size
        ? [
            {
              kind: "picks",
              groups: [...groups].map(([k, picks]) => ({ label: KIND_LABEL[k], picks })),
            },
          ]
        : [];
      return [...picks, ...tableBlocks(c)];
    }
    return [...sectionBlocks(c), ...tableBlocks(c)];
  };

  // Plates claim their photographs before any room does (v1 order).
  const plates = new Map<ChapterId, ChapterPlan["plate"]>();
  for (const c of CHAPTER_ORDER) {
    let plate: ChapterPlan["plate"];
    const want = NO_PLATE.has(c) ? undefined : m.look.plates?.[c];
    if (Array.isArray(want)) {
      const got = want.map((s) => take(s)).filter((p): p is PlacedPhoto => Boolean(p));
      const [a, b] = got;
      plate =
        a && b
          ? [
              { ...a, caption: captionOf(a, m.look.captions) },
              { ...b, caption: captionOf(b, m.look.captions) },
            ]
          : a;
    } else plate = take(want);
    if (plate) plates.set(c, plate);
  }

  const present = CHAPTER_ORDER.filter((c) => c !== "help").map((c) => ({
    c,
    blocks: blocksOf(c),
  }));
  const kept = present.filter((x) => x.c === "arrival" || x.blocks.length > 0);
  const helpBlocks = blocksOf("help");

  const nameFor = (c: ChapterId) =>
    c === "arrival"
      ? label("chapter.arrival", "Getting in")
      : (m.sections.find((s) => s.id === c)?.title ?? TITLES[c] ?? c);

  let prev: FieldId = "arrival";
  const chapters: ChapterPlan[] = kept.map(({ c, blocks }, i) => {
    const name = nameFor(c);
    const head = copy.chapterHeads[c] ?? { text: name, from: "live" as const };
    const plate = plates.get(c);
    const field = FIELD_OF[c];
    const chapter: ChapterPlan = {
      id: c,
      number: i + 1,
      name,
      showName: head.text !== name,
      head,
      field,
      prevField: prev,
      plate,
      blocks,
    };
    id(c);
    prev = field;
    return chapter;
  });

  const helpName = TITLES.help ?? "Help";
  const helpHead = copy.chapterHeads.help ?? {
    text: m.sections.find((s) => s.id === "help")?.title ?? helpName,
    from: "live" as const,
  };
  const help = {
    id: "help" as const,
    number: chapters.length + 1,
    name: helpName,
    showName: helpHead.text !== helpName,
    head: helpHead,
    field: "paper" as const,
    prevField: prev,
    blocks: helpBlocks,
    contact: copy.bodies.contact?.text ?? m.contact.label,
    phone: opts.phone === "allowed" ? m.contact.phone : undefined,
    sms: opts.phone === "allowed" && m.contact.phone ? m.contact.sms : undefined,
    emergencies: label("emergencies", "Emergencies"),
  };
  id("help");

  // Quick find: the house's own list, or one row per chapter (the v1 shape).
  const qfRows: Omit<QuickRow, "n">[] = [];
  const itemsByKey = new Map<string, ItemV2>();
  for (const s of m.sections) for (const it of s.items) itemsByKey.set(itemKey(s.id, it), it);
  const linkByKey = new Map(
    m.sections.flatMap((s) => (s.links ?? []).map((l) => [itemKey(s.id, l), l] as const)),
  );
  const unknownByKey = new Map(
    m.sections.flatMap((s) => (s.unknowns ?? []).map((u) => [itemKey(s.id, u), u] as const)),
  );
  const short = (t: string | undefined) => {
    if (!t) return undefined;
    const f = firstSentence(t);
    return f.length <= ANSWER_MAX ? f : undefined;
  };
  if (m.look.quickFind?.length) {
    for (const ref of m.look.quickFind) {
      const draft = copy.quickFind[ref];
      const row = (href: string, question: string, answer?: string): Omit<QuickRow, "n"> => ({
        ref,
        href,
        question: draft?.question.text ?? question,
        answer: draft ? draft.answer?.text : answer,
      });
      if (ref === "wifi") {
        const r = row("#wifi", label("coverWifi", "Wi-Fi"));
        if (w.kind === "printed")
          qfRows.push({
            ...r,
            answer: undefined,
            wifi: {
              network: w.network.value,
              password: w.password.value,
              copy: label("copyButtonFind", "Copy"),
              label: label("coverPassword") || "Password",
            },
          });
        else {
          const line =
            w.kind === "open"
              ? w.network.value
              : w.kind === "in-message"
                ? w.line.value
                : unknownText(w.fact, copy);
          if (line) qfRows.push({ ...r, answer: draft?.answer?.text ?? line });
        }
      } else if (ref === "door")
        qfRows.push(row("#door", label("coverDoor", "Getting in"), short(copy.codeDelivery.text)));
      else if (ref === "parking") {
        if (parkingText)
          qfRows.push(row("#park", label("coverPark", "Parking"), short(parkingText)));
      } else if (ref === "checkout") {
        const out = unknownText(m.checkOut, copy);
        const target = chapters.some((c) => c.id === "checkout") ? "#checkout" : "#arrival";
        if (out) qfRows.push(row(target, label("coverOut", "Check-out"), out));
      } else if (itemsByKey.has(ref)) {
        const it = itemsByKey.get(ref) as ItemV2;
        qfRows.push(row(`#${anchor(ref)}`, it.label, short(it.body)));
      } else if (linkByKey.has(ref)) {
        qfRows.push(row(`#${anchor(ref)}`, linkByKey.get(ref)?.label ?? ref));
      } else if (unknownByKey.has(ref) && ids.includes(anchor(ref))) {
        const u = unknownByKey.get(ref);
        const text = copy.unknownsOn ? copy.unknownLine?.text : u?.fact.liveLine;
        if (u && text) qfRows.push({ ...row(`#${anchor(ref)}`, u.label), answer: text });
      }
    }
  } else {
    for (const c of [...chapters, help])
      qfRows.push({ ref: c.id, href: `#${c.id}`, question: c.name });
  }
  const quickRows: QuickRow[] = qfRows.map((r, i) => ({ ...r, n: String(i + 1).padStart(2, "0") }));

  // Cover rows.
  const rows: CoverRow[] = [];
  const inV = unknownText(m.checkIn, copy);
  const outV = unknownText(m.checkOut, copy);
  if (inV || outV)
    rows.push({
      kind: "times",
      id: "times",
      label: label("coverIn", "Check-in"),
      inValue: inV,
      outLabel: label("coverOut", "Check-out"),
      outValue: outV,
    });
  const merged = copy.labels.coverPassword?.text === "";
  if (w.kind === "printed") {
    if (merged)
      rows.push({
        kind: "wifi",
        id: "wifi",
        label: label("coverWifi", "Wi-Fi"),
        network: w.network.value,
        password: w.password.value,
        copy: label("copyButton", "Copy"),
      });
    else {
      rows.push({
        kind: "wifi",
        id: "wifi",
        label: label("coverWifi", "Wi-Fi"),
        network: w.network.value,
      });
      rows.push({
        kind: "wifi",
        id: "password",
        label: label("coverPassword", "Password"),
        password: w.password.value,
        copy: label("copyButton", "Copy"),
      });
    }
  } else if (w.kind === "open")
    rows.push({
      kind: "wifi",
      id: "wifi",
      label: label("coverWifi", "Wi-Fi"),
      network: w.network.value,
    });
  else {
    const line = w.kind === "in-message" ? w.line.value : unknownText(w.fact, copy);
    if (line)
      rows.push({ kind: "text", id: "wifi", label: label("coverWifi", "Wi-Fi"), text: line });
  }

  const coverLine = (
    rowId: "door" | "parking",
    rowLabel: string,
    text: string,
    href: string,
    mode: "lead" | "full" | "link" | undefined,
    jumpText: string,
  ): CoverRow => {
    const lead = firstSentence(text);
    const pick = mode ?? (lead.length <= LEAD_MAX ? "lead" : "link");
    if (pick === "full") return { kind: "text", id: rowId, label: rowLabel, text };
    if (pick === "lead") return { kind: "text", id: rowId, label: rowLabel, text: lead };
    // One clear link in the live wording ("Getting in", "Parking"); the cover shows it without the
    // row label, so a row never reads "Parking: Parking".
    return { kind: "link", id: rowId, label: rowLabel, text: jumpText, href };
  };
  const doorLabel = label("coverDoor", "Getting in");
  if (copy.codeDelivery.from === "approved")
    rows.push({ kind: "text", id: "door", label: doorLabel, text: copy.codeDelivery.text });
  else if (copy.coverLines.door)
    rows.push({ kind: "text", id: "door", label: doorLabel, text: copy.coverLines.door.text });
  else
    rows.push(
      coverLine(
        "door",
        doorLabel,
        copy.codeDelivery.text,
        "#door",
        m.look.coverRows?.door,
        TEMPLATE_LABELS.coverDoor.live ?? "Getting in",
      ),
    );
  const parkLabel = label("coverPark", "Parking");
  if (copy.coverLines.parking && parkingText)
    rows.push({
      kind: "text",
      id: "parking",
      label: parkLabel,
      text: copy.coverLines.parking.text,
    });
  else if (parkingText)
    rows.push(
      isUnknown(m.parking)
        ? { kind: "text", id: "parking", label: parkLabel, text: parkingText }
        : coverLine(
            "parking",
            parkLabel,
            parkingText,
            "#park",
            m.look.coverRows?.parking,
            TEMPLATE_LABELS.coverPark.live ?? "Parking",
          ),
    );
  rows.push({
    kind: "link",
    id: "help",
    label: label("coverHelp", "Help"),
    text: firstSentence(m.contact.label),
    href: "#help",
  });

  const labelChars = Math.max(...rows.map((r) => r.label.length));
  const labelWidth = copy.alpenglowLabels ? 60 : Math.min(104, Math.ceil(labelChars * 7.8) + 12);

  const a = m.address.value;
  const addressLine = `${a.street}, ${a.city}, ${a.state} ${a.zip}`;
  const coverPlan: CoverPlan = {
    kind: coverPhoto ? "photo" : "type",
    layout: coverPhoto && cover.kind === "photo" ? cover.layout : "type",
    name: m.name,
    nameLines: m.nameLines,
    nameStep: nameStep(m.name),
    photo: coverPhoto,
    typeTitle: cover.kind === "type" ? cover.title : undefined,
    feature: cover.kind === "type" ? cover.feature : undefined,
    address: addressLine,
    place: m.name.trim() === a.street.trim() ? `${a.city}, ${a.state} ${a.zip}` : undefined,
    mapUrl: m.address.mapUrl,
    appleMapUrl: m.address.appleMapUrl,
    directions: label("directions", "Directions"),
    rows,
    labelWidth,
    notice: m.notice?.value,
  };

  const latest = newestChecked(m);
  const checkedBy = m.checkedBy ? ` by ${m.checkedBy.value}` : "";
  const checked = `${label("checked", "Checked")} ${copy.alpenglowLabels ? monthYear(latest) : formatDay(latest)}${checkedBy}`;

  const plan: Plan = {
    slug: m.slug,
    name: m.name,
    shortName:
      m.shortName ?? (m.name.length <= 14 ? m.name : m.name.split(/\s+/).slice(0, 2).join(" ")),
    iconText: m.iconText,
    cover: coverPlan,
    quickFind: { head: L.quickFindHead ?? { text: "Quick find", from: "live" }, rows: quickRows },
    chapters,
    help,
    colophon: {
      address: addressLine,
      checked,
      saved: label("savedLine"),
      credits: [...new Set([...used].flatMap((src) => bySrc.get(src)?.credit ?? []))],
    },
    print: { wifiQr: wifiPayload(m) },
    ids,
    offlineUrls: [],
    copy,
  };

  const url = opts.imageUrl ?? ((src: string) => src);
  const offline = new Set<string>();
  if (opts.page) offline.add(opts.page);
  for (const u of opts.extraUrls ?? []) offline.add(u);
  if (coverPhoto) offline.add(url(coverPhoto.portrait.src, COVER_WIDTH));
  for (const p of placedPhotos(plan))
    if (p.src !== coverPhoto?.portrait.src) offline.add(url(p.src, PHONE_WIDTH));
  plan.offlineUrls = [...offline];
  return plan;
}

/** Every photograph a plan places, in page order, the cover first. */
export function placedPhotos(p: Plan): PlacedPhoto[] {
  const out: PlacedPhoto[] = [];
  if (p.cover.photo)
    out.push({
      src: p.cover.photo.portrait.src,
      alt: p.cover.photo.alt,
      room: "cover",
      width: p.cover.photo.portrait.width,
      height: p.cover.photo.portrait.height,
    });
  for (const c of p.chapters) {
    if (Array.isArray(c.plate)) out.push(...c.plate);
    else if (c.plate) out.push(c.plate);
    for (const b of c.blocks) if (b.kind === "item" && b.photos) out.push(...b.photos);
  }
  return out;
}
