import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const alertDiscord = vi.fn();
vi.mock("../discord", () => ({ alertDiscord }));

import { __resetDedupForTests } from "../dedup";

afterEach(() => {
  __resetDedupForTests();
  process.env.VERCEL_ENV = undefined;
  process.env.OBSERVABILITY_FORCE_NOTIFY = undefined;
});
beforeEach(() => alertDiscord.mockReset());

describe("notify", () => {
  it("stays silent outside prod/preview unless forced", async () => {
    process.env.VERCEL_ENV = "development";
    const { notify } = await import("../notify");
    await notify({ severity: "critical", title: "x", message: "y" });
    expect(alertDiscord).not.toHaveBeenCalled();
  });

  it("sends in production, scrubs PII, maps warn→warning", async () => {
    process.env.VERCEL_ENV = "production";
    const { notify } = await import("../notify");
    await notify({
      severity: "warn",
      title: "Lead failed",
      message: "for a@b.com",
    });
    expect(alertDiscord).toHaveBeenCalledTimes(1);
    const [msg, level] = alertDiscord.mock.calls[0] ?? [];
    expect(level).toBe("warning");
    expect(msg).toContain("[email]");
    expect(msg).not.toContain("a@b.com");
  });

  it("dedups within TTL by severity:error_key", async () => {
    process.env.VERCEL_ENV = "production";
    const { notify } = await import("../notify");
    await notify({
      severity: "critical",
      title: "t",
      message: "m",
      error_key: "k",
    });
    await notify({
      severity: "critical",
      title: "t",
      message: "m",
      error_key: "k",
    });
    expect(alertDiscord).toHaveBeenCalledTimes(1);
  });

  it("never throws when the transport fails", async () => {
    process.env.VERCEL_ENV = "production";
    alertDiscord.mockRejectedValueOnce(new Error("discord down"));
    const { notify } = await import("../notify");
    await expect(
      notify({ severity: "critical", title: "t", message: "m" }),
    ).resolves.toBeUndefined();
  });
});
