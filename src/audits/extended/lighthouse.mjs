/**
 * Run Lighthouse against a URL. Browser deps are dynamically imported so the
 * kit stays lean for required-tier-only sites.
 * @returns {Promise<{scores:Record<string,number|null>, metrics:{lcp:number|null,cls:number|null,tbt:number|null}}>}
 */
export async function runLighthouse(
  url,
  {
    categories = ["performance", "seo", "best-practices", "accessibility"],
    formFactor = "mobile",
  } = {},
) {
  let lighthouse;
  let launch;
  try {
    ({ default: lighthouse } = await import("lighthouse"));
    ({ launch } = await import("chrome-launcher"));
  } catch {
    throw new Error("Extended-tier perf needs Lighthouse: pnpm add -D lighthouse chrome-launcher");
  }
  const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
  try {
    const { lhr } = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: categories,
      formFactor,
      screenEmulation: formFactor === "desktop" ? { disabled: true } : undefined,
      logLevel: "error",
    });
    const scores = {};
    for (const c of categories) scores[c] = lhr.categories[c]?.score ?? null;
    return {
      scores,
      metrics: {
        lcp: lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
        cls: lhr.audits["cumulative-layout-shift"]?.numericValue ?? null,
        tbt: lhr.audits["total-blocking-time"]?.numericValue ?? null,
      },
    };
  } finally {
    await chrome.kill();
  }
}
