/**
 * Contents of the files `web-kit brand-pack init` writes into a client repo.
 *
 * The scaffolded code deliberately avoids template literals, so nothing here
 * needs escaping and the generated files stay easy to read and edit. The five
 * designs are imported from web-kit rather than copied, so a design change
 * still reaches every client through a pinned-ref bump. The board shells
 * belong to the client repo, which is what makes a per-client override an
 * ordinary edit instead of a fork.
 */

/** Relative specifier from a file `depth` directories below the repo root. */
const up = (depth) => `${"../".repeat(depth)}brand-pack.config.mjs`;

export const configFile = () => `/**
 * Brand pack for the signature and link preview boards at /brand.
 *
 * Every __UNFILLED__ below is a real value nobody has supplied yet. The audit
 * fails while any survive, which is deliberate: a board must never render an
 * invented name, job title or tagline.
 *
 * This file imports nothing on purpose. The type comes from a JSDoc annotation,
 * which is erased at runtime, so the audit can still read this config in a repo
 * whose install is broken. That is exactly when the gate needs to work.
 *
 * @type {import("@iserlabs/web-kit/brand-pack").BrandPackConfig}
 */
export default {
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
  // One entry per named person. Supply real details or leave the list empty.
  people: [],
};
`;

export const indexRoute = (depth) => `import Link from "next/link";
import config from "${up(depth)}";
import { page, h1, lede, card, cardTitle, cardNote } from "./styles";

export const metadata = {
  title: "Brand pack",
  robots: { index: false, follow: false },
};

export default function BrandIndex() {
  return (
    <main style={page(config)}>
      <p style={lede(config)}>{config.wordmark}</p>
      <h1 style={h1(config)}>Two things to pick</h1>
      <p style={lede(config)}>
        Both take a minute. Tell us the letter you want and we wire it.
      </p>
      <div style={{ display: "grid", gap: 20, marginTop: 40 }}>
        <Link href="/brand/signature" style={card(config)}>
          <span style={cardTitle(config)}>Email signature</span>
          <span style={cardNote(config)}>
            Five designs. Pick one, then copy your own block straight into Gmail or Outlook.
          </span>
        </Link>
        <Link href="/brand/share" style={card(config)}>
          <span style={cardTitle(config)}>Link preview</span>
          <span style={cardNote(config)}>
            Five cards, each shown the way iMessage, WhatsApp, Slack, LinkedIn, X, Facebook and
            Google will actually crop it.
          </span>
        </Link>
      </div>
    </main>
  );
}
`;

export const stylesFile = () => `/**
 * Shared styling for the brand pack boards. These are the client's own tokens,
 * so the boards read as part of their site rather than as a contact sheet.
 * Edit freely: this file belongs to this repo, not to web-kit.
 */

export const page = (c) => ({
  backgroundColor: c.ground,
  color: c.ink,
  minHeight: "100vh",
  padding: "72px 32px 120px",
  fontFamily: c.bodyFont,
});

export const inner = { maxWidth: 1080, margin: "0 auto" };

export const h1 = (c) => ({
  fontFamily: c.displayFont,
  fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
  lineHeight: 1.05,
  fontWeight: 500,
  margin: "0 0 20px",
});

export const lede = (c) => ({
  fontFamily: c.bodyFont,
  fontSize: "1rem",
  lineHeight: 1.6,
  margin: "0 0 8px",
  opacity: 0.78,
});

export const premise = (c) => ({
  fontFamily: c.bodyFont,
  fontSize: "0.95rem",
  lineHeight: 1.6,
  padding: "16px 20px",
  borderLeft: "3px solid " + c.brand,
  margin: "28px 0 8px",
  maxWidth: 720,
});

export const roundNote = (c) => ({
  fontFamily: c.bodyFont,
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  opacity: 0.6,
  margin: "0 0 36px",
  color: c.accent,
});

export const optionHead = (c) => ({
  display: "flex",
  alignItems: "baseline",
  gap: 14,
  margin: "56px 0 6px",
  paddingTop: 28,
  borderTop: "1px solid " + c.brand + "44",
});

export const letter = (c) => ({
  fontFamily: c.displayFont,
  fontSize: "1.5rem",
  color: c.accent,
});

export const optionTitle = (c) => ({
  fontFamily: c.displayFont,
  fontSize: "1.5rem",
  fontWeight: 500,
});

export const optionNote = (c) => ({
  fontFamily: c.bodyFont,
  fontSize: "0.92rem",
  lineHeight: 1.6,
  opacity: 0.75,
  margin: "0 0 24px",
  maxWidth: 640,
});

export const card = (c) => ({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "24px 26px",
  border: "1px solid " + c.brand + "55",
  textDecoration: "none",
  color: c.ink,
});

export const cardTitle = (c) => ({ fontFamily: c.displayFont, fontSize: "1.4rem" });
export const cardNote = (c) => ({ fontFamily: c.bodyFont, fontSize: "0.92rem", opacity: 0.75 });

export const unfilled = (c) => ({
  fontFamily: c.bodyFont,
  fontSize: "0.95rem",
  padding: "18px 20px",
  border: "1px dashed " + c.accent,
  color: c.accent,
  maxWidth: 640,
});
`;

