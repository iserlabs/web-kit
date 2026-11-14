// Legal pages for every site built on the kit: one Privacy Policy and one Terms and Conditions,
// generated from a short per-site config so the wording stays identical across the fleet and only
// the facts change. Framework-free: a site renders `sections` in its own type and layout.
//
// Rules the text keeps (do not edit them away):
// 1) Every fact is the site's own: legal name, email, what the forms ask, which services touch data.
//    Never invent an entity suffix ("LLC"), an address or a phone number. A blank field drops its
//    sentence; it never prints a placeholder.
// 2) No street address and no phone number appear in either page. Email is the contact channel.
// 3) A cookie notice exists only when `analytics.consentCookies` is non-empty, and those tools load
//    only after Accept. A site with no tracking cookies says so and shows no banner.

export interface LegalProcessor {
  /** Company name, e.g. "Vercel". */
  name: string;
  /** What it does for us, lower case, e.g. "hosts the website". */
  role: string;
}

export interface LegalConfig {
  /** Name visitors know, e.g. "Palisade Stays". */
  brand: string;
  /** Registered legal name, e.g. "Palisade Stays LLC". Same as brand when there is no separate entity. */
  legalName: string;
  /** Bare domain, e.g. "palisadestays.com". */
  domain: string;
  /** Public address for privacy and legal requests. */
  email: string;
  /** Governing-law state, spelled out, e.g. "New Jersey". */
  state: string;
  /** Effective date as printed, e.g. "November 13, 2026". */
  effective: string;
  /** What the contact or inquiry form asks for, as a plain list phrase. Omit when the site has no form. */
  formFields?: string;
  /** Booking system that takes reservations and payment, e.g. "Guesty". Omit when the site takes no bookings. */
  bookingEngine?: string;
  /** Other payment processor the site uses directly, e.g. "Stripe" or "Square". */
  payments?: string;
  /** The site collects mobile numbers and may text people who give one. Adds the carrier-required consent line. */
  textMessages?: boolean;
  /** The site offers an email list. */
  newsletter?: boolean;
  /** Services that run the site and handle data for us. Vercel is assumed when omitted. */
  processors?: LegalProcessor[];
  analytics?: {
    /** Measurement that sets no cookies, e.g. ["Vercel Web Analytics"]. */
    cookieless?: string[];
    /** Analytics or advertising tools that set cookies, e.g. ["Google Analytics", "Meta Pixel"]. Load only after consent. */
    consentCookies?: string[];
    /** Any consent tool is an advertising pixel (Meta, Google Ads, TikTok). Changes the sharing language. */
    advertising?: boolean;
  };
  /** A medical or dental practice: the site policy defers health information to the Notice of Privacy Practices. */
  healthcare?: boolean;
  /** What the business does, for the terms, e.g. "short-term rental management". Used when there is no booking engine. */
  service?: string;
}

export interface LegalTable {
  /** Visible caption, also the table's accessible name. */
  caption: string;
  columns: string[];
  /** One array of cells per row, same length as `columns`. The first cell names the row. */
  rows: string[][];
}

export interface LegalSection {
  /** Anchor id: the section is linkable as /privacy#<id>. */
  id: string;
  heading: string;
  /** Rendered before the paragraphs when present. */
  table?: LegalTable;
  paragraphs: string[];
}

/**
 * How a site renders a document (the bar every legal page meets):
 * 1) h1 title, then "Effective <date>" in a <time> element.
 * 2) "At a glance": the `summary` lines as a short list in a quiet bordered panel, before anything
 *    else. These are the plain-English promises; the sections below are the binding detail.
 * 3) The intro paragraph, then "Contents": a numbered list of links to every section (#id).
 * 4) Each section an h2 numbered to match the contents ("1. What we collect"), with `id` set
 *    and `scroll-margin-top` clearing any sticky header. A table renders as a real <table> with
 *    <caption> and <th scope="col">, horizontally scrollable inside its own wrapper on a phone,
 *    never squeezing the page.
 * 5) Reading column ~65ch, body 17-18px, line-height ~1.65, the site's own fonts and colors, light.
 * 6) Print: hide header, footer, cookie notice and contents; black text; URLs stay readable.
 */
