/**
 * Five link preview card designs.
 *
 * A renderer returns a serializable tree of plain nodes rather than React
 * elements, because web-kit carries no React and should not start. The
 * scaffolded route in the client repo converts the tree into elements for
 * `next/og`. Satori needs `display: flex` on any element with more than one
 * child, so every container sets it.
 */

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
  return box(
    { ...base(c), position: "relative", flexDirection: "column", justifyContent: "flex-end" },
    [
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
          span(
            { fontFamily: c.bodyFont, fontSize: 28, color: "#ffffff", paddingTop: 12 },
            c.tagline,
          ),
        ],
      ),
    ],
  );
}

function typeOnly(c) {
  return box({ ...base(c), flexDirection: "column", justifyContent: "center", padding: "0 96px" }, [
    span({ fontFamily: c.displayFont, fontSize: 84, color: c.ink }, c.wordmark),
    box({ display: "flex", width: 120, height: 4, backgroundColor: c.brand, margin: "32px 0" }, []),
    span({ fontFamily: c.bodyFont, fontSize: 30, color: c.ink }, c.tagline),
  ]);
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
    throw new Error(
      `Unknown share card variant "${variantId}". Known: ${SHARE_CARD_IDS.join(", ")}`,
    );
  }
  if (NEEDS_PHOTO.has(variantId) && !config.photoUrl) {
    // A photo card with no photograph renders an empty frame, which reads as a
    // broken site rather than a design choice. Fall back, and say which variant
    // was asked for so the board can show why.
    return { ...markRule(config), fallbackFrom: variantId };
  }
  return renderer(config);
}
