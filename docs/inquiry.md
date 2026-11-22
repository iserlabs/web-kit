# `@iserlabs/web-kit/inquiry`

A one-question-per-screen inquiry flow: big tap-to-choose answers, an answered step folds to a summary line with a "change" link, a short contact step, one send button, a success state. No prices, no recommendations. The logic lives in the kit; the look and every word live in the site.

## Install in a site

1) `package.json`: pin the kit at the release that has it, then `pnpm install`.

```json
"@iserlabs/web-kit": "github:iserlabs/web-kit#v0.12.0"
```

2) Scaffold:

```
pnpm exec web-kit inquiry init
```

It writes `src/components/inquiry/inquiry-flow.tsx` (the UI, Tailwind theme tokens only) and `src/content/inquiry-flow.ts` (an example config), never overwrites an existing file, and prints the route snippet. A site without a `src` folder gets the same paths at its root.

3) Edit `src/content/inquiry-flow.ts`: your questions, options, contact labels and failure sentence.

4) Add the route, for example `src/app/api/inquiry/route.ts`:

```ts
import { createInquiryRoute } from "@iserlabs/web-kit/inquiry";
import { inquiryFlow } from "@/content/inquiry-flow";
import { sender } from "@/lib/mail"; // { send({ to, from, subject, text }) => Promise<{ id }> }

export const POST = createInquiryRoute({
  config: inquiryFlow,
  to: process.env.LEAD_TO_EMAIL ?? "",
  from: process.env.LEAD_FROM_EMAIL ?? "",
  sender,
});
```

5) Render `<InquiryFlow source="/plan-your-stay" />` on the inquiry page, and point every call to action at it. Set the sender's env vars (`LEAD_TO_EMAIL`, your mail key) before deploy: an unset key must not look like success.

React 19 is an optional peer dependency (needed only for the hook).

## Config

```ts
export const inquiryFlow = defineInquiry({
  endpoint: "/api/inquiry",
  failureMessage: "We could not send that. Please email hello@yoursite.com.",
  steps: [
    { kind: "choice", id: "size", question: "How many people?", multi: false, optional: false,
      options: [{ id: "1-2", label: "1 to 2", hint: "optional" }],
      followUp: { question: "Anything more specific?", multi: true, options: [/* ... */] } },
    { kind: "contact", id: "contact", heading: "How can we reach you?",
      fields: { phone: true, date: true, message: "required" }, // false | true | "required"
      labels: { name: "Your name", email: "Email", phone: "Phone", date: "Date", message: "Message" },
      submitLabel: "Send" },
  ],
});
```

### Count step: a question answered with a number

```ts
{ kind: "count", id: "listings", question: "How many listings?", help: "Tap or type.",
  min: 1, max: 50, step: 1, default: 10, optional: false,
  unit: { one: "listing", other: "listings" } }   // or a plain string, or leave it out
```

Large minus and plus buttons (56 px, real buttons with aria-labels) around a numeric box (`inputMode="numeric"`, 24 px, typing allowed). `min` defaults to 0, `max` to 9999, `step` to 1. With a `default` the box starts there; without one it starts empty and the first tap lands on `min`. The buttons stay inside min and max; a typed value outside them is refused on Next with "Please enter a number from 1 to 50." (override with the contact step's `errors.count`). Required unless `optional: true`. The summary line reads "How many listings?: 12 listings" ("1 listing" for one). The server checks the number against the same min and max.

A live figure (for example a worked quote): read `flow.answers.listings?.count` on every render, or pass `useInquiryFlow(config, { onChange: (answers) => ... })`, which fires after every tap, typed digit or choice with all answers so far.

Rules `defineInquiry` enforces: choice and count steps first, exactly one contact step last, unique step ids, unique option ids. Optional: `autoAdvance` (default true: a single-choice step with no follow-up moves on at the tap), `minFillMs` (default 2500), `maxMessageLength` (default 2000), per-field `errors` text on the contact step.

## Hook

`useInquiryFlow(config, { source?, fetcher?, onChange? })` returns:

- `step`, `stepIndex`, `isContact`, `progress: { n, total }`
- `answers`, `summaries` (earlier steps as `{ stepId, question, answer }`), `contact`, `errors`
- `choose(stepId, optionId)`, `chooseFollowUp(stepId, optionId)`, `setCount(stepId, number | null)`, `bumpCount(stepId, 1 | -1)`, `next()`, `back()`, `change(stepId)`, `setContact(field, value)`
- `submit()` returns `"sent" | "failed" | "invalid" | "ignored"`; `status` is `idle | sending | sent | failed`; `failure` is the config's `failureMessage` when failed; `retry()`
- `buildPayload()`: `{ answers, contact, summary, website, elapsedMs, source }`, where `summary` is the "Question: answer" lines
- `honeypotProps`: spread onto a hidden input. A filled honeypot, or a send sooner than `minFillMs`, looks sent to the visitor and posts nothing; the server drops both too.

The same logic runs without React through `createInquiryController(config, deps)`.

## Server

`createInquiryHandler({ config, to, from, sender, subject?, onSuccess?, onSendError? })` reuses `createContactHandler` from `@iserlabs/web-kit/forms`, validates the payload against the config (unknown option ids are refused) and rebuilds the email's summary lines from the config's own words, never from client text. `createInquiryRoute` wraps it as a `POST(Request)` that answers 200, 400 with field errors, 413, or 502 when the send fails. `createContactHandler` now takes any schema with `safeParse` (a zod schema still fits). Rate limiting stays the site's job.

## Mobile rules the scaffolded UI keeps (keep them when you restyle)

Full-width `<button type="button" aria-pressed>` answers at least 48px tall; focus moves to each new heading and the step scrolls into view (instantly under reduced motion); inputs are 16px or larger; `type`, `autoComplete` and `inputMode` set for name, email and phone; errors beside the field; no sticky or fixed elements, so the send button scrolls above the keyboard; `min-w-0` and wrapping so nothing scrolls sideways at 320px.
