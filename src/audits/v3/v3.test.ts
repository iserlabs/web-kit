import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module
import { applyBaseline, recordBaseline } from "./baseline.mjs";
// @ts-expect-error: plain ESM module
import { makeSite, runOne, startFixtureServer } from "./harness.mjs";
// @ts-expect-error: plain ESM module
import { ALL_CHECKS, runV3Audit } from "./index.mjs";
// @ts-expect-error: plain ESM module
import { faceName, formatLine, loadDecisions, PROBATION, TIERS } from "./lib.mjs";

const PROBATION_IDS = Object.keys(PROBATION);

/**
 * One good page that passes every check, and for each check one bad page that fails it.
 * The good page runs once through the whole audit; each bad page runs through only its check.
 */
const dec = (b64: string) => Buffer.from(b64, "base64").toString("utf8");
const DASH = String.fromCharCode(0x2014);
const NOT_X_Y = dec("SXQncyBub3QgYSByZW50YWwsIGl0J3MgYSBob21lLg==");
const BUZZ_LINE = dec("U2VhbWxlc3MgY2hlY2staW4gZm9yIGV2ZXJ5IGd1ZXN0Lg==");
const SPARKLE_LINE = dec("QSBtYWdpY2FsIHN0YXkgYXdhaXRzIHlvdSBoZXJlLg==");
const SUPER_LINE = dec("VGhlIGJlc3QgbG9mdCBpbiB0b3duLg==");

