# owner-statement

One engine-written `owner-statement/1` model, rendered as the owner's monthly statement page, its
print PDF, and its link preview (tags plus a 1200x630 card). Framework free `.mjs` with
`index.d.ts`; every page rule sits under `.os`.

| Export | What it does |
|---|---|
| `renderStatement(model, { logo, pdfHref?, fonts? })` | The page: `{ html, css, title, fontsHref }` |
| `validate(model)` | Plain-English errors, one named rule each; every renderer throws on a model that fails |
| `formatCents(cents, { parens? })` | `($346.71)` |
| `BRANDS` | The four token sets, including `card` (the link preview tokens) |
| `statementShareMeta(model, { place, street?, imageUrl? })` | The link preview tags |
| `renderStatementShareCard(model, { photoUrl, markUrl, place?, photoCrop?, fonts? })` | The card, as a Satori-safe tree |
| `SHARE_CARD_SIZE`, `SHARE_CARD_SAFE` | 1200x630, and the center box (x 315 to 885) every word stays inside |

## Link preview (option 1, photo and seal, picked 2026-11-12)

The owner's home fills the card, the brand's mark sits on the center line as a seal, the month
large under it, a small "Owner statement" line, then "{YYYY} · {address}". Everything with words
sits in the center 570px, so the near-square WhatsApp and Google crops still show the mark, the
month and the "Owner statement" line. A long address steps down 2px at a time to 30px, then wraps.

Tags:

1) title: `{Month YYYY} owner statement · {property}`
2) description: `{brand} · {city, state}`, or `{street} · {city, state}` when the property is the
brand itself (The Columbus Hotel), which is why `street` is required there
3) image alt: `{brand} owner statement, {Month YYYY}, {property}`

The card and the tags are public: no dollar figure, no owner name and no stay count, ever. Both
functions refuse a `place` or `street` that carries money or the owner's name. Statements already
sent keep the tags they went out with; this applies from the November 2026 close on.

### Wiring it into a Next.js site

The kit carries no React. The site turns the tree into elements, the same way the brand pack's
card routes do. Two pieces, next to the statement page:

1) `app/statements/[slug]/opengraph-image.tsx`, the card:

```tsx
import type { ShareCardTree } from "@iserlabs/web-kit/owner-statement";
import { renderStatementShareCard, SHARE_CARD_SIZE } from "@iserlabs/web-kit/owner-statement";
import { ImageResponse } from "next/og";
import { createElement, type ReactElement, type ReactNode } from "react";
import { loadStatement } from "@/lib/statements"; // the site's own model loader

export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

function toElement(node: ShareCardTree, key?: string): ReactElement {
  const { tag, style, children = [], src, alt } = node;
  const props: Record<string, unknown> = { style, key };
  if (src !== undefined) props.src = src;
  if (alt !== undefined) props.alt = alt;
  if (tag === "img") Object.assign(props, { width: style.width, height: style.height });
  return createElement(tag, props, ...children.map(toChild));
}
function toChild(child: ShareCardTree | string, i: number): ReactNode {
  return typeof child === "string" ? child : toElement(child, String(i));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { model, photoUrl, photoCrop, markUrl, place } = await loadStatement(slug);
  return new ImageResponse(
    toElement(renderStatementShareCard(model, { photoUrl, photoCrop, markUrl, place })),
    { ...SHARE_CARD_SIZE, fonts: await brandFonts(model.brand) }, // load the TTFs the card names
  );
}
```

Load each face under the plain family name in `BRANDS[brand].card` (`monthFont`, `subFont`,
`labelFont`), at the weights given there, or pass `fonts: { display, text }` with the names you
loaded them under. `photoUrl` and `markUrl` must be absolute addresses or data URIs; a missing
photo renders a visible "No photo supplied" card, a missing mark "No mark supplied".

2) `generateMetadata` on the statement page, the tags:

```ts
import { statementShareMeta } from "@iserlabs/web-kit/owner-statement";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { model, place, street } = await loadStatement(slug);
  const meta = statementShareMeta(model, { place, street });
  return {
    title: meta.title,
    description: meta.description,
    openGraph: { type: "website", title: meta.title, description: meta.description, siteName: meta.siteName },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
  };
}
```

The `opengraph-image` file adds the `og:image`, its size and its alt (`export const alt` or the
route's default); set `alt` to `meta.imageAlt` when the site builds the image entry by hand
(`imageUrl` returns a ready `image` object for that).

### Crawlers must reach the tags without the password

iMessage, WhatsApp, Slack and Google fetch the link with no password and no cookie. If the gate
redirects them, the preview is blank or shows the gate page's generic tags.

1) The image route is public: leave `opengraph-image` out of the middleware matcher (or any gate
that wraps the statement folder).
2) The locked page still emits the statement's tags: run `generateMetadata` whatever the lock
state, and render the password form in the body. Only the statement itself sits behind the
password.
3) Check it the way a crawler sees it: fetch the page with no cookie and read the `og:` tags, then
fetch the image route and confirm a 200 PNG.

Nothing on the card or in the tags is private, which is the reason both are allowed to be public.
