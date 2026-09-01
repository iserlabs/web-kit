# Brand Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `brand-pack` module in `@iserlabs/web-kit` so every new client site and major redesign produces an email signature board and a link preview board on the client's own domain, and so a site that lacks one fails its own audit.

**Architecture:** web-kit stays framework-free. The five signature renderers, the five share card renderers, the seven platform frame specs, the config loader, the audit check and the CLI all live here as `.mjs`, runnable under bare Node and importable by a Next app. `web-kit brand-pack init` scaffolds thin `.tsx` route shells into the client repo that consume those renderers. Design changes to the five variants therefore flow to every client through a pinned-ref bump, while the board shell belongs to the client repo, which is what makes a per-client override natural rather than a fork.

**Tech Stack:** Node ESM (`.mjs`), TypeScript for types only via JSDoc and a `types.d.ts`, vitest for tests, `node-html-parser` for asserting on rendered signature HTML, `next/og` in the consumer for card rendering.

## Global Constraints

1) web-kit is consumed as source through a pinned git ref. There is no build and no `dist/`. App-consumed code is `.ts`; CLI and audit code is `.mjs` because consumers run it under bare Node with no `tsx`. This module is `.mjs` throughout so both sides can import it.
2) No React, no `next`, and no `.tsx` may be added to `web-kit/src`. The package has none today and must keep none.
3) Tests live beside the module as `*.test.ts` and are picked up by `include: ["src/**/*.test.ts"]` with `environment: "node"`. Import `.mjs` from a test with a `// @ts-expect-error: plain ESM module` line above the import, matching `src/audits/checks/seo.test.ts`.
4) Audit findings are `{ severity, code, message }` objects, optionally carrying `route`. Severity is `"error"`, `"warn"` or `"info"`. Every check honors `config.severity[code]`, including the value `"off"`.
5) No em dashes anywhere. American English only. No italicized body text in any rendered output.
6) Honest content only. An unfilled field renders a visible unfilled state and fails the audit. Never emit an invented name, job title, phone number or tagline, and never emit a placeholder that reads as real.
7) Signature HTML is email HTML: nested tables with `role="presentation"`, inline styles only, no `<style>` block, no `class` attributes, no flexbox, no grid, no background images, no pseudo-elements, no web fonts, and a maximum width of 600px.
8) Commit after every task. This repo is an Iser Labs repo, so commits carry no Claude or AI trace and no `Co-Authored-By: Claude`.
9) Run `pnpm lint` and `pnpm typecheck` before each commit. pnpm only, never npm or yarn.

---

### Task 1: Config contract, loader and validator

The consumer config is `brand-pack.config.mjs`, not `.ts`. The audit check and the CLI run under bare Node and cannot import TypeScript, and the existing `web-kit.audits.config.mjs` already establishes this exact pattern. Types reach the consumer through a JSDoc annotation.

**Files:**
- Create: `src/brand-pack/types.d.ts`
- Create: `src/brand-pack/config.mjs`
- Test: `src/brand-pack/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BRAND_PACK_FILENAME` (string, `"brand-pack.config.mjs"`), `UNFILLED` (string sentinel, `"__UNFILLED__"`), `defineBrandPack(config) => config`, `validateBrandPackConfig(config) => Finding[]`, `loadBrandPackConfig(siteDir) => Promise<config>`.

- [ ] **Step 1: Write the failing test**

Create `src/brand-pack/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { UNFILLED, defineBrandPack, validateBrandPackConfig } from "./config.mjs";

const good = defineBrandPack({
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Front Range short-term rental management",
  markUrl: "https://sunmountainstays.com/brand/mark-128.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#ffffff",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [
    {
      name: "Jake Lee",
      title: "Founder",
      email: "hello@sunmountainstays.com",
      phone: "201.321.5446",
    },
  ],
});

const codes = (c: unknown) =>
  validateBrandPackConfig(c).map((f: { code: string }) => f.code);

describe("validateBrandPackConfig", () => {
  it("passes a complete config", () => {
    expect(validateBrandPackConfig(good)).toEqual([]);
  });

  it("flags a missing share card pick", () => {
    expect(codes({ ...good, shareCard: null })).toContain("brand-pack-unpicked");
  });

  it("flags a share card pick that is not a known variant", () => {
    expect(codes({ ...good, shareCard: "nope" })).toContain("brand-pack-unpicked");
  });

  it("flags an unfilled person field", () => {
    const c = codes({ ...good, people: [{ ...good.people[0], phone: UNFILLED }] });
    expect(c).toContain("brand-pack-placeholder");
  });

  it("flags an empty person field the same way as an unfilled one", () => {
    const c = codes({ ...good, people: [{ ...good.people[0], title: "  " }] });
    expect(c).toContain("brand-pack-placeholder");
  });

  it("flags an unfilled brand token", () => {
    expect(codes({ ...good, markUrl: UNFILLED })).toContain("brand-pack-placeholder");
  });

  it("flags zero people, since a board with nobody on it is not a deliverable", () => {
    expect(codes({ ...good, people: [] })).toContain("brand-pack-no-people");
  });

  it("names the person and the field in the message so the fix is obvious", () => {
    const findings = validateBrandPackConfig({
      ...good,
      people: [{ ...good.people[0], phone: UNFILLED }],
    });
    expect(findings[0].message).toContain("Jake Lee");
    expect(findings[0].message).toContain("phone");
  });

  it("rejects an em dash in any string value", () => {
    expect(codes({ ...good, tagline: "Front Range \u2014 managed" })).toContain(
      "brand-pack-em-dash",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/config.test.ts`
Expected: FAIL, cannot resolve `./config.mjs`.

- [ ] **Step 3: Write the type declaration**

Create `src/brand-pack/types.d.ts`:

```ts
export interface BrandPackPerson {
  name: string;
  title: string;
  email: string;
  phone: string;
  /** Optional per-person booking or inquiry link shown by the two-column variant. */
  link?: { label: string; href: string };
}

export interface BrandPackConfig {
  siteUrl: string;
  wordmark: string;
  tagline: string;
  markUrl: string;
  markAlt: string;
  displayFont: string;
  bodyFont: string;
  ink: string;
  ground: string;
  brand: string;
  accent: string;
  /** Photograph used by the share cards that carry one. Absolute URL. */
  photoUrl?: string;
  /** id of the picked share card variant. Null until the client picks. */
  shareCard: string | null;
  /** id of the picked signature variant. Null until the client picks. */
  signature?: string | null;
  people: BrandPackPerson[];
  /** Replace one of the five with a renderer written for this client. */
  overrides?: {
    signatures?: Record<string, (config: BrandPackConfig, person: BrandPackPerson) => string>;
    shareCards?: Record<string, (config: BrandPackConfig) => unknown>;
  };
}

export declare const BRAND_PACK_FILENAME: string;
export declare const UNFILLED: string;
export declare function defineBrandPack(config: BrandPackConfig): BrandPackConfig;
export declare function validateBrandPackConfig(
  config: unknown,
): { severity: string; code: string; message: string }[];
export declare function loadBrandPackConfig(siteDir: string): Promise<BrandPackConfig>;
```

- [ ] **Step 4: Write the implementation**

Create `src/brand-pack/config.mjs`:

