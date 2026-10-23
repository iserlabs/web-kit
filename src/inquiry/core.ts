import type {
  ChoiceStep,
  ContactStep,
  ContactValues,
  FieldErrors,
  FlowStatus,
  InquiryAnswers,
  InquiryConfig,
  InquiryErrorCode,
  InquiryOption,
  InquiryPayload,
  InquiryStep,
  PayloadAnswer,
  StepAnswer,
} from "./types";

export const DEFAULT_MIN_FILL_MS = 2500;
export const DEFAULT_MAX_MESSAGE = 2000;

const DEFAULT_ERRORS: Record<InquiryErrorCode, string> = {
  choose: "Please pick an answer to keep going.",
  name: "Please add your name.",
  email: "Please add an email address we can reply to.",
  phone: "That phone number does not look right.",
  phoneRequired: "Please add a phone number.",
  date: "We could not read that date. Try picking it from the calendar.",
  datePast: "That date has already passed. Pick another, or leave it blank.",
  messageRequired: "Please add a short message.",
  messageLong: "Please keep your message shorter.",
};

export function errorText(step: ContactStep, code: InquiryErrorCode): string {
  return step.errors?.[code] ?? DEFAULT_ERRORS[code];
}

export function choiceSteps(config: InquiryConfig): ChoiceStep[] {
  return config.steps.filter((s): s is ChoiceStep => s.kind === "choice");
}

export function contactStep(config: InquiryConfig): ContactStep {
  const last = config.steps[config.steps.length - 1];
  if (!last || last.kind !== "contact")
    throw new Error("inquiry config: the last step must be the contact step");
  return last;
}

/** Throws a plain sentence when a config is malformed. Call it once in the site's content file. */
export function defineInquiry<C extends InquiryConfig>(config: C): C {
  const ids = new Set<string>();
  if (config.steps.length < 2)
    throw new Error("inquiry config: needs at least one choice step and a contact step");
  config.steps.forEach((s, i) => {
    if (ids.has(s.id)) throw new Error(`inquiry config: duplicate step id "${s.id}"`);
    ids.add(s.id);
    const last = i === config.steps.length - 1;
    if (last && s.kind !== "contact")
      throw new Error("inquiry config: the last step must be the contact step");
    if (!last && s.kind !== "choice")
      throw new Error(
        `inquiry config: step "${s.id}" must be a choice step; only the last step is the contact step`,
      );
    if (s.kind === "choice") {
      for (const list of [s.options, s.followUp?.options ?? []]) {
        const seen = new Set<string>();
        for (const o of list) {
          if (seen.has(o.id))
            throw new Error(`inquiry config: step "${s.id}" repeats option id "${o.id}"`);
          seen.add(o.id);
        }
      }
      if (s.options.length === 0) throw new Error(`inquiry config: step "${s.id}" has no options`);
    }
  });
  return config;
}

export const EMPTY_CONTACT: ContactValues = {
  name: "",
  email: "",
  phone: "",
  date: "",
  message: "",
};

export function emptyAnswers(config: InquiryConfig): InquiryAnswers {
  const out: InquiryAnswers = {};
  for (const s of choiceSteps(config)) out[s.id] = { choices: [], followUp: [] };
  return out;
}

