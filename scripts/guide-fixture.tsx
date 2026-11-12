/**
 * Writes the kit's fixture guides as static HTML, the review surface for the
 * Alpenglow template (a library has no preview URL).
 *
 *   pnpm exec tsx scripts/guide-fixture.tsx --out <dir> [--assets <img dir>] [--fonts <dir>] [--fetch-fonts]
 *
 * For each fixture it writes <id>.html (live copy only, zero approvals: what a
 * guest would see today) and <id>-drafts.html (every held line in place, for
 * the approval board). Photos and brand marks are copied from --assets; they
 * are not in this public repo. Fonts are self-hosted: copied from --fonts, or
 * fetched once from Google Fonts (latin subset) with --fetch-fonts.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GuideBrand } from "../src/guest-guide/brand";
import { resolveCopy } from "../src/guest-guide/copy";
import { FIXTURE_TODAY, FIXTURES } from "../src/guest-guide/fixtures";
import { placedPhotos, planGuide } from "../src/guest-guide/plan";
import { type FontFile, renderGuideHtml } from "../src/guest-guide/static";
import { guideServiceWorker } from "../src/guest-guide/sw";
import { validateModel } from "../src/guest-guide/validate";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = flag("--out");
if (!out) {
  console.error("usage: tsx scripts/guide-fixture.tsx --out <dir> [--assets <dir>] [--fonts <dir>] [--fetch-fonts]");
  process.exit(2);
}
const assets = flag("--assets");
const fontsDir = flag("--fonts");
mkdirSync(path.join(out, "img"), { recursive: true });
mkdirSync(path.join(out, "fonts"), { recursive: true });

/** The faces each fixture brand uses: family, the Google Fonts axis query, and the file name written. */
const FACES: Record<string, { family: string; query: string; weight: string; file: string; preload?: boolean }[]> = {
  "sun-mountain": [
    { family: "Newsreader", query: "Newsreader:opsz,wght@6..72,300..400", weight: "300 400", file: "newsreader.woff2", preload: true },
    { family: "Instrument Sans", query: "Instrument+Sans:wght@400;600", weight: "400 600", file: "instrument-sans.woff2", preload: true },
    { family: "IBM Plex Mono", query: "IBM+Plex+Mono:wght@300", weight: "300", file: "plex-mono-300.woff2" },
    { family: "IBM Plex Mono", query: "IBM+Plex+Mono:wght@400", weight: "400", file: "plex-mono-400.woff2", preload: true },
    { family: "Cinzel", query: "Cinzel:wght@600", weight: "600", file: "cinzel-600.woff2" },
  ],
  columbus: [
    { family: "Literata", query: "Literata:opsz,wght@7..72,300..400", weight: "300 400", file: "literata.woff2", preload: true },
    { family: "Schibsted Grotesk", query: "Schibsted+Grotesk:wght@400;600", weight: "400 600", file: "schibsted.woff2", preload: true },
    { family: "Space Mono", query: "Space+Mono:wght@400", weight: "400", file: "space-mono-400.woff2", preload: true },
  ],
};

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

async function fetchFace(query: string, dest: string) {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, { headers: { "user-agent": ua } })
  ).text();
  const latin = css.split("/* latin */")[1] ?? css;
  const url = /url\((https:[^)]+\.woff2)\)/.exec(latin)?.[1];
  if (!url) throw new Error(`no woff2 for ${query}`);
  writeFileSync(dest, Buffer.from(await (await fetch(url)).arrayBuffer()));
}

async function fontsFor(brand: GuideBrand): Promise<FontFile[]> {
  const list = FACES[brand.id] ?? [];
  const files: FontFile[] = [];
  for (const f of list) {
    const dest = path.join(out as string, "fonts", f.file);
    if (!existsSync(dest)) {
      const from = fontsDir ? path.join(fontsDir, f.file) : undefined;
      if (from && existsSync(from)) copyFileSync(from, dest);
      else if (args.includes("--fetch-fonts")) await fetchFace(f.query, dest);
    }
    if (existsSync(dest))
      files.push({ family: f.family, src: `fonts/${f.file}`, weight: f.weight, preload: f.preload, unicodeRange: LATIN });
    else console.warn(`font missing: ${f.file} (pass --fonts or --fetch-fonts); the fallback face renders`);
  }
  return files;
}

function copyAsset(src: string) {
  if (!assets || /^https?:/.test(src)) return;
  const name = path.basename(src);
  const from = path.join(assets, name);
  const to = path.join(out as string, "img", name);
  if (existsSync(from)) copyFileSync(from, to);
  else console.warn(`asset missing: ${name}`);
}

const index: string[] = [];
writeFileSync(path.join(out, "sw.js"), guideServiceWorker({ cachePrefix: "fixture-guides", scope: "./", version: "fixture" }));
for (const fx of FIXTURES) {
  const problems = validateModel(fx.model, { today: FIXTURE_TODAY, phone: fx.brand.phone });
  for (const p of problems) console.warn(`${fx.id}: ${p}`);
  const fonts = await fontsFor(fx.brand);
  for (const mode of ["live", "drafts"] as const) {
    const copy = resolveCopy(fx.model, {
      approvals: [],
      brandLabels: fx.brand.labels,
      drafts: mode === "drafts" ? "show" : "hide",
    });
    const file = mode === "live" ? `${fx.id}.html` : `${fx.id}-drafts.html`;
    const plan = planGuide(fx.model, copy, {
      page: file,
      phone: fx.brand.phone,
      extraUrls: fonts.map((f) => f.src),
    });
    for (const p of placedPhotos(plan)) copyAsset(p.src);
    if (plan.cover.photo?.wide) copyAsset(plan.cover.photo.wide.src);
    if (fx.brand.mark) copyAsset(fx.brand.mark.src);
    if (fx.brand.wordmark.kind === "image") copyAsset(fx.brand.wordmark.src);
    const html = renderGuideHtml({
      plan,
      brand: fx.brand,
      fonts,
      page: file,
      serviceWorker: { url: "sw.js", scope: "./" },
      head: { canonical: `https://example.invalid/guides/${fx.model.slug}` },
    });
    writeFileSync(path.join(out, file), html);
    index.push(file);
  }
}
console.log(`wrote ${index.length} fixture pages to ${out}`);
for (const f of index) console.log(path.join(out, f));
if (assets) console.log(`images: ${readdirSync(path.join(out, "img")).length} copied`);
