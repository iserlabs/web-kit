/**
 * Run axe-core a11y analysis against a URL via Playwright. Browser deps are
 * dynamically imported so the kit stays lean for sites that only run the
 * required tier (they never install playwright / @axe-core/playwright).
 * @returns {Promise<Array<{severity:string,code:string,message:string}>>}
 */
export async function runAxe(url, { tags = ["wcag2a", "wcag2aa"] } = {}) {
  let chromium;
  let AxeBuilder;
  try {
    ({ chromium } = await import("playwright"));
    const mod = await import("@axe-core/playwright");
    AxeBuilder = mod.default ?? mod.AxeBuilder;
  } catch {
    throw new Error(
      "Extended-tier a11y needs Playwright + axe: pnpm add -D playwright @axe-core/playwright",
    );
  }
  const browser = await chromium.launch();
  try {
    // @axe-core/playwright requires a page from an explicit browser context.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
    return violations.map((v) => ({
      severity: "warn",
      code: `a11y-axe-${v.id}`,
      message: `${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
    }));
  } finally {
    await browser.close();
  }
}
