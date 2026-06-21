import { describe, expect, it } from "vitest";
import { z } from "zod";
import { observabilityEnv } from "../env";

describe("observabilityEnv", () => {
  it("validates a well-formed Sentry+Discord env", () => {
    const schema = z.object({
      ...observabilityEnv.sentry,
      ...observabilityEnv.discord,
    });
    const parsed = schema.safeParse({
      SENTRY_DSN: "https://k@o.ingest.sentry.io/1",
      DISCORD_BOT_TOKEN: "a-token-1234567890",
      DISCORD_LEADS_CHANNEL_ID: "123",
      DISCORD_ALERTS_CHANNEL_ID: "456",
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects a non-https Sentry DSN", () => {
    const schema = z.object({ ...observabilityEnv.sentry });
    expect(schema.safeParse({ SENTRY_DSN: "http://insecure" }).success).toBe(false);
  });
});