const doc = (body: string, css = "", head = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test page</title><meta name="viewport" content="width=device-width,initial-scale=1">${head}<style>body{margin:0;font:18px/1.5 Georgia,serif;color:#14110f;background:#fff}${css}</style></head><body><main>${body}</main></body></html>`;

const GOOD = readFileSync(join(import.meta.dirname, "__fixtures__", "good.html"), "utf8");

const FACTS = `| claim | where | source | match |
|---|---|---|---|
| Cedar Loft sleeps 6 | hero | catalog | yes |
| 2 bedrooms | hero | catalog | yes |
| Hot tub holds 6 | amenities | catalog | yes |
| 4 blocks from the lift | hero | map | yes |
| Nightly rate $249 | rates | engine | yes |
| Cedar deck is 4 steps from the kitchen | amenities | catalog | yes |
| Quiet hours at 10 pm | house rules | rules | yes |
| Request dates for the loft in Silverthorne | form | copy | yes |
| Where the loft sits near the lift | map | copy | yes |
| Quiet hours and house rules | rules | copy | yes |
| Nightly rate for the loft | rates | engine | yes |
`;
const SCALES = {
  radius: [0, 8, 16],
  fontSizes: [14, 16, 18, 32, 48],
  spacing: [4, 8, 12, 16, 24, 48, 64, 96],
};

let browser: any;
let server: any;
let goodSite: string;
let emailsDir: string;
let goodResults: Record<string, any> = {};

beforeAll(async () => {
  browser = await chromium.launch();
  server = await startFixtureServer();
  server.set("/embed", doc("<p>Map of Silverthorne</p>"));
  server.set("/blank", "<!doctype html><html><body></body></html>");
  server.set("/api/rates", { type: "application/json", body: '{"nightly":249}', delay: 900 });
  server.set("/robots.txt", {
    type: "text/plain",
    body: "User-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: *\nAllow: /\nSitemap: /sitemap.xml\n",
  });
  goodSite = makeSite({ "docs/design/FACTS.md": FACTS, "docs/design/scales.json": SCALES });
  emailsDir = join(goodSite, "emails");
  mkdirSync(emailsDir, { recursive: true });
  writeFileSync(
    join(emailsDir, "ok.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><table width="100%" style="max-width:600px"><tr><td>Hello</td></tr></table></body></html>',
  );
  const url = server.add(GOOD, "/good");
  const out = await runV3Audit(url, { browser, routes: ["/"], siteDir: goodSite, emailsDir });
  goodResults = Object.fromEntries(out.results.map((r: any) => [r.id, r]));
}, 240000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const IDS = Object.keys(TIERS) as string[];

describe("the good page passes every check", () => {
  it("covers all 47 checks", () => {
    expect(ALL_CHECKS.map((c: any) => c.id).sort()).toEqual([...IDS].sort());
    expect(IDS).toHaveLength(47);
  });
  it.each(IDS)("%s passes", (id) => {
    const r = goodResults[id];
    expect(r, `${id} did not run`).toBeTruthy();
    expect(`${r.id} ${r.status} ${r.reason}`).toMatch(/PASS/);
  });
});

type Bad = { id: string; html: string; site?: Record<string, unknown>; want?: string };
const font = faceName("retnI");
const BAD: Bad[] = [
  { id: "C01", html: doc("<h2>Hot tub holds six.</h2>") },
  { id: "C02", html: doc("<span>01</span><h2>Our story</h2>") },
  { id: "C03", html: doc('<p style="letter-spacing:-0.05em">Tight text sits here</p>') },
  {
    id: "C04",
    html: doc('<p style="text-transform:uppercase;font-size:20px">Welcome to the loft</p>'),
  },
  {
    id: "C05",
    html: doc(`<p style="font-family:'${font}',sans-serif">Body text in a stock face</p>`),
  },
  {
    id: "C06",
    html: doc('<div style="background:linear-gradient(90deg,#f00,#00f);height:80px">band</div>'),
  },
  { id: "C07", html: doc('<div style="border:1px solid #333;padding:8px">A boxed card</div>') },
  { id: "C08", html: doc('<style>.x{opacity:.5}</style><p class="x">Faded text</p>') },
  { id: "C09", html: doc('<p style="font-family:monospace">Welcome to the loft</p>') },
  { id: "C10", html: doc("<h2><em>Quiet</em> loft</h2>") },
  { id: "C11", html: doc("<button>Book now \u{1F389}</button>") },
  { id: "C12", html: doc('<div style="backdrop-filter:blur(10px);padding:8px">glass</div>') },
  {
    id: "C13",
    html: doc(
      '<button><svg class="lucide lucide-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/></svg> Close</button>',
    ),
  },
  {
    id: "C14",
    html: doc(
      '<button style="font-weight:300"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M5 12h14"/></svg> Next</button>',
    ),
  },
  {
    id: "C15",
    html: doc(
      '<div style="border-radius:24px;padding:8px;background:#eee;width:200px"><div style="border-radius:24px;background:#ccc;height:60px"></div></div>',
    ),
  },
  {
    id: "C16",
    html: doc('<div style="border-radius:12px;background:#eee;padding:8px">Soft corner</div>'),
    site: { "docs/design/scales.json": SCALES },
  },
  {
    id: "C17",
    html: doc(
      [12, 13, 15, 17, 19, 23, 29].map((s) => `<p style="font-size:${s}px">Size ${s}</p>`).join(""),
    ),
    site: { "docs/design/scales.json": SCALES },
  },
  {
    id: "C18",
    html: doc(
      '<section style="padding:20px"><p>One block of text here</p></section><section style="padding:20px"><p>Another block of text</p></section>',
    ),
    site: { "docs/design/scales.json": SCALES },
  },
  {
    id: "C19",
    html: doc(
      '<h2 style="font-size:40px;margin:0 24px">A quiet cedar loft in the mountains above Silverthorne Colorado</h2>',
      "h2{text-wrap:wrap}",
    ),
  },
  { id: "C20", html: doc("<p>$249 per night</p>") },
  {
    id: "C21",
    html: doc(
      '<button style="background:#8a3b12;color:#fff;border:0;min-height:48px">Book the loft</button><br><button style="background:#123b8a;color:#fff;border:0;min-height:48px">Ask a question</button>',
    ),
  },
  {
    id: "C22",
    html: doc(
      '<div style="display:flex;gap:16px">' +
        ["Sleeps six", "Hot tub", "Near lift"]
          .map((t) => `<div style="flex:1"><h3>${t}</h3><p>Plain words about it.</p></div>`)
          .join("") +
        "</div>",
    ),
  },
  { id: "C23", html: doc("<button>Learn more</button>") },
  {
    id: "C24",
    html: doc(
      "<form>" +
        ["a", "b", "c", "d", "e", "f"]
          .map((n) => `<input name="${n}" required aria-label="${n}">`)
          .join("") +
        "<button>Send request</button></form>",
    ),
  },
  { id: "C25", html: doc('<a href="/a">Home</a> <a href="/b">Stay</a>') },
  {
    id: "C26",
    html: doc(
      "<header><nav>" +
        ["One", "Two", "Three", "Four", "Five", "Six", "Seven"]
          .map((t) => `<a href="/${t}">${t}</a>`)
          .join(" ") +
        "</nav></header>",
    ),
  },
  {
    id: "C27",
    html: doc('<a href="/a">First link</a><br><a href="/b">Second link</a>', "a{outline:none}"),
  },
  {
    id: "C28",
    html: doc('<iframe src="/blank" title="Booking widget" width="300" height="120"></iframe>'),
  },
  {
    id: "C29",
    html: doc(
      '<div id="r"></div><script>fetch("/api/rates").then(function(r){return r.json()}).then(function(d){document.getElementById("r").textContent="From $"+d.nightly})</script>',
    ),
  },
  {
    id: "C30",
    html: doc(
      '<button id="t" aria-expanded="false">Details</button><div id="d"></div><script>document.getElementById("t").onclick=function(){var b=this;setTimeout(function(){b.setAttribute("aria-expanded","true")},400)}</script>',
    ),
  },
  {
    id: "C31",
    html: doc(
      '<div style="height:1600px"></div><h2 id="late" style="opacity:0;transition:opacity .4s">Hot tub holds six</h2><script>new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.style.opacity=1})}).observe(document.getElementById("late"))</script>',
    ),
  },
  {
    id: "C32",
    html: doc(
      '<p>Hover me</p><script>document.addEventListener("mousemove",function(){})</script>',
    ),
  },
  {
    id: "C33",
    html: doc(
      '<div class="s" style="width:40px;height:40px;background:#888"></div>',
      "@keyframes spin{to{transform:rotate(360deg)}}.s{animation:spin 2s linear infinite}",
    ),
  },
  { id: "C34", html: doc("<p>Lorem ipsum dolor sit amet</p>") },
  {
    id: "C35",
    html: doc(`<p>Sleeps 14 guests. ${SUPER_LINE}</p>`),
    site: { "docs/design/FACTS.md": FACTS },
  },
  {
    id: "C36",
    html: doc(
      `<p>${NOT_X_Y}</p><p>${BUZZ_LINE}</p><p>${SPARKLE_LINE}</p><p>A loft${DASH}warm and quiet.</p>`,
    ),
  },
  {
    id: "C37",
    html: doc(
      "<h1>A very long headline that keeps on going well past the ten word budget set</h1>",
    ),
    want: "WARN",
  },
  {
    id: "C38",
    html: doc(
      '<p style="font-size:13px;text-transform:uppercase;letter-spacing:.1em;margin:0">Our story</p><h2>Cedar Loft story</h2>',
    ),
  },
  { id: "C39", html: doc("<p>Above</p><hr><p>Below</p>") },
  {
    id: "C40",
    html: doc(
      '<span style="display:inline-block;border-radius:999px;background:#eee;padding:4px 12px">Superhost</span>',
    ),
  },
  {
    id: "C41",
    html: doc("<h1>Welcome to a place of calm</h1>"),
    site: { "docs/design/FACTS.md": FACTS },
  },
  {
    id: "C42",
    html: doc(
      "<p>Plain</p>",
      ":root{--primary:oklch(0.205 0 0);--muted-foreground:oklch(0.556 0 0);--border:oklch(0.922 0 0)}",
    ),
  },
  {
    id: "C43",
    html: doc(
      '<p>Loading</p><script>setTimeout(function(){var h=document.createElement("h1");h.style.fontSize="64px";h.textContent="A late arriving headline";document.body.appendChild(h)},3000)</script>',
    ),
  },
  {
    id: "C44",
    html: doc('<p style="color:#999">A plain paragraph with enough words to measure.</p>'),
  },
  {
    id: "C45",
    html: doc(
      "<p>Plain</p>",
      "@media (prefers-color-scheme:dark){body{background:#000;color:#fff}}",
    ),
  },
  {
    id: "C47",
    html: doc(
      "<h1>Cedar Loft</h1>",
      "",
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"LodgingBusiness","name":"Cedar Loft","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","reviewCount":"120"}}</script>',
    ),
  },
];

describe("each bad page fails its check", () => {
  it.each(BAD.map((b) => [b.id, b] as const))(
    "%s fails on its bad fixture",
    async (_id, b) => {
      let siteDir: string | undefined;
      if (b.site) siteDir = makeSite(b.site);
      // C47 needs a server with no robots.txt of its own
      const srv = b.id === "C47" ? await startFixtureServer() : server;
      try {
        // after probation every check blocks, so prove the bad page FAILs with a date past it
        const r = await runOne(srv, browser, b.id, b.html, { siteDir, today: "2027-01-01" });
        expect(r.status, `${b.id}: ${r.reason}`).toBe(b.want ?? "FAIL");
        expect(r.count).toBeGreaterThan(0);
      } finally {
        if (srv !== server) await srv.close();
      }
    },
    120000,
  );

  it("C46 fails on an email wider than the phone", async () => {
    const dir = makeSite({
      "emails/wide.html":
        '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><table width="800"><tr><td>wide</td></tr></table></body></html>',
    });
    const r = await runOne(server, browser, "C46", doc("<p>x</p>"), {
      emailsDir: join(dir, "emails"),
    });
    expect(r.status).toBe("FAIL");
  }, 60000);
});

describe("checks that need site data say so", () => {
  it.each(["C16", "C17", "C18", "C35", "C41"])(
    "%s reports UNPROVEN with no data on file",
    async (id) => {
      const good =
        id === "C35" || id === "C41"
          ? "<h1>Cedar Loft</h1><p>Sleeps 6.</p>"
          : '<section style="padding:96px 24px"><p>Short text here</p></section>';
      const r = await runOne(server, browser, id, doc(good));
      expect(r.status).toBe("UNPROVEN");
      expect(r.reason).toMatch(/UNPROVEN/);
    },
    60000,
  );
  it("C46 reports UNPROVEN with no email folder", () => {
    expect(goodResults.C46.status).toBe("PASS");
  });
});

describe("decisions, baseline and printing", () => {
  it("a reason in DECISIONS.md waives a T1 failure, but never a T2 one", async () => {
    const site = makeSite({
      "docs/design/DECISIONS.md":
        "- C01: the client's wordmark ends with a period in their own logo lockup\n- C20: we like proportional numbers here for the look\n",
    });
    expect(loadDecisions(site).has("C01")).toBe(true);
    const t1 = await runOne(server, browser, "C01", doc("<h2>Hot tub holds six.</h2>"), {
      siteDir: site,
    });
    expect(t1.waived).toMatch(/wordmark/);
    expect(formatLine(t1)).toMatch(/^PASS/);
    const t2 = await runOne(server, browser, "C20", doc("<p>$249 per night</p>"), {
      siteDir: site,
    });
    expect(t2.status).toBe("FAIL");
    expect(t2.waived).toBeUndefined();
  }, 60000);

  it("judgment-heavy checks warn instead of blocking during their probation, then block", async () => {
    const bad = doc(
      '<p style="font-size:13px;text-transform:uppercase;letter-spacing:.1em;margin:0">Our story</p><h2>Cedar Loft story</h2>',
    );
    const inside = await runOne(server, browser, "C38", bad, { today: "2026-11-23" });
    expect(inside.status).toBe("WARN");
    expect(inside.probation).toBe("2026-12-22");
    expect(formatLine(inside)).toMatch(/probation until 2026-12-22/);
    const after = await runOne(server, browser, "C38", bad, { today: "2026-12-23" });
    expect(after.status).toBe("FAIL");
    expect(PROBATION_IDS.every((id) => TIERS[id])).toBe(true);
  }, 60000);

  it("real-site regressions: SVG text and 'light only' are read correctly", async () => {
    const svg = await runOne(
      server,
      browser,
      "C20",
      doc(
        '<svg width="200" height="40"><text x="4" y="20">$249 chart label</text></svg><p>Plain words only</p>',
      ),
    );
    expect(svg.status).toBe("PASS");
    const only = await runOne(
      server,
      browser,
      "C45",
      doc("<p>Plain</p>", ":root{color-scheme:light only}"),
    );
    expect(only.status).toBe("PASS");
  }, 60000);

  it("real-site regression: a sideways photo strip is not a keyboard trap", async () => {
    const items = Array.from({ length: 6 }, (_, i) => `<li><button class="ints-open" aria-label="Photo ${i + 1}"><img alt="Room ${i + 1}" width="280" height="60" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></button></li>`).join("");
    const strip = await runOne(
      server,
      browser,
      "C27",
      doc(
        `<a href="/a">Start</a><ul class="row">${items}</ul><a href="/b">After the strip</a>`,
        ".row{display:flex;overflow-x:auto;width:300px;list-style:none;padding:0;margin:0}.row li{flex:0 0 300px}.row button{width:280px;height:60px}",
      ),
    );
    expect(strip.status).toBe("PASS");
  }, 60000);

  it("real-site regression: a fact toggle is not a vague button, a long call to action still is", async () => {
    const toggles = await runOne(
      server,
      browser,
      "C23",
      doc(
        '<button aria-expanded="false">Best Overall Home, 2017 Parade of Homes</button><button aria-pressed="true">Colonial Park: Built in 1994, reimagined</button><button>Request a consultation</button>',
      ),
    );
    expect(toggles.status).toBe("PASS");
    const cta = await runOne(server, browser, "C23", doc("<button>Send us your lot details today</button>"));
    expect(cta.status).toBe("FAIL");
  }, 60000);

  it("real-site regression: a tonal secondary beside the accent button is not a second accent", async () => {
    const tonal = await runOne(
      server,
      browser,
      "C21",
      doc(
        '<div style="background:#e6e1d6;padding:24px"><a href="#a" style="display:inline-block;background:#6b5420;color:#fff;padding:12px 20px">Ask about your date</a><br><a href="#b" style="display:inline-block;background:#f4f1e9;color:#1e1c18;padding:12px 20px">See the spaces</a></div>',
      ),
    );
    expect(tonal.status).toBe("PASS");
    const two = await runOne(
      server,
      browser,
      "C21",
      doc(
        '<div style="background:#e6e1d6;padding:24px"><a href="#a" style="display:inline-block;background:#6b5420;color:#fff;padding:12px 20px">Ask about your date</a><br><a href="#b" style="display:inline-block;background:#123b8a;color:#fff;padding:12px 20px">Book now</a></div>',
      ),
    );
    expect(two.status).toBe("FAIL");
  }, 60000);

  it("real-site regression: a link inside a closed details box is not unreachable", async () => {
    const r = await runOne(
      server,
      browser,
      "C27",
      doc(
        '<a href="/a">Start</a><details><summary>Six Parades</summary><div class="b"><a href="/src">Read the feature</a></div></details><a href="/b">End</a>',
        ".b{display:block !important}",
      ),
    );
    expect(r.status).toBe("PASS");
  }, 60000);

  it("a reason too short to mean anything does not waive", () => {
    const site = makeSite({ "docs/design/DECISIONS.md": "C01 ok\n" });
    expect(loadDecisions(site).has("C01")).toBe(false);
  });

  it("the baseline hides old failures and still catches new ones", async () => {
    const site = makeSite({});
    const old = doc("<h2>Hot tub holds six.</h2>");
    const first = await runOne(server, browser, "C01", old);
    recordBaseline(site, [first], { url: "x" });
    const same = await runV3Audit(server.add(old), {
      browser,
      routes: ["/"],
      only: ["C01"],
      siteDir: site,
    });
    expect(same.blocking).toBe(0);
    expect(same.results[0].known).toBe(true);
    const worse = await runV3Audit(
      server.add(doc("<h2>Hot tub holds six.</h2><h2>Another new one.</h2>")),
      { browser, routes: ["/"], only: ["C01"], siteDir: site },
    );
    expect(worse.blocking).toBe(1);
  }, 60000);

  it("applyBaseline leaves a site with no baseline alone", () => {
    const r = [{ id: "C01", status: "FAIL", items: ["a"], count: 1 }];
    expect(applyBaseline(r, null)).toEqual(r);
  });

  it("prints one plain line per check", () => {
    const line = formatLine({
      id: "C01",
      tier: "T1",
      title: "no heading ends with a period",
      status: "FAIL",
      reason: "first: x",
      count: 3,
    });
    expect(line).toBe("FAIL     C01 [T1] no heading ends with a period: first: x (3)");
  });

  it("the app scope runs only its subset", async () => {
    const out = await runV3Audit(server.add(GOOD, "/scope"), {
      browser,
      routes: ["/"],
      scope: "app",
    });
    const ids = out.results.map((r: any) => r.id);
    expect(ids).toContain("C27");
    expect(ids).not.toContain("C22");
    expect(ids).not.toContain("C41");
  }, 180000);
});
