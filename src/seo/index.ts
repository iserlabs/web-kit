export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

export interface PageMetaInput {
  title: string;
  description: string;
  canonical: string;
  siteName?: string;
  image?: string;
  type?: "website" | "article";
  locale?: string;
  alternates?: HreflangAlternate[];
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    siteName?: string;
    images?: { url: string }[];
    type: "website" | "article";
    locale?: string;
  };
  twitter: {
    card: "summary" | "summary_large_image";
    title: string;
    description: string;
    images?: string[];
  };
  languages: Record<string, string>;
}

export function pageMeta(input: PageMetaInput): PageMeta {
  const languages: Record<string, string> = {};
  for (const alt of input.alternates ?? []) {
    languages[alt.hreflang] = alt.href;
  }
  return {
    title: input.title,
    description: input.description,
    canonical: input.canonical,
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.canonical,
      siteName: input.siteName,
      images: input.image ? [{ url: input.image }] : undefined,
      type: input.type ?? "website",
      locale: input.locale,
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      title: input.title,
      description: input.description,
      images: input.image ? [input.image] : undefined,
    },
    languages,
  };
}
