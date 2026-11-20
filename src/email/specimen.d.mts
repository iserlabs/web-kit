// GENERATED from the sign-kit src/lib/signer-email-core.ts (the Specimen). Do not edit by hand:
// change the kit's file and run `pnpm emails:vendor-webkit <this repo>` in the kit.
// kit-core-sha256: 7ab0275694fa3cfd0da9266141b7a199cdc9974565b7f5004f7a1ad8ce91b1ac (kit commit 2c0a8fc when generated)
/**
 * The Specimen: the ONE email design for every signing and form email across Jake's businesses
 * (picked by Jake on the round 2 board, 2026-11-14, over the Track, which was rejected).
 *
 * This file imports nothing. It holds the whole design and three ways to describe a message to it:
 *
 * - renderSignerEmail(EmailModel)   the confirmation a signer gets after signing (waiting or complete)
 * - renderOperatorEmail(OperatorModel)  the alert the business inbox gets when someone signs
 * - renderReceiptEmail(ReceiptModel)    the receipt for a form (a sheet of what was received)
 *
 * All three build a SpecimenModel and call renderSpecimen(), the layout itself. Sites that cannot
 * depend on the kit keep a byte-for-byte copy (`pnpm emails:vendor <site repo>`); the web-kit mail
 * framework gets the same layout as a generated module (`pnpm emails:vendor-webkit <web-kit repo>`),
 * so there is one design and one place to change it.
 *
 * The design: a tinted ground with the business's real logo centered at the top, one large sentence
 * saying what happened, one full-width button, then the thing itself drawn as a sheet of paper (its
 * title, its terms, and one signature line per party: a signed name sits on its line, an unsigned
 * one shows "Signature needed"), a quiet footer. No colored header band and no step track.
 *
 * Mechanics, chosen for the inboxes that actually exist:
 * - tables and inline styles; one small <style> for light-only and phone sizes (a progressive
 *   extra: the email is complete without it)
 * - 600px maximum, fluid under that; body copy 16px or more, nothing under 13px
 * - every painted cell carries BOTH bgcolor and style, so Outlook's Word engine keeps the colors
 * - web font first with a deliberate system fallback (Iowan Old Style, Charter, Georgia; Helvetica
 *   Neue, Arial), never a Times New Roman fallback
 * - the logo is a hosted image with alt text and its own background painted in; the wordmark is
 *   live text when there is no logo, so images off still shows the name
 * - the button is a plain link in every client with a VML twin for Outlook
 * - the page declares itself light-only and switches off phone auto-linking
 * - the preview line is a hidden preheader, padded so body text cannot follow it into the list
 * - the booking link is the bare address alone in its own paragraph under a footer sentence that ends
 *   in a colon, never a button and never buried in a sentence (Jake, 2026-11-20)
 * - a plain-text twin is always built, so no send ever goes out html-only
 *
 * No phone number appears anywhere on these emails. Contact is the reply.
 */
