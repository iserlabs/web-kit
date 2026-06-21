import type { ZodType } from "zod";

export interface ContactSender {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text: string;
  }): Promise<{ id: string }>;
}

export interface ContactHandlerOptions<T> {
  schema: ZodType<T>;
  to: string;
  from: string;
  sender: ContactSender;
  text: (data: T) => string;
  subject?: (data: T) => string;
  /** Observation seam for the observability lead rail. Wire `notifyLead`
   *  here to announce a successful submission. Never imports observability —
   *  the caller passes the callback, keeping the dependency one-way. */
  onSuccess?: (data: T, id: string) => void | Promise<void>;
  /** Wire `notify({ severity: "critical" })` here to alert on a failed send.
   *  The error still propagates after the hook runs. */
  onSendError?: (data: T, err: unknown) => void | Promise<void>;
}

export type ContactResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string[]> };

export function createContactHandler<T>(opts: ContactHandlerOptions<T>) {
  return async function handle(input: unknown): Promise<ContactResult> {
    const parsed = opts.schema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        const existing = errors[key] ?? [];
        existing.push(issue.message);
        errors[key] = existing;
      }
      return { ok: false, errors };
    }
    let id: string;
    try {
      ({ id } = await opts.sender.send({
        to: opts.to,
        from: opts.from,
        subject: opts.subject ? opts.subject(parsed.data) : "New contact form submission",
        text: opts.text(parsed.data),
      }));
    } catch (err) {
      // Observation seam: let the caller alert (notify) before the error
      // propagates. The hook must not swallow the failure.
      await opts.onSendError?.(parsed.data, err);
      throw err;
    }
    await opts.onSuccess?.(parsed.data, id);
    return { ok: true, id };
  };
}
