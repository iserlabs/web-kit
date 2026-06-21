// Generalized Discord transport — REST plumbing only (no app-specific lead
// builders, no @discordjs/builders). Node-runtime only; never imported from
// client or Edge code. Missing token / channel → warn + skip, never throw.
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}
export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  timestamp?: string;
}

const EMBED_TITLE_MAX = 256;
const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FIELD_VALUE_MAX = 1024;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Clamp every slot to Discord's limits so a long free-text value can't make
 *  the API reject the whole message and drop a lead/alert. */
export function buildEmbed(spec: Embed): Embed {
  return {
    ...spec,
    title: spec.title ? truncate(spec.title, EMBED_TITLE_MAX) : undefined,
    description: spec.description ? truncate(spec.description, EMBED_DESCRIPTION_MAX) : undefined,
    fields: spec.fields?.map((f) => ({
      ...f,
      value: truncate(f.value, EMBED_FIELD_VALUE_MAX),
    })),
  };
}

let restClient: REST | null = null;
function getClient(): REST | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  if (!restClient) restClient = new REST({ version: "10" }).setToken(token);
  return restClient;
}

export async function postDiscordMessage(
  channelEnvKey: string,
  content: string | undefined,
  embed: Embed,
): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[observability] discord_bot_token_missing");
    return;
  }
  const channelId = process.env[channelEnvKey];
  if (!channelId) {
    console.warn(`[observability] discord_channel_not_configured ${channelEnvKey}`);
    return;
  }
  await client.post(Routes.channelMessages(channelId), {
    body: { content: content ?? undefined, embeds: [buildEmbed(embed)] },
  });
}

const SEVERITY_STYLE = {
  critical: { color: 0xef4444, prefix: "CRITICAL" },
  warning: { color: 0xeab308, prefix: "WARNING" },
  info: { color: 0x3b82f6, prefix: "INFO" },
} as const;

/** Ops alert → DISCORD_ALERTS_CHANNEL_ID. `@everyone` is added ONLY for
 *  `critical` in production (spec §7) so PR previews never ping the channel. */
export async function alertDiscord(
  message: string,
  level: "critical" | "warning" | "info",
): Promise<void> {
  const style = SEVERITY_STYLE[level];
  const content =
    level === "critical" && process.env.VERCEL_ENV === "production" ? "@everyone" : undefined;
  const fullTitle = `${style.prefix}: ${message}`;
  const overflowed = fullTitle.length > EMBED_TITLE_MAX;
  await postDiscordMessage("DISCORD_ALERTS_CHANNEL_ID", content, {
    title: fullTitle,
    description: overflowed ? message : undefined,
    color: style.color,
    timestamp: new Date().toISOString(),
  });
}

/** Lead notification → DISCORD_LEADS_CHANNEL_ID. Carries PII BY DESIGN —
 *  the caller builds the embed; it is NOT scrubbed (spec §7). */
export async function notifyLead(embed: Embed): Promise<void> {
  await postDiscordMessage("DISCORD_LEADS_CHANNEL_ID", undefined, embed);
}
