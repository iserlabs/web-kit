"use client";

import {
  type ChoiceStep,
  type CountStep,
  countUnit,
  type InquiryOption,
  useInquiryFlow,
} from "@iserlabs/web-kit/inquiry";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { inquiryFlow } from "@/content/inquiry-flow";

/**
 * Scaffolded by `web-kit inquiry init`. This file is the site's: art-direct it
 * (spacing, radius, type, motion) freely. The rules live in the hook; keep these
 * behaviors when you restyle:
 *  - real <button type="button"> with aria-pressed, at least 48px tall, full width
 *  - focus moves to each new question heading and the step scrolls into view
 *  - inputs are 16px or larger (smaller makes iOS Safari zoom the page)
 *  - errors sit beside the field; nothing is sticky or fixed
 *  - no color transition on answer buttons: mid-transition, a chosen answer's text
 *    crosses the fill color and reads as disabled (measured contrast 1.6:1)
 * Uses only the site's Tailwind theme tokens (no new fonts or colors).
 */

const TAP =
  "flex touch-manipulation min-h-12 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-base leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const TAP_ON = "border-primary bg-primary text-primary-foreground";
const TAP_OFF = "border-border bg-background text-foreground hover:bg-muted";
const FIELD =
  "block w-full min-w-0 min-h-12 rounded-md border border-input bg-background px-4 py-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";
