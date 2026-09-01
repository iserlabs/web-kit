# Brand Pack: email signature and link preview boards

**Date:** 2026-09-01
**Status:** approved, ready for implementation planning
**Package:** `@iserlabs/web-kit`, new `brand-pack` export plus a CLI subcommand and an audit check
**Out-of-repo wiring:** `~/.claude/CLAUDE.md` section 7, `~/.claude/commands/perfect.md` step 7, `~/.claude/skills/ship/SKILL.md`, one auto-memory file

## The rule this implements

Every new client website or web platform, and every major redesign of one, ships two boards on
the client's own domain: a set of email signature designs and a set of link preview card
designs, both rendered in the client's real brand, for the client to pick from.

This is not a new practice. It has been hand-built at least four times already, each time from
scratch and each time only because someone remembered to: Sun Mountain (8 signature variants
with paste-ready blocks and a per-person folder), Streamlined (7 variants), PLFA (6 variants),
and the jakejjlee link preview board (3 boards plus a 17-site research page). The Bodhicitta
share card was built as a one-off with no board at all. The point of this spec is to stop that
work being rediscovered every time, and to stop it being skipped when nobody remembers.

## Why it belongs in web-kit rather than in prose

The 2026-08-30 audit measured that 73 of 78 sessions ran a skill's own engine without the skill
ever loading. A rule that lives only in a document is a rule that gets walked past. Putting the
routes in the template every client site already consumes means a site that lacks a brand pack
fails its own ship gate, so the rule holds without anyone remembering it.

## What gets built

### 1. Routes on the client site

Three routes, scaffolded into the consumer repo:

1) `/brand`, a short index that names the two boards and links them. Built to hold logo files,
   a palette sheet and a type specimen later; those are not in scope now.
2) `/brand/signature`, the email signature board.
3) `/brand/share`, the link preview board.

All three are unlisted: excluded from the sitemap, absent from every nav, and carrying
`robots: { index: false, follow: false }`. No password. The contact details on a signature go
out on every email the client sends, so they are public by design, and a gate is one more thing
that breaks the day a staff member needs their own block.

A repo whose client has someone with a direct number that is not published anywhere else can
gate the route by hand. That is a per-client decision made at handover, not a default.

### 2. The signature board

Five designs, following `~/.claude/shared/visual-tuning-board.md`:

1) Five options is the default, and the client never has to ask for it.
2) A one-line premise printed at the top of the board, stating as a disagreeable sentence the
   one thing all five assume, so a set-level rejection kills the premise rather than the options.
3) If the client already uses a signature, it renders as option 0 in the same treatment.
4) Nothing rejected in a round comes back in the next one, and the board says which round it is.

The five differ by construction, not decoration:

1) **Ruled letterhead.** Mark left, vertical brand rule, name and title and company stacked
   right, hairline beneath, contact line under that. The Sun Mountain shape.
2) **Single line.** Everything on one typographic line, no logo at all. The smallest footprint,
   and the one that survives a long reply chain best.
3) **Stacked lockup.** Mark above, name below, wordmark-forward, for a brand whose mark carries
   the recognition.
4) **Two column.** Vertical brand rule between an identity column and a column carrying a
   booking or inquiry link.
5) **Tinted card.** A block in the brand's secondary color with the mark reversed out.

Each design renders a copy-ready block per named person the client has supplied. One design set,
many people, the way the `allan/` folder worked on Sun Mountain. Nobody hand-edits HTML.

#### Email compatibility rules (these are the craft floor, not preferences)

1) Nested tables with `role="presentation"`, `cellpadding="0"`, `cellspacing="0"`, `border="0"`
   and `border-collapse:collapse`.
2) Inline styles only. No `<style>` block, no classes, no CSS custom properties.
3) No flexbox, no grid, no background images, no pseudo-elements.
4) No web fonts. Font stacks only, degrading to Georgia and Arial. The brand display face is
   named first and is expected to be absent in most clients.
5) Under 600px wide.
6) The mark is a hosted PNG served from the client's own domain at 2x, with explicit `width`,
   `height`, `display:block`, `border:0` and real alt text.
7) Colors chosen to survive the automatic inversion Outlook and Apple Mail apply in dark mode.
   Near-black on near-white inverts legibly; a mid-tone on a tinted ground often does not. The
   tinted card design is the one that needs checking, not assuming.
8) No em dashes. American English. No italicized body text.

#### The copy mechanism

