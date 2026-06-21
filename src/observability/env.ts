// Zod shape fragments for the observability env vars (spec §8). Sites compose
// these into their own z.object({...}) and pass it to web-kit's validateEnv —
// this module owns the var NAMES + shapes, not the validation entry point.
import { z } from "zod";

export const observabilityEnv = {
  sentry: {
    SENTRY_DSN: z.string().url().startsWith("https://"),
  },
  discord: {
    DISCORD_BOT_TOKEN: z.string().min(10),
    DISCORD_LEADS_CHANNEL_ID: z.string().min(1),
    DISCORD_ALERTS_CHANNEL_ID: z.string().min(1),
  },
} as const;
