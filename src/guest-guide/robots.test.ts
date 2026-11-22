import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, aiGuideRules, robotsTxt } from "./robots";

describe("AI_CRAWLERS", () => {
  it("is the spec's list of 21 agents, each once", () => {
    expect(AI_CRAWLERS).toHaveLength(21);
    expect(new Set(AI_CRAWLERS).size).toBe(21);
    for (const a of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "MistralAI-User"])
      expect(AI_CRAWLERS).toContain(a);
  });
});

describe("aiGuideRules", () => {
  it("disallows every guide path for every agent", () => {
    const rules = aiGuideRules(["/guides/yale", "/guides/lark"]);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.userAgent).toEqual([...AI_CRAWLERS]);
    expect(rules[0]?.disallow).toEqual(["/guides/yale", "/guides/lark"]);
  });

  it("refuses an empty path list and a path that is not absolute", () => {
    expect(() => aiGuideRules([])).toThrow();
    expect(() => aiGuideRules(["guides/yale"])).toThrow();
  });
});

describe("robotsTxt", () => {
  it("keeps the * record exactly as given and adds the AI record", () => {
    const txt = robotsTxt({
      star: { allow: ["/"], disallow: ["/api/"] },
      guidePaths: ["/guides/yale"],
      sitemap: "https://example.invalid/sitemap.xml",
    });
    expect(txt).toContain("User-agent: *\nAllow: /\nDisallow: /api/\n");
    for (const a of AI_CRAWLERS) expect(txt).toContain(`User-agent: ${a}\n`);
    expect(txt).toContain("Disallow: /guides/yale\n");
    expect(txt.match(/Disallow: \/guides\/yale/g)).toHaveLength(1);
    expect(txt.trim().endsWith("Sitemap: https://example.invalid/sitemap.xml")).toBe(true);
  });

  it("with no * record, writes none", () => {
    const txt = robotsTxt({ guidePaths: ["/"] });
    expect(txt).not.toContain("User-agent: *");
    expect(txt).toContain("Disallow: /\n");
  });
});