export const copyButton = () => `"use client";

import { useState } from "react";

/**
 * Puts real rich HTML on the clipboard, so a paste into Gmail or Outlook lands
 * formatted rather than as source. Where the Clipboard API is missing, it falls
 * back to selecting the rendered block so a manual copy still works.
 */
export default function CopyButton({ html, targetId, accent, font }) {
  const [state, setState] = useState("idle");

  function selectBlock() {
    const el = document.getElementById(targetId);
    if (!el) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }

  async function copy() {
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      setState("copied");
    } catch {
      setState(selectBlock() ? "selected" : "failed");
    }
    setTimeout(() => setState("idle"), 2600);
  }

  const label = {
    idle: "Copy signature",
    copied: "Copied. Paste into your mail settings.",
    selected: "Selected. Press Command C to copy.",
    failed: "Could not copy. Select the block above by hand.",
  }[state];

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        fontFamily: font,
        fontSize: "0.85rem",
        letterSpacing: "0.04em",
        padding: "11px 18px",
        minHeight: 44,
        marginTop: 16,
        cursor: "pointer",
        color: accent,
        background: "transparent",
        border: "1px solid " + accent,
      }}
    >
      {label}
    </button>
  );
}
`;

export const signatureRoute = (
  depth,
) => `import { SIGNATURE_VARIANTS, renderSignature } from "@iserlabs/web-kit/brand-pack";
import config from "${up(depth)}";
import CopyButton from "../CopyButton";
import {
  page,
  inner,
  h1,
  lede,
  premise,
  roundNote,
  optionHead,
  letter,
  optionTitle,
  optionNote,
  unfilled,
} from "../styles";

export const metadata = {
  title: "Email signature",
  robots: { index: false, follow: false },
};

const ROUND = 1;
const PREMISE =
  "All five assume the signature should carry the mark, the person and one contact line, and nothing else.";
const LETTERS = ["A", "B", "C", "D", "E"];

export default function SignatureBoard() {
  return (
    <main style={page(config)}>
      <div style={inner}>
        <p style={lede(config)}>{config.wordmark}</p>
        <h1 style={h1(config)}>Email signature</h1>
        <p style={premise(config)}>{PREMISE}</p>
        <p style={roundNote(config)}>Round {ROUND}. Tell us the letter you want.</p>

        {config.people.length === 0 ? (
          <p style={unfilled(config)}>
            No one has been added yet. Send us each person's name, job title, email and phone
            and their block will appear here.
          </p>
        ) : null}

        {SIGNATURE_VARIANTS.map((variant, i) => (
          <section key={variant.id}>
            <div style={optionHead(config)}>
              <span style={letter(config)}>{LETTERS[i]}</span>
              <h2 style={optionTitle(config)}>{variant.label}</h2>
            </div>
            <p style={optionNote(config)}>{variant.note}</p>
            {config.people.map((person) => {
              const html = renderSignature(variant.id, config, person);
              const id = variant.id + "-" + person.name.replace(/\\W+/g, "-").toLowerCase();
              return (
                <div key={id} style={{ margin: "0 0 40px" }}>
                  <p style={optionNote(config)}>{person.name}</p>
                  <div
                    id={id}
                    style={{ background: "#ffffff", padding: 28, border: "1px solid #e7e2d8" }}
                    // The block is generated from this repo's own config, never from user input.
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  <CopyButton
                    html={html}
                    targetId={id}
                    accent={config.accent}
                    font={config.bodyFont}
                  />
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
}
`;

