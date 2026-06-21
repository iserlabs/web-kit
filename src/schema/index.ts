type JsonLd = Record<string, unknown> & { "@context": "https://schema.org" };

export interface OrganizationInput {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}
export function organization(input: OrganizationInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.sameAs ? { sameAs: input.sameAs } : {}),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}
export function breadcrumb(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}
export function faq(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

export interface LodgingBusinessInput {
  name: string;
  url: string;
  image?: string;
  telephone?: string;
  priceRange?: string;
  address: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
}
export function lodgingBusiness(input: LodgingBusinessInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: input.name,
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.priceRange ? { priceRange: input.priceRange } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: input.address.street,
      addressLocality: input.address.city,
      addressRegion: input.address.region,
      postalCode: input.address.postalCode,
      addressCountry: input.address.country,
    },
  };
}
