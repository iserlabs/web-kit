/**
 * The browser tier. Every route, at thirteen geometries, in a real Chrome.
 *
 * WHAT THIS TIER IS FOR. Required reads the HTML and the stylesheet; extended runs
 * Lighthouse and axe at one size. Neither can see that a hero stops short of the fold on
 * a phone, that a heading is clipped at 834px, that a control is 38px tall, or that the
 * page cannot be scrolled with a finger. Those are the failures clients actually report,
 * and every one of them is a measurement rather than an opinion.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not click things. On a marketing site a
 * blind click sweep submits forms, sends enquiries and navigates away mid-audit. Driving
 * every control belongs in the project that knows which of its buttons are safe, which
 * is what the /perfect pipeline does per build. This tier stays read-only so it can run
 * anywhere, on any route, without side effects.
 */

import { loadAuditConfig } from "../config.mjs";
import { startPreview, waitForReady } from "../preview.mjs";
import { parseSitemap } from "../sitemap.mjs";
import { openBrowser } from "./cdp.mjs";
import { GEOMETRIES, gradeConsole, gradeGeometry, gradeTouch, measureExpression } from "./checks.mjs";

async function resolveRoutes(config) {
  if (config.browser?.routes?.length) return config.browser.routes;
  if (config.routes?.length) return config.routes;
  try {
    const res = await fetch(`${config.baseUrl}/sitemap.xml`);
    const routes = parseSitemap(await res.text());
    if (routes.length) return routes;
  } catch {
    /* no sitemap: fall through to the home route */
  }
  return ["/"];
}

/** Every route at every geometry, against an already-running site. */
export async function auditRunningSite({ baseUrl, routes, browser: opts = {} }) {
  const geometries = opts.geometries ?? GEOMETRIES;
  const heroRoutes = new Set(opts.heroRoutes ?? ["/"]);
  const findings = [];
  const page = await openBrowser();

  try {
    for (const route of routes) {
      for (const geometry of geometries) {
        await page.setViewport({ width: geometry.w, height: geometry.h, dpr: geometry.dpr, mobile: geometry.mobile });
        await page.goto(`${baseUrl}${route}`, opts.settleMs ?? 2400);
        await page.evaluate("window.scrollTo(0, 0)");

        const requireHero = Boolean(opts.heroSelector) && heroRoutes.has(route);
        const m = await page.evaluate(measureExpression({ heroSelector: requireHero ? opts.heroSelector : null }));
        findings.push(...gradeGeometry(m, { route, geometry, minTapTarget: opts.minTapTarget ?? 44, requireHero }));
        findings.push(...gradeConsole(page.consoleErrors(), { route, geometry }));

        /* The finger test, on the geometries that have fingers and pages long enough to
           move. A short page that cannot scroll is not a frozen page. */
        if (geometry.mobile && m.docHeight > m.vh + 200) {
          await page.evaluate("window.scrollTo(0, 300)");
          const before = await page.evaluate("window.scrollY");
          let after = before;
          for (let attempt = 0; attempt < 3 && after <= before + 60; attempt++) {
            await page.swipe({ x: Math.round(geometry.w / 2), fromY: Math.round(geometry.h * 0.62), toY: Math.round(geometry.h * 0.22) });
            after = await page.evaluate("window.scrollY");
          }
          findings.push(...gradeTouch({ before, after, scrollable: true }, { route, geometry }));
        }
      }
    }
  } finally {
    await page.close();
  }
  return findings;
}

/** The CLI entry: boot the site's own preview, audit it, tear down. */
export async function runBrowserAudit(siteDir) {
  const config = await loadAuditConfig(siteDir);
  const server = startPreview(config.previewCommand);
  try {
    await waitForReady(config.baseUrl, config.readyTimeoutMs);
    const routes = await resolveRoutes(config);
    const findings = await auditRunningSite({ baseUrl: config.baseUrl, routes, browser: config.browser });
    return findings.map((f) => {
      const override = config.severity[f.code];
      return override ? { ...f, severity: override } : f;
    });
  } finally {
    await server.stop();
  }
}
