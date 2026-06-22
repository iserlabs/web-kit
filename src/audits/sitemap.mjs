import { XMLParser } from "fast-xml-parser";

export function parseSitemap(xml, baseUrl) {
  const parsed = new XMLParser().parse(xml);
  const urls = parsed?.urlset?.url;
  if (!urls) return [];
  const list = Array.isArray(urls) ? urls : [urls];
  return list
    .map((u) => String(u.loc ?? ""))
    .filter(Boolean)
    .map((loc) => loc.replace(baseUrl, "") || "/");
}
