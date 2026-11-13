import type { GuideBrand } from "../brand";
import type { Plan } from "../plan";
import { type ImageUrl, identityUrl, srcSet, widthsFor } from "./image";

export type GuideHeadInput = {
  plan: Plan;
  brand: GuideBrand;
  /** The page's own canonical URL; og:url is the same. */
  canonical: string;
  /** Live wording. Default: "<name> guest guide · <brand>". */
  title?: string;
  /** Live wording, from the site. Default: the title. */
  description?: string;
  /** The house's own cover crop for link previews. */
  ogImage?: { url: string; width: number; height: number; alt?: string };
  manifest?: string;
  appleIcon?: string;
  imageUrl?: ImageUrl;
};

export type GuideHead = {
  title: string;
  description: string;
  canonical: string;
  robots: "noindex, nofollow";
  colorScheme: "light only";
  themeColor: string;
  ogImage?: GuideHeadInput["ogImage"];
  manifest?: string;
  appleIcon?: string;
  /** The cover, preloaded per window shape at high priority (it is the LCP image). */
  preloads: { href: string; imageSrcSet?: string; imageSizes?: string; media: string }[];
};

/** Everything the page head carries, for the static renderer or a Next `generateMetadata`. */
export function guideHead(i: GuideHeadInput): GuideHead {
  const url = i.imageUrl ?? identityUrl;
  const title = i.title ?? `${i.plan.name} guest guide · ${i.brand.name}`;
  const p = i.plan.cover.photo;
  const preloads: GuideHead["preloads"] = [];
  if (p) {
    const wideMedia = "(min-width: 700px)";
    preloads.push({
      href: url(p.portrait.src, 1170),
      imageSrcSet: srcSet(p.portrait.src, [828, 1170], url),
      imageSizes: "100vw",
      media: p.wide ? "(max-width: 699px)" : "all",
    });
    if (p.wide)
      preloads.push({
        href: url(p.wide.src, 2400),
        imageSrcSet: srcSet(p.wide.src, widthsFor(p.wide.width, [1600, 2400]), url),
        imageSizes: "100vw",
        media: wideMedia,
      });
  }
  return {
    title,
    description: i.description ?? title,
    canonical: i.canonical,
    robots: "noindex, nofollow",
    colorScheme: "light only",
    themeColor: i.brand.fields.arrival,
    ogImage: i.ogImage,
    manifest: i.manifest,
    appleIcon: i.appleIcon,
    preloads,
  };
}

/** The same head as a Next.js Metadata-shaped object (no Next import in the kit). */
export function guideMetadata(h: GuideHead) {
  return {
    title: h.title,
    description: h.description,
    alternates: { canonical: h.canonical },
    robots: { index: false, follow: false },
    manifest: h.manifest,
    icons: h.appleIcon ? { apple: h.appleIcon } : undefined,
    openGraph: {
      title: h.title,
      description: h.description,
      url: h.canonical,
      type: "website",
      images: h.ogImage ? [h.ogImage] : undefined,
    },
    other: { "color-scheme": h.colorScheme },
  };
}
