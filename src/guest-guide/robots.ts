/**
 * AI-crawler rules for guest guides. The ruling: block AI bots only, keep
 * addresses and slugs, leave the `*` record unchanged. One list for every site.
 */

export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "meta-externalagent",
  "Bytespider",
  "cohere-ai",
  "Diffbot",
  "YouBot",
  "DuckAssistBot",
  "MistralAI-User",
] as const;

/** A rule in the shape Next's `MetadataRoute.Robots` uses (no Next import here). */
export type RobotsRule = {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

/** One rule: every AI agent disallowed from every guide path. Add it beside the site's own `*` rule. */
export function aiGuideRules(paths: string[]): { userAgent: string[]; disallow: string[] }[] {
  if (paths.length === 0) throw new Error("aiGuideRules needs at least one guide path");
  for (const p of paths)
    if (!p.startsWith("/")) throw new Error(`guide path "${p}" must start with /`);
  return [{ userAgent: [...AI_CRAWLERS], disallow: [...paths] }];
}

const list = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** A whole robots.txt for a static site: the `*` record as given, then the AI record. */
export function robotsTxt(o: {
  star?: { allow?: string[]; disallow?: string[] };
  guidePaths: string[];
  sitemap?: string;
}): string {
  const lines: string[] = [];
  if (o.star) {
    lines.push("User-agent: *");
    for (const a of list(o.star.allow)) lines.push(`Allow: ${a}`);
    for (const d of list(o.star.disallow)) lines.push(`Disallow: ${d}`);
    lines.push("");
  }
  const [rule] = aiGuideRules(o.guidePaths);
  for (const a of rule?.userAgent ?? []) lines.push(`User-agent: ${a}`);
  for (const d of rule?.disallow ?? []) lines.push(`Disallow: ${d}`);
  lines.push("");
  if (o.sitemap) lines.push(`Sitemap: ${o.sitemap}`, "");
  return lines.join("\n");
}
