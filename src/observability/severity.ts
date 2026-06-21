export type Severity = "info" | "warn" | "critical";
export type Kind = "lead" | "deploy" | "content" | "self-check" | "uptime";

export function getEmojiPrefix(severity: Severity, kind?: Kind): string {
  if (kind === "lead") return "📊";
  if (kind === "deploy") return "🚀";
  if (kind === "content") return "📝";
  if (kind === "self-check") return "🧪";
  if (kind === "uptime") return "🌐";
  if (severity === "critical") return "🔴";
  if (severity === "warn") return "🟡";
  return "🟢";
}
