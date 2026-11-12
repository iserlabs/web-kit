/**
 * Brand tokens for the four statement looks. Faces and palettes are the locks in the design
 * standard (2.4): Palisade is EB Garamond, Instrument Sans and Geist Mono with gold; Columbus is
 * navy, gold and cream; Sun Mountain is Newsreader and Instrument Sans; Xenia is Newsreader with
 * oat, olive and clay. Every stack reads a CSS variable a site can set (for example the one
 * next/font writes) and falls back to the face by name.
 *
 * `card` is the link preview card (option 1, photo and seal, picked 2026-11-12): the scrim color
 * as an "r,g,b" triple and its darkest alpha, the light ink and accent printed over the photo, the
 * faces by their plain family name (Satori takes a name, not a CSS stack) and the seal.
 */

const NEWSREADER = 'var(--font-newsreader, "Newsreader"), Georgia, serif';
const INSTRUMENT =
  'var(--font-instrument-sans, "Instrument Sans"), "Helvetica Neue", Arial, sans-serif';
const GARAMOND = 'var(--font-eb-garamond, "EB Garamond"), Georgia, serif';
const GEIST_MONO =
  'var(--font-geist-mono, "Geist Mono"), ui-monospace, "SF Mono", Menlo, monospace';
const LITERATA = 'var(--font-literata, "Literata"), Georgia, serif';
const SCHIBSTED =
  'var(--font-schibsted-grotesk, "Schibsted Grotesk"), "Helvetica Neue", Arial, sans-serif';

const GF = "https://fonts.googleapis.com/css2?";
const NEWSREADER_Q = "family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600";
const INSTRUMENT_Q = "family=Instrument+Sans:wght@400;500;600";

export const BRANDS = {
  "sun-mountain": {
    display: NEWSREADER,
    text: INSTRUMENT,
    figures: INSTRUMENT,
    paper: "#fbf8f0",
    ground: "#ece7dc",
    ink: "#0d2318",
    soft: "#3d4a42",
    accent: "#8a5a12",
    gold: "#c8912f",
    rule: "#ddd3bd",
    tint: "#f1ead9",
    stripe: null,
    logoHeight: 40,
    tabular: true,
    figureScale: 1,
    figureAdvance: 0.54,
    card: {
      scrim: "13,35,24",
      scrimMax: 0.82,
      light: "#f1ebdd",
      accent: "#e0b866",
      monthFont: "Newsreader",
      monthWeight: 500,
      monthSize: 104,
      subFont: "Instrument Sans",
      subWeight: 500,
      subSize: 34,
      subUpper: false,
      labelFont: "Instrument Sans",
      seal: { radius: 80, ground: null, ring: null, mark: { width: 160, height: 160 } },
    },
    fontsHref: `${GF}${NEWSREADER_Q}&${INSTRUMENT_Q}&display=swap`,
  },
  palisade: {
    display: GARAMOND,
    text: INSTRUMENT,
    figures: GEIST_MONO,
    paper: "#ffffff",
    ground: "#ece8df",
    ink: "#2a2d31",
    soft: "#4d5157",
    accent: "#6b5328",
    gold: "#b5975a",
    rule: "#e4ddd0",
    tint: "#f6f2ea",
    stripe: "#b5975a",
    logoHeight: 44,
    tabular: true,
    figureScale: 0.93,
    figureAdvance: 0.6,
    card: {
      scrim: "20,18,15",
      scrimMax: 0.82,
      light: "#f1ede4",
      accent: "#d9c48f",
      monthFont: "EB Garamond",
      monthWeight: 500,
      monthSize: 116,
      subFont: "Geist Mono",
      subWeight: 500,
      subSize: 32,
      subUpper: true,
      labelFont: "Instrument Sans",
      seal: { radius: 80, ground: "#233755", ring: "#b5975a", mark: { width: 100, height: 100 } },
    },
    fontsHref: `${GF}family=EB+Garamond:wght@400;500;600&${INSTRUMENT_Q}&family=Geist+Mono:wght@400;500&display=swap`,
  },
  columbus: {
    display: LITERATA,
    text: SCHIBSTED,
    figures: SCHIBSTED,
    paper: "#fbf7ef",
    ground: "#e9e3d6",
    ink: "#16273d",
    soft: "#3e4a5c",
    accent: "#7f6124",
    gold: "#b0894c",
    rule: "#e1d6c0",
    tint: "#f2ebdc",
    stripe: null,
    logoHeight: 50,
    tabular: false,
    figureScale: 1,
    figureAdvance: 0.54,
    card: {
      scrim: "15,29,46",
      scrimMax: 0.88,
      light: "#f7f1e5",
      accent: "#d9b77a",
      monthFont: "Literata",
      monthWeight: 600,
      monthSize: 94,
      subFont: "Schibsted Grotesk",
      subWeight: 500,
      subSize: 34,
      subUpper: false,
      labelFont: "Schibsted Grotesk",
      seal: { radius: 0, ground: null, ring: null, mark: { width: 160, height: 160 } },
    },
    fontsHref: `${GF}family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&family=Schibsted+Grotesk:wght@400;500;600&display=swap`,
  },
  xenia: {
    display: NEWSREADER,
    text: INSTRUMENT,
    figures: INSTRUMENT,
    paper: "#fbf8f1",
    ground: "#e9e4d6",
    ink: "#1f1d19",
    soft: "#4a463d",
    accent: "#4e5231",
    gold: "#a8823a",
    rule: "#ddd5c3",
    tint: "#efe9db",
    stripe: null,
    logoHeight: 36,
    tabular: true,
    figureScale: 1,
    figureAdvance: 0.54,
    card: {
      scrim: "22,21,15",
      scrimMax: 0.82,
      light: "#f4efe4",
      accent: "#e4dac4",
      monthFont: "Newsreader",
      monthWeight: 500,
      monthSize: 104,
      subFont: "Newsreader",
      subWeight: 500,
      subSize: 36,
      subUpper: false,
      labelFont: "Instrument Sans",
      seal: { radius: 80, ground: "#f4efe4", ring: null, mark: { width: 96, height: 87 } },
    },
    fontsHref: `${GF}${NEWSREADER_Q}&${INSTRUMENT_Q}&display=swap`,
  },
};
