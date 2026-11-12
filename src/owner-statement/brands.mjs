/**
 * Brand tokens for the four statement looks. Faces and palettes are the locks in the design
 * standard (2.4): Palisade is EB Garamond, Instrument Sans and Geist Mono with gold; Columbus is
 * navy, gold and cream; Sun Mountain is Newsreader and Instrument Sans; Xenia is Newsreader with
 * oat, olive and clay. Every stack reads a CSS variable a site can set (for example the one
 * next/font writes) and falls back to the face by name.
 */

const NEWSREADER = 'var(--font-newsreader, "Newsreader"), Georgia, serif';
const INSTRUMENT = 'var(--font-instrument-sans, "Instrument Sans"), "Helvetica Neue", Arial, sans-serif';
const GARAMOND = 'var(--font-eb-garamond, "EB Garamond"), Georgia, serif';
const GEIST_MONO = 'var(--font-geist-mono, "Geist Mono"), ui-monospace, "SF Mono", Menlo, monospace';
const LITERATA = 'var(--font-literata, "Literata"), Georgia, serif';
const SCHIBSTED = 'var(--font-schibsted-grotesk, "Schibsted Grotesk"), "Helvetica Neue", Arial, sans-serif';

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
    fontsHref: `${GF}${NEWSREADER_Q}&${INSTRUMENT_Q}&display=swap`,
  },
};
