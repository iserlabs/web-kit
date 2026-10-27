import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tpl = (name) => readFileSync(join(here, "templates", name), "utf8");

function defaultWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/**
 * Scaffold the inquiry flow into a site: the component (art-direct it there),
 * an example config (replace its copy), and the route snippet to print.
 * Nothing existing is ever overwritten.
 */
export function initInquiry(siteDir, opts = {}) {
  const write = opts.write ?? defaultWrite;
  const exists = opts.exists ?? existsSync;
  const src = exists(join(siteDir, "src")) ? "src" : ".";
  const files = [
    [join(siteDir, src, "components/inquiry/inquiry-flow.tsx"), tpl("inquiry-flow.tsx.tpl")],
    [join(siteDir, src, "content/inquiry-flow.ts"), tpl("inquiry-flow.ts.tpl")],
  ];
  const written = [];
  const skipped = [];
  for (const [path, contents] of files) {
    if (exists(path)) {
      skipped.push(path);
      continue;
    }
    write(path, contents);
    written.push(path);
  }
  return { written, skipped, routeSnippet: tpl("route.ts.tpl") };
}
