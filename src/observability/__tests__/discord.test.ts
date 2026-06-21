import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("@discordjs/rest", () => ({
  REST: class {
    setToken() {
      return this;
    }
    post = post;
  },
}));

describe("discord transport", () => {
  beforeEach(() => {
    post.mockReset();
    process.env.DISCORD_BOT_TOKEN = "tok";
    process.env.DISCORD_ALERTS_CHANNEL_ID = "alerts-1";
    process.env.DISCORD_LEADS_CHANNEL_ID = "leads-1";
  });
  afterEach(() => {
    process.env.VERCEL_ENV = undefined;
    vi.resetModules();
  });

  it("buildEmbed clamps field values to 1024 chars", async () => {
    const { buildEmbed } = await import("../discord");
    const embed = buildEmbed({
      fields: [{ name: "n", value: "x".repeat(2000) }],
    });
    expect(embed.fields?.[0]?.value.length).toBe(1024);
  });

  it("alertDiscord pings @everyone only on critical-in-production", async () => {
    process.env.VERCEL_ENV = "production";
    const { alertDiscord } = await import("../discord");
    await alertDiscord("db down", "critical");
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0][1].body;
    expect(body.content).toBe("@everyone");
    expect(body.embeds[0].title).toContain("CRITICAL");
  });

  it("alertDiscord omits @everyone outside production", async () => {
    process.env.VERCEL_ENV = "preview";
    const { alertDiscord } = await import("../discord");
    await alertDiscord("db down", "critical");
    expect(post.mock.calls[0][1].body.content).toBeUndefined();
  });

  it("skips silently when the bot token is missing", async () => {
    process.env.DISCORD_BOT_TOKEN = "";
    const { alertDiscord } = await import("../discord");
    await expect(alertDiscord("x", "info")).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
});
