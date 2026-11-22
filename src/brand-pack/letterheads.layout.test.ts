import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { LETTERHEAD_IDS, letterheadDocument, renderLetterhead } from "./letterheads.mjs";

/**
 * The letterhead email measured in a real browser at the narrowest phones (320 is the first
 * iPhone SE). Nothing may push the page sideways: not the summary table's figure columns, not a
 * long address, not a pasted Gmail signature with a fixed-width rule or a line that refuses to
 * wrap. Every layout, with and without a pasted signature. Skipped with no headless Chrome.
 */
const CHROME = join(homedir(), ".claude/bin/chrome-headless");
const HAVE_CHROME = existsSync(CHROME);
const PHONES = [320, 360, 390];

const config = {
  siteUrl: "https://example-stays.com",
  wordmark: "Example Stays",
  tagline: "Short term rental management",
  displayFont: "'Newsreader', Georgia, 'Times New Roman', serif",
  bodyFont: "'Instrument Sans', -apple-system, Helvetica, Arial, sans-serif",
  ink: "#0d2318",
  ground: "#fbf8f0",
  brand: "#c8912f",
  accent: "#b0492b",
  shareCard: "mark-rule",
  people: [],
  letterhead: {
    headerUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    headerWidth: 384,
    photoUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    photoAlt: "The house from the street",
    footer: "Example Stays · Somewhere, Colorado",
    mastheadContact: true,
  },
};

const person = {
  name: "Pat Example",
  title: "Founder",
  email: "hello@example-stays.com",
  phone: "555.010.0100",
};

/** The owner statement email at its widest: the longest labels and figures the real months carry. */
const email = {
  subject: "100 Example St | October 2026 owner statement",
  blocks: [
    { type: "p", text: "Hi Lonny and Jennifer," },
    {
      type: "lead",
      text: "Your October total is $35,094.30, and our management fee is $3,812.42 by check.",
    },
    { type: "heading", text: "October at a glance" },
    {
      type: "table",
      columns: ["", "October", "September"],
      rows: [
        ["Host payout", "$46,196.31", "$45,311.12"],
        ["Management fee", "($3,812.42)", "($2,099.86)"],
        ["Cleaning, fee, expenses", "($5,425.00)", "($2,099.86)"],
        ["Occupancy", "50.8%", "96.7%"],
      ],
      strongColumn: 1,
    },
    { type: "heading", text: "Needs your attention" },
    {
      type: "list",
      items: [
        "The stay of October 30 to November 2 was still running at close and is counted here.",
        "A refund of up to $466.84 is still to be settled.",
      ],
    },
    {
      type: "button",
      label: "Open the October statement",
      href: "https://example-stays.com/client/someone/report/october-2026",
    },
    {
      type: "p",
      text: "Prefer a PDF? The same statement is here: https://example-stays.com/client/someone/report/october-2026/pdf",
    },
    {
      type: "p",
      text: "Questions on any figure: reply here, or pick a time at https://example.com/meet.",
    },
    { type: "close", text: "Best," },
  ],
};

/** A signature pasted from a live Gmail account, as the close engine passes it: a fixed-width rule and a contact line that will not wrap. */
const gmailSignature =
  '<div dir="ltr"><table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;border-collapse:collapse"><tbody>' +
  '<tr><td style="padding:0px"><table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tbody><tr>' +
  '<td style="padding:0px 16px 0px 0px;vertical-align:middle"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="64" height="64" alt="Example Stays" style="display:block;width:64px;height:64px"></td>' +
  '<td style="padding:0px;vertical-align:middle"><div style="font-size:18px;line-height:23px;font-weight:600">Pat Example</div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1.7px">FOUNDER</div><div style="font-size:14px">Example Stays</div></td>' +
  "</tr></tbody></table></td></tr>" +
  '<tr><td style="padding:12px 0px 0px"><div style="width:392.515625px;height:1px;background-color:rgb(226,221,209);font-size:1px;line-height:1px"> </div></td></tr>' +
  '<tr><td style="padding:10px 0px 0px;font-size:12px;line-height:17px;white-space:nowrap"><a href="mailto:hello@example-stays.com" style="color:rgb(58,70,78);text-decoration:none" target="_blank"><span>hello@example-stays-management.com</span></a><span style="color:rgb(200,145,47);font-size:11px;padding:0px 7px">·</span><a href="https://example-stays.com/" style="color:rgb(13,35,24);text-decoration:none" target="_blank"><span>example-stays-management.com</span></a></td></tr>' +
  "</tbody></table></div>";

interface Reading {
  width: number;
  scrollWidth: number;
  past: string[];
}

/** Runs in the page: the page width, and every element whose right edge leaves the window. */
function measure(): Omit<Reading, "width"> {
  const past: string[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.right > window.innerWidth + 0.5) {
      past.push(
        `${el.tagName} right ${box.right.toFixed(1)} "${(el.textContent ?? "").trim().slice(0, 40)}"`,
      );
    }
  }
  return { scrollWidth: document.documentElement.scrollWidth, past: past.slice(0, 5) };
}

describe.skipIf(!HAVE_CHROME)("letterhead email on the narrowest phones", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ executablePath: CHROME });
  }, 60_000);
  afterAll(async () => {
    await Promise.race([browser?.close(), new Promise((done) => setTimeout(done, 5_000))]);
  }, 30_000);

  async function readings(html: string, widths: number[]): Promise<Reading[]> {
    const p = await browser.newPage({ viewport: { width: widths[0] ?? 320, height: 900 } });
    try {
      await p.setContent(html, { waitUntil: "load" });
      const out: Reading[] = [];
      for (const width of widths) {
        await p.setViewportSize({ width, height: 900 });
        out.push({ width, ...(await p.evaluate(measure)) });
      }
      return out;
    } finally {
      await p.close();
    }
  }

  for (const id of LETTERHEAD_IDS as string[]) {
    for (const [label, sig] of [
      ["its own signature", undefined],
      ["a pasted Gmail signature", gmailSignature],
    ] as const) {
      it(`${id} with ${label}: no sideways scroll at 320, 360 and 390`, async () => {
        const html = letterheadDocument(renderLetterhead(id, config, person, email, sig), {
          subject: email.subject,
        });
        for (const r of await readings(html, PHONES)) {
          expect(r.scrollWidth, `${r.width}px wide: ${r.past.join(" | ")}`).toBeLessThanOrEqual(
            r.width,
          );
        }
      }, 60_000);
    }
  }

  it("paper keeps its 20px side margins on a desktop-width letter", async () => {
    const html = letterheadDocument(renderLetterhead("paper", config, person, email), {
      subject: email.subject,
    });
    const p = await browser.newPage({ viewport: { width: 760, height: 900 } });
    try {
      await p.setContent(html, { waitUntil: "load" });
      const gutters = await p.evaluate(() => {
        const cell = Array.from(document.querySelectorAll("p")).find(
          (el) => el.textContent === "Hi Lonny and Jennifer,",
        );
        const sheet = cell?.parentElement?.parentElement?.getBoundingClientRect();
        const body = cell?.getBoundingClientRect();
        return sheet && body ? [body.left - sheet.left, sheet.right - body.right] : [];
      });
      expect(gutters.length).toBe(2);
      for (const g of gutters) expect(Math.abs(g - 21)).toBeLessThanOrEqual(0.6);
    } finally {
      await p.close();
    }
  }, 60_000);
});