export const shareRoute = (
  depth,
) => `import { PLATFORMS, SHARE_CARD_VARIANTS } from "@iserlabs/web-kit/brand-pack";
import config from "${up(depth)}";
import {
  page,
  inner,
  h1,
  lede,
  premise,
  roundNote,
  optionHead,
  letter,
  optionTitle,
  optionNote,
} from "../styles";

export const metadata = {
  title: "Link preview",
  robots: { index: false, follow: false },
};

const ROUND = 1;
const PREMISE =
  "All five assume the card has to read at thumbnail size, not only as a large rich link.";
const LETTERS = ["A", "B", "C", "D", "E"];

export default function ShareBoard() {
  return (
    <main style={page(config)}>
      <div style={inner}>
        <p style={lede(config)}>{config.wordmark}</p>
        <h1 style={h1(config)}>Link preview</h1>
        <p style={premise(config)}>{PREMISE}</p>
        <p style={roundNote(config)}>Round {ROUND}. Tell us the letter you want.</p>
        <p style={lede(config)}>
          One image, seven crops. Every platform cuts it differently, so judge each card by its
          worst frame rather than its best.
        </p>

        {SHARE_CARD_VARIANTS.map((variant, i) => (
          <section key={variant.id}>
            <div style={optionHead(config)}>
              <span style={letter(config)}>{LETTERS[i]}</span>
              <h2 style={optionTitle(config)}>{variant.label}</h2>
            </div>
            <p style={optionNote(config)}>{variant.note}</p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 28,
                alignItems: "flex-start",
                margin: "0 0 24px",
              }}
            >
              {PLATFORMS.map((platform) => (
                <figure key={platform.id} style={{ margin: 0, maxWidth: platform.cardWidth }}>
                  <img
                    src={"/brand/share/card/" + variant.id}
                    alt={variant.label + " as it appears on " + platform.label}
                    width={platform.cardWidth}
                    height={platform.cardHeight}
                    style={{
                      display: "block",
                      width: platform.cardWidth,
                      height: platform.cardHeight,
                      objectFit: "cover",
                      borderRadius: platform.radius,
                      border: "1px solid " + config.brand + "44",
                    }}
                  />
                  <figcaption
                    style={{
                      fontFamily: config.bodyFont,
                      fontSize: "0.72rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      opacity: 0.65,
                      marginTop: 8,
                    }}
                  >
                    {platform.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
`;

export const cardRoute = (depth) => `import { ImageResponse } from "next/og";
import { createElement } from "react";
import { CARD_SIZE, SHARE_CARD_IDS, renderShareCard } from "@iserlabs/web-kit/brand-pack";
import config from "${up(depth)}";

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
  return createElement(tag, props, ...children.map((child, i) => toElement(child, String(i))));
}

export async function GET(_request, { params }) {
  const { variant } = await params;
  return new ImageResponse(toElement(renderShareCard(variant, config), "root"), CARD_SIZE);
}
`;

export const openGraphRoute = (depth) => `import { ImageResponse } from "next/og";
import { createElement } from "react";
import { CARD_SIZE, renderShareCard } from "@iserlabs/web-kit/brand-pack";
import config from "${up(depth)}";

export const alt = config.wordmark;
export const size = CARD_SIZE;
export const contentType = "image/png";

function toElement(node, key) {
  if (typeof node === "string") return node;
  const { tag, style, children = [], src, alt: altText } = node;
  const props = { style, key };
  if (src !== undefined) props.src = src;
  if (altText !== undefined) props.alt = altText;
  return createElement(tag, props, ...children.map((child, i) => toElement(child, String(i))));
}

export default async function Image() {
  return new ImageResponse(toElement(renderShareCard(config.shareCard, config), "root"), CARD_SIZE);
}
`;
