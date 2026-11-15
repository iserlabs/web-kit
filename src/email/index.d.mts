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
export type EmailBrand = {
  business: string;
  // biome-ignore lint/suspicious/noExplicitAny: the brand-pack config is plain data
  config: any;
  person: { name: string; title?: string; email: string; phone?: string };
  from: string;
  replyTo?: string;
  fontsHref?: string;
  variant?: string;
  signatureHtml?: string;
};
export type EmailBlock = { type: string; [key: string]: unknown };
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
export type ConfirmationContent = {
  lead: string;
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
export function confirmationBlocks(
  args: { recipientName?: string } & ConfirmationContent,
): EmailBlock[];
export function composeEmail(args: {
  brand: EmailBrand;
  to: string;
  kind: string;
  who?: string;
  reference?: string;
  date: Date | string;
  timeZone?: string;
  blocks: EmailBlock[];
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
