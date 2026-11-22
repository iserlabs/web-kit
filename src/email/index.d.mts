export const GMAIL_CLIP_BYTES: number;
export const GMAIL_SAFE_BYTES: number;
export function formatLongDate(date: Date | string, timeZone?: string): string;
export function emailSubject(args: {
  business: string;
  kind: string;
  who?: string;
  reference?: string;
  date: Date | string;
  timeZone?: string;
}): string;
export function makeReference(
  prefix: string,
  date: Date | string,
  seed: string,
  timeZone?: string,
): string;
export function mailSwitch(
  env: Record<string, string | undefined> | undefined,
  name: string,
): { name: string; on: boolean };

import type { Faces, Logo, Palette } from "./specimen.mjs";

export type EmailBrand = {
  business: string;
  // biome-ignore lint/suspicious/noExplicitAny: the brand-pack config is plain data
  config: any;
  person: { name: string; title?: string; email: string; phone?: string };
  from: string;
  replyTo?: string;
  /** Hosted web font stylesheet for the business's faces. */
  fontsHref?: string;
  /** The legal line in the footer; defaults to the business name. */
  legalLine?: string;
  /** Refinements to the Specimen for this business. Everything else comes from `config`. */
  specimen?: {
    deep?: string;
    gold?: string;
    logo?: Logo;
    faces?: Faces;
    fontsHref?: string;
  };
};
export type ComposedMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  reference?: string;
  headers: Record<string, string>;
};
export type SpecimenContent = {
  headline: string;
  /** Paragraphs under the headline. */
  lead: string[];
  sheetTitle?: string;
  caption?: string;
  received?: { label: string; value: string }[];
  reference?: { label: string; value: string };
  /** Paragraphs under the sheet; `[label](https://url)` becomes an inline link. */
  after?: string[];
  status?: string;
};
export type ConfirmationContent = {
  lead: string;
  /** The big sentence; defaults to the kind as a sentence ("Inquiry received."). */
  headline?: string;
  /** The sheet's title: "What you sent" by default. */
  sheetTitle?: string;
  /** One line above the rows, e.g. "For your records, here is what you sent:". */
  caption?: string;
  received?: [string, string][];
  reference?: string;
  referenceLabel?: string;
  next?: string[];
  nextIntro?: string;
  replyLine?: string;
  close?: string;
  replyTo?: string;
  from?: string;
};
export function confirmationContent(
  args: { recipientName?: string; kind: string } & ConfirmationContent,
): SpecimenContent;
export function specimenLook(brand: EmailBrand): {
  palette: Palette;
  faces: Faces;
  logo?: Logo;
  fontsHref?: string;
};
export function composeEmail(args: {
  brand: EmailBrand;
  to: string;
  kind: string;
  who?: string;
  reference?: string;
  date: Date | string;
  timeZone?: string;
  content: SpecimenContent;
  replyTo?: string;
  from?: string;
}): ComposedMessage;
export function composeConfirmation(
  args: {
    brand: EmailBrand;
    to: string;
    kind: string;
    recipientName?: string;
    date: Date | string;
    timeZone?: string;
  } & ConfirmationContent,
): ComposedMessage;
export function deliver(
  message: ComposedMessage,
  options: {
    switchOn: boolean;
    configured?: boolean;
    transport?: (message: ComposedMessage) => Promise<unknown>;
  },
): Promise<{
  status: "off" | "not_configured" | "delivered" | "failed";
  result?: unknown;
  error?: string;
}>;
export function lintMessage(
  message: { subject: string; html: string; text: string },
  options?: { allow?: string[]; bannedPhones?: string[] },
): { code: string; message: string }[];
