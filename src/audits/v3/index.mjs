import { applyBaseline, loadBaseline, recordBaseline } from "./baseline.mjs";
import { CONTENT } from "./checks/content.mjs";
import { INTERACTION } from "./checks/interaction.mjs";
import { TYPOGRAPHY } from "./checks/typography.mjs";
import { VISUAL } from "./checks/visual.mjs";
import { INPAGE } from "./inpage.mjs";
import {
  formatLine,
  loadDecisions,
  loadFacts,
  loadScales,
  makeResult,
  onProbation,
  PROBATION,
  SCOPES,
  STATUS,
  TIERS,
} from "./lib.mjs";

export { formatLine, loadBaseline, recordBaseline };

export const ALL_CHECKS = [...TYPOGRAPHY, ...VISUAL, ...INTERACTION, ...CONTENT].sort((a, b) =>
  a.id.localeCompare(b.id),
);

/** These change the page they run on (focus, clicks, resized window), so they run last. */
const MUTATES = new Set(["C27", "C30", "C19", "C18"]);

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "The v3 audit needs Playwright: pnpm add -D playwright && pnpm exec playwright install chromium",
    );
  }
}

async function sitemapRoutes(origin, limit) {
  try {
    const res = await fetch(new URL("/sitemap.xml", origin));
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
      .map((m) => {
        try {
          const u = new URL(m[1]);
          return u.origin === origin ? u.pathname + u.search : null;
        } catch {
          return null;
        }
      })
      .filter((p) => p && p !== "/")
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Runs the v3 checks against a live URL.
 * @param {string} url the page to audit (its home page for a whole site)
 * @param {object} [opts] siteDir, today (YYYY-MM-DD, for tests), maxPages, scope (marketing|app|document|email), emailsDir,
 *   only (array of check IDs), browser (an open Playwright browser to reuse), routes (array)
 * @returns {Promise<{results: object[], blocking: number, summary: string, lines: string[]}>}
 */
export async function runV3Audit(url, opts = {}) {
  const siteDir = opts.siteDir ?? null;
  const origin = new URL(url).origin;
  const ctx = {
    facts: loadFacts(siteDir),
    scales: loadScales(siteDir),
    emailsDir: opts.emailsDir ?? null,
  };
  const waivers = loadDecisions(siteDir);
  const baseline = loadBaseline(siteDir);

  const allow = opts.only ?? SCOPES[opts.scope ?? "marketing"];
  const checks = ALL_CHECKS.filter((c) => !allow || allow.includes(c.id)).sort(
    (a, b) => Number(MUTATES.has(a.id)) - Number(MUTATES.has(b.id)) || a.id.localeCompare(b.id),
  );

  const pw = opts.browser ? null : await loadPlaywright();
  const browser = opts.browser ?? (await pw.chromium.launch());
  const open = new Set();

  const fresh = async (o = {}) => {
    const {
      navigate = true,
      viewport = { width: 1440, height: 900 },
      isMobile,
      hasTouch,
      deviceScaleFactor,
      reducedMotion,
      colorScheme,
    } = o;
    const context = await browser.newContext({
      viewport,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      reducedMotion,
      colorScheme,
      ignoreHTTPSErrors: true,
    });
    await context.addInitScript({ content: INPAGE });
    const page = await context.newPage();
    const handle = {
      page,
      context,
      close: async () => {
        open.delete(handle);
        await context.close().catch(() => {});
      },
    };
    open.add(handle);
    if (navigate) {
      await page.goto(o.url ?? url, { waitUntil: "load", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    return handle;
  };

  try {
    const routes = opts.routes ?? [
      "/",
      ...(await sitemapRoutes(origin, Math.max(0, (opts.maxPages ?? 6) - 1))),
    ];
    const raw = new Map(checks.map((c) => [c.id, []]));
    const record = (id, route, r) => raw.get(id).push({ route, r });

    for (const [i, route] of routes.entries()) {
      const pageUrl = i === 0 ? url : new URL(route, origin).href;
      const home = i === 0;
      const want = checks.filter(
        (c) => c.scope !== "site" && (home || c.scope !== "home") && c.run,
      );
      const needDesktop = want.some((c) => c.viewport !== "phone");
      const needPhone = want.some((c) => c.viewport === "phone");
      const desktop = needDesktop ? await fresh({ url: pageUrl }) : null;
      const phone = needPhone
        ? await fresh({
            url: pageUrl,
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 2,
          })
        : null;
      try {
        for (const c of want) {
          const page = (c.viewport === "phone" ? phone : desktop).page;
          try {
            record(
              c.id,
              route,
              await c.run({
                page,
                ctx,
                url: pageUrl,
                origin,
                route,
                fresh: (o) => fresh({ url: pageUrl, ...o }),
              }),
            );
          } catch (e) {
            record(c.id, route, {
              error: String(e.message ?? e)
                .split("\n")[0]
                .slice(0, 120),
            });
          }
        }
      } finally {
        await desktop?.close();
        await phone?.close();
      }
    }
    for (const c of checks.filter((c) => c.scope === "site")) {
      try {
        record(c.id, "/", await c.run({ ctx, url, origin, fresh }));
      } catch (e) {
        record(c.id, "/", {
          error: String(e.message ?? e)
            .split("\n")[0]
            .slice(0, 120),
        });
      }
    }

    let results = checks.map((c) => {
      const runs = raw.get(c.id);
      const tier = TIERS[c.id];
      const fails = runs.flatMap(({ route, r }) =>
        (r.fails ?? []).map((f) => ({
          item: route === "/" ? f.item : `${route} ${f.item}`,
          detail: route === "/" ? f.detail : `${route}: ${f.detail}`,
        })),
      );
      const errors = runs.filter((x) => x.r.error);
      const unproven = runs.find((x) => x.r.unproven);
      const merged = {
        fails,
        note: runs.find((x) => x.r.note)?.r.note,
        unproven: unproven?.r.unproven,
        error: errors.length === runs.length && runs.length ? errors[0].r.error : undefined,
      };
      if (!runs.length) merged.error = "no page was available to check";
      return makeResult(c.id, c.title, tier, merged);
    });

    const today = opts.today ?? new Date().toISOString().slice(0, 10);
    results = results.map((r) => {
      if (!onProbation(r.id, today)) return r;
      return {
        ...r,
        probation: PROBATION[r.id],
        status: r.status === STATUS.FAIL ? STATUS.WARN : r.status,
      };
    });
    results = results.map((r) => {
      if (r.status === STATUS.FAIL && waivers.has(r.id) && ["T1", "T3"].includes(r.tier))
        return { ...r, waived: waivers.get(r.id) };
      return r;
    });
    results = applyBaseline(results, baseline);

    const isBlocking = (r) => r.status === STATUS.FAIL && !r.waived && !r.known;
    const blocking = results.filter(isBlocking).length;
    const count = (f) => results.filter(f).length;
    const summary =
      `web-kit v3: ${blocking} new FAIL, ${count((r) => r.known)} known (baseline), ${count((r) => r.waived)} waived, ` +
      `${count((r) => r.status === STATUS.WARN)} WARN, ${count((r) => r.status === STATUS.UNPROVEN)} UNPROVEN, ` +
      `${count((r) => r.status === STATUS.PASS && !r.waived)} PASS of ${results.length}`;
    return { results, blocking, summary, lines: [...results.map(formatLine), summary] };
  } finally {
    for (const h of [...open]) await h.close();
    if (!opts.browser) await browser.close();
  }
}

/** Runs the audit and writes the result as the site's baseline. */
export async function recordV3Baseline(url, opts = {}) {
  const out = await runV3Audit(url, opts);
  if (!opts.siteDir) throw new Error("recording a baseline needs the site folder");
  const rec = recordBaseline(opts.siteDir, out.results, { url });
  return { ...out, baseline: rec };
}