export interface LegalDocument {
  title: string;
  effective: string;
  /** Plain-English promises shown first, 4 to 6 lines. */
  summary: string[];
  intro: string;
  sections: LegalSection[];
}

const listOf = (items: string[]): string => {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

// For items that carry their own commas: "a; b; and c".
const listOfSemi = (items: string[]): string => {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]}; and ${items[1]}`;
  return `${items.slice(0, -1).join("; ")}; and ${items[items.length - 1]}`;
};

const operatedBy = (c: LegalConfig): string =>
  c.legalName === c.brand ? c.brand : `${c.brand}, operated by ${c.legalName}`;

export const hasCookieConsent = (c: LegalConfig): boolean =>
  (c.analytics?.consentCookies?.length ?? 0) > 0;

export function privacyPolicy(c: LegalConfig): LegalDocument {
  const processors: LegalProcessor[] = c.processors?.length
    ? c.processors
    : [{ name: "Vercel", role: "hosts the website" }];
  const consent = hasCookieConsent(c);
  const ads = consent && c.analytics?.advertising === true;
  const sections: LegalSection[] = [];

  const collect: string[] = [];
  if (c.formFields) {
    collect.push(`Information you give us. When you use a form on this site, we receive what you enter: ${c.formFields}.`);
  }
  if (c.bookingEngine) {
    collect.push(
      `Bookings. Reservations are made through ${c.bookingEngine}, our booking system. It collects your name, contact details, stay dates, guest count and payment card, and processes the payment. We receive the reservation details. We never see or store your full card number.`,
    );
  }
  if (c.payments) {
    collect.push(`Payments. Payments on this site are processed by ${c.payments}. We never see or store your full card number.`);
  }
  if (c.newsletter) {
    collect.push("Email updates. If you sign up for updates, we keep your email address to send them. Every email has a link to stop them.");
  }
  const auto = [
    "Information collected automatically. When you visit, our hosting provider receives the technical data every website receives: IP address, browser and device type, the pages requested and the time of each request.",
  ];
  if (c.analytics?.cookieless?.length) {
    auto.push(`We count visits with ${listOf(c.analytics.cookieless)}, which measures page views without cookies and without identifying you.`);
  }
  if (consent) {
    auto.push(
      `If you choose Accept in the cookie notice, ${listOf(c.analytics?.consentCookies ?? [])} also ${c.analytics?.consentCookies?.length === 1 ? "records" : "record"} how you arrived and how you use the site.`,
    );
  }
  collect.push(auto.join(" "));
  collect.push(
    c.healthcare
      ? "This site does not ask for medical information, and you should not send it through a website form. Health information you give us as a patient is protected under our Notice of Privacy Practices, which governs it in place of this policy."
      : "We do not ask for government ID numbers, precise location, health information or other sensitive data through this site.",
  );
  const host = processors[0]?.name ?? "Vercel";
  const helpers = processors.map((p) => p.name).filter((n) => n !== c.bookingEngine && n !== c.payments);
  const rows: string[][] = [];
  if (c.formFields) {
    rows.push(["What you send us", c.formFields, "You, through a form or by email", "To answer you and follow up", listOf(helpers)]);
  } else {
    rows.push(["What you send us", "Whatever you choose to write to us", "You, by email", "To answer you and follow up", "Our email provider"]);
  }
  if (c.bookingEngine) {
    rows.push(["Booking details", "Name, contact details, stay dates, guest count", "You, when you book", "To take and look after your booking", c.bookingEngine]);
  }
  if (c.bookingEngine || c.payments) {
    rows.push(["Payment card", "Card number and billing details", "You, at checkout", "To take payment", `${c.payments ?? c.bookingEngine} only; we never see the full number`]);
  }
  if (c.newsletter) {
    rows.push(["Email address for updates", "Your email address", "You, when you sign up", "To send the updates you asked for", listOf(helpers)]);
  }
  rows.push([
    "Visit data",
    "IP address, browser and device type, pages and times",
    "Your browser, automatically",
    "To run and secure the site",
    listOf([host, ...(c.analytics?.cookieless ?? [])]),
  ]);
  if (consent) {
    rows.push([
      "Analytics",
      "How you arrived and moved through the site",
      "Cookies, only after you choose Accept",
      ads ? "To improve the site and measure our ads" : "To improve the site",
      listOf(c.analytics?.consentCookies ?? []),
    ]);
  }
  sections.push({
    id: "collect",
    heading: "What we collect",
    table: {
      caption: "What we collect, at a glance",
      columns: ["Information", "Examples", "Where it comes from", "Why", "Who else handles it"],
      rows,
    },
    paragraphs: collect,
  });

  const uses = ["to answer your inquiry and follow up on it"];
  if (c.bookingEngine) uses.push("to take, confirm and look after your booking");
  if (c.payments) uses.push("to process payments");
  if (c.newsletter) uses.push("to send the updates you asked for");
  uses.push("to run, secure and fix the site", "to keep the records the law requires");
  sections.push({
    id: "use",
    heading: "How we use it",
    paragraphs: [
      `We use your information ${listOfSemi(uses)}. We do not use it to make automated decisions that have legal or similarly significant effects on you.`,
    ],
  });

  const share = [
    ads
      ? "We do not sell your personal information. If you allow advertising cookies, the advertising platforms named above receive data about your visit, which some state laws call sharing for targeted advertising. You can refuse or withdraw that at any time, and we treat a Global Privacy Control signal from your browser as a refusal."
      : "We do not sell your personal information, and we do not share it for targeted advertising.",
    `We share it only with the companies that run this site and our business for us, under terms that limit them to our instructions: ${listOfSemi(
      processors.map((p) => `${p.name}, which ${p.role}`),
    )}.${c.bookingEngine && !processors.some((p) => p.name === c.bookingEngine) ? ` ${c.bookingEngine} handles bookings under its own privacy policy as well as ours.` : ""}`,
    "We may also disclose information when the law requires it, to protect someone's safety or our legal rights, or as part of a sale or reorganization of the business, in which case this policy continues to cover it.",
  ];
  if (c.textMessages) {
    share.push(
      "Mobile numbers and text-message consent are never shared with third parties or affiliates for their marketing. If we text you, reply STOP to any message to stop, or HELP for help. Message and data rates may apply.",
    );
  }
  sections.push({ id: "share", heading: "Who we share it with", paragraphs: share });

  sections.push({
    id: "cookies",
    heading: "Cookies",
    paragraphs: consent
      ? [
          `Cookies the site needs to work are always on. ${ads ? "Analytics and advertising cookies" : "Analytics cookies"} load only after you choose Accept in the cookie notice, and the site works the same if you decline. You can change your choice at any time with the Cookie settings link at the bottom of every page.`,
          "Browsers' Do Not Track setting has no common standard, so we do not respond to it. We do honor Global Privacy Control.",
        ]
      : [
          "This site sets no advertising or tracking cookies. It may use a small number of cookies it needs to work, such as remembering a choice you made, so there is nothing to opt out of.",
          "Browsers' Do Not Track setting has no common standard, so we do not respond to it. Because we do not track you across sites, it would change nothing here.",
        ],
  });

  const keep = ["We keep an inquiry as long as we need it to answer you and follow up"];
  if (c.bookingEngine || c.payments) keep.push("booking and payment records as long as tax and accounting law requires, generally seven years");
  keep.push("technical logs for the short period our hosting provider sets");
  sections.push({
    id: "retention",
    heading: "How long we keep it",
    paragraphs: [`${listOfSemi(keep)}. After that we delete it or strip it of anything that identifies you.`],
  });

  sections.push({
    id: "security",
    heading: "How we protect it",
    paragraphs: [
      "The site runs only over an encrypted connection. Only the people who need your information to serve you can see it, and our service providers are held to the same standard. No system is perfectly secure; if a breach affects your information, we will tell you as the law requires.",
    ],
  });

  sections.push({
    id: "rights",
    heading: "Your rights",
    paragraphs: [
      "You can ask us what personal information we hold about you, and ask us to correct it, delete it or send you a copy. You can also opt out of any sale of your information, targeted advertising or profiling. Residents of California, Colorado, Connecticut, New Jersey, Virginia and other states with privacy laws have these rights by law; we give them to everyone.",
      `To make a request, email ${c.email}. We will confirm it is you using information we already hold, answer within 45 days, and never treat you differently for asking. An authorized agent may ask on your behalf. If we turn down a request, you can appeal by replying to our answer, and if you are still not satisfied, you can contact your state attorney general.`,
    ],
  });

  sections.push({
    id: "children",
    heading: "Children",
    paragraphs: [
      `This site is not meant for children under 16, and we do not knowingly collect their information. If you believe a child has sent us information, email ${c.email} and we will delete it.`,
    ],
  });

  sections.push({
    id: "international",
    heading: "Visitors outside the United States",
    paragraphs: [
      "We operate in the United States and keep information here. If you contact us from another country, your information is transferred to the United States and handled under this policy.",
    ],
  });

  sections.push({
    id: "changes",
    heading: "Changes to this policy",
    paragraphs: [
      "If we change this policy, we will post the new version on this page with a new effective date. If a change affects how we use information we already hold in a significant way, we will tell you before it applies.",
    ],
  });

  sections.push({
    id: "contact",
    heading: "Contact",
    paragraphs: [`Questions or requests about privacy: ${c.email}. ${c.legalName}.`],
  });

  const summary = [
    c.formFields || c.bookingEngine || c.payments || c.newsletter
      ? "We collect only what you give us and the basic visit data every website receives."
      : "We collect only the basic visit data every website receives, and whatever you choose to email us.",
    "We never sell your information.",
    consent
      ? ads
        ? "Analytics and advertising cookies load only if you say yes."
        : "Analytics cookies load only if you say yes."
      : "No tracking or advertising cookies.",
  ];
  if (c.bookingEngine || c.payments) {
    summary.push(`Payments run through ${c.payments ?? c.bookingEngine}. We never see your full card number.`);
  }
  if (c.textMessages) summary.push("Your mobile number is never shared for marketing.");
  summary.push(`You can see, correct or delete your information at any time: email ${c.email}.`);

  return {
    title: "Privacy Policy",
    effective: c.effective,
    summary,
    intro: `This policy covers ${c.domain}, the website of ${operatedBy(c)} ("we", "us"). It explains what we collect, why, who handles it for us and what you can ask us to do with it.`,
    sections,
  };
}

export function termsAndConditions(c: LegalConfig): LegalDocument {
  const sections: LegalSection[] = [];

  sections.push({
    id: "use",
    heading: "Using the site",
    paragraphs: [
      "You may use this site for lawful purposes. You agree not to misuse it: no attempts to break into it or overload it, no automated scraping, no spam through its forms, and nothing harmful, false or unlawful sent through it.",
    ],
  });

  sections.push({
    id: "bookings",
    heading: c.bookingEngine ? "Bookings" : "Our services",
    paragraphs: c.bookingEngine
      ? [
          "Rates, availability, house rules, cancellation terms and fees are shown at checkout and in your booking confirmation. Those booking terms, and any rental agreement you sign, govern your stay; where they differ from these terms, they control.",
          "Photos, descriptions, amenities and prices on this site are given in good faith and may change. Your booking confirmation is the final word on what you booked and what you pay.",
        ]
      : [
          `Information on this site about our ${c.service ?? "services"} is general and may change. Any work we do for you is governed by a separate written agreement, which controls where it differs from these terms. Nothing on this site is an offer or a guarantee of a particular result.`,
        ],
  });

  sections.push({
    id: "content",
    heading: "Our content",
    paragraphs: [
      `The text, photographs, design, logos and other material on this site belong to ${c.legalName} or the people who licensed them to us, and are protected by copyright and trademark law. You may view and share pages for personal use. Do not copy, republish or use them commercially without our written permission.`,
    ],
  });

  sections.push({
    id: "submissions",
    heading: "What you send us",
    paragraphs: [
      "When you send us information through the site, you confirm it is accurate and yours to share. We handle it as our Privacy Policy describes.",
    ],
  });

  sections.push({
    id: "third-parties",
    heading: "Other services",
    paragraphs: [
      `The site links to and uses services run by others${c.bookingEngine ? `, such as ${c.bookingEngine} for bookings` : ""}${c.payments ? `${c.bookingEngine ? " and" : ", such as"} ${c.payments} for payments` : ""}. We do not control them and are not responsible for their content or practices; their own terms apply when you use them.`,
    ],
  });

  sections.push({
    id: "disclaimer",
    heading: "Disclaimer",
    paragraphs: [
      'The site is provided "as is" and "as available". To the fullest extent the law allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement, and we do not promise the site will be uninterrupted or free of errors.',
    ],
  });

  sections.push({
    id: "liability",
    heading: "Limit of liability",
    paragraphs: [
      `To the fullest extent the law allows, ${c.legalName} and its owners, staff and agents are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or goodwill, arising from your use of this website. Our total liability for any claim about the website is limited to one hundred dollars ($100). Claims about a stay or a service are governed by your booking or service agreement. Nothing in these terms limits liability that the law does not allow to be limited.`,
    ],
  });

  sections.push({
    id: "indemnity",
    heading: "Your responsibility",
    paragraphs: [
      "If you misuse the site or break these terms and that leads to a claim against us, you agree to cover our resulting losses and costs, including reasonable attorneys' fees.",
    ],
  });

  sections.push({
    id: "law",
    heading: "Governing law",
    paragraphs: [
      `These terms are governed by the laws of the State of ${c.state}, without regard to its conflict-of-law rules. Any dispute about them will be decided in the state or federal courts located in ${c.state}, and you agree to those courts' jurisdiction.`,
    ],
  });

  sections.push({
    id: "changes",
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms by posting a new version on this page with a new effective date. Using the site after that means you accept the update.",
    ],
  });

  sections.push({
    id: "general",
    heading: "General",
    paragraphs: [
      "If any part of these terms is found unenforceable, the rest stays in effect. Not enforcing a term is not a waiver of it. These terms, our Privacy Policy and any booking or service agreement you have with us are the whole agreement about your use of the site.",
    ],
  });

  sections.push({
    id: "contact",
    heading: "Contact",
    paragraphs: [`Questions about these terms: ${c.email}. ${c.legalName}.`],
  });

  return {
    title: "Terms and Conditions",
    effective: c.effective,
    summary: [
      "Use the site lawfully, and do not misuse its forms.",
      c.bookingEngine
        ? "Your booking confirmation and any rental agreement govern your stay."
        : "Any work we do for you is governed by its own written agreement.",
      "The words and photographs here belong to us or the people who licensed them.",
      "The site is provided as is, and our liability for it is limited.",
      `${c.state} law applies.`,
    ],
    intro: `These terms govern your use of ${c.domain}, the website of ${operatedBy(c)} ("we", "us"). By using the site you agree to them. If you do not agree, please do not use it.`,
    sections,
  };
}

/** Plain text of a document, for a site that renders static HTML or Markdown. */
export function legalText(doc: LegalDocument): string {
  const table = (t: LegalTable | undefined): string[] =>
    t ? [t.caption, ...t.rows.map((r) => r.map((cell, i) => `${t.columns[i]}: ${cell}`).join(". "))] : [];
  return [
    doc.title,
    `Effective ${doc.effective}`,
    "At a glance",
    ...doc.summary,
    doc.intro,
    ...doc.sections.flatMap((s, i) => [`${i + 1}. ${s.heading}`, ...table(s.table), ...s.paragraphs]),
  ].join("\n\n");
}
