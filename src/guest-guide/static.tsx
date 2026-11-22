/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * The static renderer: the same Alpenglow components through react-dom/server,
 * for the sites that publish plain HTML (Euclid, Grand Colorado). Run it under
 * `tsx`: Node will not strip types inside node_modules.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { AlpenglowGuide, type AlpenglowGuideProps } from "./alpenglow/guide";
import { type GuideHeadInput, guideHead } from "./alpenglow/head";

/** A self-hosted font file. Fallback metrics keep the swap from moving the page (CLS under 0.05). */
export type FontFile = {
  family: string;
  src: string;
  weight: string | number;
  /** Preload it (the cover's faces). */
  preload?: boolean;
  unicodeRange?: string;
  /** A metric-matched local fallback, emitted as "<family> Fallback". */
  fallback?: {
    local: string;
    sizeAdjust: string;
    ascentOverride?: string;
    descentOverride?: string;
  };
};

export type RenderGuideHtmlOptions = AlpenglowGuideProps & {
  head: Omit<GuideHeadInput, "plan" | "brand" | "imageUrl">;
  fonts?: FontFile[];
};

const ATTR = /["<>&]/g;
const esc = (s: string) =>
  s.replace(ATTR, (c) => ({ '"': "&quot;", "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
const SAFE_CSS = /^[^;{}<>\\"]*$/;

function fontCss(fonts: FontFile[]): string {
  const out: string[] = [];
  const fallbacks = new Set<string>();
  for (const f of fonts) {
    for (const v of [f.family, f.src, String(f.weight), f.unicodeRange ?? ""])
      if (!SAFE_CSS.test(v)) throw new Error(`font value "${v}" is not safe CSS`);
    out.push(
      `@font-face{font-family:"${f.family}";src:url("${f.src}") format("woff2");font-weight:${f.weight};font-style:normal;font-display:swap${f.unicodeRange ? `;unicode-range:${f.unicodeRange}` : ""}}`,
    );
    if (f.fallback && !fallbacks.has(f.family)) {
      fallbacks.add(f.family);
      const fb = f.fallback;
      for (const v of [fb.local, fb.sizeAdjust, fb.ascentOverride ?? "", fb.descentOverride ?? ""])
        if (!SAFE_CSS.test(v)) throw new Error(`font fallback value "${v}" is not safe CSS`);
      out.push(
        `@font-face{font-family:"${f.family} Fallback";src:local("${fb.local}");size-adjust:${fb.sizeAdjust}${fb.ascentOverride ? `;ascent-override:${fb.ascentOverride}` : ""}${fb.descentOverride ? `;descent-override:${fb.descentOverride}` : ""}}`,
      );
    }
  }
  return out.join("");
}

/** One complete HTML document for a guide. Same input, same bytes: no clock, no randomness. */
export function renderGuideHtml(o: RenderGuideHtmlOptions): string {
  const h = guideHead({ ...o.head, plan: o.plan, brand: o.brand, imageUrl: o.imageUrl });
  const n = o.nonce ? ` nonce="${esc(o.nonce)}"` : "";
  const fonts = o.fonts ?? [];
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(h.title)}</title>`,
    `<meta name="description" content="${esc(h.description)}">`,
    `<meta name="robots" content="${h.robots}">`,
    `<meta name="color-scheme" content="${h.colorScheme}">`,
    `<meta name="theme-color" content="${esc(h.themeColor)}">`,
    `<link rel="canonical" href="${esc(h.canonical)}">`,
    `<meta property="og:title" content="${esc(h.title)}">`,
    `<meta property="og:description" content="${esc(h.description)}">`,
    `<meta property="og:url" content="${esc(h.canonical)}">`,
    '<meta property="og:type" content="website">',
    ...(h.ogImage
      ? [
          `<meta property="og:image" content="${esc(h.ogImage.url)}">`,
          `<meta property="og:image:width" content="${h.ogImage.width}">`,
          `<meta property="og:image:height" content="${h.ogImage.height}">`,
        ]
      : []),
    ...(h.manifest ? [`<link rel="manifest" href="${esc(h.manifest)}">`] : []),
    ...(h.appleIcon ? [`<link rel="apple-touch-icon" href="${esc(h.appleIcon)}">`] : []),
    ...h.preloads.map(
      (p) =>
        `<link rel="preload" as="image" href="${esc(p.href)}"${p.imageSrcSet ? ` imagesrcset="${esc(p.imageSrcSet)}" imagesizes="${esc(p.imageSizes ?? "100vw")}"` : ""} media="${esc(p.media)}" fetchpriority="high">`,
    ),
    ...fonts
      .filter((f) => f.preload)
      .map(
        (f) => `<link rel="preload" as="font" type="font/woff2" href="${esc(f.src)}" crossorigin>`,
      ),
    ...(fonts.length ? [`<style${n}>${fontCss(fonts)}</style>`] : []),
  ].join("\n");
  const body = renderToStaticMarkup(<AlpenglowGuide {...o} />);
  return `<!doctype html>\n<html lang="en">\n<head>\n${head}\n</head>\n<body style="margin:0;background:${esc(o.brand.fields.paper)}">\n${body}\n</body>\n</html>\n`;
}