export type Palette = {
    paper: string;
    ground: string;
    ink: string;
    muted: string;
    rule: string;
    /** The brand's deep color: the button and the signed name. */
    band: string;
    bandText: string;
    /** The brand's accent: the gold rule and the stamp tint. */
    bandAccent: string;
};
export type Faces = {
    serif: string;
    sans: string;
    wordmark: string;
};
export type Term = {
    label: string;
    value: string | string[];
};
/** A hosted logo. `markOnly` marks a square mark, which is shown above the live wordmark. */
export type Logo = {
    src: string;
    width: number;
    height: number;
    alt: string;
    markOnly?: boolean;
};
export type Signer = {
    name: string;
    role?: string;
    when?: string;
};
export type EmailModel = {
    palette: Palette;
    faces: Faces;
    /** The wordmark, the footer sentence and the preheader all use this. */
    brandName: string;
    /** The document's title, e.g. "Management Agreement". */
    docTitle: string;
    /**
     * The client or place that leads the subject, e.g. "309 Cranbrook Circle, Colorado Springs".
     * Empty when the document names no one, and the subject then starts with the document.
     */
    subjectPlace?: string;
    /** Under the sheet title: the property or document, one line per entry. */
    place: string | string[];
    /** The real logo, hosted. Preferred over `mark`. */
    logo?: Logo;
    /** A square mark (the older field): shown above the live wordmark at 64px. */
    mark?: {
        src: string;
        ground: string;
    };
    /** Hosted web font stylesheet (Google Fonts) for the brand's faces. */
    fontsHref?: string;
    signedBy: string;
    /** The signer's role on the document, e.g. "Owner". */
    signedRole?: string;
    /** "November 11, 2026, 6:59 PM MST". Empty when the time cannot be read. */
    signedWhen: string;
    /** Parties who signed earlier, shown on their lines when known. */
    others?: Signer[];
    /** Parties who have not signed. Empty means the agreement is complete. */
    waiting: {
        name: string;
        role?: string;
    }[];
    /** The next real date after signing, when one exists. Never invented. */
    nextStep?: {
        what: string;
        when: string;
    };
    /** Said under the headline when the agreement is complete, e.g. "Every party has signed." */
    completeDetail: string;
    /** What happens after the missing signatures: the detail line carries the promise. */
    completion: {
        title: string;
        detail: string;
    };
    button?: {
        url: string;
    };
    /** Short sentences under the button (the attachment line). */
    note: string[];
    terms: Term[];
    /** Small-print sentences above "Keep this email for your records." */
    fineprint?: string[];
    bookUrl: string;
    /** Second footer line, e.g. the legal entity. */
    legalLine: string;
};
export type BuiltEmail = {
    subject: string;
    html: string;
    text: string;
};
export type Sheet = {
    title: string;
    place?: string;
    /** A line above the rows, e.g. "For your records, here is what you sent:". */
    caption?: string;
    rows: {
        label: string;
        value: string;
    }[];
    signatures?: {
        name: string;
        role?: string;
        signed: boolean;
        when?: string;
    }[];
    /** A reference the reader can quote, drawn as the last row. */
    reference?: {
        label: string;
        value: string;
    };
};
export type SpecimenModel = {
    subject: string;
    preheader: string;
    palette: Palette;
    faces: Faces;
    fontsHref?: string;
    brandName: string;
    logo?: Logo;
    headline: string;
    /** Paragraphs under the headline. `[label](https://url)` becomes an inline link. */
    lead: string[];
    /** The stamp on the sheet: "Complete", "Signed 1 of 2", "Received". */
    status: string;
    button?: {
        url: string;
        label: string;
    };
    /** Small lines under the button. */
    attach?: string[];
    sheet: Sheet;
    /** Paragraphs under the sheet, links as above. */
    after?: string[];
    signoff?: {
        name: string;
        title?: string;
    };
    footer: {
        reply?: string;
        /** The booking address alone in its own paragraph, under a `reply` that ends in a colon. */
        book?: string;
        fine?: string;
        legal: string;
    };
};
export declare function esc(s: string): string;
/** "A", "A and B", "A, B and C". */
export declare function joinNames(names: readonly string[]): string;
/** Keeps "6:59 PM MST" on one line so a receipt never breaks as "6:59 / PM MST". */
export declare function keepTogether(s: string): string;
export declare function isHex(v: string | undefined): v is string;
/** WCAG contrast ratio between two hex colors. */
export declare function contrast(a: string, b: string): number;
/** The first candidate that reads at 4.5:1 on the background, else the last. */
export declare function readable(bg: string, ...candidates: (string | undefined)[]): string;
export type PaletteInput = {
    paper: string;
    ground: string;
    ink?: string;
    muted?: string;
    rule: string;
    /** The brand's deep color. Used for the button only if the paper reads on it. */
    band?: string;
    bandText?: string;
    accent?: string;
};
export declare const FALLBACK: {
    readonly paper: "#fbf8f1";
    readonly ground: "#f3ede1";
    readonly ink: "#1b1a16";
    readonly muted: "#6b6455";
    readonly rule: "#e5dac4";
    readonly band: "#1b1a16";
};
/**
 * Every pair the email paints is checked here, not assumed: ink and muted on the paper, the deep
 * color against the paper it must carry as the button, the button's text and the accent. A token
 * that would fail 4.5:1 is replaced by one that passes rather than shipped unreadable.
 */
