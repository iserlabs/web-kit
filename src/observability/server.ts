// Node-runtime entry. NOT Edge-safe (@discordjs/rest needs Node). Server-only
// by convention + Node deps; no `server-only` import (Next-only no-op under Astro).

export type { DedupResult } from "./dedup";
export { __resetDedupForTests, checkAndRecord } from "./dedup";
export type { Embed, EmbedField } from "./discord";
export {
  alertDiscord,
  buildEmbed,
  notifyLead,
  postDiscordMessage,
} from "./discord";
export type { NotifyPayload } from "./notify";
export { notify } from "./notify";
export type { Kind, Severity } from "./severity";
export { getEmojiPrefix } from "./severity";
