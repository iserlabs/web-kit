import { XMLParser } from "fast-xml-parser";

/**
 * Extract route *paths* from a sitemap XML. Robust to the sitemap using the
 * production/canonical origin (e.g. https://example.com) while the audit crawls
 * a local preview server — we take each <loc>'s pathname regardless of origin.
 * @param {string} xml
 * @returns {string[]}
 */
export function parseSitemap(xml) {
  const parsed = new XMLParser().parse(xml);
  const urls = parsed?.urlset?.url;
  if (!urls) return [];
  const list = Array.isArray(urls) ? urls : [urls];
  return list
    .map((u) => String(u.loc ?? ""))
    .filter(Boolean)
    .map((loc) => {
      try {
        return new URL(loc).pathname || "/";
      } catch {
        return loc.startsWith("/") ? loc : "/";
      }
    });
}
