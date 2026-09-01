import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BRAND_PACK_FILENAME } from "./config.mjs";
import * as templates from "./templates/index.mjs";

function defaultWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/**
 * Scaffold the /brand boards into a client site.
 *
 * Nothing existing is ever overwritten. A client who has filled in their config
 * or authored their own board keeps it, and re-running this fills in only what
 * is missing.
 */
export function initBrandPack(siteDir, opts = {}) {
  const write = opts.write ?? defaultWrite;
  const exists = opts.exists ?? existsSync;

  const appDir = exists(join(siteDir, "src/app")) ? "src/app" : "app";
  // How far below the repo root each scaffolded file sits, which is how many
  // hops its import of brand-pack.config.mjs needs.
  const appDepth = appDir.split("/").length;

  const files = [
    [join(siteDir, BRAND_PACK_FILENAME), templates.configFile()],
    [join(siteDir, appDir, "brand/styles.ts"), templates.stylesFile()],
    [join(siteDir, appDir, "brand/CopyButton.tsx"), templates.copyButton()],
    [join(siteDir, appDir, "brand/page.tsx"), templates.indexRoute(appDepth + 1)],
    [join(siteDir, appDir, "brand/signature/page.tsx"), templates.signatureRoute(appDepth + 2)],
    [join(siteDir, appDir, "brand/share/page.tsx"), templates.shareRoute(appDepth + 2)],
    [
      join(siteDir, appDir, "brand/share/card/[variant]/route.tsx"),
      templates.cardRoute(appDepth + 4),
    ],
    [join(siteDir, appDir, "opengraph-image.tsx"), templates.openGraphRoute(appDepth)],
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
  return { written, skipped };
}
