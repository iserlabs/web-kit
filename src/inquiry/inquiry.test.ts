import { describe, expect, it, vi } from "vitest";
import { createInquiryController } from "./controller";
import { buildPayload, defineInquiry, localToday, validateContact } from "./core";
import { fixture } from "./fixture";
import { createInquiryHandler, createInquiryRoute, inquirySchema } from "./server";
import type { InquiryConfig } from "./types";

const TODAY = "2026-10-23";
function make(over: { fetcher?: any; t?: { v: number } } = {}) {
  const t = over.t ?? { v: 0 };
  const ctl = createInquiryController(fixture, {
    now: () => t.v,
    today: () => TODAY,
    fetcher: over.fetcher,
  });
  return { ctl, t };
}
function fillAnswers(ctl: ReturnType<typeof make>["ctl"]) {
  ctl.choose("kind", "a");
  ctl.next();
  ctl.choose("size", "m"); // single, no follow-up: auto-advances
}
const goodContact = {
  name: " Ana Lee ",
  email: "ana@example.com",
  phone: "(555) 123-4567",
  date: "2026-12-01",
  message: "Hi",
};
function fillContact(ctl: ReturnType<typeof make>["ctl"], c = goodContact) {
  for (const [k, v] of Object.entries(c)) ctl.setContact(k as any, v);
}

describe("step logic", () => {
  it("starts on step 1 and refuses to advance unanswered", () => {
    const { ctl } = make();
    ctl.next();
    expect(ctl.getState().index).toBe(0);
    expect(ctl.getState().errors.kind).toMatch(/pick/i);
  });

  it("single choice with a follow-up waits for Next; single without follow-up auto-advances", () => {
    const { ctl } = make();
    ctl.choose("kind", "a");
    expect(ctl.getState().index).toBe(0);
    ctl.next();
    expect(ctl.getState().index).toBe(1);
    ctl.choose("size", "s");
    expect(ctl.getState().index).toBe(2);
  });

  it("single choice replaces, tapping the same one clears", () => {
    const { ctl } = make();
    ctl.choose("kind", "a");
    ctl.choose("kind", "b");
    expect(ctl.getState().answers.kind?.choices).toEqual(["b"]);
    ctl.choose("kind", "b");
    expect(ctl.getState().answers.kind?.choices).toEqual([]);
  });

  it("multi toggles, ignores unknown ids, optional step passes empty", () => {
    const { ctl } = make();
    fillAnswers(ctl);
    ctl.choose("extras", "p");
    ctl.choose("extras", "q");
    ctl.choose("extras", "p");
    ctl.choose("extras", "nope");
    expect(ctl.getState().answers.extras?.choices).toEqual(["q"]);
    ctl.choose("extras", "q");
    ctl.next();
    expect(ctl.getState().index).toBe(3);
  });

  it("changing an earlier step returns to where you were", () => {
    const { ctl } = make();
    fillAnswers(ctl);
    ctl.change("kind");
    expect(ctl.getState().index).toBe(0);
    ctl.choose("kind", "b");
    ctl.next();
    expect(ctl.getState().index).toBe(2);
    expect(ctl.getState().answers.size?.choices).toEqual(["m"]);
  });

  it("back moves one screen", () => {
    const { ctl } = make();
    fillAnswers(ctl);
    ctl.back();
    expect(ctl.getState().index).toBe(1);
  });

  it("clearing the main choice clears the follow-up", () => {
    const { ctl } = make();
    ctl.choose("kind", "a");
    ctl.chooseFollowUp("kind", "x");
    ctl.choose("kind", "a");
    expect(ctl.getState().answers.kind?.followUp).toEqual([]);
  });
});

