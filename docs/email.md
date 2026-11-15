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
- Layout: the paper letterhead, 600px column, light only, real-text header when there is no artwork,
  alt text on every image, well under the 102KB Gmail clip.
- Switch: a kind sends only when its variable is exactly `1`, `true`, `on` or `yes`. Unset is off.
  On without a mail key returns `not_configured`; it is never a silent success.
- `lintMessage` checks all of this (subject shape, em dash, exclamation mark, size, light only, alt
  text, spelling, stock words, a stray phone number). Run it on every email in the site's tests and
  write the previews with `writePreviews` from `@iserlabs/web-kit/email/preview`.
