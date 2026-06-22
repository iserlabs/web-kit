# @iserlabs/web-kit

Shared, build-free web kit for Iser Labs marketing sites. Consumed as source via a git-tag dependency:

    "@iserlabs/web-kit": "github:iserlabs/web-kit#v0.1.0"

A menu, not a mandate — import only what a site needs. See the fleet consistency spec for the full design.

## Usage

Add the kit (pin a tag):

    pnpm add "@iserlabs/web-kit@github:iserlabs/web-kit#v0.1.0"

For Next sites, transpile it: `next.config.ts` → `transpilePackages: ["@iserlabs/web-kit"]`.

### Config presets
- `biome.json` → `{ "extends": ["@iserlabs/web-kit/biome"] }`
- `tsconfig.json` → `{ "extends": "@iserlabs/web-kit/tsconfig" }`

### Token contract (Tailwind 4)
`globals.css`:

    @import "tailwindcss";
    @import "shadcn/tailwind.css";
    @import "@iserlabs/web-kit/tailwind";
    /* then override :root / .dark values for your brand */

### Utilities
- `import { pageMeta } from "@iserlabs/web-kit/seo"`
- `import { organization, lodgingBusiness, breadcrumb, faq } from "@iserlabs/web-kit/schema"`
- `import { createContactHandler } from "@iserlabs/web-kit/forms"`
- `import { validateEnv } from "@iserlabs/web-kit/env"`
- `import { cn } from "@iserlabs/web-kit/utils"`

### Conformance
- `pnpm exec web-kit doctor` — checks an adopting site's baseline (skips non-adopters).

### Audits (required tier)
Add `web-kit.audits.config.mjs` at the site root:

    export default {
      previewCommand: "pnpm build && pnpm start --port 4321",
      baseUrl: "http://localhost:4321",
      pageTypes: { "/": "home", "/rooms": "lodging" },
      expectedSchema: { home: ["Organization"], lodging: ["LodgingBusiness"] },
      headers: { requireCsp: true },
      contrast: { cssFile: "src/app/globals.css", minRatio: 4.5 },
      // severity: { "header-xcto-missing": "off" }, // per-check override
    };

Then gate CI with `web-kit audit --tier required` (crawls the preview server,
fails on any `error` finding). Extended tier (Lighthouse / axe / CWV) ships in a
later release.
