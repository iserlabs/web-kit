# Email framework

`@iserlabs/web-kit/email` is the shared frame for a site's automatic emails. A site keeps its own
facts (name, colors, header image, sender address, the words of each email) and passes them in.

## One email

```js
import { composeConfirmation, deliver, mailSwitch, makeReference } from "@iserlabs/web-kit/email";

const message = composeConfirmation({
  brand,                       // { business, config, person, from, replyTo, fontsHref? }
  to: visitor.email,
  kind: "Inquiry received",    // the middle part of the subject
  recipientName: visitor.name, // the last part of the subject
  date: new Date(),
  lead: "We received your inquiry.",
  received: [["Dates", "December 1 to January 5"]],
  reference: makeReference("INQ", new Date(), visitor.email),
  next: ["We read it today.", "You get a reply within one business day."],
  replyLine: "Reply to this email and a person answers it.",
});

await deliver(message, {
  switchOn: mailSwitch(process.env, "MAIL_INQUIRY_RECEIPT").on,
  configured: Boolean(process.env.RESEND_API_KEY),
  transport,                   // the site's own function that hands the message to its mail service
});
```

## The standard it holds

- Subject: `<Business> | <what it is> | <name or reference>, <Month D, YYYY>`, date in the business's time zone.
- Body: what was received, a reference, what happens next, who replies. A plain-text part always ships.
- Layout: the Specimen (one design for every signing and form email, from the sign-kit's
  `signer-email-core.ts`, generated here as `src/email/specimen.mjs`): a tinted ground, the
  business's real logo (or its name as live text), one large sentence, a sheet of what was received
  and the reference, the person who answers. 600px column, light only, web font then a real fallback
  (never Times New Roman), alt text on every image, well under the 102KB Gmail clip.
- Switch: a kind sends only when its variable is exactly `1`, `true`, `on` or `yes`. Unset is off.
  On without a mail key returns `not_configured`; it is never a silent success.
- `lintMessage` checks all of this (subject shape, em dash, exclamation mark, size, light only, alt
  text, spelling, stock words, a stray phone number). Run it on every email in the site's tests and
  write the previews with `writePreviews` from `@iserlabs/web-kit/email/preview`.

## The Specimen, and how a business wears it

`composeConfirmation` and `composeEmail` build the Specimen from the business's brand-pack `config`
(paper, surround, ink, brand and accent colors, display and body fonts). A site refines it with
`brand.specimen`:

```js
const brand = {
  business: "Palisade Stays",
  config,
  person: { name: "Jake Lee", title: "Founder, Palisade Stays", email: "hello@palisadestays.com" },
  from, replyTo,
  fontsHref: "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap",
  specimen: {
    deep: "#2a2d31",            // the button and the signed name; defaults to config.ink
    gold: "#b5975a",            // the rule and stamp tint; defaults to config.brand
    logo: { src: "https://palisadestays.com/brand/ps-horizontal.png", width: 957, height: 236, alt: "Palisade Stays" },
  },
};
```

Content: `headline` (defaults to the kind as a sentence), `lead`, `sheetTitle` and `caption` for the
sheet, `received` rows, `reference`, `next` (typed 1) 2) 3) under the sheet), `replyLine`. Links in a
paragraph are written `[label](https://url)`. The sign-off is the brand's `person`.

Do not edit `src/email/specimen.mjs` or `specimen.d.mts`: change the sign-kit's `signer-email-core.ts`
and run `pnpm emails:vendor-webkit <this repo>` there.
