import { isUnfilled } from "../brand-pack/unfilled.mjs";
import { BRANDS } from "./brands.mjs";
import { validate } from "./validate.mjs";

/**
 * What a statement link shows in a preview (iMessage, WhatsApp, Slack, Google), and the card image
 * itself. Option 1 "Photo and seal", picked 2026-11-12: the owner's home fills the card, the brand's
 * mark sits on the center line, the month large under it, a small "Owner statement" line, then the
 * year and the address.
 *
 * The card and the tags are public (a crawler reads them without the statement password), so they
 * carry the month, the property, the brand and the place, and never a figure, the owner's name or
 * a stay count. Every string a caller hands in is checked for money and the owner's name too.
 */

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

/**
 * The box every word and the seal stay inside. WhatsApp and Google crop the 1200x630 card to its
 * center square (x 285 to 915); this keeps a 30px margin inside that square.
 */
export const SHARE_CARD_SAFE = { left: 315, width: 570 };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Anything that reads as money: a dollar sign, thousands commas, or a figure with cents. */
const MONEY = /\$|\d,\d{3}|\d\.\d{2}\b/;
const SEP = " · ";

function checkModel(model) {
  const errors = validate(model);
  if (errors.length) {
    throw new Error(`owner-statement: the model does not validate:\n${errors.join("\n")}`);
  }
}

/** The owner's name and greeting as whole words of three letters or more. */
function ownerWords(model) {
  const words = `${model.owner?.name ?? ""} ${model.owner?.greeting ?? ""}`
    .split(/[^\p{L}'-]+/u)
    .flatMap((w) => w.split("-"))
    .filter((w) => w.length > 2 && !/^(and|the)$/i.test(w));
  return [...new Set(words)];
}

/** Throws when a string bound for the public card or tags carries money or the owner's name. */
function guard(model, what, value) {
  if (MONEY.test(value)) {
    throw new Error(`owner-statement: the share ${what} would carry money: "${value}"`);
  }
  for (const word of ownerWords(model)) {
    const re = new RegExp(
      `(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`,
      "iu",
    );
    if (re.test(value)) {
      throw new Error(`owner-statement: the share ${what} would carry the owner's name`);
    }
  }
  return value;
}

function need(value, what) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`owner-statement: options.${what} is required`);
  }
  return value.trim();
}

/** True when the property and the brand are one name (the hotel), so the street stands in. */
const propertyIsBrand = (model) => model.property.label === model.business;

/**
 * The tags for a statement page. `place` is "{city, state}" as the brand writes it; `street` is
 * required when the property is the brand itself. `imageUrl`, when given, comes back as a ready
 * `image` entry for the page metadata.
 */
export function statementShareMeta(model, options) {
  checkModel(model);
  const place = guard(model, "place", need(options?.place, "place"));
  const label = guard(model, "property", model.property.label);
  const business = guard(model, "business", model.business);
  const month = model.monthLabel;
  const lead = propertyIsBrand(model)
    ? guard(model, "street", need(options?.street, "street (the property is the brand)"))
    : business;
  const imageAlt = propertyIsBrand(model)
    ? `${business} owner statement, ${month}`
    : `${business} owner statement, ${month}, ${label}`;
  const meta = {
    title: `${month} owner statement${SEP}${label}`,
    description: `${lead}${SEP}${place}`,
    siteName: business,
    imageAlt,
    imageWidth: SHARE_CARD_SIZE.width,
    imageHeight: SHARE_CARD_SIZE.height,
  };
  if (options?.imageUrl !== undefined) {
    meta.image = {
      url: need(options.imageUrl, "imageUrl"),
      width: SHARE_CARD_SIZE.width,
      height: SHARE_CARD_SIZE.height,
      alt: imageAlt,
    };
  }
  for (const [k, v] of Object.entries(meta)) if (typeof v === "string") guard(model, k, v);
  return meta;
}

// ---- the card tree: plain nodes, display flex on every multi-child box (Satori) ----

const node = (tag, style, children = [], extra = {}) => ({ tag, style, children, ...extra });
const abs = (left, top, width, height, style = {}) => ({
  position: "absolute",
  left,
  top,
  width,
  height,
  display: "flex",
  ...style,
});

/** Rough width of a line in px, to step a long address down before Satori sees it. */
function lineWidth(text, size, font, upper, trackingEm) {
  const advance = /mono/i.test(font) ? 0.6 : 0.5;
  const caps = upper ? 0.1 : 0;
  return text.length * size * (advance + caps + trackingEm);
}

const SUB_FLOOR = 30;

/**
 * The option-1 card for one statement, as a tree of `{ tag, style, children, src?, alt?, role? }`.
 * `photoUrl` and `markUrl` are absolute addresses (or data URIs) the image route can fetch;
 * `photoCrop` places the photo at an explicit size and offset, otherwise it covers the card.
 * `fonts.display` / `fonts.text` rename the faces when the route loaded them under other names.
 */
