/** One tap-to-choose answer. */
export interface InquiryOption {
  id: string;
  label: string;
  hint?: string;
}

/** The optional "Anything more specific?" list shown after a choice. */
export interface InquiryFollowUp {
  question: string;
  help?: string;
  multi?: boolean;
  options: readonly InquiryOption[];
}

export interface ChoiceStep {
  kind: "choice";
  id: string;
  question: string;
  help?: string;
  /** Several answers allowed. Default: one. */
  multi?: boolean;
  /** When true the visitor may move on without answering. Default: required. */
  optional?: boolean;
  options: readonly InquiryOption[];
  followUp?: InquiryFollowUp;
}

/** A question answered with a number: large minus and plus buttons around a numeric input. */
export interface CountStep {
  kind: "count";
  id: string;
  question: string;
  help?: string;
  /** Smallest allowed value. Default 0. */
  min?: number;
  /** Largest allowed value. Default 9999. */
  max?: number;
  /** What each minus or plus tap moves by. Default 1. */
  step?: number;
  /** Where the counter starts. When absent the input starts empty and the first tap lands on `min`. */
  default?: number;
  /** Words after the number in the summary, "12 listings". A string, or one and other forms. */
  unit?: string | { one: string; other: string };
  /** When true the visitor may move on without a number. Default: required. */
  optional?: boolean;
}

export type ContactFieldMode = false | true | "required";

export interface ContactLabels {
  name: string;
  email: string;
  phone: string;
  date: string;
  message: string;
}

export interface ContactStep {
  kind: "contact";
  id: string;
  heading: string;
  intro?: string;
  /** Name and email are always shown and required. */
  fields: { phone?: ContactFieldMode; date?: ContactFieldMode; message?: ContactFieldMode };
  labels: ContactLabels;
  /** Words for each field error. */
  errors?: Partial<Record<InquiryErrorCode, string>>;
  submitLabel: string;
}

export type InquiryStep = ChoiceStep | CountStep | ContactStep;

/** A step the visitor answers (everything but the contact step). */
export type AnswerStep = ChoiceStep | CountStep;

export interface InquiryConfig {
  /** Choice and count steps, then exactly one contact step last. */
  steps: readonly InquiryStep[];
  /** Where the flow POSTs its JSON. */
  endpoint: string;
  /** What the visitor reads when sending fails: say what to do (the fallback email). */
  failureMessage: string;
  /** Moving on from a single-choice step with no follow-up goes straight to the next. Default true. */
  autoAdvance?: boolean;
  /** Sends sooner than this after the flow opened are quietly dropped. Default 2500. */
  minFillMs?: number;
  /** Longest message accepted. Default 2000. */
  maxMessageLength?: number;
}

export type InquiryErrorCode =
  | "choose"
  | "count"
  | "name"
  | "email"
  | "phone"
  | "phoneRequired"
  | "date"
  | "datePast"
  | "messageRequired"
  | "messageLong";

export interface StepAnswer {
  choices: string[];
  followUp: string[];
  /** The number, for a count step. null (or absent) means not answered. */
  count?: number | null;
}

export type InquiryAnswers = Record<string, StepAnswer>;

export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  /** yyyy-mm-dd, as a date input gives it. */
  date: string;
  message: string;
}

export type FlowStatus = "idle" | "sending" | "sent" | "failed";

/** Field name (a step id or a contact field) to the message shown beside it. */
export type FieldErrors = Record<string, string>;

export interface PayloadAnswer {
  stepId: string;
  question: string;
  choices: { id: string; label: string }[];
  followUp?: { question: string; choices: { id: string; label: string }[] };
  /** The number, for a count step (its `choices` is empty). */
  count?: number;
}

export interface InquiryPayload {
  answers: PayloadAnswer[];
  contact: { name: string; email: string; phone?: string; date?: string; message?: string };
  /** Human-readable lines ("Question: answer") for the notification email. */
  summary: string[];
  /** Honeypot. Real visitors leave it empty. */
  website: string;
  /** Milliseconds from the flow opening to the send. */
  elapsedMs: number;
  /** The page the inquiry came from, when the site gives it. */
  source?: string;
}
