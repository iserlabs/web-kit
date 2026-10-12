# Payments rail: on-site Stripe checkout and payment links

**Date:** 2026-10-12
**Status:** approved in conversation, 2026-10-12. Implementation plan to follow at `../plans/2026-10-12-payments-rail.md`.
**Package:** `@iserlabs/web-kit`, new `payments` export, a `payments init` CLI subcommand and an audit check
**Out-of-repo wiring:** `~/.claude/skills/throughline/SKILL.md` phases 1, 4 and 10, `~/.claude/skills/throughline/references/production-handoff.md`, one auto-memory file
**First consumer:** julianpotulicki.com, spec at `julianpotulicki/docs/superpowers/specs/2026-10-12-julian-payments-design.md`
**Base:** written against `origin/main` at `b20f80a` (v0.9.2). GitHub was unreachable from the authoring sandbox, so rebase onto the real tip before implementing.

## The rule this implements

Any site built on the kit can take payments on its own pages, in its own design, by switching one
setting on and supplying the site owner's own Stripe keys. A site with the switch off carries none
of it. Jake ruled this a reusable feature, not a one-off for Julian, and ruled that `/throughline`
offers it whenever a site sells something directly.

Two ways to pay, both on the site's own domain:

1\) **Buy an item.** A listed item at a public price, bought off its page.
2\) **Pay a link.** A custom amount and a one-line description the owner creates in a private
admin page, then sends to a buyer themselves: a commission deposit, an agreed price, a shipping
quote. The kit never sends anything.

## Decisions already taken (do not re-open)

1\) **Stripe**, in the site owner's own account. The money never touches an iserlabs account.
2\) **On-site form**, not Stripe's hosted page. Card data still never touches our servers: Stripe's
Elements render the fields, and our code only ever holds a session id. Jake chose this over the
hosted page knowing it is roughly three times the code.
3\) **Stripe Tax** where the site turns tax on, at 0.5% of the sale.
4\) **No email from the kit.** Buyers get Stripe's receipt; owners get Stripe's own payment
notifications. This keeps the rail clear of the account-wide ban on Claude sending email.

## Stripe primitive

Checkout Sessions with `ui_mode: "elements"` (confirmed in Stripe's API reference, 2026-10-12:
`ui_mode` accepts `elements | embedded_page | form | hosted_page`). This gives automatic tax,
shipping address collection, shipping options and dynamic payment methods (card, Apple Pay, Google
Pay, US bank account) from the Checkout Sessions API, while the page renders Stripe's Payment
Element and Address Element inside our own layout. A raw PaymentIntent flow was rejected: it
would mean hand-building tax calculation and shipping, which Checkout Sessions already does.

Session settings: `mode: "payment"`, `expires_at` 30 minutes out (Stripe's minimum), a `return_url`
back to the site's confirmation page, `metadata: { wkSite, kind: "item" | "link", ref, fulfillment }`.

## Units

Each unit has one job and is testable alone. Server code takes a Web `Request` and returns a
`Response`, so it runs in a Next route handler today and an Astro endpoint later without change.

| Unit | Job | Depends on |
|---|---|---|
| `config` | Reads and validates the site's `payments.config.ts`: the catalog adapter, fulfillment options, tax setting, admin authorizer | zod |
| `store` | Holds, orders, links and processed webhook ids. `PaymentStore` interface plus an Upstash REST implementation using plain `fetch` (no client library), keys namespaced `wk:pay:<site>:` | nothing |
| `checkout` | Creates a Checkout Session for an item or a link, after re-reading the price on the server | config, store, stripe |
| `holds` | Claims and releases a single-quantity item | store |
| `webhook` | Verifies Stripe's signature, de-duplicates, moves orders and items between states, calls the site's `onStatus` | store, stripe |
| `links` | Create, list and cancel payment links; admin-only through the site's own authorizer | store |
| `health` | Reports which pieces are configured as booleans, never values | env |
| `client` | Framework-free browser helper: `claimThenConfirm(checkout, sessionId)` and `appearanceFromTokens()`, which builds Stripe's appearance object from the site's kit token contract (`--background`, `--foreground`, `--primary`, `--radius`, `--font-sans`) read at mount | @stripe/stripe-js |
| `cli` | `web-kit payments init` scaffolds the routes, the config stub and three starter components (`Checkout`, `PayLink`, `LinkManager`) INTO the site, adds the package.json switch, prints the env vars to set | nothing |

**The kit carries no React** (its standing convention, see `CLAUDE.md`). The visible parts are
scaffolded into each site and owned there, the way shadcn primitives are, because the checkout is a
designed surface that `/throughline` art-directs per site. The money logic stays in the kit, so a
fix to holds or the webhook reaches every site on a version bump.

## What a site supplies

```ts
// src/payments.config.ts (scaffolded by `web-kit payments init`)
export default definePayments({
  site: "julianpotulicki",
  catalog: {
    // Source of truth for price and availability. Called on every checkout, never cached.
    getItem: async (id) => ({ id, name, amountCents, currency: "usd", image, kind: "unique", available }),
    // Called by the webhook on every state change. Must be idempotent: Stripe retries.
    onStatus: async (id, status /* "reserved" | "sold" | "available" */, order) => {},
  },
  fulfillment: [
    { id: "pickup", label: "Collect from the studio", kind: "pickup", taxAddress: { /* origin */ } },
    { id: "ship", label: "Ship to me (quoted separately)", kind: "ship-quoted" },
    // also supported: { kind: "ship-flat", amountCents }, { kind: "none" } for links and digital goods
  ],
  tax: { automatic: true },
  authorizeAdmin: async (req) => boolean, // the site's own login decides who manages links
});
```

`kind: "unique"` means quantity one: an original painting, a single object. `kind: "stock"` items
carry a quantity and skip holds; v1 builds and tests `"unique"` only, because that is the only real
consumer. `"stock"` is typed and rejected at config time with a clear message until a site needs it.

## Flows

**Buy an item.**
1\) The item page asks `health` and `getItem`. The Buy control renders only when both say yes.
2\) The checkout page creates a session for the chosen fulfillment option. The server reads the
price from `getItem`, so a tampered page cannot change it, and refuses if the item is unavailable
or held by someone else.
3\) The buyer presses Pay. The client calls `claim(sessionId)` first. The claim is an Upstash
`SET hold:<id> <sessionId> NX EX 1800`. If another session holds the item, the claim returns 409,
and the page says the piece has just been reserved and does not confirm. Otherwise it calls
`checkout.confirm()`.
4\) A failed confirm releases the hold at once.
5\) Webhook `checkout.session.completed` with `payment_status: "paid"` marks the item sold.
With `"unpaid"`, which is a bank debit still clearing, it converts the hold into a reservation with
no expiry. `checkout.session.async_payment_succeeded` then marks it sold, and
`async_payment_failed` releases it. `checkout.session.expired` releases any hold still held by that
session.

