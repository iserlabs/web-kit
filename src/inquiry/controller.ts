import {
  advance,
  buildPayload,
  changeStep,
  chooseFollowUp,
  chooseOption,
  contactStep,
  type FlowState,
  goBack,
  initialState,
  localToday,
  looksAutomated,
  setContactField,
  validateContact,
} from "./core";
import type { ContactValues, InquiryConfig, InquiryPayload } from "./types";

export interface ControllerDeps {
  /** Defaults to the global fetch. */
  fetcher?: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
  /** Milliseconds clock. Defaults to Date.now. */
  now?: () => number;
  /** Today as yyyy-mm-dd in the visitor's local calendar. */
  today?: () => string;
  /** The page the inquiry came from. */
  source?: string;
}

/**
 * The flow without React: a small store the hook subscribes to, so every rule
 * (steps, validation, payload, honeypot, timing, sending) is testable in plain Node.
 */
export function createInquiryController(config: InquiryConfig, deps: ControllerDeps = {}) {
  const now = deps.now ?? (() => Date.now());
  const today = deps.today ?? (() => localToday());
  const openedAt = now();
  let state: FlowState = initialState(config);
  const listeners = new Set<() => void>();
  const set = (next: FlowState) => {
    if (next === state) return;
    state = next;
    for (const l of listeners) l();
  };

  const payload = (): InquiryPayload =>
    buildPayload(config, state.answers, state.contact, {
      website: state.honeypot,
      elapsedMs: now() - openedAt,
      source: deps.source,
    });

  async function submit(): Promise<"sent" | "failed" | "invalid" | "ignored"> {
    if (state.status === "sending" || state.status === "sent") return "ignored";
    const cs = contactStep(config);
    const errors = validateContact(cs, state.contact, config, today());
    if (Object.keys(errors).length) {
      set({ ...state, errors, status: "idle", failure: null });
      return "invalid";
    }
    const body = payload();
    // A bot signal looks like success to the sender and goes nowhere.
    if (looksAutomated(config, body)) {
      set({ ...state, errors: {}, status: "sent", failure: null });
      return "sent";
    }
    set({ ...state, errors: {}, status: "sending", failure: null });
    try {
      const f = deps.fetcher ?? ((u, i) => fetch(u, i));
      const res = await f(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        /* a non-JSON answer is judged by its status */
      }
      const d = data as { ok?: boolean; errors?: Record<string, string[]> } | null;
      if (res.ok && d?.ok !== false) {
        set({ ...state, status: "sent", failure: null, errors: {} });
        return "sent";
      }
      if (res.status === 400 && d?.errors) {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.errors))
          if (v[0]) fieldErrors[k.replace(/^contact\./, "")] = v[0];
        set({ ...state, status: "idle", errors: fieldErrors });
        return "invalid";
      }
      set({ ...state, status: "failed", failure: config.failureMessage });
      return "failed";
    } catch {
      set({ ...state, status: "failed", failure: config.failureMessage });
      return "failed";
    }
  }

  return {
    config,
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    choose: (stepId: string, optionId: string) =>
      set(chooseOption(config, state, stepId, optionId)),
    chooseFollowUp: (stepId: string, optionId: string) =>
      set(chooseFollowUp(config, state, stepId, optionId)),
    next: () => set(advance(config, state)),
    back: () => set(goBack(state)),
    change: (stepId: string) => set(changeStep(config, state, stepId)),
    setContact: (field: keyof ContactValues, value: string) =>
      set(setContactField(state, field, value)),
    setHoneypot: (value: string) => set({ ...state, honeypot: value }),
    /** After a failed send, lets the visitor try again. */
    retry: () => set({ ...state, status: "idle", failure: null }),
    payload,
    submit,
  };
}

export type InquiryController = ReturnType<typeof createInquiryController>;