Each block carries a copy button that writes both `text/html` and `text/plain` to the clipboard
using `ClipboardItem`, so a paste into Gmail or Outlook lands formatted rather than as source.
Safari needs the promise form of `ClipboardItem`, so the implementation passes a promise, not a
resolved blob. Where the API is unavailable the button falls back to selecting the block's range
so the manual copy still works, and says so in its label.

### 3. The link preview board

Five cards, same board rules as above, each shown inside accurate platform chrome: iMessage,
WhatsApp, Slack, LinkedIn, X, Facebook and a Google result.

The five vary on how much weight sits on photograph, on type and on the mark:

1) Full-bleed photograph with a lower-third scrim carrying the wordmark and one line.
2) Type only on brand ground: the name set large in the display face, a rule, the tagline.
3) Mark centered on brand ground inside a double rule. The Bodhicitta shape.
4) Split: photograph on one half, a type block on the other.
5) Photograph with the mark alone and no text, for a brand whose name is already in the URL.

**The crops are the reason this board exists.** One 1200 by 630 file is cropped differently by
every platform: LinkedIn holds roughly 1.91:1, WhatsApp reduces to a small near-square thumbnail,
iMessage renders a large rich link, and a Google result may show a small square. A card that
reads beautifully full-bleed can be unreadable as a WhatsApp thumb. The board shows those real
crops side by side so the client picks a card that survives all of them, not one that photographs
well in isolation.

**The cards on the board are real renders, not mockups.** Each variant is served by the same
`next/og` code path that serves the live card, at `/brand/share/card/[variant]`. What the client
approves is byte-identical to what ships. Mockups would make the board a lie.

Known `next/og` constraint, learned on Bodhicitta: Satori cannot read woff2 or variable fonts, so
card text needs static TTF subsets fetched at build time. The brand-pack card renderer carries
that font loader so each consumer does not rediscover it.

### 4. Generation model

Five tokenized defaults ship in web-kit and render automatically from the client's brand config,
so a site with no extra authoring still gets a real board in its own type, palette and mark. A
per-client override file replaces or art-directs any of the five where the brand needs something
the defaults cannot reach.

This is the fork between cheap and templated, and it is deliberately settled toward cheap with an
escape hatch. Five identical shapes across every client we serve would be the exact templated
tell the design bar exists to catch, so the override path is a first-class part of the module,
not an afterthought.

### 5. Module surface

web-kit is consumed as source through a pinned git ref, with no build step and no `dist/`, so
the file extension decides who can run the code. App-consumed code is `.ts` or `.tsx`, transpiled
by the consuming Next app. CLI and audit code is `.mjs`, because it runs under bare Node with no
`tsx` available to consumers. The brand pack splits along that line: the board components,
variant renderers and config loader are `.tsx` and `.ts`; the `brand-pack init` scaffold and the
audit check are `.mjs`.

Shipping this therefore means cutting a tag, and a client site picks it up by bumping its pinned
ref and running `pnpm install`. Nothing reaches an existing site until someone bumps it.

New export `@iserlabs/web-kit/brand-pack`:

1) `signatureVariants`: five renderers, each `(config, person) => string` returning email-safe
   HTML.
2) `shareCardVariants`: five renderers, each `(config) => ReactElement` for `ImageResponse`.
3) Board components: `<BrandPackIndex />`, `<SignatureBoard />`, `<ShareBoard />`.
4) Platform chrome components for the seven frames.
5) `loadBrandPackConfig()`, reading `brand-pack.config.ts` from the consumer repo.
6) The static TTF font loader for Satori.

Consumer config, `brand-pack.config.ts`, holds every value explicitly: the brand tokens the
boards render with (display face, body face, ink, ground, primary and secondary brand colors,
hosted mark URL, wordmark, tagline, site URL), the people list, the picked share card variant,
and an optional `overrides` map. Explicit rather than derived, because a signature has to hold
still while a site's theme moves.

`brand-pack init` seeds those tokens by reading the site's Tailwind theme and content config
where it can find them, and writes what it could not resolve as a visibly unfilled value that
the audit check fails on. It guesses nothing.

### 6. CLI

`web-kit brand-pack init [siteDir]` scaffolds the config file and the three routes, following
the existing `bin/web-kit.mjs` dispatch pattern (a bare `if (cmd === ...)` block, positional dir,
exit code 0 or 1). It refuses to overwrite an existing `brand-pack.config.ts`.

### 7. Audit check

A new check module at `src/audits/checks/brand-pack.mjs`, run from `runRequiredAudit`, matching
the existing check shape: a pure function returning findings of
`{ severity, code, message }`, honoring the `config.severity[code]` override including `"off"`,
and covered by a `brand-pack.test.ts` beside it.

Codes:

