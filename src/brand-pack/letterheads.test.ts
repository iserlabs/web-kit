import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import {
  LETTERHEAD_IDS,
  LETTERHEAD_VARIANTS,
  letterheadDocument,
  letterheadPlainText,
  letterheadSignature,
  renderLetterhead,
  // @ts-expect-error: plain ESM module
} from "./letterheads.mjs";

const config = {
  siteUrl: "https://sunmountainstays.com",
  wordmark: "Sun Mountain Stays",
  tagline: "Short term rental management, Colorado Springs",
  markUrl: "https://sunmountainstays.com/brand/mark-128.png",
  markAlt: "Sun Mountain Stays",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#fbf8f0",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [],
  letterhead: {
    headerUrl: "cid:letterhead",
    photoUrl: "https://sunmountainstays.com/photos/pikes-peak.jpg",
    photoAlt: "Pikes Peak from Colorado Springs",
    footer: "Sun Mountain Stays · Colorado Springs, Colorado",
    mastheadContact: true,
  },
};

const person = {
  name: "Jake Lee",
  title: "Founder",
  email: "hello@sunmountainstays.com",
  phone: "555.010.0100",
};

const email = {
  subject: "705 E Kiowa St | September 2026 owner statement",
  blocks: [
    { type: "p", text: "Hi Dana," },
    { type: "lead", text: "Your September statement is ready." },
    {
      type: "link",
      label: "You can read it here:",
      href: "https://sunmountainstays.com/owners/kiowa/2026-09",
    },
    {
      type: "list",
      intro: "Three things changed:",
      items: ["Cleaning moved to Sil.", "Rates rose 4%.", "Hot tub serviced."],
    },
    { type: "close", text: "Best," },
  ],
};

const texts = [
  "Hi Dana,",
  "Your September statement is ready.",
  "You can read it here:",
  "Three things changed:",
  "Cleaning moved to Sil.",
  "Rates rose 4%.",
  "Hot tub serviced.",
  "Best,",
];

const all = (c = config): [string, string][] =>
  LETTERHEAD_IDS.map((id: string) => [id, renderLetterhead(id, c, person, email)]);

