import type { ZodType } from "zod";

export interface ContactSender {
  send(message: { to: string; from: string; subject: string; text: string }): Promise<{ id: string }>;
}

export interface ContactHandlerOptions<T> {
  schema: ZodType<T>;
  to: string;
  from: string;
  sender: ContactSender;
  text: (data: T) => string;
  subject?: (data: T) => string;
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
        (errors[key] ??= []).push(issue.message);
      }
      return { ok: false, errors };
    }
    const { id } = await opts.sender.send({
      to: opts.to,
      from: opts.from,
      subject: opts.subject ? opts.subject(parsed.data) : "New contact form submission",
      text: opts.text(parsed.data),
    });
    return { ok: true, id };
  };
}