**Pay a link.** The admin creates `{ amountCents, description, payerName? }` and gets a URL
`/pay/<id>` with a random, unguessable id. Opening it creates a session for that amount, with tax
and fulfillment per config. A canceled or already-paid link refuses with a plain message. Links
need no holds.

**States.** Item: `available -> held (30 min) -> reserved (bank debit clearing) -> sold`, with
release back to `available` from held or reserved. Link: `open -> paid | canceled`.

## Correctness rules (from the minimum coding standard)

1\) **Atomic writes.** Marking sold writes the order record and the item state in one Upstash
`MULTI/EXEC` transaction. The site's `onStatus` runs after it. If `onStatus` throws, the webhook
returns 500 so Stripe retries, and the processed-event id is recorded only after `onStatus`
succeeds.
2\) **Idempotent webhook.** Processed event ids are kept for 30 days, and a replay is a no-op that
returns 200.
3\) **No silent no-op.** With the switch on and any key missing, `health` reports exactly which one,
the Buy control does not render, and the scaffolded `LinkManager` shows "Payments are not connected" with the
missing piece named. The audit check (below) fails the build gate.
4\) **Authorization.** Every link-admin handler calls the site's `authorizeAdmin` itself. A hidden
admin link is never the gate.
5\) **Dates.** Stored as ISO-8601 UTC and displayed in the site's configured time zone, default
`America/New_York`. No date is ever built from a zone-less string.
6\) **Test mode is detected from the key prefix** (`sk_test_`), shown on every checkout page as a
visible "Practice mode" line, and live keys on a preview deploy are refused.

## The switch and the audit check

`package.json` -> `"web-kit": { "payments": { "enabled": true } }`.

`audit --tier required` gains a `payments` check that follows the `brand-pack` check's shape. When
enabled, it fetches `/api/payments/health` from the server under audit and fails on any missing
piece (secret key, publishable key, webhook secret, store), naming it. When the switch is absent,
the check is silent and passes.

The audit check never reads `payments.config.ts`, which only the app imports; it reads the
`package.json` switch and the health route, so it runs under bare Node like the brand-pack check.

Stripe libraries (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`) are
**optional peer dependencies** of the kit. `payments init` adds them to the consuming site, so a
site without payments installs nothing new.

Environment variables a site needs: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`.

## /throughline changes

1\) **Phase 1 · UNDERSTAND.** Under "Commercial reality", if the one action is a purchase, a
deposit or any payment, ask once (with `AskUserQuestion`, recommended option first) whether to
switch the payments rail on. Record the answer in the catalog as a fact with its source.
2\) **Phase 4 · ART DIRECT and Phase 5 · AUTHOR.** When the rail is on, the checkout page is a
required surface in every direction, art-directed like the rest of the site, never left as
default Stripe styling.
3\) **Phase 10 · SCALE.** When the rail is on, run `web-kit payments init` before handing to
`/perfect`.
4\) **`references/production-handoff.md`.** QA adds one line: a full practice-mode purchase and a
practice-mode link payment, end to end on a preview, with the webhook observed flipping state.

## Testing

**Unit (Vitest, fake Stripe client plus an in-memory `PaymentStore`):**
1\) Two simultaneous claims on one item: exactly one wins.
2\) A checkout request carrying a different price: the session uses the catalog price.
3\) A failed confirm releases the hold.
4\) A bank debit that fails after `completed/unpaid` releases the reservation.
5\) A canceled link and a paid link both refuse a new session.
6\) A replayed webhook event is a no-op.
7\) A bad signature returns 400.
8\) An `onStatus` that throws gives a 500 and records no processed id.
9\) A missing env var: health names it, and the Buy control does not render.
10\) A live key on a preview is refused.

**Real adapter, before any merge:** one practice-mode session is created against the real Stripe
API with `ui_mode: "elements"` and automatic tax, and the Stripe CLI forwards real webhook events
to a local server. A green unit suite is not evidence that the primitive behaves as assumed.

**Open risk to settle in that real-adapter run:** how Stripe Tax computes tax for studio pickup.
The plan is a Customer whose shipping address is the pickup `taxAddress`, which Checkout uses for
automatic tax. If Stripe does not honor that, the fallback is the Tax Calculations API with the
origin address, and the spec gets amended before Julian's adoption ships.

## Out of scope for v1

Stock items with quantities, subscriptions, discounts and coupons, multi-item carts, refunds from
the admin page (refunds happen in the Stripe dashboard), non-USD currencies, Astro scaffolding.