describe("contact validation", () => {
  const cs = fixture.steps[3] as any;
  const base = { name: "A", email: "a@b.co", phone: "", date: "", message: "" };
  it("requires name and a real email", () => {
    const e = validateContact(cs, { ...base, name: " ", email: "nope" }, fixture, TODAY);
    expect(Object.keys(e).sort()).toEqual(["email", "name"]);
  });
  it("optional fields may be empty but are checked when present", () => {
    expect(validateContact(cs, base, fixture, TODAY)).toEqual({});
    expect(validateContact(cs, { ...base, phone: "12" }, fixture, TODAY).phone).toBeTruthy();
    expect(validateContact(cs, { ...base, date: "2026-02-31" }, fixture, TODAY).date).toBeTruthy();
    expect(validateContact(cs, { ...base, date: "2026-10-22" }, fixture, TODAY).date).toMatch(
      /passed/,
    );
    expect(validateContact(cs, { ...base, date: TODAY }, fixture, TODAY).date).toBeUndefined();
    expect(
      validateContact(cs, { ...base, message: "x".repeat(2001) }, fixture, TODAY).message,
    ).toBeTruthy();
  });
  it("localToday uses the local calendar, not UTC", () => {
    expect(localToday(new Date(2026, 9, 23, 23, 59))).toBe("2026-10-23");
  });
});

describe("payload and summary lines", () => {
  it("returns structured answers and Question: answer lines", () => {
    const { ctl } = make({ t: { v: 5000 } });
    ctl.choose("kind", "a");
    ctl.chooseFollowUp("kind", "x");
    ctl.chooseFollowUp("kind", "y");
    ctl.next();
    ctl.choose("size", "m");
    ctl.choose("extras", "p");
    ctl.next();
    fillContact(ctl);
    const p = ctl.payload();
    expect(p.summary).toEqual([
      "What are you planning?: Alpha",
      "Anything more specific?: Ex, Why",
      "How many?: Medium",
      "Extras?: Pets",
      "Name: Ana Lee",
      "Email: ana@example.com",
      "Phone: (555) 123-4567",
      "Date: 2026-12-01",
      "Message: Hi",
    ]);
    expect(p.answers[0]).toMatchObject({ stepId: "kind", choices: [{ id: "a", label: "Alpha" }] });
    expect(p.contact.name).toBe("Ana Lee");
  });
  it("omits empty optional fields", () => {
    const p = buildPayload(
      fixture,
      { kind: { choices: ["a"], followUp: [] } },
      { name: "A", email: "a@b.co", phone: "", date: "", message: "" },
    );
    expect(p.summary.join("\n")).not.toMatch(/Phone|Date|Message/);
  });
});