export function renderStatementShareCard(model, options = {}) {
  checkModel(model);
  const { photoUrl, markUrl, photoCrop, fonts = {} } = options;
  const tokens = BRANDS[model.brand];
  const c = tokens.card;
  const display = fonts.display ?? c.monthFont;
  const subFont = fonts.text ?? c.subFont;
  const labelFont = fonts.text ?? c.labelFont;
  const shadow = `0 2px 14px rgba(${c.scrim},0.5)`;
  const [year, mm] = String(model.month).split("-");
  const monthName = MONTHS[Number(mm) - 1];
  const address = propertyIsBrand(model)
    ? guard(model, "place", need(options.place, "place (the property is the brand)"))
    : guard(model, "property", model.property.label);
  const subText = `${year}${SEP}${address}`;
  const tracking = c.subUpper ? 0.06 : 0;
  let subSize = c.subSize;
  while (
    subSize > SUB_FLOOR &&
    lineWidth(subText, subSize, subFont, c.subUpper, tracking) > SHARE_CARD_SAFE.width
  ) {
    subSize -= 2;
  }
  subSize = Math.max(subSize, SUB_FLOOR);

  const { width: W, height: H } = SHARE_CARD_SIZE;
  const layers = [];

  if (isUnfilled(photoUrl)) {
    layers.push(
      node(
        "div",
        abs(24, 24, W - 48, H - 48, {
          border: `3px dashed ${c.accent}`,
          justifyContent: "center",
          alignItems: "flex-start",
          paddingTop: 216,
        }),
        [
          node(
            "div",
            {
              display: "flex",
              fontFamily: labelFont,
              fontSize: 30,
              fontWeight: 500,
              color: c.accent,
            },
            ["No photo supplied"],
          ),
        ],
        { role: "no-photo" },
      ),
    );
  } else {
    const style = photoCrop
      ? {
          position: "absolute",
          left: photoCrop.left ?? 0,
          top: photoCrop.top ?? 0,
          width: photoCrop.width,
          height: photoCrop.height,
        }
      : { width: W, height: H, objectFit: "cover" };
    layers.push(
      node("div", abs(0, 0, W, H, { overflow: "hidden" }), [
        node("img", style, [], { src: photoUrl, alt: "", role: "photo" }),
      ]),
    );
    layers.push(
      node(
        "div",
        abs(0, 250, W, 380, {
          backgroundImage: `linear-gradient(180deg, rgba(${c.scrim},0) 0%, rgba(${c.scrim},0.56) 45%, rgba(${c.scrim},${c.scrimMax}) 100%)`,
        }),
        [],
        { role: "scrim" },
      ),
    );
  }

  if (tokens.stripe) {
    layers.push(
      node("div", abs(0, 0, 14, H, { backgroundColor: tokens.stripe }), [], { role: "stripe" }),
    );
  }

  const s = c.seal;
  const sealSize = 160;
  const sealStyle = abs((W - sealSize) / 2, 40, sealSize, sealSize, {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: s.radius,
    boxShadow: "0 10px 30px rgba(0,0,0,0.30)",
    ...(s.ground ? { backgroundColor: s.ground } : {}),
    ...(s.ring ? { border: `4px solid ${s.ring}` } : {}),
  });
  const mark = isUnfilled(markUrl)
    ? node(
        "div",
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: sealSize,
          height: sealSize,
          borderRadius: s.radius,
          border: `2px dashed ${c.accent}`,
          backgroundColor: `rgb(${c.scrim})`,
          color: c.accent,
          fontFamily: labelFont,
          fontSize: 18,
          textAlign: "center",
        },
        ["No mark supplied"],
      )
    : node(
        "img",
        {
          width: s.mark.width,
          height: s.mark.height,
          ...(s.ground ? {} : { borderRadius: s.radius }),
        },
        [],
        { src: markUrl, alt: model.business, role: "mark" },
      );
  layers.push(node("div", sealStyle, [mark], { role: "seal" }));

  const line = (style, text, role) =>
    node(
      "div",
      {
        display: "flex",
        justifyContent: "center",
        maxWidth: SHARE_CARD_SAFE.width,
        textShadow: shadow,
        ...style,
      },
      [text],
      { role },
    );
  layers.push(
    node(
      "div",
      {
        position: "absolute",
        left: SHARE_CARD_SAFE.left,
        width: SHARE_CARD_SAFE.width,
        bottom: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      },
      [
        line(
          {
            fontFamily: display,
            fontWeight: c.monthWeight,
            fontSize: c.monthSize,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: c.light,
          },
          monthName,
          "month",
        ),
        line(
          {
            marginTop: 16,
            fontFamily: labelFont,
            fontWeight: 500,
            fontSize: 28,
            lineHeight: 1.2,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: c.accent,
          },
          "Owner statement",
          "label",
        ),
        line(
          {
            marginTop: 14,
            fontFamily: subFont,
            fontWeight: c.subWeight,
            fontSize: subSize,
            lineHeight: 1.2,
            textAlign: "center",
            color: c.light,
            ...(c.subUpper ? { textTransform: "uppercase", letterSpacing: `${tracking}em` } : {}),
          },
          subText,
          "sub",
        ),
      ],
      { role: "text" },
    ),
  );

  return node(
    "div",
    {
      width: W,
      height: H,
      display: "flex",
      position: "relative",
      overflow: "hidden",
      backgroundColor: `rgb(${c.scrim})`,
    },
    layers,
  );
}