const LINK =
  "inline-flex min-h-12 items-center text-base text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Choices({
  options,
  selected,
  onPick,
}: {
  options: readonly InquiryOption[];
  selected: readonly string[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-3">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.id)}
            className={`${TAP} ${on ? TAP_ON : TAP_OFF}`}
          >
            <span className="min-w-0">
              <span className="block">{o.label}</span>
              {o.hint ? (
                <span className={`mt-0.5 block text-sm ${on ? "opacity-90" : "text-muted-foreground"}`}>{o.hint}</span>
              ) : null}
            </span>
            <span aria-hidden="true" className="shrink-0 text-lg">
              {on ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-base font-medium text-foreground">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-base text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function InquiryFlow({ source }: { source?: string }) {
  const flow = useInquiryFlow(inquiryFlow, { source });
  const { step, stepIndex, errors, contact, status } = flow;
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  /* Each new screen: focus its heading and bring it into view. Not on first paint. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: run when the screen or status changes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = heading.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  }, [stepIndex, status]);

  if (status === "sent") {
    return (
      <section className="mx-auto w-full max-w-xl px-4 py-8" aria-live="polite">
        <h2 ref={heading} tabIndex={-1} className="scroll-mt-4 text-2xl leading-tight outline-none">
          Thank you. Your inquiry has arrived.
        </h2>
        <p className="mt-3 text-base text-muted-foreground">We will reply by email.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-6 pb-24" aria-label="Inquiry">
      <p className="text-sm text-muted-foreground">
        {step.kind !== "contact" ? `Question ${flow.progress.n} of ${flow.progress.total}` : "Last step"}
      </p>

      {flow.summaries.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {flow.summaries.map((s) => (
            <li key={s.stepId} className="flex items-center justify-between gap-3 px-4 py-1">
              <span className="min-w-0 py-2 text-base">
                <span className="block text-sm text-muted-foreground">{s.question}</span>
                <span className="block break-words">{s.answer || "Skipped"}</span>
              </span>
              <button type="button" onClick={() => flow.change(s.stepId)} className={LINK}>
                change
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {step.kind === "choice" ? (
        <ChoiceScreen step={step} flow={flow} headingRef={heading} />
      ) : step.kind === "count" ? (
        <CountScreen step={step} flow={flow} headingRef={heading} />
      ) : (
        <form
          noValidate
          className="relative mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void flow.submit();
          }}
        >
          <h2 ref={heading} tabIndex={-1} className="scroll-mt-4 text-2xl leading-tight outline-none">
            {step.heading}
          </h2>
          {step.intro ? <p className="mt-2 text-base text-muted-foreground">{step.intro}</p> : null}

          <Field id="inq-name" label={step.labels.name} error={errors.name}>
            <input
              id="inq-name"
              className={FIELD}
              type="text"
              name="name"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              value={contact.name}
              onChange={(e) => flow.setContact("name", e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "inq-name-error" : undefined}
            />
          </Field>
          <Field id="inq-email" label={step.labels.email} error={errors.email}>
            <input
              id="inq-email"
              className={FIELD}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              value={contact.email}
              onChange={(e) => flow.setContact("email", e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "inq-email-error" : undefined}
            />
          </Field>
          {step.fields.phone ? (
            <Field id="inq-phone" label={step.labels.phone} error={errors.phone}>
              <input
                id="inq-phone"
                className={FIELD}
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                value={contact.phone}
                onChange={(e) => flow.setContact("phone", e.target.value)}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "inq-phone-error" : undefined}
              />
            </Field>
          ) : null}
          {step.fields.date ? (
            <Field id="inq-date" label={step.labels.date} error={errors.date}>
              <input
                id="inq-date"
                className={FIELD}
                type="date"
                name="date"
                value={contact.date}
                onChange={(e) => flow.setContact("date", e.target.value)}
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? "inq-date-error" : undefined}
              />
            </Field>
          ) : null}
          {step.fields.message ? (
            <Field id="inq-message" label={step.labels.message} error={errors.message}>
              <textarea
                id="inq-message"
                className={`${FIELD} min-h-32`}
                name="message"
                rows={4}
                value={contact.message}
                onChange={(e) => flow.setContact("message", e.target.value)}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "inq-message-error" : undefined}
              />
            </Field>
          ) : null}

          {/* Honeypot: off-screen, hidden from people and screen readers. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Leave this empty
              <input {...flow.honeypotProps} />
            </label>
          </div>

          {status === "failed" && flow.failure ? (
            <p role="alert" className="mt-5 rounded-md border border-destructive p-4 text-base text-destructive">
              {flow.failure}
            </p>
          ) : null}

          <div className="mt-6 grid gap-2">
            <button type="submit" disabled={status === "sending"} className={`${PRIMARY} scroll-mb-24`}>
              {status === "sending" ? "Sending" : status === "failed" ? "Try again" : step.submitLabel}
            </button>
            {flow.canGoBack ? (
              <button type="button" onClick={flow.back} className={LINK}>
                Back
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}

function ChoiceScreen({
  step,
  flow,
  headingRef,
}: {
  step: ChoiceStep;
  flow: ReturnType<typeof useInquiryFlow>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const a = flow.answers[step.id];
  const chosen = a?.choices ?? [];
  const err = flow.errors[step.id];
  const needsNext = step.multi || !!step.followUp || step.optional;
  return (
    <div className="mt-6">
      <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-2xl leading-tight outline-none">
        {step.question}
      </h2>
      {step.help ? <p className="mt-2 text-base text-muted-foreground">{step.help}</p> : null}
      <Choices options={step.options} selected={chosen} onPick={(id) => flow.choose(step.id, id)} />

      {step.followUp && chosen.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-lg leading-snug">{step.followUp.question}</h3>
          {step.followUp.help ? <p className="mt-1 text-base text-muted-foreground">{step.followUp.help}</p> : null}
          <Choices
            options={step.followUp.options}
            selected={a?.followUp ?? []}
            onPick={(id) => flow.chooseFollowUp(step.id, id)}
          />
        </div>
      ) : null}

      {err ? (
        <p role="alert" className="mt-4 text-base text-destructive">
          {err}
        </p>
      ) : null}

      <div className="mt-6 grid gap-2">
        {needsNext ? (
          <button type="button" onClick={flow.next} className={PRIMARY}>
            Next
          </button>
        ) : null}
        {flow.canGoBack ? (
          <button type="button" onClick={flow.back} className={LINK}>
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* A number question: big minus and plus around an input you can also type in. */
function CountScreen({
  step,
  flow,
  headingRef,
}: {
  step: CountStep;
  flow: ReturnType<typeof useInquiryFlow>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const value = flow.answers[step.id]?.count ?? null;
  const min = step.min ?? 0;
  const max = step.max ?? 9999;
  /* What the visitor is typing, kept apart from the number so a half-typed value is never
     overwritten. null means "show the number itself", so the buttons update the box at once. */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  const err = flow.errors[step.id];
  const unit = countUnit(step, value);
  const inputId = `inq-${step.id}`;

  const bump = (d: 1 | -1) => {
    setDraft(null);
    flow.bumpCount(step.id, d);
  };
  return (
    <div className="mt-6">
      <h2 id={`${inputId}-q`} ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-2xl leading-tight outline-none">
        {step.question}
      </h2>
      {step.help ? <p className="mt-2 text-base text-muted-foreground">{step.help}</p> : null}
      <div className="mt-4 flex items-stretch gap-3">
        <button
          type="button"
          aria-label={`Decrease: ${step.question}`}
          disabled={value !== null && value <= min}
          onClick={() => bump(-1)}
          className="inline-flex min-h-14 w-14 shrink-0 touch-manipulation items-center justify-center rounded-md border border-border bg-background text-3xl leading-none text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <span aria-hidden="true">{"\u2212"}</span>
        </button>
        <input
          id={inputId}
          className="block w-full min-w-0 min-h-14 flex-1 rounded-md border border-input bg-background px-2 py-3 text-center text-2xl text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="next"
          aria-labelledby={`${inputId}-q`}
          aria-invalid={!!err}
          aria-describedby={err ? `${inputId}-error` : undefined}
          value={shown}
          onChange={(e) => {
            const text = e.target.value.replace(min < 0 ? /[^\d-]/g : /\D/g, "");
            setDraft(text);
            flow.setCount(step.id, text === "" || text === "-" ? null : Number(text));
          }}
          onBlur={() => setDraft(null)}
        />
        <button
          type="button"
          aria-label={`Increase: ${step.question}`}
          disabled={value !== null && value >= max}
          onClick={() => bump(1)}
          className="inline-flex min-h-14 w-14 shrink-0 touch-manipulation items-center justify-center rounded-md border border-border bg-background text-3xl leading-none text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {unit ? <p className="mt-2 text-center text-base text-muted-foreground">{unit}</p> : null}
      {err ? (
        <p id={`${inputId}-error`} role="alert" className="mt-4 text-base text-destructive">
          {err}
        </p>
      ) : null}
      <div className="mt-6 grid gap-2">
        <button type="button" onClick={flow.next} className={PRIMARY}>
          Next
        </button>
        {flow.canGoBack ? (
          <button type="button" onClick={flow.back} className={LINK}>
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}
