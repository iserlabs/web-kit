import { describe, expect, it } from "vitest";
import { scrubEvent, scrubObject, scrubPii } from "../scrub";

describe("scrubPii", () => {
  it("redacts emails and phones in free text", () => {
    expect(scrubPii("reach me at a@b.com or 201-555-0142")).toBe("reach me at [email] or [phone]");
  });
});

describe("scrubObject", () => {
  it("redacts known PII keys case-insensitively, leaves others", () => {
    expect(scrubObject({ Email: "a@b.com", count: 3 })).toEqual({
      Email: "[REDACTED]",
      count: 3,
    });
  });
});

describe("scrubEvent", () => {
  it("scrubs extra by key and message/exception by regex", () => {
    const event = scrubEvent({
      extra: { email: "a@b.com", ok: 1 },
      message: "failed for a@b.com",
      exception: { values: [{ value: "smtp rejected 201-555-0142" }] },
    });
    expect(event.extra).toEqual({ email: "[REDACTED]", ok: 1 });
    expect(event.message).toBe("failed for [email]");
    expect(event.exception?.values?.[0]?.value).toBe("smtp rejected [phone]");
  });
});
