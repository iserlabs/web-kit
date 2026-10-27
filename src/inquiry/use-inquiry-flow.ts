import { useMemo, useState, useSyncExternalStore } from "react";
import { type ControllerDeps, createInquiryController } from "./controller";
import { answerSteps, answerText, contactStep, stepAt } from "./core";
import type { ChoiceStep, ContactStep, CountStep, InquiryConfig } from "./types";

/**
 * The whole flow for a React component. Renders nothing itself: the site's
 * component (scaffolded by `web-kit inquiry init`) draws it.
 */
export function useInquiryFlow(config: InquiryConfig, deps: ControllerDeps = {}) {
  const [ctl] = useState(() => createInquiryController(config, deps));
  const state = useSyncExternalStore(ctl.subscribe, ctl.getState, ctl.getState);
  const step = stepAt(config, state.index);
  const total = config.steps.length;

  const answered = useMemo(
    () =>
      answerSteps(config)
        .filter(
          (s) => config.steps.indexOf(s) < state.index || state.index >= config.steps.length - 1,
        )
        .filter((s) => answerText(s, state.answers[s.id]) !== "" || s.optional)
        .map((s) => ({
          stepId: s.id,
          question: s.question,
          answer: answerText(s, state.answers[s.id]),
        })),
    [config, state.answers, state.index],
  );

  return {
    /** idle, sending, sent or failed. */
    status: state.status,
    /** The sentence to show when status is "failed". */
    failure: state.failure,
    /** The screen showing now. */
    step: step as ChoiceStep | CountStep | ContactStep,
    stepIndex: state.index,
    isContact: step.kind === "contact",
    contactStep: contactStep(config),
    /** "n of N": show as `Question ${n} of ${total}`. */
    progress: { n: state.index + 1, total },
    answers: state.answers,
    /** Earlier answered steps, each with its summary line. */
    summaries: answered,
    contact: state.contact,
    /** Inline messages keyed by step id or contact field. */
    errors: state.errors,
    canGoBack: state.index > 0 && state.status !== "sending",
    choose: ctl.choose,
    chooseFollowUp: ctl.chooseFollowUp,
    /** Sets a count step's number (null clears it). Read the live value at `answers[stepId].count`. */
    setCount: ctl.setCount,
    /** One minus (-1) or plus (1) tap, clamped to min and max. */
    bumpCount: ctl.bumpCount,
    next: ctl.next,
    back: ctl.back,
    change: ctl.change,
    setContact: ctl.setContact,
    submit: ctl.submit,
    retry: ctl.retry,
    /** Structured answers plus "Question: answer" lines, as the server receives them. */
    buildPayload: ctl.payload,
    /** Spread onto a visually hidden, aria-hidden text input. Real visitors never fill it. */
    honeypotProps: {
      name: "website",
      type: "text" as const,
      tabIndex: -1,
      autoComplete: "off",
      value: state.honeypot,
      onChange: (e: { target: { value: string } }) => ctl.setHoneypot(e.target.value),
    },
  };
}
