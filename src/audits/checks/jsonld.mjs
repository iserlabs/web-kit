import { parse } from "node-html-parser";

export function checkJsonLd(html, opts) {
  const root = parse(html);
  const findings = [];
  const err = (code, message) =>
    findings.push({ severity: "error", code, message, route: opts.route });

  const blocks = root.querySelectorAll("script[type='application/ld+json']");
  const seenTypes = new Set();

  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block.text);
    } catch {
      err("jsonld-invalid", "A ld+json block is not valid JSON");
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      const t = node?.["@type"];
      if (Array.isArray(t)) for (const x of t) seenTypes.add(x);
      else if (t) seenTypes.add(t);
    }
  }

  for (const expected of opts.expectedTypes) {
    if (!seenTypes.has(expected)) {
      err("jsonld-type-missing", `Expected JSON-LD @type "${expected}" not found`);
    }
  }

  return findings;
}