```js
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SHARE_CARD_IDS } from "./share-cards.mjs";

export const BRAND_PACK_FILENAME = "brand-pack.config.mjs";

/**
 * Written by `brand-pack init` wherever it could not resolve a real value.
 * It is deliberately unmistakable: it must never look like real copy, and the
 * audit fails while any survive.
 */
export const UNFILLED = "__UNFILLED__";

const TOKEN_KEYS = [
  "siteUrl",
  "wordmark",
  "tagline",
  "markUrl",
  "markAlt",
  "displayFont",
  "bodyFont",
  "ink",
  "ground",
  "brand",
  "accent",
];

const PERSON_KEYS = ["name", "title", "email", "phone"];

/** Identity helper that gives a consumer's plain object its types. */
export function defineBrandPack(config) {
  return config;
}

const unfilled = (value) =>
  typeof value !== "string" || value.trim() === "" || value.includes(UNFILLED);

export function validateBrandPackConfig(config) {
  const findings = [];
  const err = (code, message) => findings.push({ severity: "error", code, message });

  if (!config || typeof config !== "object") {
    err("brand-pack-invalid", `${BRAND_PACK_FILENAME} does not export a config object`);
    return findings;
  }

  for (const key of TOKEN_KEYS) {
    if (unfilled(config[key])) {
      err("brand-pack-placeholder", `Brand token "${key}" is unfilled`);
    }
  }

  if (!SHARE_CARD_IDS.includes(config.shareCard)) {
    err(
      "brand-pack-unpicked",
      `shareCard is "${config.shareCard}", which is not one of: ${SHARE_CARD_IDS.join(", ")}`,
    );
  }

  const people = Array.isArray(config.people) ? config.people : [];
  if (people.length === 0) {
    err("brand-pack-no-people", "people is empty, so the signature board has nobody on it");
  }

  for (const [i, person] of people.entries()) {
    const who = typeof person?.name === "string" && person.name.trim() ? person.name : `person ${i + 1}`;
    for (const key of PERSON_KEYS) {
      if (unfilled(person?.[key])) {
        err("brand-pack-placeholder", `${who}: "${key}" is unfilled`);
      }
    }
  }

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.includes("\u2014")) {
      err("brand-pack-em-dash", `"${key}" contains an em dash`);
    }
  }

  return findings;
}

export async function loadBrandPackConfig(siteDir) {
  const path = join(siteDir, BRAND_PACK_FILENAME);
  if (!existsSync(path)) {
    throw new Error(`No ${BRAND_PACK_FILENAME} found in ${siteDir}`);
  }
  const mod = await import(pathToFileURL(resolve(path)).href);
  return mod.default ?? mod.config ?? {};
}
```

- [ ] **Step 5: Stub the share card ids so this task's test can run**

`config.mjs` imports `SHARE_CARD_IDS`, which Task 3 owns. Create the minimum now so Task 1 stands alone, and Task 3 fills the file in.

Create `src/brand-pack/share-cards.mjs`:

```js
export const SHARE_CARD_IDS = ["photo-scrim", "type-only", "mark-rule", "split", "photo-mark"];
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/config.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Lint, typecheck and commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck
git add src/brand-pack
git commit -m "feat(brand-pack): config contract, loader and validator

An unfilled token or person field is an error rather than a default, so a
board can never render an invented job title."
```

---

### Task 2: The five signature renderers

**Files:**
- Create: `src/brand-pack/signatures.mjs`
- Test: `src/brand-pack/signatures.test.ts`

**Interfaces:**
- Consumes: `BrandPackConfig` and `BrandPackPerson` shapes from Task 1.
- Produces: `SIGNATURE_IDS` (string[]), `SIGNATURE_VARIANTS` (array of `{ id, label, note }`), `renderSignature(variantId, config, person) => string`.

- [ ] **Step 1: Write the failing test**

Create `src/brand-pack/signatures.test.ts`:

