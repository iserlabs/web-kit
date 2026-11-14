import { parse } from "node-html-parser";

// The launch checklist every site ships with (docs/launch-checklist.md). The SEO check already
// covers title, description and alt text; this one covers the rest that a page can prove:
// privacy and terms pages that exist and are linked from the footer, a favicon, a link preview
// image, robots.txt and sitemap.xml, no secret in the shipped HTML, and no tracking script that
// loads before the visitor has said yes.

const TRACKERS = [
  /googletagmanager\.com\/gtag\/js/i,
  /googletagmanager\.com\/gtm\.js/i,
  /connect\.facebook\.net/i,
  /static\.hotjar\.com/i,
  /clarity\.ms\/tag/i,
  /analytics\.tiktok\.com/i,
  /snap\.licdn\.com/i,
];

// Shapes of real credentials. A publishable key (pk_live_, a Google Maps browser key) is meant to
// be public, so it is not listed.
const SECRETS = [
  [/sk_(live|test)_[A-Za-z0-9]{16,}/, "Stripe secret key"],
  [/\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/, "Resend API key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic API key"],
  [/\bsk-(proj-)?[A-Za-z0-9_-]{32,}/, "OpenAI API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
];

/** Checks one rendered page. Pure, so it is tested without a server. */
export function checkLaunchHtml(html, opts = {}) {
  const route = opts.route ?? "/";
  const findings = [];
  const err = (code, message) => findings.push({ severity: "error", code, message, route });
  const root = parse(html);

  const hrefs = root.querySelectorAll("a[href]").map((a) => a.getAttribute("href") ?? "");
  const links = (re) => hrefs.some((h) => re.test(h));
  if (!links(/(^|\/)privacy(-policy)?\/?($|[?#])/)) {
    err("launch-privacy-link", "No link to the Privacy Policy on this page (put it in the footer)");
  }
  if (!links(/(^|\/)terms(-and-conditions|-of-use)?\/?($|[?#])/)) {
    err("launch-terms-link", "No link to the Terms and Conditions on this page (put it in the footer)");
  }

  if (!root.querySelector("link[rel~='icon']")) err("launch-favicon", "No favicon link");
  if (!root.querySelector("meta[property='og:image']")) {
    err("launch-og-image", "No og:image, so link previews show nothing");
  }

  for (const s of root.querySelectorAll("script[src]")) {
    const src = s.getAttribute("src") ?? "";
    const type = s.getAttribute("type") ?? "";
    if (type === "text/plain") continue; // parked until consent
    if (TRACKERS.some((re) => re.test(src))) {
      err("launch-tracker-before-consent", `${src} loads before consent; load it only after Accept`);
    }
  }
  for (const s of root.querySelectorAll("script:not([src])")) {
    const type = s.getAttribute("type") ?? "";
    if (type === "text/plain" || type === "application/ld+json") continue;
    const body = s.text;
    if (/\bfbq\(\s*['"]init/.test(body) || /\bgtag\(\s*['"]config/.test(body)) {
      if (!/consent/i.test(body)) {
        err("launch-tracker-before-consent", "An inline tracking snippet runs before consent");
      }
    }
  }

  for (const [re, name] of SECRETS) {
    if (re.test(html)) err("launch-secret-exposed", `A ${name} appears in the page source`);
  }

  return findings;
}

/** Fetches the home page, both legal pages, robots.txt and sitemap.xml from a running site. */
export async function checkLaunch(baseUrl, opts = {}) {
  const fetchFn = opts.fetch ?? fetch;
  const findings = [];
  const get = async (path) => {
    try {
      const res = await fetchFn(new URL(path, baseUrl), { redirect: "follow" });
      return { ok: res.ok, text: res.ok ? await res.text() : "" };
    } catch {
      return { ok: false, text: "" };
    }
  };

  const home = await get("/");
  if (home.ok) findings.push(...checkLaunchHtml(home.text, { route: "/" }));

  const privacy = (await get("/privacy")).ok || (await get("/privacy-policy")).ok;
  if (!privacy) {
    findings.push({ severity: "error", code: "launch-privacy-page", message: "No page at /privacy", route: "/privacy" });
  }
  const terms = (await get("/terms")).ok || (await get("/terms-and-conditions")).ok;
  if (!terms) {
    findings.push({ severity: "error", code: "launch-terms-page", message: "No page at /terms", route: "/terms" });
  }

  const robots = await get("/robots.txt");
  if (!robots.ok) {
    findings.push({ severity: "error", code: "launch-robots", message: "No robots.txt", route: "/robots.txt" });
  } else if (!/sitemap:/i.test(robots.text)) {
    findings.push({ severity: "error", code: "launch-robots-sitemap", message: "robots.txt does not point to the sitemap", route: "/robots.txt" });
  }
  if (!(await get("/sitemap.xml")).ok) {
    findings.push({ severity: "error", code: "launch-sitemap", message: "No sitemap.xml", route: "/sitemap.xml" });
  }

  return findings;
}
