import { parse } from "node-html-parser";

export function checkSeoMeta(html, opts) {
  const root = parse(html);
  const findings = [];
  const err = (code, message) =>
    findings.push({ severity: "error", code, message, route: opts.route });

  const title = root.querySelector("title");
  if (!title?.text.trim()) err("seo-title-missing", "Missing or empty <title>");

  if (!root.querySelector("meta[name='description']")) {
    err("seo-description-missing", "Missing meta[name=description]");
  }
  if (!root.querySelector("link[rel='canonical']")) {
    err("seo-canonical-missing", "Missing link[rel=canonical]");
  }
  if (!root.querySelector("meta[property='og:title']")) {
    err("seo-og-title-missing", "Missing og:title");
  }
  if (!root.querySelector("meta[property='og:description']")) {
    err("seo-og-description-missing", "Missing og:description");
  }
  if (!root.querySelector("meta[name='twitter:card']")) {
    err("seo-twitter-card-missing", "Missing twitter:card");
  }

  const h1s = root.querySelectorAll("h1");
  if (h1s.length !== 1) err("seo-h1-count", `Expected exactly one <h1>, found ${h1s.length}`);

  for (const img of root.querySelectorAll("img")) {
    // Flag a *missing* alt attribute (a forgotten alt). An explicit empty
    // alt="" is the correct WCAG/axe convention for a decorative image — the
    // author declaring "skip me" — so it is intentional and not an error.
    if (img.getAttribute("alt") === undefined) {
      err("seo-img-alt", `<img src="${img.getAttribute("src") ?? "?"}"> has no alt attribute`);
    }
  }

  return findings;
}