describe("submit", () => {
  const okFetch = () =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  it("invalid contact never calls the endpoint", async () => {
    const fetcher = okFetch();
    const { ctl } = make({ fetcher, t: { v: 0 } });
    fillAnswers(ctl);
    expect(await ctl.submit()).toBe("invalid");
    expect(fetcher).not.toHaveBeenCalled();
    expect(ctl.getState().errors.name).toBeTruthy();
  });
  it("posts JSON and reaches sent", async () => {
    const fetcher = okFetch();
    const t = { v: 0 };
    const { ctl } = make({ fetcher, t });
    fillAnswers(ctl);
    ctl.next();
    fillContact(ctl);
    t.v = 9000;
    expect(await ctl.submit()).toBe("sent");
    const [url, init] = fetcher.mock.calls[0] as any;
    expect(url).toBe("/api/inquiry");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).summary.length).toBeGreaterThan(5);
    expect(ctl.getState().status).toBe("sent");
  });
  it("a failed send says what to do and can retry", async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const t = { v: 0 };
    const { ctl } = make({ fetcher, t });
    fillAnswers(ctl);
    ctl.next();
    fillContact(ctl);
    t.v = 9000;
    expect(await ctl.submit()).toBe("failed");
    expect(ctl.getState().status).toBe("failed");
    expect(ctl.getState().failure).toBe(fixture.failureMessage);
    ctl.retry();
    expect(ctl.getState().status).toBe("idle");
  });
  it("a network error is a failed state too", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    const t = { v: 0 };
    const { ctl } = make({ fetcher, t });
    fillAnswers(ctl);
    ctl.next();
    fillContact(ctl);
    t.v = 9000;
    expect(await ctl.submit()).toBe("failed");
  });
  it("honeypot filled: looks sent, nothing posted", async () => {
    const fetcher = okFetch();
    const t = { v: 0 };
    const { ctl } = make({ fetcher, t });
    fillAnswers(ctl);
    ctl.next();
    fillContact(ctl);
    ctl.setHoneypot("http://spam");
    t.v = 9000;
    expect(await ctl.submit()).toBe("sent");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("too fast: looks sent, nothing posted", async () => {
    const fetcher = okFetch();
    const { ctl } = make({ fetcher, t: { v: 0 } });
    fillAnswers(ctl);
    ctl.next();
    fillContact(ctl);
    expect(await ctl.submit()).toBe("sent");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("ignores a second tap while sending", async () => {
    let release: (v: any) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    const t = { v: 0 };
    const { ctl } = make({ fetcher: fetcher as any, t });
    fillAnswers(ctl);
    ctl.next();
    fillContact(ctl);
    t.v = 9000;
    const first = ctl.submit();
    expect(await ctl.submit()).toBe("ignored");
    release({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("config", () => {
  it("defineInquiry rejects a config with no contact step last", () => {
    expect(() =>
      defineInquiry({ ...fixture, steps: [fixture.steps[0]!, fixture.steps[1]!] } as InquiryConfig),
    ).toThrow(/contact/);
  });
  it("rejects duplicate ids", () => {
    expect(() =>
      defineInquiry({
        ...fixture,
        steps: [fixture.steps[0]!, fixture.steps[0]!, fixture.steps[3]!],
      } as InquiryConfig),
    ).toThrow(/duplicate/);
  });
});

describe("server", () => {
  const goodBody = {
    answers: [
      { stepId: "kind", choices: [{ id: "a" }], followUp: { choices: [{ id: "x" }] } },
      { stepId: "size", choices: [{ id: "m" }] },
    ],
    contact: { name: "Ana", email: "ana@example.com" },
    summary: ["INJECTED LINE"],
    website: "",
    elapsedMs: 5000,
  };
  const mk = () => {
    const send = vi.fn(async () => ({ id: "m1" }));
    const handle = createInquiryHandler({
      config: fixture,
      to: "o@x.com",
      from: "n@x.com",
      sender: { send },
      today: () => TODAY,
    });
    return { send, handle };
  };
  it("emails summary lines rebuilt from the config, not the client's own", async () => {
    const { send, handle } = mk();
    expect(await handle(goodBody)).toEqual({ ok: true, id: "m1" });
    const msg = (send.mock.calls[0] as any)[0];
    expect(msg.text).toContain("What are you planning?: Alpha");
    expect(msg.text).toContain("Anything more specific?: Ex");
    expect(msg.text).not.toContain("INJECTED");
    expect(msg.to).toBe("o@x.com");
  });
  it("rejects unknown option ids and missing contact, with field keys", async () => {
    const { send, handle } = mk();
    const res: any = await handle({
      ...goodBody,
      answers: [{ stepId: "kind", choices: [{ id: "zzz" }] }],
      contact: {},
    });
    expect(res.ok).toBe(false);
    expect(Object.keys(res.errors)).toEqual(
      expect.arrayContaining(["kind", "size", "contact.name", "contact.email"]),
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects two answers to a single-choice step", () => {
    const r: any = inquirySchema(fixture, () => TODAY).safeParse({
      ...goodBody,
      answers: [{ stepId: "kind", choices: [{ id: "a" }, { id: "b" }] }, goodBody.answers[1]],
    });
    expect(r.success).toBe(false);
  });
  it("honeypot and too-fast sends answer ok and send nothing", async () => {
    const { send, handle } = mk();
    expect((await handle({ ...goodBody, website: "x" })).ok).toBe(true);
    expect((await handle({ ...goodBody, elapsedMs: 10 })).ok).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
  it("route: 400 on bad input, 200 on good, 502 when the sender throws", async () => {
    const send = vi.fn(async () => ({ id: "1" }));
    const POST = createInquiryRoute({
      config: fixture,
      to: "o@x.com",
      from: "n@x.com",
      sender: { send },
      today: () => TODAY,
    });
    const req = (b: string) => new Request("http://x/api/inquiry", { method: "POST", body: b });
    expect((await POST(req("not json"))).status).toBe(400);
    expect((await POST(req(JSON.stringify({})))).status).toBe(400);
    expect((await POST(req(JSON.stringify(goodBody)))).status).toBe(200);
    const bad = createInquiryRoute({
      config: fixture,
      to: "o",
      from: "n",
      sender: {
        send: async () => {
          throw new Error("x");
        },
      },
      today: () => TODAY,
    });
    expect((await bad(req(JSON.stringify(goodBody)))).status).toBe(502);
  });
});