1) `brand-pack-missing`, error: the site has adopted web-kit and is a client site, and has no
   `brand-pack.config.ts`.
2) `brand-pack-unpicked`, error: a config exists but no share card variant is picked.
3) `brand-pack-placeholder`, error: a person in the config has an unfilled name, title, phone or
   email. Honest content only, so an unfilled field must fail rather than render an invented one.
4) `brand-pack-routes-missing`, error: a config exists but one of the three routes does not.

#### The adoption problem, and how it is handled

Making `brand-pack-missing` blocking on day one would red-line the eight web-kit consumer sites
that have no brand pack today (90 North, Boutique Stays, Fountain Creek, CB Cleans, the starter,
Julian Potulicki, Kutsu Point, Landstar, and any others that have adopted since). That is a
gate crying wolf on day one, and a check that cries wolf gets switched off.

So:

1) Checks 2, 3 and 4 are blocking wherever a `brand-pack.config.ts` exists. A site that has one
   must have it right.
2) Check 1 is blocking on every site that has adopted web-kit and is not the template. The code
   has no way to tell a client site from an internal one, and inventing a flag for that would be
   a second thing to forget, so internal surfaces declare the same reasoned opt-out that a
   not-yet-backfilled client site does. The opt-out must carry a written reason and a date, and
   is declared in `package.json` under the existing `web-kit` field the doctor already reads:

   ```json
   "web-kit": { "brandPack": { "skip": true, "reason": "...", "date": "2026-09-01" } }
   ```

   A `skip` with no reason or no date is itself an error. That way backfilling Palisade, 90
   North, Fountain Creek and the rest is a scheduled decision rather than eight red gates
   appearing at once.
3) The template opts out through the existing `web-kit.template.json` marker, the same way the
   doctor already exempts it from identity checks.

## Timing in the build

The brand pack is produced after the site is built and its type and palette are locked, at
handover, before ship. Building it earlier means rebuilding it, since a signature and a share
card are made of exactly the tokens a later refinement would move. Handover already asks the
client to look at something, so this rides along rather than adding a stop.

The site ships with the recommended card already wired as the real `opengraph-image`, so it is
never live with a bare default during the window when a launch is most likely to be shared. The
wiring is a re-export: the site's `src/app/opengraph-image.tsx` renders whichever variant
`brand-pack.config.ts` names in `shareCard`, and `twitter-image.tsx` re-exports that same module
so X gets the identical card. The client's pick then changes one word in the config, and the
board the client approved and the card the world sees cannot drift apart.

## Trigger scope

New client sites and platforms, and major redesigns or rebrands of existing client sites. A
redesign moves the type and palette a signature is made of, so leaving it out means the client's
signature contradicts their new site.

Internal and personal surfaces (Xenia Ops Hub, Docket, jakejjlee) are out of scope by default.
They have no outside recipient, so the deliverable would go unopened.

## Quality bar

The boards are client-facing surfaces, so they meet the design bar themselves rather than reading
as a contact sheet. That follows the standing rule that a utility surface, including a page built
for one named person, meets the same bar as the site it belongs to.

Honest content only. The board renders only the people and titles the client actually supplied,
and an unfilled field shows a visible unfilled state rather than an invented job title. The audit
check enforces this rather than trusting it.

## Out of scope for v1

1) No fill-in-your-own-details generator on the page. It invites invented titles and it is a
   growing-team need we do not have yet.
2) No backend capturing the pick. The client names the letter. An endpoint plus an env var on
   every client site is one more thing to break at handover.
3) No logo files, palette sheet or type specimen on the `/brand` index. The index is built to
   hold them.
4) No favicon or app icon board, no print collateral.

## Wiring outside this repo

1) `~/.claude/CLAUDE.md` section 7: one line stating the rule and pointing at this module.
2) `~/.claude/commands/perfect.md` step 7 (Ship): the handback carries the `/brand` link.
3) `~/.claude/skills/ship/SKILL.md`: same, for a standalone ship.
4) One auto-memory file plus its `MEMORY.md` pointer, so the rule is recallable outside a
   pipeline run.

## Verification

1) The audit check has unit tests beside it, in the style of the existing checks, covering each
   of the four codes plus the opt-out and template exemptions.
2) The signature HTML is verified by rendering it and confirming it survives a paste into Gmail,
   not by asserting on the string.
3) The share cards are verified by fetching `/brand/share/card/[variant]` and confirming a 200
   and the expected dimensions, and by checking the live card matches the picked variant.
4) The boards go through the standard geometry matrix and the anti-slop inspector like any other
   client-facing surface.