export declare function makePalette(t: PaletteInput): Palette;
export declare const SANS_STACK = "'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";
export declare const SERIF_NEWSREADER = "Newsreader,'Iowan Old Style',Charter,Georgia,serif";
export declare const SERIF_GARAMOND = "'EB Garamond',Garamond,'Iowan Old Style',Charter,Georgia,serif";
export declare const WORDMARK_CINZEL = "Cinzel,'Trajan Pro',Georgia,serif";
export declare const FONTS_NEWSREADER = "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Instrument+Sans:wght@400;500;600;700&display=swap";
export declare const FONTS_GARAMOND = "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap";
/** The default faces: Newsreader and Instrument Sans with the deliberate fallbacks. */
export declare const DEFAULT_FACES: Faces;
/** The layout itself: the one place the Specimen is drawn. Pure: no network, clock or environment. */
export declare function renderSpecimen(m: SpecimenModel): BuiltEmail;
/** "November 11, 2026, 6:59 PM MST" or "November 11, 2026 at 6:59:12 PM MST" to "November 11, 2026". */
export declare function signedDay(signedWhen: string): string;
/**
 * The subject, built to be found by search and skimmed in a list (Jake, 2026-11-14):
 * who or where, then the document, then what happened and the day it happened.
 *
 *   309 Cranbrook Circle | Management Agreement | Signed by Michael Williams, November 11, 2026
 *   309 Cranbrook Circle | Management Agreement | Fully signed, November 11, 2026
 */
export declare function subjectFor(m: Pick<EmailModel, "waiting" | "subjectPlace" | "docTitle" | "signedBy" | "signedWhen">): string;
/**
 * The confirmation a signer gets after signing. Pure: no network, no clock, no environment, so it
 * can be rendered to a file and read before anything is ever sent.
 */
export declare function renderSignerEmail(m: EmailModel): BuiltEmail;
export type OperatorModel = {
    palette: Palette;
    faces: Faces;
    brandName: string;
    logo?: Logo;
    fontsHref?: string;
    docTitle: string;
    subjectPlace?: string;
    place: string;
    signedBy: string;
    signedWhen: string;
    /** Parties still to sign. Empty means fully executed. */
    waiting: {
        name: string;
        role?: string;
    }[];
    /** The signature record: signed by, when, their email, version, fingerprint, and so on. */
    record: Term[];
    /** The signed agreement, when there is a page or file for it. */
    button?: {
        url: string;
        label?: string;
    };
    /** The attachment line, and the line saying the record is filed elsewhere. */
    note: string[];
    legalLine: string;
};
/** The alert the business inbox gets when someone signs: who, when, what is left, the record. */
export declare function renderOperatorEmail(m: OperatorModel): BuiltEmail;
export type ReceiptModel = {
    palette: Palette;
    faces: Faces;
    brandName: string;
    logo?: Logo;
    fontsHref?: string;
    /** The subject, already built (Business | what | name, Month D, YYYY). */
    subject: string;
    headline: string;
    /** Opening paragraphs; the first may be a greeting. */
    lead: string[];
    /** "Your inquiry", "What you sent". */
    sheetTitle: string;
    /** "For your records, here is what you sent:". */
    caption?: string;
    received: {
        label: string;
        value: string;
    }[];
    reference?: {
        label: string;
        value: string;
    };
    after?: string[];
    signoff?: {
        name: string;
        title?: string;
    };
    legalLine: string;
    status?: string;
};
/** The receipt for a form: a sheet of what was received and the reference. No signature lines. */
export declare function renderReceiptEmail(m: ReceiptModel): BuiltEmail;
/**
 * The cheap checks, as a list of problems (empty means clean). Pure string work, a few milliseconds
 * per email, so every state of every agreement can be checked on each test run. It does not
 * replace looking at a render; it catches what a change to the markup or the copy would silently
 * break.
 */
export declare function lintSignerEmail(m: BuiltEmail): string[];
