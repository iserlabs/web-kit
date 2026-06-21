import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createContactHandler } from "../index";

const schema = z.object({ email: z.string().email() });

describe("createContactHandler observation hooks", () => {
  it("calls onSuccess with data + id after a successful send", async () => {
    const onSuccess = vi.fn();
    const handle = createContactHandler({
      schema,
      to: "o@x.com",
      from: "n@x.com",
      sender: { send: async () => ({ id: "msg-1" }) },
      text: () => "body",
      onSuccess,
    });
    const res = await handle({ email: "a@b.com" });
    expect(res).toEqual({ ok: true, id: "msg-1" });
    expect(onSuccess).toHaveBeenCalledWith({ email: "a@b.com" }, "msg-1");
  });

  it("calls onSendError and rethrows when the sender fails", async () => {
    const onSendError = vi.fn();
    const handle = createContactHandler({
      schema,
      to: "o@x.com",
      from: "n@x.com",
      sender: {
        send: async () => {
          throw new Error("resend down");
        },
      },
      text: () => "body",
      onSendError,
    });
    await expect(handle({ email: "a@b.com" })).rejects.toThrow("resend down");
    expect(onSendError).toHaveBeenCalledTimes(1);
    expect(onSendError.mock.calls[0][0]).toEqual({ email: "a@b.com" });
  });

  it("does not call hooks on a validation failure", async () => {
    const onSuccess = vi.fn();
    const onSendError = vi.fn();
    const handle = createContactHandler({
      schema,
      to: "o@x.com",
      from: "n@x.com",
      sender: { send: async () => ({ id: "x" }) },
      text: () => "body",
      onSuccess,
      onSendError,
    });
    const res = await handle({ email: "not-an-email" });
    expect(res.ok).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSendError).not.toHaveBeenCalled();
  });
});
