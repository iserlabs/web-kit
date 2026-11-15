import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  composeConfirmation,
  composeEmail,
  confirmationBlocks,
  deliver,
  emailSubject,
  formatLongDate,
  lintMessage,
  mailSwitch,
  makeReference,
} from "./index.mjs";
import { writePreviews } from "./preview.mjs";

const brand = {
  business: "Example Stays",
  config: {
    siteUrl: "https://example.test",
    wordmark: "Example Stays",
    tagline: "Stays",
    markUrl: "https://example.test/mark.png",
    markAlt: "Example Stays",
    displayFont: "Georgia, serif",
    bodyFont: "Helvetica, Arial, sans-serif",
    ink: "#14201c",
    ground: "#fcfdfc",
    brand: "#6b8f80",
    accent: "#2e5a4d",
    people: [],
    letterhead: { textHeader: true, paper: "#fcfdfc", surround: "#e3ebe7" },
  },
  person: { name: "Example Stays", title: "Team", email: "hello@example.test" },
  from: "Example Stays <hello@example.test>",
  replyTo: "hello@example.test",
};

const content = {
  brand,
  to: "guest@example.org",
  kind: "Inquiry received",
  recipientName: "Maria Lopez",
  date: new Date("2026-11-14T15:00:00Z"),
  lead: "We received your inquiry about a monthly stay.",
  received: [["Dates", "December 1 to January 5"] as [string, string]],
  reference: makeReference("INQ", "2026-11-14", "guest@example.org"),
  next: ["We read it today.", "You get a reply within one business day."],
  replyLine: "Reply to this email and a person answers it.",
};

describe("subject", () => {
  it("follows Business | what | name, Month D, YYYY", () => {
    expect(
      emailSubject({
        business: "Example Stays",
        kind: "Inquiry received",
        who: "Maria Lopez",
        date: new Date("2026-11-14T15:00:00Z"),
      }),
    ).toBe("Example Stays | Inquiry received | Maria Lopez, November 14, 2026");
  });

  it("falls back to the reference when there is no name", () => {
    expect(
      emailSubject({ business: "B", kind: "K", reference: "INQ-261114-ABCDE", date: "2026-11-14" }),
    ).toBe("B | K | INQ-261114-ABCDE, November 14, 2026");
  });

  it("uses the business's own time zone, so 9 PM Eastern is still the same day", () => {
    expect(formatLongDate(new Date("2026-11-15T02:30:00Z"))).toBe("November 14, 2026");
    expect(formatLongDate("2026-11-14")).toBe("November 14, 2026");
  });

  it("strips pipes so the three-part shape cannot break", () => {
    const s = emailSubject({ business: "A | B", kind: "K", who: "x | y", date: "2026-01-02" });
    expect(s.split(" | ")).toHaveLength(3);
  });

  it("refuses a subject with nothing to search for", () => {
    expect(() => emailSubject({ business: "B", kind: "K", date: "2026-01-02" })).toThrow();
  });
});

describe("reference", () => {
  it("is stable for the same seed and day, and different for another seed", () => {
    const a = makeReference("INQ", "2026-11-14", "a@x.org");
    expect(a).toBe(makeReference("INQ", "2026-11-14", "a@x.org"));
    expect(a).not.toBe(makeReference("INQ", "2026-11-14", "b@x.org"));
    expect(a).toMatch(/^INQ-261114-[0-9A-HJKMNP-TV-Z]{5}$/);
  });
});

