import { describe, expect, it } from "vitest";
import { baseSentryOptions, REPLAY_MASKING_DEFAULTS } from "../options";

describe("baseSentryOptions", () => {
  it("bakes in the errors-only, PII-safe posture", () => {
    const opts = baseSentryOptions({
      runtime: "node",
      dsn: "https://x@sentry.io/1",
      environment: "production",
      release: "abc123",
      enabled: true,
    });
    expect(opts.tracesSampleRate).toBe(0);
    expect(opts.sendDefaultPii).toBe(false);
    expect(opts.ignoreErrors).toContain("Load failed");
    expect(opts.beforeSend).toBeTypeOf("function");
    expect(opts.dsn).toBe("https://x@sentry.io/1");
    expect(opts.enabled).toBe(true);
  });
  it("beforeSend scrubs PII", () => {
    const opts = baseSentryOptions({
      runtime: "browser",
      dsn: undefined,
      environment: "preview",
      release: undefined,
      enabled: false,
    });
    const scrubbed = opts.beforeSend({ message: "x a@b.com" });
    expect(scrubbed.message).toBe("x [email]");
  });
  it("mandates replay masking defaults", () => {
    expect(REPLAY_MASKING_DEFAULTS).toEqual({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
  });
});
