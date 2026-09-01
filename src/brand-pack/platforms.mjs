/**
 * How each surface actually renders a 1200x630 open-graph image. Sizes are the
 * rendered card in CSS pixels at a typical viewport, not the source file.
 *
 * The near-square frames are the whole reason the share board exists: a card
 * that reads beautifully as a large rich link can be unreadable as a WhatsApp
 * thumbnail, and nothing about the source file reveals that.
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