```ts
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { SIGNATURE_IDS, SIGNATURE_VARIANTS, renderSignature } from "./signatures.mjs";

const config = {
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Front Range short-term rental management",
  markUrl: "https://sunmountainstays.com/brand/mark-128.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#ffffff",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [],
};

const person = {
  name: "Jake Lee",
  title: "Founder",
  email: "hello@sunmountainstays.com",
  phone: "201.321.5446",
  link: { label: "Book a call", href: "https://sunmountainstays.com/contact" },
};

const all = () => SIGNATURE_IDS.map((id: string) => [id, renderSignature(id, config, person)]);

describe("signature variants", () => {
  it("ships exactly five, with distinct ids", () => {
    expect(SIGNATURE_IDS).toHaveLength(5);
    expect(new Set(SIGNATURE_IDS).size).toBe(5);
    expect(SIGNATURE_VARIANTS.map((v: { id: string }) => v.id)).toEqual(SIGNATURE_IDS);
  });

  it("gives every variant a label and a one-line note for the board", () => {
    for (const v of SIGNATURE_VARIANTS) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.note.length).toBeGreaterThan(0);
    }
  });

  it("throws on an unknown variant rather than falling back silently", () => {
    expect(() => renderSignature("nope", config, person)).toThrow(/nope/);
  });

  it("builds every variant out of presentation tables", () => {
    for (const [id, html] of all()) {
      const root = parse(html);
      const table = root.querySelector("table");
      expect(table, `${id} has no table`).toBeTruthy();
      expect(table?.getAttribute("role"), `${id} table is not presentational`).toBe("presentation");
    }
  });

  it("uses inline styles only, with no stylesheet and no classes", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} has a style block`).not.toContain("<style");
      expect(html, `${id} uses a class`).not.toContain("class=");
    }
  });

  it("avoids layout features email clients do not support", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} uses flex`).not.toContain("display:flex");
      expect(html, `${id} uses grid`).not.toContain("display:grid");
      expect(html, `${id} uses a background image`).not.toContain("background-image");
    }
  });

  it("keeps every variant within 600px", () => {
    for (const [id, html] of all()) {
      for (const m of html.matchAll(/max-width:\s*(\d+)px/g)) {
        expect(Number(m[1]), `${id} is wider than 600px`).toBeLessThanOrEqual(600);
      }
    }
  });

  it("gives every image an alt, an explicit size and display:block", () => {
    for (const [id, html] of all()) {
      for (const img of parse(html).querySelectorAll("img")) {
        expect(img.getAttribute("alt"), `${id} image has no alt`).toBeTruthy();
        expect(img.getAttribute("width"), `${id} image has no width`).toBeTruthy();
        expect(img.getAttribute("height"), `${id} image has no height`).toBeTruthy();
        expect(img.getAttribute("style"), `${id} image is not block`).toContain("display:block");
      }
    }
  });

  it("styles every link inline, since email clients repaint an unstyled link", () => {
    for (const [id, html] of all()) {
      for (const a of parse(html).querySelectorAll("a")) {
        expect(a.getAttribute("style"), `${id} link is unstyled`).toContain("color:");
        expect(a.getAttribute("style"), `${id} link is underlined`).toContain(
          "text-decoration:none",
        );
      }
    }
  });

  it("renders the person's real details and invents nothing", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} drops the name`).toContain("Jake Lee");
      expect(html, `${id} drops the email`).toContain("hello@sunmountainstays.com");
    }
  });

  it("writes no em dash", () => {
    for (const [id, html] of all()) {
      expect(html, `${id} contains an em dash`).not.toContain("\u2014");
    }
  });

  it("omits the logo entirely in the single-line variant", () => {
    const html = renderSignature("single-line", config, person);
    expect(parse(html).querySelectorAll("img")).toHaveLength(0);
  });

  it("carries the person's link in the two-column variant", () => {
    const html = renderSignature("two-column", config, person);
    expect(html).toContain("https://sunmountainstays.com/contact");
    expect(html).toContain("Book a call");
  });

  it("omits the link column when the person has no link", () => {
    const html = renderSignature("two-column", config, { ...person, link: undefined });
    expect(html).not.toContain("Book a call");
  });

  it("escapes a value that would otherwise break the markup", () => {
    const html = renderSignature("ruled", config, { ...person, title: 'Founder & "Chief"' });
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/signatures.test.ts`
Expected: FAIL, cannot resolve `./signatures.mjs`.

- [ ] **Step 3: Write the implementation**

Create `src/brand-pack/signatures.mjs`. The five renderers share one escape helper and one set of style builders, so the email rules are stated once.

```js
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const T_OPEN =
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;">';
const T_CLOSE = "</table>";

const link = (href, text, color, font, size) =>
  `<a href="${esc(href)}" style="color:${color};text-decoration:none;font-family:${font};font-size:${size}px;">${esc(text)}</a>`;

const mark = (c, size) =>
  `<img src="${esc(c.markUrl)}" width="${size}" height="${size}" alt="${esc(c.markAlt)}" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;">`;

const dot = (c) => `<span style="color:${c.brand};font-size:11px;padding:0 7px;">&#183;</span>`;

const contactLine = (c, p) =>
  [
    link(`tel:${String(p.phone).replace(/[^\d+]/g, "")}`, p.phone, c.ink, c.bodyFont, 12),
    link(`mailto:${p.email}`, p.email, c.ink, c.bodyFont, 12),
    link(c.siteUrl, c.siteUrl.replace(/^https?:\/\//, ""), c.ink, c.bodyFont, 12),
  ].join(dot(c));

const nameBlock = (c, p) =>
  `<div style="font-family:${c.displayFont};font-size:18px;line-height:23px;color:${c.ink};font-weight:600;">${esc(p.name)}</div>` +
  `<div style="font-family:${c.bodyFont};font-size:10px;line-height:15px;color:${c.accent};text-transform:uppercase;letter-spacing:1.7px;font-weight:600;padding-top:3px;">${esc(p.title)}</div>` +
  `<div style="font-family:${c.displayFont};font-size:14px;line-height:19px;color:${c.ink};padding-top:4px;">${esc(c.wordmark)}</div>`;

const rule = (color, width) =>
  `<div style="width:${width};height:1px;background-color:${color};font-size:1px;line-height:1px;">&nbsp;</div>`;

function ruled(c, p) {
  return `${T_OPEN}
<tr><td style="padding:0;">${T_OPEN}
<tr>
  <td style="padding:0 16px 0 0;vertical-align:middle;">${mark(c, 64)}</td>
  <td style="padding:0 16px 0 0;vertical-align:middle;"><div style="width:1px;height:56px;background-color:${c.brand};font-size:1px;line-height:1px;">&nbsp;</div></td>
  <td style="padding:0;vertical-align:middle;">${nameBlock(c, p)}</td>
</tr>${T_CLOSE}</td></tr>
<tr><td style="padding:12px 0 0 0;">${rule(c.brand, "100%")}</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:17px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

function singleLine(c, p) {
  return `${T_OPEN}
<tr><td style="padding:0;font-family:${c.bodyFont};font-size:12px;line-height:18px;color:${c.ink};">
<span style="font-family:${c.displayFont};font-size:14px;color:${c.ink};font-weight:600;">${esc(p.name)}</span>${dot(c)}<span style="color:${c.accent};">${esc(p.title)}</span>${dot(c)}<span>${esc(c.wordmark)}</span>${dot(c)}${link(`tel:${String(p.phone).replace(/[^\d+]/g, "")}`, p.phone, c.ink, c.bodyFont, 12)}${dot(c)}${link(`mailto:${p.email}`, p.email, c.ink, c.bodyFont, 12)}
</td></tr>
${T_CLOSE}`;
}

function stacked(c, p) {
  return `${T_OPEN}
<tr><td style="padding:0 0 10px 0;">${mark(c, 56)}</td></tr>
<tr><td style="padding:0;">${nameBlock(c, p)}</td></tr>
<tr><td style="padding:10px 0 0 0;">${rule(c.brand, "72px")}</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:19px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

function twoColumn(c, p) {
  const right = p.link
    ? `<td style="padding:0 0 0 18px;vertical-align:middle;border-left:1px solid ${c.brand};">
        <div style="padding-left:18px;">${link(p.link.href, p.link.label, c.accent, c.bodyFont, 12)}</div>
      </td>`
    : "";
  return `${T_OPEN}
<tr><td style="padding:0;">${T_OPEN}
<tr>
  <td style="padding:0 18px 0 0;vertical-align:middle;">${mark(c, 48)}</td>
  <td style="padding:0;vertical-align:middle;">${nameBlock(c, p)}</td>
  ${right}
</tr>${T_CLOSE}</td></tr>
<tr><td style="padding:12px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:17px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

function tintedCard(c, p) {
  return `${T_OPEN}
<tr><td style="padding:18px 22px;background-color:${c.ink};">${T_OPEN}
<tr>
  <td style="padding:0 16px 0 0;vertical-align:middle;">${mark(c, 44)}</td>
  <td style="padding:0;vertical-align:middle;">
    <div style="font-family:${c.displayFont};font-size:17px;line-height:22px;color:${c.ground};font-weight:600;">${esc(p.name)}</div>
    <div style="font-family:${c.bodyFont};font-size:10px;line-height:15px;color:${c.brand};text-transform:uppercase;letter-spacing:1.7px;font-weight:600;padding-top:3px;">${esc(p.title)}</div>
  </td>
</tr>${T_CLOSE}</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:${c.bodyFont};font-size:12px;line-height:17px;color:${c.ink};">${contactLine(c, p)}</td></tr>
${T_CLOSE}`;
}

const RENDERERS = {
  ruled,
  "single-line": singleLine,
  stacked,
  "two-column": twoColumn,
  "tinted-card": tintedCard,
};

export const SIGNATURE_VARIANTS = [
  {
    id: "ruled",
    label: "Ruled letterhead",
    note: "Mark left, brand rule, identity stacked right, contact line under a hairline.",
  },
  {
    id: "single-line",
    label: "Single line",
    note: "One typographic line, no logo. The smallest footprint in a long reply chain.",
  },
  {
    id: "stacked",
    label: "Stacked lockup",
    note: "Mark above the name, for a brand whose mark carries the recognition.",
  },
  {
    id: "two-column",
    label: "Two column",
    note: "A brand rule between the identity and a booking or inquiry link.",
  },
  {
    id: "tinted-card",
    label: "Tinted card",
    note: "The identity reversed out of a brand-colored block, contact line beneath.",
  },
];

export const SIGNATURE_IDS = SIGNATURE_VARIANTS.map((v) => v.id);

export function renderSignature(variantId, config, person) {
  const override = config.overrides?.signatures?.[variantId];
  if (override) return override(config, person);
  const renderer = RENDERERS[variantId];
  if (!renderer) {
    throw new Error(`Unknown signature variant "${variantId}". Known: ${SIGNATURE_IDS.join(", ")}`);
  }
  return renderer(config, person);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/signatures.test.ts`
Expected: PASS, 15 tests. If the 600px assertion fails, the fix is in `T_OPEN`, not in the test.

- [ ] **Step 5: Lint, typecheck and commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck
git add src/brand-pack/signatures.mjs src/brand-pack/signatures.test.ts
git commit -m "feat(brand-pack): five email signature renderers

The email rules live in shared helpers rather than in five copies, and the
tests assert them on rendered HTML instead of trusting the author."
```

---

### Task 3: The five share card renderers

Satori and `ImageResponse` need React elements, and web-kit carries no React. So a renderer returns a serializable tree of `{ tag, style, children, src, alt }` nodes, and the scaffolded consumer route converts that tree into elements with a short recursive helper. web-kit stays framework-free and the five designs still live here.

**Files:**
- Modify: `src/brand-pack/share-cards.mjs` (replacing the Task 1 stub)
- Test: `src/brand-pack/share-cards.test.ts`

**Interfaces:**
- Consumes: `BrandPackConfig` from Task 1.
- Produces: `SHARE_CARD_IDS` (string[]), `SHARE_CARD_VARIANTS` (`{ id, label, note }[]`), `CARD_SIZE` (`{ width: 1200, height: 630 }`), `renderShareCard(variantId, config) => CardNode`.

- [ ] **Step 1: Write the failing test**

Create `src/brand-pack/share-cards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import {
  CARD_SIZE,
  SHARE_CARD_IDS,
  SHARE_CARD_VARIANTS,
  renderShareCard,
} from "./share-cards.mjs";

const config = {
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Front Range short-term rental management",
  markUrl: "https://sunmountainstays.com/brand/mark-512.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "Newsreader",
  bodyFont: "Instrument Sans",
  ink: "#0d2318",
  ground: "#f7f4ec",
  brand: "#c8912f",
  accent: "#b0492b",
  photoUrl: "https://sunmountainstays.com/brand/share.jpg",
  shareCard: "mark-rule",
  people: [],
};

const text = (node: any): string =>
  typeof node === "string"
    ? node
    : (node?.children ?? []).map(text).join(" ");

describe("share card variants", () => {
  it("ships exactly five, with distinct ids", () => {
    expect(SHARE_CARD_IDS).toHaveLength(5);
    expect(new Set(SHARE_CARD_IDS).size).toBe(5);
    expect(SHARE_CARD_VARIANTS.map((v: { id: string }) => v.id)).toEqual(SHARE_CARD_IDS);
  });

  it("renders at the one size every platform crops from", () => {
    expect(CARD_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("throws on an unknown variant", () => {
    expect(() => renderShareCard("nope", config)).toThrow(/nope/);
  });

  it("gives every card an explicit size and a background", () => {
    for (const id of SHARE_CARD_IDS) {
      const node = renderShareCard(id, config);
      expect(node.style.width, `${id} width`).toBe(1200);
      expect(node.style.height, `${id} height`).toBe(630);
      expect(node.style.backgroundColor, `${id} has no ground`).toBeTruthy();
    }
  });

  it("sets display flex on every element, which Satori requires", () => {
    const walk = (n: any): void => {
      if (typeof n === "string") return;
      const kids = n.children ?? [];
      if (kids.length > 1) expect(n.style?.display).toBe("flex");
      kids.forEach(walk);
    };
    for (const id of SHARE_CARD_IDS) walk(renderShareCard(id, config));
  });

  it("takes every word from the config and invents none", () => {
    for (const id of SHARE_CARD_IDS) {
      const words = text(renderShareCard(id, config)).trim();
      if (!words) continue;
      for (const w of words.split(/\s+/)) {
        expect(
          `${config.wordmark} ${config.tagline}`.includes(w),
          `${id} invented the word "${w}"`,
        ).toBe(true);
      }
    }
  });

  it("writes no text at all in the photo-mark variant", () => {
    expect(text(renderShareCard("photo-mark", config)).trim()).toBe("");
  });

  it("falls back to the mark card when a photo variant has no photograph", () => {
    const node = renderShareCard("photo-scrim", { ...config, photoUrl: undefined });
    expect(node.fallbackFrom).toBe("photo-scrim");
  });

  it("writes no em dash", () => {
    for (const id of SHARE_CARD_IDS) {
      expect(text(renderShareCard(id, config))).not.toContain("\u2014");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/share-cards.test.ts`
Expected: FAIL, `CARD_SIZE` is not exported by the Task 1 stub.

- [ ] **Step 3: Write the implementation**

Replace `src/brand-pack/share-cards.mjs` in full:

```js
export const CARD_SIZE = { width: 1200, height: 630 };

const box = (style, children = []) => ({ tag: "div", style, children });
const span = (style, value) => ({ tag: "div", style, children: [String(value)] });
const img = (src, alt, style) => ({ tag: "img", src, alt, style, children: [] });

const base = (c) => ({
  width: CARD_SIZE.width,
  height: CARD_SIZE.height,
  display: "flex",
  backgroundColor: c.ground,
  color: c.ink,
});

function photoScrim(c) {
  return {
    ...box({ ...base(c), position: "relative", flexDirection: "column", justifyContent: "flex-end" }, [
      img(c.photoUrl, "", {
        position: "absolute",
        top: 0,
        left: 0,
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        objectFit: "cover",
      }),
      box(
        {
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          width: CARD_SIZE.width,
          backgroundColor: "rgba(0,0,0,0.55)",
        },
        [
          span({ fontFamily: c.displayFont, fontSize: 64, color: "#ffffff" }, c.wordmark),
          span({ fontFamily: c.bodyFont, fontSize: 28, color: "#ffffff", paddingTop: 12 }, c.tagline),
        ],
      ),
    ]),
  };
}

function typeOnly(c) {
  return box(
    { ...base(c), flexDirection: "column", justifyContent: "center", padding: "0 96px" },
    [
      span({ fontFamily: c.displayFont, fontSize: 84, color: c.ink }, c.wordmark),
      box({ display: "flex", width: 120, height: 4, backgroundColor: c.brand, margin: "32px 0" }, []),
      span({ fontFamily: c.bodyFont, fontSize: 30, color: c.ink }, c.tagline),
    ],
  );
}

function markRule(c) {
  return box(
    {
      ...base(c),
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      border: `4px solid ${c.brand}`,
      boxSizing: "border-box",
    },
    [
      img(c.markUrl, "", { width: 180, height: 180 }),
      span({ fontFamily: c.displayFont, fontSize: 62, color: c.ink, paddingTop: 32 }, c.wordmark),
      span({ fontFamily: c.bodyFont, fontSize: 26, color: c.ink, paddingTop: 14 }, c.tagline),
    ],
  );
}

function split(c) {
  return box({ ...base(c), flexDirection: "row" }, [
    img(c.photoUrl, "", { width: 600, height: 630, objectFit: "cover" }),
    box(
      {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: 600,
        height: 630,
        padding: "0 64px",
        backgroundColor: c.ground,
      },
      [
        span({ fontFamily: c.displayFont, fontSize: 58, color: c.ink }, c.wordmark),
        span({ fontFamily: c.bodyFont, fontSize: 26, color: c.ink, paddingTop: 18 }, c.tagline),
      ],
    ),
  ]);
}

function photoMark(c) {
  return box({ ...base(c), position: "relative", alignItems: "center", justifyContent: "center" }, [
    img(c.photoUrl, "", {
      position: "absolute",
      top: 0,
      left: 0,
      width: CARD_SIZE.width,
      height: CARD_SIZE.height,
      objectFit: "cover",
    }),
    img(c.markUrl, "", { width: 220, height: 220 }),
  ]);
}

const RENDERERS = {
  "photo-scrim": photoScrim,
  "type-only": typeOnly,
  "mark-rule": markRule,
  split,
  "photo-mark": photoMark,
};

const NEEDS_PHOTO = new Set(["photo-scrim", "split", "photo-mark"]);

export const SHARE_CARD_VARIANTS = [
  {
    id: "photo-scrim",
    label: "Photograph with a lower third",
    note: "Full-bleed photograph, wordmark and one line on a scrim. Strongest as a large rich link.",
  },
  {
    id: "type-only",
    label: "Type on brand ground",
    note: "No photograph. The name set large, a rule, the tagline. Survives every crop.",
  },
  {
    id: "mark-rule",
    label: "Mark centered in a rule",
    note: "Mark, wordmark and tagline centered inside a brand border. Reads at thumbnail size.",
  },
  {
    id: "split",
    label: "Split photograph and type",
    note: "Photograph on one half, type on the other. Loses the photograph in a square crop.",
  },
  {
    id: "photo-mark",
    label: "Photograph with the mark alone",
    note: "No text. For a brand whose name is already in the link.",
  },
];

export const SHARE_CARD_IDS = SHARE_CARD_VARIANTS.map((v) => v.id);

export function renderShareCard(variantId, config) {
  const override = config.overrides?.shareCards?.[variantId];
  if (override) return override(config);
  const renderer = RENDERERS[variantId];
  if (!renderer) {
    throw new Error(`Unknown share card variant "${variantId}". Known: ${SHARE_CARD_IDS.join(", ")}`);
  }
  if (NEEDS_PHOTO.has(variantId) && !config.photoUrl) {
    // A photo card with no photograph would render an empty frame, which reads
    // as a broken site rather than a design choice. Fall back and say so.
    return { ...markRule(config), fallbackFrom: variantId };
  }
  return renderer(config);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/share-cards.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the whole suite, since Task 1 imported the stub**

Run: `cd ~/Claude/_tools/web-kit && pnpm test`
Expected: PASS, all files.

- [ ] **Step 6: Lint, typecheck and commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck
git add src/brand-pack/share-cards.mjs src/brand-pack/share-cards.test.ts
git commit -m "feat(brand-pack): five link preview card renderers

Cards are serializable trees rather than React elements, so the five designs
live here without web-kit taking on React. A photo card with no photograph
falls back rather than rendering an empty frame."
```

---

### Task 4: Platform frame specs

The board's whole reason to exist is that one 1200 by 630 file is cropped differently by every platform. These specs carry the real crop behavior so the board shows it rather than approximating it.

**Files:**
- Create: `src/brand-pack/platforms.mjs`
- Test: `src/brand-pack/platforms.test.ts`

**Interfaces:**
- Consumes: `CARD_SIZE` from Task 3.
- Produces: `PLATFORMS` (`{ id, label, cardWidth, cardHeight, showsTitle, showsDescription, showsDomain, radius, note }[]`), `PLATFORM_IDS`.

- [ ] **Step 1: Write the failing test**

Create `src/brand-pack/platforms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { PLATFORMS, PLATFORM_IDS } from "./platforms.mjs";

describe("platform frames", () => {
  it("covers the seven surfaces a client link actually lands on", () => {
    expect(PLATFORM_IDS).toEqual([
      "imessage",
      "whatsapp",
      "slack",
      "linkedin",
      "x",
      "facebook",
      "google",
    ]);
  });

  it("gives every frame a real pixel size, not a ratio to be inferred", () => {
    for (const p of PLATFORMS) {
      expect(p.cardWidth, `${p.id} width`).toBeGreaterThan(0);
      expect(p.cardHeight, `${p.id} height`).toBeGreaterThan(0);
    }
  });

  it("keeps at least one near-square frame, which is the crop that kills a card", () => {
    const ratios = PLATFORMS.map((p: { cardWidth: number; cardHeight: number }) =>
      p.cardWidth / p.cardHeight,
    );
    expect(Math.min(...ratios)).toBeLessThan(1.3);
  });

  it("keeps at least one wide frame at roughly 1.91:1", () => {
    const ratios = PLATFORMS.map((p: { cardWidth: number; cardHeight: number }) =>
      p.cardWidth / p.cardHeight,
    );
    expect(Math.max(...ratios)).toBeGreaterThan(1.8);
  });

  it("says of every frame whether it shows the title, description and domain", () => {
    for (const p of PLATFORMS) {
      expect(typeof p.showsTitle, `${p.id}`).toBe("boolean");
      expect(typeof p.showsDescription, `${p.id}`).toBe("boolean");
      expect(typeof p.showsDomain, `${p.id}`).toBe("boolean");
    }
  });

  it("gives every frame a note explaining what it does to the card", () => {
    for (const p of PLATFORMS) expect(p.note.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/platforms.test.ts`
Expected: FAIL, cannot resolve `./platforms.mjs`.

- [ ] **Step 3: Write the implementation**

Create `src/brand-pack/platforms.mjs`:

```js
/**
 * How each surface actually renders a 1200x630 open-graph image. Sizes are the
 * rendered card in CSS pixels at a typical viewport, not the source file.
 * The near-square frames are the ones that decide whether a design survives.
 */
export const PLATFORMS = [
  {
    id: "imessage",
    label: "iMessage",
    cardWidth: 300,
    cardHeight: 158,
    showsTitle: true,
    showsDescription: false,
    showsDomain: true,
    radius: 18,
    note: "Large rich link. The most generous crop, and the one a photograph flatters.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    cardWidth: 92,
    cardHeight: 92,
    showsTitle: true,
    showsDescription: true,
    showsDomain: true,
    radius: 6,
    note: "A small near-square thumbnail beside the text. A full-bleed photograph dies here.",
  },
  {
    id: "slack",
    label: "Slack",
    cardWidth: 360,
    cardHeight: 189,
    showsTitle: true,
    showsDescription: true,
    showsDomain: true,
    radius: 8,
    note: "Unfurl behind a colored bar, with title and description carrying most of the weight.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    cardWidth: 552,
    cardHeight: 289,
    showsTitle: true,
    showsDescription: false,
    showsDomain: true,
    radius: 0,
    note: "Roughly 1.91:1, close to the source ratio. Title sits under the image on a gray bar.",
  },
  {
    id: "x",
    label: "X",
    cardWidth: 504,
    cardHeight: 264,
    showsTitle: true,
    showsDescription: false,
    showsDomain: true,
    radius: 16,
    note: "summary_large_image. Rounded corners clip anything set into the extreme corners.",
  },
  {
    id: "facebook",
    label: "Facebook",
    cardWidth: 500,
    cardHeight: 261,
    showsTitle: true,
    showsDescription: true,
    showsDomain: true,
    radius: 0,
    note: "Wide crop with a heavy text block beneath, so the card competes with its own caption.",
  },
  {
    id: "google",
    label: "Google result",
    cardWidth: 104,
    cardHeight: 104,
    showsTitle: true,
    showsDescription: true,
    showsDomain: true,
    radius: 8,
    note: "A small square thumbnail. Only a centered mark or large type reads at this size.",
  },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/platforms.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Lint, typecheck and commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck
git add src/brand-pack/platforms.mjs src/brand-pack/platforms.test.ts
git commit -m "feat(brand-pack): the seven platform frames a link lands in

Real rendered sizes, including the two near-square crops that decide whether
a card survives, so the board shows the crop rather than approximating it."
```

---

### Task 5: The audit check

**Files:**
- Create: `src/audits/checks/brand-pack.mjs`
- Test: `src/audits/checks/brand-pack.test.ts`
- Modify: `src/audits/index.mjs` (add the check to `runRequiredAudit`)

**Interfaces:**
- Consumes: `BRAND_PACK_FILENAME`, `validateBrandPackConfig`, `loadBrandPackConfig` from Task 1.
- Produces: `checkBrandPack(siteDir, opts) => Promise<Finding[]>`, where `opts` is `{ readJson, exists }` so the test can drive it without a filesystem.

- [ ] **Step 1: Write the failing test**

Create `src/audits/checks/brand-pack.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { checkBrandPack } from "./brand-pack.mjs";

const adopted = { dependencies: { "@iserlabs/web-kit": "github:iserlabs/web-kit#v0.6.0" } };

const goodConfig = {
  siteUrl: "https://x.com",
  wordmark: "X",
  tagline: "T",
  markUrl: "https://x.com/m.png",
  markAlt: "X",
  displayFont: "Georgia, serif",
  bodyFont: "Arial, sans-serif",
  ink: "#000000",
  ground: "#ffffff",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [{ name: "A", title: "B", email: "a@x.com", phone: "1" }],
};

const run = (opts: Record<string, unknown>) =>
  checkBrandPack("/site", {
    readJson: () => adopted,
    exists: () => true,
    loadConfig: async () => goodConfig,
    ...opts,
  });

const codes = async (opts: Record<string, unknown>) =>
  (await run(opts)).map((f: { code: string }) => f.code);

describe("checkBrandPack", () => {
  it("passes a site with a complete brand pack", async () => {
    expect(await run({})).toEqual([]);
  });

  it("says nothing about a site that has not adopted web-kit", async () => {
    expect(await run({ readJson: () => ({ dependencies: {} }) })).toEqual([]);
  });

  it("says nothing about the template itself", async () => {
    expect(
      await run({
        readJson: (p: string) =>
          p.endsWith("web-kit.template.json") ? { template: true } : adopted,
      }),
    ).toEqual([]);
  });

  it("flags an adopted site with no brand pack", async () => {
    expect(await codes({ exists: () => false })).toContain("brand-pack-missing");
  });

  it("accepts a documented opt-out", async () => {
    expect(
      await run({
        exists: () => false,
        readJson: () => ({
          ...adopted,
          "web-kit": {
            brandPack: { skip: true, reason: "internal surface, no outside recipient", date: "2026-09-01" },
          },
        }),
      }),
    ).toEqual([]);
  });

  it("rejects an opt-out with no reason", async () => {
    const c = await codes({
      exists: () => false,
      readJson: () => ({ ...adopted, "web-kit": { brandPack: { skip: true, date: "2026-09-01" } } }),
    });
    expect(c).toContain("brand-pack-skip-unreasoned");
  });

  it("rejects an opt-out with no date", async () => {
    const c = await codes({
      exists: () => false,
      readJson: () => ({ ...adopted, "web-kit": { brandPack: { skip: true, reason: "later" } } }),
    });
    expect(c).toContain("brand-pack-skip-unreasoned");
  });

  it("passes the config's own findings through", async () => {
    const c = await codes({ loadConfig: async () => ({ ...goodConfig, shareCard: null }) });
    expect(c).toContain("brand-pack-unpicked");
  });

  it("flags a config that exists but whose routes do not", async () => {
    const c = await codes({ exists: (p: string) => !p.includes("app/brand") });
    expect(c).toContain("brand-pack-routes-missing");
  });

  it("reports a config that throws rather than passing vacuously", async () => {
    const c = await codes({
      loadConfig: async () => {
        throw new Error("boom");
      },
    });
    expect(c).toContain("brand-pack-invalid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/audits/checks/brand-pack.test.ts`
Expected: FAIL, cannot resolve `./brand-pack.mjs`.

- [ ] **Step 3: Write the implementation**

Create `src/audits/checks/brand-pack.mjs`:

```js
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRAND_PACK_FILENAME,
  loadBrandPackConfig,
  validateBrandPackConfig,
} from "../../brand-pack/config.mjs";

const ROUTE_DIRS = ["src/app/brand", "app/brand"];

function defaultReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export async function checkBrandPack(siteDir, opts = {}) {
  const readJson = opts.readJson ?? defaultReadJson;
  const exists = opts.exists ?? existsSync;
  const loadConfig = opts.loadConfig ?? loadBrandPackConfig;

  const findings = [];
  const err = (code, message) => findings.push({ severity: "error", code, message });

  const pkg = readJson(join(siteDir, "package.json"));
  if (!pkg) return findings;

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (!deps["@iserlabs/web-kit"]) return findings;

  const marker = readJson(join(siteDir, "web-kit.template.json"));
  if (marker?.template === true || pkg["web-kit"]?.template === true) return findings;

  const configPath = join(siteDir, BRAND_PACK_FILENAME);
  if (!exists(configPath)) {
    const skip = pkg["web-kit"]?.brandPack;
    if (skip?.skip === true) {
      // An opt-out is a decision, so it has to be written down and dated. A
      // bare `skip: true` is how a gate quietly stops meaning anything.
      if (!skip.reason || !skip.date) {
        err(
          "brand-pack-skip-unreasoned",
          'package.json "web-kit".brandPack.skip needs both a reason and a date',
        );
      }
      return findings;
    }
    err(
      "brand-pack-missing",
      `No ${BRAND_PACK_FILENAME}. Run \`web-kit brand-pack init\`, or declare a dated opt-out in package.json.`,
    );
    return findings;
  }

  if (!ROUTE_DIRS.some((d) => exists(join(siteDir, d)))) {
    err(
      "brand-pack-routes-missing",
      `${BRAND_PACK_FILENAME} exists but no /brand route does. Run \`web-kit brand-pack init\`.`,
    );
  }

  let config;
  try {
    config = await loadConfig(siteDir);
  } catch (e) {
    err("brand-pack-invalid", `${BRAND_PACK_FILENAME} could not be loaded: ${e.message}`);
    return findings;
  }

  findings.push(...validateBrandPackConfig(config));
  return findings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/audits/checks/brand-pack.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire the check into the required audit**

In `src/audits/index.mjs`, add the import beside the others:

```js
import { checkBrandPack } from "./checks/brand-pack.mjs";
```

Then, inside `runRequiredAudit`, after the contrast block and before `return findings;`:

```js
    for (const f of await checkBrandPack(siteDir)) {
      const override = config.severity[f.code];
      if (override !== "off") findings.push(override ? { ...f, severity: override } : f);
    }
```

- [ ] **Step 6: Run the whole suite**

Run: `cd ~/Claude/_tools/web-kit && pnpm test`
Expected: PASS, all files.

- [ ] **Step 7: Lint, typecheck and commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck
git add src/audits/checks/brand-pack.mjs src/audits/checks/brand-pack.test.ts src/audits/index.mjs
git commit -m "feat(audits): fail a client site with no brand pack

Blocking, with an opt-out that must carry a written reason and a date, so
backfilling the existing sites stays a scheduled decision rather than eight
red gates appearing at once."
```

---

### Task 6: `web-kit brand-pack init`

**Files:**
- Create: `src/brand-pack/init.mjs`
- Create: `src/brand-pack/templates/index.mjs` (the scaffolded file contents as strings)
- Test: `src/brand-pack/init.test.ts`
- Modify: `bin/web-kit.mjs`

**Interfaces:**
- Consumes: `BRAND_PACK_FILENAME`, `UNFILLED` from Task 1; `SIGNATURE_IDS` from Task 2; `SHARE_CARD_IDS` from Task 3.
- Produces: `initBrandPack(siteDir, opts) => { written: string[], skipped: string[] }`, where `opts` is `{ write, exists }` for testing.

- [ ] **Step 1: Write the failing test**

Create `src/brand-pack/init.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { initBrandPack } from "./init.mjs";

function harness(existing: string[] = []) {
  const files = new Map<string, string>();
  const result = (opts = {}) =>
    initBrandPack("/site", {
      write: (p: string, c: string) => files.set(p, c),
      exists: (p: string) => existing.some((e) => p.includes(e)),
      ...opts,
    });
  return { files, result };
}

describe("initBrandPack", () => {
  it("writes the config and all three routes", () => {
    const { files, result } = harness();
    const out = result();
    expect(out.written.some((p: string) => p.endsWith("brand-pack.config.mjs"))).toBe(true);
    expect(out.written.some((p: string) => p.includes("brand/page.tsx"))).toBe(true);
    expect(out.written.some((p: string) => p.includes("brand/signature/page.tsx"))).toBe(true);
    expect(out.written.some((p: string) => p.includes("brand/share/page.tsx"))).toBe(true);
    expect(files.size).toBe(out.written.length);
  });

  it("writes the per-variant card route so the board shows real renders", () => {
    const { result } = harness();
    expect(
      result().written.some((p: string) => p.includes("brand/share/card/[variant]")),
    ).toBe(true);
  });

  it("refuses to overwrite an existing config", () => {
    const { files, result } = harness(["brand-pack.config.mjs"]);
    const out = result();
    expect(out.skipped.some((p: string) => p.endsWith("brand-pack.config.mjs"))).toBe(true);
    expect([...files.keys()].some((p) => p.endsWith("brand-pack.config.mjs"))).toBe(false);
  });

  it("seeds every unresolved token with the unfilled sentinel, never a guess", () => {
    const { files, result } = harness();
    result();
    const config = [...files.entries()].find(([p]) => p.endsWith("brand-pack.config.mjs"))?.[1];
    expect(config).toContain("__UNFILLED__");
    expect(config).not.toContain("example.com");
    expect(config).not.toContain("Jane Doe");
  });

  it("leaves shareCard unpicked so the audit fails until the client picks", () => {
    const { files, result } = harness();
    result();
    const config = [...files.entries()].find(([p]) => p.endsWith("brand-pack.config.mjs"))?.[1];
    expect(config).toContain("shareCard: null");
  });

  it("writes routes under src/app when the site uses a src directory", () => {
    const { result } = harness(["src/app"]);
    expect(result().written.every((p: string) => !p.includes("/site/app/"))).toBe(true);
  });

  it("writes no em dash into any scaffolded file", () => {
    const { files, result } = harness();
    result();
    for (const [p, c] of files) expect(c, p).not.toContain("\u2014");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/init.test.ts`
Expected: FAIL, cannot resolve `./init.mjs`.

- [ ] **Step 3: Write the scaffold templates**

Create `src/brand-pack/templates/index.mjs`. Each export is a function returning the file's contents. The route files import from `@iserlabs/web-kit/brand-pack`, so the five designs stay centrally maintained and a ref bump updates them.

```js
export const configFile = () => `import { defineBrandPack } from "@iserlabs/web-kit/brand-pack";

/**
 * Brand pack for the signature and link preview boards at /brand.
 * Every __UNFILLED__ below is a real value nobody has supplied yet. The
 * audit fails while any survive, which is deliberate: a board must never
 * render an invented name, title or tagline.
 */
export default defineBrandPack({
  siteUrl: "__UNFILLED__",
  wordmark: "__UNFILLED__",
  tagline: "__UNFILLED__",
  markUrl: "__UNFILLED__",
  markAlt: "__UNFILLED__",
  displayFont: "__UNFILLED__",
  bodyFont: "__UNFILLED__",
  ink: "__UNFILLED__",
  ground: "__UNFILLED__",
  brand: "__UNFILLED__",
  accent: "__UNFILLED__",
  // Absolute URL of the photograph the photo cards use. Optional.
  photoUrl: undefined,
  // The client's pick. Null until they choose.
  shareCard: null,
  signature: null,
  people: [],
});
`;

export const indexRoute = () => `import Link from "next/link";

export const metadata = {
  title: "Brand pack",
  robots: { index: false, follow: false },
};

export default function BrandIndex() {
  return (
    <main style={{ padding: "64px 32px", maxWidth: 720, margin: "0 auto" }}>
      <h1>Brand pack</h1>
      <p>Two things to pick. Both take a minute.</p>
      <ul>
        <li>
          <Link href="/brand/signature">Email signature</Link>
        </li>
        <li>
          <Link href="/brand/share">Link preview</Link>
        </li>
      </ul>
    </main>
  );
}
`;

export const cardRoute = () => `import { ImageResponse } from "next/og";
import { CARD_SIZE, SHARE_CARD_IDS, renderShareCard } from "@iserlabs/web-kit/brand-pack";
import config from "../../../../../../brand-pack.config.mjs";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SHARE_CARD_IDS.map((variant) => ({ variant }));
}

/** Turn the serializable card tree into elements. web-kit stays React-free. */
function toElement(node, key) {
  if (typeof node === "string") return node;
  const { tag, style, children = [], src, alt } = node;
  const props = { style, key };
  if (src !== undefined) props.src = src;
  if (alt !== undefined) props.alt = alt;
  return {
    type: tag,
    key,
    props: { ...props, children: children.map((c, i) => toElement(c, String(i))) },
  };
}

export async function GET(_request, { params }) {
  const { variant } = await params;
  return new ImageResponse(toElement(renderShareCard(variant, config), "root"), CARD_SIZE);
}
`;

export const openGraphRoute = () => `import { ImageResponse } from "next/og";
import { CARD_SIZE, renderShareCard } from "@iserlabs/web-kit/brand-pack";
import config from "../../brand-pack.config.mjs";

export const alt = config.wordmark;
export const size = CARD_SIZE;
export const contentType = "image/png";

function toElement(node, key) {
  if (typeof node === "string") return node;
  const { tag, style, children = [], src, alt: a } = node;
  const props = { style, key };
  if (src !== undefined) props.src = src;
  if (a !== undefined) props.alt = a;
  return {
    type: tag,
    key,
    props: { ...props, children: children.map((c, i) => toElement(c, String(i))) },
  };
}

export default async function Image() {
  return new ImageResponse(toElement(renderShareCard(config.shareCard, config), "root"), CARD_SIZE);
}
`;
```

The signature board and share board route files are longer. Write them as `signatureRoute()` and `shareRoute()` in the same file, following these rules exactly:

1) `export const metadata = { robots: { index: false, follow: false } }` on both.
2) The board prints its premise line at the top, above the options, as one sentence a person can disagree with. For the signature board: "All five assume the signature should carry the mark, the person and one contact line, and nothing else." For the share board: "All five assume the card should read at thumbnail size, not only as a large rich link."
3) The board says which round it is, read from a `round` constant the scaffold sets to 1.
4) The signature board maps `SIGNATURE_VARIANTS` over `config.people`, renders each with `renderSignature`, sets the HTML with `dangerouslySetInnerHTML`, and puts a copy button beside each block.
5) The copy button is a client component using `ClipboardItem` with a promise, both `text/html` and `text/plain`, falling back to a range selection where the API is missing. Write it as `"use client"` at the top of its own scaffolded file, `brand/CopyButton.tsx`.
6) The share board maps `SHARE_CARD_VARIANTS` over `PLATFORMS`, showing each card at each frame's real `cardWidth` and `cardHeight` with `object-fit: cover`, sourcing every image from `/brand/share/card/<variant>`.
7) Neither board uses an em dash, italic body text, or Inter.

- [ ] **Step 4: Write the init implementation**

Create `src/brand-pack/init.mjs`:

```js
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BRAND_PACK_FILENAME } from "./config.mjs";
import * as templates from "./templates/index.mjs";

function defaultWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function initBrandPack(siteDir, opts = {}) {
  const write = opts.write ?? defaultWrite;
  const exists = opts.exists ?? existsSync;

  const appDir = exists(join(siteDir, "src/app")) ? "src/app" : "app";
  const files = [
    [join(siteDir, BRAND_PACK_FILENAME), templates.configFile()],
    [join(siteDir, appDir, "brand/page.tsx"), templates.indexRoute()],
    [join(siteDir, appDir, "brand/CopyButton.tsx"), templates.copyButton()],
    [join(siteDir, appDir, "brand/signature/page.tsx"), templates.signatureRoute()],
    [join(siteDir, appDir, "brand/share/page.tsx"), templates.shareRoute()],
    [join(siteDir, appDir, "brand/share/card/[variant]/route.tsx"), templates.cardRoute()],
  ];

  const written = [];
  const skipped = [];
  for (const [path, contents] of files) {
    // Never clobber a client's authored board or their filled-in config.
    if (exists(path)) {
      skipped.push(path);
      continue;
    }
    write(path, contents);
    written.push(path);
  }
  return { written, skipped };
}
```

- [ ] **Step 5: Wire the subcommand into the CLI**

In `bin/web-kit.mjs`, add before the final usage line:

```js
if (cmd === "brand-pack") {
  const sub = argv[1];
  if (sub !== "init") {
    console.log("Usage: web-kit brand-pack init [siteDir]");
    process.exit(1);
  }
  const dir = argv[2] || process.cwd();
  const { initBrandPack } = await import("../src/brand-pack/init.mjs");
  const { written, skipped } = initBrandPack(dir);
  for (const p of written) console.log(`wrote  ${p}`);
  for (const p of skipped) console.log(`kept   ${p} (already exists)`);
  console.log(
    `web-kit brand-pack: ${written.length} written, ${skipped.length} kept. Fill in every __UNFILLED__, then run \`web-kit audit --tier required\`.`,
  );
  process.exit(0);
}
```

Then update the usage line at the bottom:

```js
console.log(
  "Usage: web-kit <doctor|audit|brand-pack> [--tier required|extended] [siteDir]",
);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd ~/Claude/_tools/web-kit && pnpm vitest run src/brand-pack/init.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Prove the CLI actually runs, since a passing unit test is not evidence**

```bash
cd /tmp && rm -rf bp-smoke && mkdir -p bp-smoke/src/app
cd bp-smoke && echo '{"name":"smoke","dependencies":{"@iserlabs/web-kit":"github:iserlabs/web-kit#v0.6.0"}}' > package.json
node ~/Claude/_tools/web-kit/bin/web-kit.mjs brand-pack init .
find . -type f | sort
```

Expected: six files listed, all under `src/app/brand` plus `brand-pack.config.mjs`, and the summary line naming `__UNFILLED__`.

- [ ] **Step 8: Lint, typecheck and commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck && pnpm test
git add src/brand-pack bin/web-kit.mjs
git commit -m "feat(brand-pack): scaffold the boards into a client repo

init writes the config and the three routes, refuses to clobber anything a
client has already filled in, and seeds every unresolved value with a
sentinel the audit fails on rather than a plausible guess."
```

---

### Task 7: Export the module and document it

**Files:**
- Modify: `package.json` (add `./brand-pack` to `exports`)
- Create: `src/brand-pack/index.mjs`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `CLAUDE.md` (the Exports and CLI sections)

- [ ] **Step 1: Write the barrel**

Create `src/brand-pack/index.mjs`:

```js
export {
  BRAND_PACK_FILENAME,
  UNFILLED,
  defineBrandPack,
  loadBrandPackConfig,
  validateBrandPackConfig,
} from "./config.mjs";
export { SIGNATURE_IDS, SIGNATURE_VARIANTS, renderSignature } from "./signatures.mjs";
export {
  CARD_SIZE,
  SHARE_CARD_IDS,
  SHARE_CARD_VARIANTS,
  renderShareCard,
} from "./share-cards.mjs";
export { PLATFORMS, PLATFORM_IDS } from "./platforms.mjs";
```

- [ ] **Step 2: Add the export map entry**

In `package.json`, inside `exports`, after `"./audits"`:

```json
    "./brand-pack": "./src/brand-pack/index.mjs",
```

- [ ] **Step 3: Document it**

In `CLAUDE.md`, add `brand-pack` to the Exports list with the note that it is `.mjs` so both the CLI and a Next app can import it, and add to the CLI section:

```
- `web-kit brand-pack init`: scaffold the /brand signature and link preview
  boards into a client site. Required on every new client build and major
  redesign; `audit --tier required` fails a client site without one.
```

In `README.md`, add a short section showing `pnpm exec web-kit brand-pack init`, filling in `brand-pack.config.mjs`, and sending the client the `/brand` link.

In `CHANGELOG.md`, add an entry under a new `0.7.0` heading describing the module, the CLI subcommand and the new blocking audit codes, and naming the opt-out shape so a consumer upgrading knows how to defer it.

- [ ] **Step 4: Verify the export resolves**

```bash
cd /tmp/bp-smoke && node -e "import('/Users/macbook/Claude/_tools/web-kit/src/brand-pack/index.mjs').then(m => console.log(Object.keys(m).sort().join(' ')))"
```

Expected: every name from the barrel, printed once.

- [ ] **Step 5: Commit**

```bash
cd ~/Claude/_tools/web-kit
pnpm lint && pnpm typecheck && pnpm test
git add package.json src/brand-pack/index.mjs README.md CHANGELOG.md CLAUDE.md
git commit -m "feat(brand-pack): export the module and document the workflow"
```

---

### Task 8: Wire the rule outside this repo

The module means nothing if nobody reaches for it. These four wires are what make it fire.

**Files:**
- Modify: `~/.claude/CLAUDE.md` (section 7)
- Modify: `~/.claude/commands/perfect.md` (step 7, Ship)
- Modify: `~/.claude/skills/ship/SKILL.md`
- Create: `~/.claude/projects/-Users-macbook/memory/client-build-ships-a-brand-pack.md`
- Modify: `~/.claude/projects/-Users-macbook/memory/MEMORY.md`

- [ ] **Step 1: Add the CLAUDE.md rule**

In section 7, after the imagery line, add one line stating that every new client site and major redesign ships the `/brand` signature and link preview boards, built with `web-kit brand-pack init`, and that the client picks before handover.

- [ ] **Step 2: Add the pipeline step**

In `~/.claude/commands/perfect.md` step 7 (Ship), add that the handback carries the `/brand` link and names which signature and card the client still has to pick.

- [ ] **Step 3: Add the ship ritual step**

In `~/.claude/skills/ship/SKILL.md`, add the same, so a standalone ship does not drop it.

- [ ] **Step 4: Write the memory**

Create the memory file with `type: project`, describing the rule, why it exists (hand-built four times before this), and how to apply it: run `web-kit brand-pack init`, fill the config, send the `/brand` link at handover.

- [ ] **Step 5: Add the MEMORY.md pointer**

One line under 200 characters, in the practice area of the index.

- [ ] **Step 6: Verify the index still loads inside budget**

```bash
python3 ~/.claude/skills/audit/memory-load-check.py
```

Expected: a byte count under the 24,985 budget. If it is over, trim an existing line rather than dropping this one.

- [ ] **Step 7: Commit the memory**

The `~/.claude` files are personal, so a Claude trace is fine there. Commit if that directory is under version control; otherwise no commit is needed.

---

## Self-Review

**Spec coverage.** Routes: Task 6. Signature board and its five designs: Task 2 and Task 6. Email compatibility rules: Task 2, asserted in tests. Copy mechanism: Task 6 step 3 rule 5. Link preview board, five cards, platform frames and real renders: Tasks 3, 4 and 6. Generation model with overrides: Task 2 and Task 3 both check `config.overrides` first. Module surface and the `.mjs` consumption model: Task 7. CLI: Task 6. Audit check with all four codes plus the opt-out and template exemptions: Task 5. Timing, trigger scope and the `opengraph-image` re-export: Task 6 step 3 `openGraphRoute` and Task 8. Honest content: enforced in Task 1's validator and Task 6's sentinel seeding.

**Two spec corrections this plan makes, both deliberate.** The consumer config is `brand-pack.config.mjs`, not `.ts`, because the audit check and CLI run under bare Node and cannot import TypeScript. And the board components are scaffolded into the client repo rather than exported from web-kit, because web-kit carries no React today and adding it would change what the package is. The five variant renderers still live in web-kit, so a design update still flows through a ref bump. Update the spec to match before starting Task 1.

**Type consistency.** `renderSignature(variantId, config, person)` and `renderShareCard(variantId, config)` keep that argument order everywhere. `SIGNATURE_IDS`, `SHARE_CARD_IDS` and `PLATFORM_IDS` are all derived from their `*_VARIANTS` or `PLATFORMS` array rather than typed twice. `UNFILLED` is the single sentinel, defined in Task 1 and consumed by Tasks 1 and 6.

**Known ordering constraint.** Task 1 imports `SHARE_CARD_IDS` from Task 3's file, so Task 1 step 5 writes a one-line stub. Task 3 replaces that file in full. Running the whole suite at Task 3 step 5 is what catches a mismatch between them.
