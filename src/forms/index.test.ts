import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createContactHandler } from "./index";

const schema = z.object({ name: z.string().min(1), email: z.string().email() });

function fakeSender() {
  return { send: vi.fn().mockResolvedValue({ id: "msg_1" }) };
}

describe("createContactHandler", () => {
  it("sends and returns ok on valid input", async () => {
    const sender = fakeSender();
    const handle = createContactHandler({
      schema,
      to: "to@x.com",
      from: "from@x.com",
      sender,
      text: (d) => `From ${d.name} <${d.email}>`,
    });
    const res = await handle({ name: "Kev", email: "k@x.com" });
    expect(res).toEqual({ ok: true, id: "msg_1" });
    expect(sender.send).toHaveBeenCalledWith({
      to: "to@x.com",
      from: "from@x.com",
      subject: "New contact form submission",
      text: "From Kev <k@x.com>",
    });
  });

  it("returns field errors and does not send on invalid input", async () => {
    const sender = fakeSender();
    const handle = createContactHandler({
      schema,
      to: "to@x.com",
      from: "from@x.com",
      sender,
      text: () => "x",
    });
    const res = await handle({ name: "", email: "nope" });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(Object.keys(res.errors)).toEqual(expect.arrayContaining(["name", "email"]));
    }
    expect(sender.send).not.toHaveBeenCalled();
  });
});