describe("switch", () => {
  it("is off unless the variable is explicitly on", () => {
    expect(mailSwitch({}, "X").on).toBe(false);
    expect(mailSwitch({ X: "" }, "X").on).toBe(false);
    expect(mailSwitch({ X: "maybe" }, "X").on).toBe(false);
    expect(mailSwitch({ X: "0" }, "X").on).toBe(false);
    expect(mailSwitch({ X: "1" }, "X").on).toBe(true);
    expect(mailSwitch({ X: " TRUE " }, "X").on).toBe(true);
  });

  it("deliver hands nothing over while off, and is loud when on without a key", async () => {
    const transport = vi.fn();
    const msg = composeConfirmation(content);
    expect(await deliver(msg, { switchOn: false, transport })).toEqual({ status: "off" });
    expect(transport).not.toHaveBeenCalled();
    expect(await deliver(msg, { switchOn: true, configured: false, transport })).toEqual({
      status: "not_configured",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("deliver hands over once when on, and reports a failure without throwing", async () => {
    const msg = composeConfirmation(content);
    const ok = vi.fn().mockResolvedValue({ id: "1" });
    expect((await deliver(msg, { switchOn: true, transport: ok })).status).toBe("delivered");
    expect(ok).toHaveBeenCalledTimes(1);
    const bad = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await deliver(msg, { switchOn: true, transport: bad })).toEqual({
      status: "failed",
      error: "boom",
    });
  });
});

describe("confirmation", () => {
  const msg = composeConfirmation(content);

  it("meets the standard", () => {
    expect(lintMessage(msg)).toEqual([]);
  });

  it("carries the reference, what happens next and who replies, in both parts", () => {
    for (const part of [msg.html, msg.text]) {
      expect(part).toContain(content.reference);
      expect(part).toContain("You get a reply within one business day.");
      expect(part).toContain("a person answers it");
    }
    expect(msg.text).toContain("1) We read it today.");
    expect(msg.headers["X-Entity-Ref-ID"]).toBe(content.reference);
  });

  it("has a plain-text part, light only, a 600px column, and the name as real text", () => {
    expect(msg.text.length).toBeGreaterThan(50);
    expect(msg.html).toContain('content="light only"');
    expect(msg.html).toContain("max-width:600px");
    expect(msg.html).toContain(">Example Stays</a>");
    expect(msg.html).not.toMatch(/prefers-color-scheme/);
  });

  it("stays far under the Gmail clip", () => {
    expect(Buffer.byteLength(msg.html)).toBeLessThan(40 * 1024);
  });

  it("escapes what a visitor typed", () => {
    const hostile = composeConfirmation({
      ...content,
      recipientName: "<script>alert(1)</script>",
      lead: "We received <b>this</b>.",
    });
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).not.toContain("<b>this</b>");
  });

  it("greets without a name when there is none", () => {
    expect(confirmationBlocks({ lead: "Got it." })[0]).toEqual({ type: "p", text: "Hello," });
  });
});

describe("lint", () => {
  const base = composeConfirmation(content);
  const dash = String.fromCharCode(8212);

  it("catches an em dash, an exclamation mark, a bad subject and a missing text part", () => {
    const codes = lintMessage({
      ...base,
      subject: "Hi!",
      text: `Thanks ${dash} done!`,
    }).map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["subject-shape", "em-dash", "exclamation"]));
    expect(lintMessage({ ...base, text: "" }).map((f) => f.code)).toContain("no-text-part");
  });

  it("catches a dark-mode style, an image without alt and an oversized body", () => {
    const html = `${base.html}<style>@media (prefers-color-scheme: dark){}</style><img src="x">${"a".repeat(95_000)}`;
    const codes = lintMessage({ ...base, html }).map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["dark-mode", "img-alt", "gmail-clip"]));
  });

  it("flags a phone number, and a number it was told to ban", () => {
    const text = `${base.text}\nCall 555-123-4567`;
    expect(lintMessage({ ...base, text }).map((f) => f.code)).toContain("phone");
    expect(
      lintMessage({ ...base, text }, { bannedPhones: ["(555) 123-4567"] }).map((f) => f.code),
    ).toContain("banned-phone");
  });
});

describe("compose", () => {
  it("refuses to compose without a recipient", () => {
    expect(() =>
      composeEmail({
        brand,
        to: "",
        kind: "K",
        who: "A",
        date: "2026-11-14",
        blocks: [{ type: "p", text: "x" }],
      }),
    ).toThrow();
  });
});

describe("previews", () => {
  it("writes html, text and a report for each email", () => {
    const dir = mkdtempSync(join(tmpdir(), "mail-previews-"));
    const report = writePreviews(dir, [{ name: "inquiry", message: composeConfirmation(content) }]);
    expect(report[0]?.findings).toEqual([]);
    expect(readFileSync(join(dir, "inquiry.txt"), "utf8")).toContain("Subject: Example Stays |");
    expect(readFileSync(join(dir, "inquiry.html"), "utf8")).toContain("<!doctype html>");
  });
});
