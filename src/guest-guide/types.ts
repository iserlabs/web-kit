/**
 * Guest guidebook content. Every fact a guest acts on carries where it came
 * from and the day it was last confirmed, so a stale or invented line can be
 * traced and caught. There is deliberately no field for an entry code: the
 * guide says where the code arrives, never what it is.
 */

/** A value plus its source and the day it was last confirmed (YYYY-MM-DD). */
export type Sourced<T = string> = { value: T; source: string; checked: string };

export type GuideItem = { label: string; body: string; source: string; checked: string };

export type GuideSectionId =
  | "first-hour"
  | "house"
  | "good-to-know"
  | "rules"
  | "checkout"
  | "help";

export type GuideSection = { id: GuideSectionId; title: string; items: GuideItem[] };

export type LocalPickKind =
  | "grocery"
  | "coffee"
  | "dinner"
  | "trail"
  | "park"
  | "urgent-care"
  | "er"
  | "day-trip"
  | "kids"
  | "event";

export type LocalPick = {
  name: string;
  kind: LocalPickKind;
  note: string;
  url: string;
  hours?: string;
  /** From the house, e.g. "6 min drive". Absent on city-wide picks. */
  distance?: string;
  source: string;
  checked: string;
};

export type GuidePhoto = { src: string; alt: string; room: string; width: number; height: number };

export type GuestAddress = { street: string; city: string; state: string; zip: string };

export type GuestGuide = {
  slug: string;
  /** Short house name as guests know it, e.g. "135 Yale". */
  name: string;
  /** Which door is theirs, on a two-door property. */
  door?: Sourced;
  address: Sourced<GuestAddress> & { mapUrl: string };
  checkIn: Sourced;
  checkOut: Sourced;
  entry: { lock: Sourced; steps: Sourced<string[]>; codeDelivery: Sourced };
  parking: Sourced;
  wifi: { network: Sourced; password: Sourced };
  contact: { label: string; phone: string; source: string; checked: string };
  sections: GuideSection[];
  nearby: LocalPick[];
  photos: GuidePhoto[];
};
