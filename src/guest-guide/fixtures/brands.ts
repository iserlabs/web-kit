import type { GuideBrand } from "../brand";

/**
 * Token fixtures for the kit's own tests and fixture renders, copied from the
 * guest guide v2 spec (section 6). Each site holds its real tokens; these exist
 * so the kit can prove the contrast numbers and render the approved surfaces.
 */
export const sunMountainBrand: GuideBrand = {
  id: "sun-mountain",
  name: "Sun Mountain Stays",
  wordmark: { kind: "text", text: "Sun Mountain Stays", face: "wordmark" },
  mark: { src: "img/d2-sm-mark-ink.png", width: 96, height: 96 },
  faces: {
    display: { family: "Newsreader", fallback: "Georgia, serif", weight: 300, opsz: true },
    head: { family: "Newsreader", fallback: "Georgia, serif", weight: 400, opsz: true },
    text: { family: "Instrument Sans", fallback: "Arial, sans-serif", weight: 400, strong: 600 },
    figure: {
      family: "IBM Plex Mono",
      fallback: "ui-monospace, monospace",
      weight: 400,
      large: 300,
    },
    wordmark: { family: "Cinzel", fallback: "Georgia, serif", weight: 600 },
  },
  ink: "#1c2129",
  sec: "#45454b",
  accent: "#8f3a1f",
  accentText: "#8f3a1f",
  onPhoto: "#ffffff",
  button: { fill: "#e9c2a4", ink: "#1c2129", doneFill: "#1c2129", doneInk: "#f3ebdc" },
  fields: {
    arrival: "#e9c2a4",
    first: "#eed6aa",
    house: "#e5c3b9",
    know: "#dcd2e0",
    rules: "#d3dce3",
    out: "#cfe0ea",
    near: "#d6e2c9",
    paper: "#f3ebdc",
  },
  phone: "never",
  cachePrefix: "sms-guides",
  labels: { copyButton: "Copy password" },
};

export const columbusBrand: GuideBrand = {
  id: "columbus",
  name: "The Columbus Hotel",
  wordmark: {
    kind: "image",
    src: "img/d2-col-lockup.png",
    width: 331,
    height: 143,
    alt: "The Columbus Hotel, Middletown, NY",
  },
  faces: {
    display: { family: "Literata", fallback: "Georgia, serif", weight: 300, opsz: true },
    head: { family: "Literata", fallback: "Georgia, serif", weight: 400, opsz: true },
    text: { family: "Schibsted Grotesk", fallback: "Arial, sans-serif", weight: 400, strong: 600 },
    figure: { family: "Space Mono", fallback: "ui-monospace, monospace", weight: 400, large: 400 },
  },
  ink: "#16273d",
  sec: "#43506a",
  accent: "#8a4c10",
  accentText: "#8a4c10",
  onPhoto: "#16273d",
  button: { fill: "#16273d", ink: "#f7f1e5", doneFill: "#8a4c10", doneInk: "#f7f1e5" },
  fields: {
    arrival: "#eedcb6",
    first: "#f1d6b8",
    house: "#f1d6b8",
    know: "#f1d6b8",
    rules: "#d8e0ec",
    out: "#d8e0ec",
    near: "#d8e0ec",
    paper: "#f7f1e5",
  },
  phone: "allowed",
  cachePrefix: "columbus-guides",
  labels: { emergencies: "In an emergency", copyButton: "Copy password" },
};