/** Toggle (multi) or replace (single) an id in a list. */
export function pick(list: readonly string[], id: string, multi: boolean): string[] {
  if (!multi) return list.length === 1 && list[0] === id ? [] : [id];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function stepIsAnswered(step: ChoiceStep, a: StepAnswer | undefined): boolean {
  if (step.optional) return true;
  return (a?.choices.length ?? 0) > 0;
}

export function validateChoice(
  step: ChoiceStep,
  a: StepAnswer | undefined,
  contact: ContactStep,
): FieldErrors {
  const errors: FieldErrors = {};
  const choices = a?.choices ?? [];
  if (!step.optional && choices.length === 0) errors[step.id] = errorText(contact, "choose");
  return errors;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function digits(s: string): number {
  return s.replace(/\D/g, "").length;
}

/** Local calendar day as yyyy-mm-dd (never built from a UTC string). */
export function localToday(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function realDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function validateContact(
  step: ContactStep,
  c: ContactValues,
  config: InquiryConfig,
  today: string = localToday(),
): FieldErrors {
  const e: FieldErrors = {};
  const name = c.name.trim();
  const email = c.email.trim();
  const phone = c.phone.trim();
  const date = c.date.trim();
  const message = c.message.trim();
  if (!name) e.name = errorText(step, "name");
  if (!EMAIL.test(email)) e.email = errorText(step, "email");
  if (step.fields.phone) {
    if (!phone) {
      if (step.fields.phone === "required") e.phone = errorText(step, "phoneRequired");
    } else if (digits(phone) < 7 || digits(phone) > 15) e.phone = errorText(step, "phone");
  }
  if (step.fields.date && date) {
    if (!realDate(date)) e.date = errorText(step, "date");
    else if (date < today) e.date = errorText(step, "datePast");
  } else if (step.fields.date === "required" && !date) e.date = errorText(step, "date");
  if (step.fields.message) {
    if (!message && step.fields.message === "required")
      e.message = errorText(step, "messageRequired");
    else if (message.length > (config.maxMessageLength ?? DEFAULT_MAX_MESSAGE))
      e.message = errorText(step, "messageLong");
  }
  return e;
}

function labelsFor(options: readonly InquiryOption[], ids: readonly string[]) {
  return ids.flatMap((id) => {
    const o = options.find((x) => x.id === id);
    return o ? [{ id: o.id, label: o.label }] : [];
  });
}

export function answerLabels(step: ChoiceStep, a: StepAnswer | undefined): string[] {
  return labelsFor(step.options, a?.choices ?? []).map((x) => x.label);
}

export function answerText(step: ChoiceStep, a: StepAnswer | undefined): string {
  const main = answerLabels(step, a).join(", ");
  const more = labelsFor(step.followUp?.options ?? [], a?.followUp ?? []).map((x) => x.label);
  return more.length ? `${main} (${more.join(", ")})` : main;
}

/** Structured answers plus "Question: answer" lines. Unknown ids are dropped, never echoed. */
export function buildPayload(
  config: InquiryConfig,
  answers: InquiryAnswers,
  contact: ContactValues,
  extra: { website?: string; elapsedMs?: number; source?: string } = {},
): InquiryPayload {
  const cs = contactStep(config);
  const out: PayloadAnswer[] = [];
  const summary: string[] = [];
  for (const s of choiceSteps(config)) {
    const a = answers[s.id];
    const choices = labelsFor(s.options, a?.choices ?? []);
    if (choices.length === 0) continue;
    const entry: PayloadAnswer = { stepId: s.id, question: s.question, choices };
    summary.push(`${s.question}: ${choices.map((c) => c.label).join(", ")}`);
    if (s.followUp) {
      const fu = labelsFor(s.followUp.options, a?.followUp ?? []);
      if (fu.length) {
        entry.followUp = { question: s.followUp.question, choices: fu };
        summary.push(`${s.followUp.question}: ${fu.map((c) => c.label).join(", ")}`);
      }
    }
    out.push(entry);
  }
  const c: InquiryPayload["contact"] = { name: contact.name.trim(), email: contact.email.trim() };
  summary.push(`${cs.labels.name}: ${c.name}`, `${cs.labels.email}: ${c.email}`);
  if (cs.fields.phone && contact.phone.trim()) {
    c.phone = contact.phone.trim();
    summary.push(`${cs.labels.phone}: ${c.phone}`);
  }
  if (cs.fields.date && contact.date.trim()) {
    c.date = contact.date.trim();
    summary.push(`${cs.labels.date}: ${c.date}`);
  }
  if (cs.fields.message && contact.message.trim()) {
    c.message = contact.message.trim();
    summary.push(`${cs.labels.message}: ${c.message}`);
  }
  const payload: InquiryPayload = {
    answers: out,
    contact: c,
    summary,
    website: extra.website ?? "",
    elapsedMs: Math.max(0, Math.round(extra.elapsedMs ?? 0)),
  };
  if (extra.source) payload.source = extra.source;
  return payload;
}

/* ---------------------------------------------------------------- state machine */

export interface FlowState {
  /** Index into config.steps of the screen showing. */
  index: number;
  /** The furthest screen the visitor has reached. */
  reached: number;
  /** True while re-answering an earlier step; Next jumps back to `reached`. */
  editing: boolean;
  answers: InquiryAnswers;
  contact: ContactValues;
  errors: FieldErrors;
  status: FlowStatus;
  failure: string | null;
  honeypot: string;
}

export function initialState(config: InquiryConfig): FlowState {
  return {
    index: 0,
    reached: 0,
    editing: false,
    answers: emptyAnswers(config),
    contact: { ...EMPTY_CONTACT },
    errors: {},
    status: "idle",
    failure: null,
    honeypot: "",
  };
}

export function stepAt(config: InquiryConfig, i: number): InquiryStep {
  const s = config.steps[i];
  if (!s) throw new Error(`inquiry flow: no step at ${i}`);
  return s;
}

function moveTo(state: FlowState, index: number): FlowState {
  return { ...state, index, reached: Math.max(state.reached, index), errors: {} };
}

/** Leave the current choice step if it is answered; otherwise show its error. */
export function advance(config: InquiryConfig, state: FlowState): FlowState {
  const step = stepAt(config, state.index);
  if (step.kind !== "choice") return state;
  const errors = validateChoice(step, state.answers[step.id], contactStep(config));
  if (Object.keys(errors).length) return { ...state, errors };
  const target = state.editing ? state.reached : state.index + 1;
  return { ...moveTo(state, target), editing: false };
}

export function chooseOption(
  config: InquiryConfig,
  state: FlowState,
  stepId: string,
  optionId: string,
): FlowState {
  const step = config.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "choice" || !step.options.some((o) => o.id === optionId)) return state;
  const prev = state.answers[stepId] ?? { choices: [], followUp: [] };
  const choices = pick(prev.choices, optionId, !!step.multi);
  const next: FlowState = {
    ...state,
    answers: {
      ...state.answers,
      [stepId]: { choices, followUp: choices.length ? prev.followUp : [] },
    },
    errors: {},
  };
  const auto = config.autoAdvance !== false && !step.multi && !step.followUp && choices.length > 0;
  return auto && state.index === config.steps.indexOf(step) ? advance(config, next) : next;
}

export function chooseFollowUp(
  config: InquiryConfig,
  state: FlowState,
  stepId: string,
  optionId: string,
): FlowState {
  const step = config.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "choice" || !step.followUp?.options.some((o) => o.id === optionId))
    return state;
  const prev = state.answers[stepId] ?? { choices: [], followUp: [] };
  return {
    ...state,
    answers: {
      ...state.answers,
      [stepId]: { ...prev, followUp: pick(prev.followUp, optionId, !!step.followUp.multi) },
    },
  };
}

export function goBack(state: FlowState): FlowState {
  if (state.index === 0) return state;
  return {
    ...state,
    index: state.index - 1,
    editing: state.index - 1 < state.reached,
    errors: {},
    status: "idle",
    failure: null,
  };
}

/** Jump back to an earlier step to change it. Later answers are kept. */
export function changeStep(config: InquiryConfig, state: FlowState, stepId: string): FlowState {
  const i = config.steps.findIndex((s) => s.id === stepId);
  if (i < 0 || i > state.reached || i === state.index) return state;
  const reached = Math.max(state.reached, state.index);
  return {
    ...state,
    index: i,
    reached,
    editing: i < reached,
    errors: {},
    status: state.status === "sent" ? "sent" : "idle",
    failure: null,
  };
}

export function setContactField(
  state: FlowState,
  field: keyof ContactValues,
  value: string,
): FlowState {
  if (!(field in state.contact)) return state;
  const errors = { ...state.errors };
  delete errors[field];
  return { ...state, contact: { ...state.contact, [field]: value }, errors };
}

/** True when a send should be silently dropped (bot signals). */
export function looksAutomated(
  config: InquiryConfig,
  p: { website?: unknown; elapsedMs?: unknown },
): boolean {
  if (typeof p.website === "string" && p.website.trim() !== "") return true;
  const min = config.minFillMs ?? DEFAULT_MIN_FILL_MS;
  return typeof p.elapsedMs !== "number" || p.elapsedMs < min;
}
