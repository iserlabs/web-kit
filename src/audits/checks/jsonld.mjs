import { parse } from "node-html-parser";

// Collect every @type from a JSON-LD value, descending into top-level arrays
// and `@graph` containers (the standard way to express multiple entities on a
// page — used by Next sites and SEO libs alike).
function collectTypes(node, into) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, into);
    return;
  }
  const t = node["@type"];
  if (Array.isArray(t)) for (const x of t) into.add(x);
  else if (t) into.add(t);
  if (Array.isArray(node["@graph"])) {
    for (const n of node["@graph"]) collectTypes(n, into);
  }
}

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
    collectTypes(data, seenTypes);
  }

  for (const expected of opts.expectedTypes) {
    if (!seenTypes.has(expected)) {
      err("jsonld-type-missing", `Expected JSON-LD @type "${expected}" not found`);
    }
  }

  return findings;
}