describe("letterhead variants", () => {
  it("ships four with distinct ids, a label and a note each", () => {
    expect(LETTERHEAD_IDS).toEqual(["set", "paper", "masthead", "postcard"]);
    for (const v of LETTERHEAD_VARIANTS) {
      expect(v.label.length).toBeGreaterThan(3);
      expect(v.note.length).toBeGreaterThan(10);
    }
  });

  it("prints every word of the email in every layout, so no option drops content", () => {
    for (const [id, html] of all()) {
      const text = parse(html).textContent.replace(/\s+/g, " ");
      for (const t of texts)
        expect(text, `${id} is missing "${t}"`).toContain(t.replace(/%/g, "%"));
      expect(html, id).toContain("https://sunmountainstays.com/owners/kiowa/2026-09");
    }
  });

  it("numbers list items as typed 1) 2) 3), never a markdown list", () => {
    for (const [id, html] of all()) {
      expect(html, id).not.toMatch(/<ol|<ul|<li/);
      expect(parse(html).textContent, id).toMatch(/1\)[\s\S]*2\)[\s\S]*3\)/);
    }
  });

  it("uses only email-safe markup: inline styles, no stylesheet, classes, flex or grid", () => {
    for (const [id, html] of all()) {
      expect(html, id).not.toMatch(/<style|class=|display:\s*(flex|grid)|background-image/i);
    }
  });

  it("never sets a container wider than 600px", () => {
    for (const [id, html] of all()) {
      for (const m of html.matchAll(/(?:max-)?width:\s*(\d+)px/g))
        expect(Number(m[1]), id).toBeLessThanOrEqual(600);
    }
  });

  it("gives every image alt text so the words survive with images off", () => {
    for (const [id, html] of all()) {
      for (const img of parse(html).querySelectorAll("img"))
        expect(img.getAttribute("alt")?.length, id).toBeGreaterThan(0);
    }
  });

  it("shows a visible missing state when there is no header image yet", () => {
    const c = { ...config, letterhead: { ...config.letterhead, headerUrl: "__UNFILLED__" } };
    const html = renderLetterhead("paper", c, person, email);
    expect(html).toContain("No letterhead image yet");
    expect(html).not.toContain("__UNFILLED__");
  });

  it("falls back from postcard to paper, and says so, when the brand has no photograph", () => {
    const c = {
      ...config,
      photoUrl: undefined,
      letterhead: { ...config.letterhead, photoUrl: undefined },
    };
    const html = renderLetterhead("postcard", c, person, email);
    expect(html).toContain("postcard: no photoUrl, rendered paper");
  });

  it("uses the sender's own signature when one is passed", () => {
    const html = renderLetterhead("masthead", config, person, email, "<div>LIVE-SIGNATURE</div>");
    expect(html).toContain("LIVE-SIGNATURE");
  });

  it("refuses an unknown variant and an unknown block type", () => {
    expect(() => renderLetterhead("nope", config, person, email)).toThrow(
      /Unknown letterhead variant/,
    );
    expect(() =>
      renderLetterhead("paper", config, person, {
        subject: "",
        blocks: [{ type: "h9", text: "x" }],
      }),
    ).toThrow(/block type/);
  });

  it("writes a plain-text alternative carrying the link and typed numerals", () => {
    const t = letterheadPlainText(email, person);
    expect(t).toContain("https://sunmountainstays.com/owners/kiowa/2026-09");
    expect(t).toContain("1) Cleaning moved to Sil.");
    expect(t).toContain("Jake Lee");
  });

  it("wraps a document as light only, with the subject as its title", () => {
    const d = letterheadDocument("<p>x</p>", { subject: "A & B" });
    expect(d).toContain('content="light only"');
    expect(d).toContain("<title>A &amp; B</title>");
  });

  it("keeps a pasted signature's words while making its links tappable and its phone plain text", () => {
    const sig =
      '<a href="tel:+15550100100" style="color:#000">555.010.0100</a> · <a href="mailto:a@b.co" style="color:#000">a@b.co</a>';
    const out = letterheadSignature(sig);
    expect(parse(out).textContent).toBe(parse(sig).textContent);
    expect(out).not.toContain("tel:");
    expect(out).toContain("display:inline-block;padding:4px 0");
  });

  it("uses the address itself as button text when no label is given, so no words are added", () => {
    const html = renderLetterhead("postcard", config, person, email);
    expect(parse(html).textContent).not.toContain("Open the page");
  });

  it("lets a pasted signature fit a 390px phone: no nowrap, no fixed-width rule", () => {
    const sig =
      '<td style="font-size:12px;white-space:nowrap">a · b</td><div style="width:392.515625px;height:1px">&nbsp;</div><div style="width:1px;height:56px"></div>';
    const out = letterheadSignature(sig);
    expect(out).not.toMatch(/nowrap/);
    expect(out).toContain("width:100%");
    expect(out).not.toContain("392.5");
    expect(out).toContain("width:1px;height:56px");
  });

  it("drops the signature's logo on request, so a letterhead shows its mark once", () => {
    const sig =
      '<table><tr><td style="padding:0 16px 0 0"><a href="x"><img src="mark.png" alt="Brand"></a></td><td style="padding:0px 0px 0px 18px;border-left:1px solid #ccc"><div>Jake Lee</div></td></tr></table>';
    const out = letterheadSignature(sig, { logo: false });
    expect(out).not.toContain("<img");
    expect(out.match(/<td/g)?.length).toBe(1);
    expect(out).not.toContain("border-left");
    expect(out).toContain("padding:0");
    expect(letterheadSignature(sig)).toContain("<img");
  });

  it("sets money lines as a figures table, amounts right-aligned, last line strongest, words unchanged", () => {
    const e = {
      subject: "s",
      blocks: [
        {
          type: "figures",
          intro: "September:",
          rows: [
            ["Booked revenue:", "$3,043.58"],
            ["Paid to you:", "$2,302.94"],
          ],
        },
      ],
    };
    const html = renderLetterhead("paper", config, person, e);
    expect(parse(html).textContent).toContain("Booked revenue:");
    expect(html).toMatch(
      /text-align:right;white-space:nowrap;padding-left:12px;width:1%;">\$3,043\.58/,
    );
    expect(html).toMatch(/font-weight:700;[^>]*>Paid to you:/);
    expect(letterheadPlainText(e, person)).toContain("Paid to you: $2,302.94");
  });

  it("gives the bottom-line figure the most weight and runs the signature full width", () => {
    const e = {
      subject: "s",
      blocks: [
        {
          type: "figures",
          rows: [
            ["A:", "$1"],
            ["Paid to you:", "$2,302.94"],
          ],
        },
      ],
    };
    const html = renderLetterhead("paper", config, person, e);
    expect(html).toMatch(/font-size:26px;text-align:right[^>]*>\$2,302\.94/);
    const sig =
      '<table style="border-collapse:collapse"><tr><td><a href="mailto:a@b.co">a@b.co</a><span style="padding:0 7px">·</span><a href="https://b.co">b.co</a></td></tr></table>';
    const out = letterheadSignature(sig);
    expect(out).toContain('style="width:100%;border-collapse');
  });

  it("leaves no empty link behind when it drops the signature logo", () => {
    const sig =
      '<div><a href="https://x.co"><img src="m.png" alt="X"></a></div><div>Jake Lee</div>';
    expect(letterheadSignature(sig, { logo: false })).not.toMatch(/<a\b[^>]*>\s*<\/a>/);
  });

  it("under a header, stacks the contact line, drops logo leftovers, sets one name size and wraps addresses at slashes", () => {
    const sig =
      '<table><tr><td width="3" style="width:3px;background:#b5975a"> </td><td style="padding:1px 0px 1px 24px"><img src="m.png" alt="M"><div style="height:17px"> </div><div style="font-size:22px">Jake Lee</div><a href="tel:+1201" style="color:#000">201</a><span style="padding:0 7px">·</span><a href="mailto:a@b.co" style="color:#000">a@b.co</a></td></tr></table>';
    const out = letterheadSignature(sig, { logo: false, name: "Jake Lee" });
    expect(out).toContain('font-size:22px">Jake Lee');
    expect(out).not.toContain("·");
    expect(out).toContain("<br>");
    expect(out).toContain("padding:1px 0px 1px 0");
    expect(out.match(/<td/g)?.length).toBe(1);
    expect(out).toContain('<span style="display:inline-block;padding:4px 0">201</span>');
    const html = renderLetterhead("paper", config, person, email);
    expect(html).toContain("sunmountainstays.com/<wbr>owners/<wbr>kiowa/<wbr>2026-09");
  });

  it("handles a separator built from spacer spans and a name set in a span", () => {
    const sig =
      '<div><span style="font-size:17px;color:#000">Jake Lee</span></div><div><a href="tel:+1" style="c">201</a><span style="padding:0 3px"><span> </span>·<span> </span></span><a href="mailto:a@b.co" style="c">a@b.co</a></div>';
    const out = letterheadSignature(sig, { logo: false, name: "Jake Lee" });
    expect(out).not.toContain("·");
    expect(out).toContain('font-size:22px;color:#000">Jake Lee');
  });

  it("sets signature contact text at 15px and keeps small capital labels at 13px", () => {
    const out = letterheadSignature(
      '<div style="font-size:12px">a@b.co</div><div style="font-size:10px;text-transform:uppercase">FOUNDER</div>',
    );
    expect(out).toContain('style="font-size:15px"');
    expect(out).toContain("font-size:13px;text-transform:uppercase");
  });

  it("puts one rule above the signature, unless the letter already ends on the link panel's rule", () => {
    const rule = /margin:0 0 20px 0;">&nbsp;<\/div><div>SIG/;
    expect(renderLetterhead("paper", config, person, email, "<div>SIG</div>")).toMatch(rule);
    const endsOnLink = {
      subject: "s",
      blocks: [
        { type: "p", text: "Hi," },
        { type: "link", href: "https://x.co/a" },
      ],
    };
    expect(renderLetterhead("paper", config, person, endsOnLink, "<div>SIG</div>")).not.toMatch(
      rule,
    );
  });
});
