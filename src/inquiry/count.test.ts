import { describe, expect, it, vi } from "vitest";
import { createInquiryController } from "./controller";
import { defineInquiry } from "./core";
import { createInquiryHandler, inquirySchema } from "./server";
import type { InquiryAnswers, InquiryConfig } from "./types";

const contact = {
  kind: "contact" as const,
  id: "contact",
  heading: "Contact",
  fields: {},
  labels: { name: "Name", email: "Email", phone: "P", date: "D", message: "M" },
  submitLabel: "Send",
};
const config = defineInquiry({
  endpoint: "/x",
  failureMessage: "no",
  minFillMs: 0,
  steps: [
    {
      kind: "count",
      id: "listings",
      question: "How many listings?",
      min: 1,
      max: 50,
      step: 1,
      default: 10,
      unit: { one: "listing", other: "listings" },
    },
    {
      kind: "count",
      id: "guests",
      question: "How many guests?",
      min: 0,
      max: 20,
      step: 2,
      optional: true,
    },
    { kind: "count", id: "beds", question: "Bedrooms?", min: 2, max: 9 },
    contact,
  ],
}) as InquiryConfig;

const make = (onChange?: (a: InquiryAnswers) => void) =>
  createInquiryController(config, { now: () => 0, today: () => "2026-10-23", onChange });
const count = (c: ReturnType<typeof make>, id: string) => c.getState().answers[id]?.count;

describe("count step", () => {
  it("starts at its default, or empty without one", () => {
    const c = make();
    expect(count(c, "listings")).toBe(10);
    expect(count(c, "guests")).toBeNull();
  });

  it("plus five times then minus twice, from the default", () => {
    const c = make();
    for (let i = 0; i < 5; i++) c.bumpCount("listings", 1);
    expect(count(c, "listings")).toBe(15);
    c.bumpCount("listings", -1);
    c.bumpCount("listings", -1);
    expect(count(c, "listings")).toBe(13);
  });

  it("never leaves min and max with the buttons", () => {
    const c = make();
    for (let i = 0; i < 80; i++) c.bumpCount("listings", 1);
    expect(count(c, "listings")).toBe(50);
    for (let i = 0; i < 80; i++) c.bumpCount("listings", -1);
    expect(count(c, "listings")).toBe(1);
  });

  it("moves by the step size, and the first tap from empty lands on min", () => {
    const c = make();
    c.bumpCount("guests", 1);
    expect(count(c, "guests")).toBe(0);
    c.bumpCount("guests", 1);
    c.bumpCount("guests", 1);
    expect(count(c, "guests")).toBe(4);
  });

  it("typing may pass through out-of-range values; Next refuses them in plain words", () => {
    const c = make();
    c.setCount("listings", 99);
    c.next();
    expect(c.getState().index).toBe(0);
    expect(c.getState().errors.listings).toMatch(/1 to 50/);
    c.setCount("listings", 0);
    c.next();
    expect(c.getState().index).toBe(0);
    c.setCount("listings", 12);
    expect(c.getState().errors.listings).toBeUndefined();
    c.next();
    expect(c.getState().index).toBe(1);
  });

  it("required needs a number, optional may stay empty", () => {
    const c = make();
    c.next(); // listings has its default
    c.next(); // guests is optional
    expect(c.getState().index).toBe(2);
    c.next(); // beds is required and empty
    expect(c.getState().index).toBe(2);
    expect(c.getState().errors.beds).toBeTruthy();
    c.setCount("beds", null);
    c.next();
    expect(c.getState().index).toBe(2);
    c.bumpCount("beds", 1);
    expect(count(c, "beds")).toBe(2);
    c.next();
    expect(c.getState().index).toBe(3);
  });

  it("a non-number is treated as empty", () => {
    const c = make();
    c.setCount("listings", Number.NaN);
    expect(count(c, "listings")).toBeNull();
  });

  it("onChange hears every change with the live value", () => {
    const seen: (number | null | undefined)[] = [];
    const c = make((a) => seen.push(a.listings?.count));
    c.bumpCount("listings", 1);
    c.bumpCount("listings", 1);
    c.setCount("listings", 20);
    expect(seen).toEqual([11, 12, 20]);
  });

  it("the summary line reads 'Question: 12 listings', singular for one", () => {
    const c = make();
    c.setCount("listings", 12);
    c.setCount("beds", 3);
    c.setCount("guests", 1);
    const p = c.payload();
    expect(p.summary).toContain("How many listings?: 12 listings");
    expect(p.summary).toContain("Bedrooms?: 3");
    expect(p.answers.find((a) => a.stepId === "listings")).toMatchObject({
      count: 12,
      choices: [],
    });
    c.setCount("listings", 1);
    expect(c.payload().summary).toContain("How many listings?: 1 listing");
  });

  it("an empty optional count is left out of the summary", () => {
    const c = make();
    c.setCount("beds", 3);
    expect(c.payload().summary.join("\n")).not.toContain("guests");
  });

  it("defineInquiry rejects a bad count step", () => {
    const bad = (over: object) =>
      defineInquiry({
        ...config,
        steps: [{ kind: "count", id: "n", question: "?", ...over }, contact],
      } as InquiryConfig);
    expect(() => bad({ min: 5, max: 2 })).toThrow(/min above max/);
    expect(() => bad({ step: 0 })).toThrow(/step above zero/);
    expect(() => bad({ min: 1, max: 5, default: 9 })).toThrow(/default/);
    expect(() => bad({})).not.toThrow();
  });
});

describe("count step on the server", () => {
  const good = (over: object = {}) => ({
    answers: [
      { stepId: "listings", count: 12 },
      { stepId: "beds", count: 3 },
    ],
    contact: { name: "Ana", email: "ana@example.com" },
    website: "",
    elapsedMs: 5000,
    ...over,
  });
  const schema = inquirySchema(config, () => "2026-10-23");

  it("accepts in-range counts and rebuilds the summary from the config", () => {
    const r = schema.safeParse(good());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.summary).toContain("How many listings?: 12 listings");
  });

  it("refuses out-of-range, missing and non-numeric counts, naming the step", () => {
    for (const bad of [
      [
        { stepId: "listings", count: 51 },
        { stepId: "beds", count: 3 },
      ],
      [
        { stepId: "listings", count: 0 },
        { stepId: "beds", count: 3 },
      ],
      [{ stepId: "listings", count: 12 }],
      [
        { stepId: "listings", count: "12" },
        { stepId: "beds", count: 3 },
      ],
    ]) {
      const r = schema.safeParse(good({ answers: bad }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("emails the count line", async () => {
    const send = vi.fn(async () => ({ id: "1" }));
    const handle = createInquiryHandler({
      config,
      to: "o@x.com",
      from: "n@x.com",
      sender: { send },
      today: () => "2026-10-23",
    });
    expect((await handle(good())).ok).toBe(true);
    expect((send.mock.calls[0] as unknown as [{ text: string }])[0].text).toContain("12 listings");
  });
});
