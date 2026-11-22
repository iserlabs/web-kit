import { type ContactResult, type ContactSender, createContactHandler } from "../forms/index";
import {
  answerSteps,
  buildPayload,
  contactStep,
  localToday,
  looksAutomated,
  validateChoice,
  validateContact,
} from "./core";
import type { ContactValues, InquiryConfig, InquiryPayload } from "./types";

type Parsed =
  | { success: true; data: InquiryPayload }
  | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * A schema (anything with `safeParse`) for this config's payload. It rebuilds the
 * summary from the config's own words, so a client cannot put its own text in the email.
 * Needs no zod.
 */
export function inquirySchema(config: InquiryConfig, today: () => string = localToday) {
  const cs = contactStep(config);
  return {
    safeParse(input: unknown): Parsed {
      const issues: { path: (string | number)[]; message: string }[] = [];
      const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
      const rawContact = (o.contact && typeof o.contact === "object" ? o.contact : {}) as Record<
        string,
        unknown
      >;
      const contact: ContactValues = {
        name: str(rawContact.name),
        email: str(rawContact.email),
        phone: str(rawContact.phone),
        date: str(rawContact.date),
        message: str(rawContact.message),
      };
      const rawAnswers = Array.isArray(o.answers) ? o.answers : [];
      const answers: Record<
        string,
        { choices: string[]; followUp: string[]; count?: number | null }
      > = {};
      for (const s of answerSteps(config)) {
        const found = rawAnswers.find(
          (a) => a && typeof a === "object" && (a as { stepId?: unknown }).stepId === s.id,
        ) as { choices?: unknown; followUp?: { choices?: unknown }; count?: unknown } | undefined;
        if (s.kind === "count") {
          const n =
            typeof found?.count === "number" && Number.isFinite(found.count) ? found.count : null;
          const a = { choices: [], followUp: [], count: n };
          for (const [k, m] of Object.entries(validateChoice(s, a, cs)))
            issues.push({ path: [k], message: m });
          answers[s.id] = a;
          continue;
        }
        const ids = (v: unknown) =>
          Array.isArray(v)
            ? v.map((x) => (x && typeof x === "object" ? str((x as { id?: unknown }).id) : str(x)))
            : [];
        const choices = ids(found?.choices).filter((id) => s.options.some((opt) => opt.id === id));
        const followUp = ids(found?.followUp?.choices).filter((id) =>
          s.followUp?.options.some((opt) => opt.id === id),
        );
        if (!s.multi && choices.length > 1)
          issues.push({ path: [s.id], message: "Pick one answer." });
        if (!s.optional && choices.length === 0)
          issues.push({ path: [s.id], message: "Please pick an answer." });
        answers[s.id] = { choices, followUp };
      }
      const fe = validateContact(cs, contact, config, today());
      for (const [k, m] of Object.entries(fe)) issues.push({ path: ["contact", k], message: m });
      if (issues.length) return { success: false, error: { issues } };
      const data = buildPayload(config, answers, contact, {
        website: str(o.website),
        elapsedMs: typeof o.elapsedMs === "number" ? o.elapsedMs : 0,
        source: typeof o.source === "string" ? o.source.slice(0, 300) : undefined,
      });
      return { success: true, data };
    },
  };
}

export interface InquiryHandlerOptions {
  config: InquiryConfig;
  to: string;
  from: string;
  sender: ContactSender;
  subject?: (data: InquiryPayload) => string;
  onSuccess?: (data: InquiryPayload, id: string) => void | Promise<void>;
  onSendError?: (data: InquiryPayload, err: unknown) => void | Promise<void>;
  today?: () => string;
}

/**
 * Validates an inquiry payload and emails its summary lines through the same
 * sender interface as `createContactHandler`. A honeypot or too-fast send answers
 * `{ ok: true }` and sends nothing.
 */
export function createInquiryHandler(opts: InquiryHandlerOptions) {
  const inner = createContactHandler<InquiryPayload>({
    schema: inquirySchema(opts.config, opts.today),
    to: opts.to,
    from: opts.from,
    sender: opts.sender,
    subject: opts.subject ?? ((d) => `New inquiry from ${d.contact.name}`),
    text: (d) => [...d.summary, ...(d.source ? [`Sent from: ${d.source}`] : [])].join("\n"),
    onSuccess: opts.onSuccess,
    onSendError: opts.onSendError,
  });
  const schema = inquirySchema(opts.config, opts.today);
  return async function handle(input: unknown): Promise<ContactResult> {
    const parsed = schema.safeParse(input);
    if (parsed.success && looksAutomated(opts.config, parsed.data))
      return { ok: true, id: "dropped" };
    return inner(input);
  };
}

/**
 * A Next.js route handler: `export const POST = createInquiryRoute({...})`.
 * 400 with `{ ok:false, errors }` for bad input, 502 when the email fails to send.
 */
export function createInquiryRoute(opts: InquiryHandlerOptions & { maxBytes?: number }) {
  const handle = createInquiryHandler(opts);
  const max = opts.maxBytes ?? 20_000;
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > max) return json({ ok: false, errors: { _: ["Too large."] } }, 413);
      body = JSON.parse(text);
    } catch {
      return json({ ok: false, errors: { _: ["Unreadable request."] } }, 400);
    }
    try {
      const res = await handle(body);
      return res.ok ? json({ ok: true }, 200) : json(res, 400);
    } catch {
      return json({ ok: false, errors: { _: ["Could not send."] } }, 502);
    }
  };
}
