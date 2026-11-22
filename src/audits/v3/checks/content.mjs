import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { digitsOf } from "../lib.mjs";

/**
 * Words, honesty and measured-quality checks: C11 C34 C35 C36 C41 C43 C44 C46 C47.
 * Each `run` gets { page, ctx, url, origin, fresh } and returns { fails, note?, unproven? }.
 */
const fail = (item, detail) => ({ item, detail: detail ?? item });
const dec = (b64) => Buffer.from(b64, "base64").toString("utf8").split(",");
const DASH = String.fromCharCode(0x2014); // built at run time so this file carries no literal one

/** Stock AI words are kept encoded so this file is not itself a hit for the copy guard. */
const BUZZ = dec(
  "c2VhbWxlc3Msc2VhbWxlc3NseSxlbGV2YXRlLGVsZXZhdGVkLGVsZXZhdGluZyx1bmxvY2ssdW5sb2NraW5nLGxldmVyYWdlLGxldmVyYWdpbmcsZGVsdmUsdGFwZXN0cnksdGVzdGFtZW50LGdhbWUtY2hhbmdlcixnYW1lLWNoYW5naW5nLGN1dHRpbmctZWRnZSxuZXh0LWxldmVsLHdvcmxkLWNsYXNzLHJldm9sdXRpb25pemUscmV2b2x1dGlvbmFyeSxzdXBlcmNoYXJnZSxlbXBvd2VyLGVtcG93ZXJpbmcsaG9saXN0aWMsc3luZXJneSxyb2J1c3QsdHJhbnNmb3JtYXRpdmUsY3VyYXRlZCxpbW1lcnNpdmUsc3RhdGUtb2YtdGhlLWFydCxiZXN0LWluLWNsYXNzLG9uZS1zdG9wLGVmZm9ydGxlc3MsZWZmb3J0bGVzc2x5LHVucGFyYWxsZWxlZCx1bnJpdmFsZWQsbmVzdGxlZA==",
);
const SPARKLE = dec(
  "bWFnaWNhbCxtYWdpYyxlbmNoYW50aW5nLHVuZm9yZ2V0dGFibGUsYnJlYXRodGFraW5nLHN0dW5uaW5nLG1lc21lcml6aW5nLGNhcHRpdmF0aW5nLHNwZWxsYmluZGluZyxkcmVhbXk=",
);
const SUPERLATIVES = dec(
  "YmVzdCxvbmx5LG51bWJlciBvbmUsIzEsdG9wLXJhdGVkLGxhcmdlc3QsZmluZXN0LGxlYWRpbmcscHJlbWllcix3b3JsZC1jbGFzcyx1bm1hdGNoZWQsdW5yaXZhbGVkLGhpZ2hlc3QtcmF0ZWQsbW9zdCBwb3B1bGFyLG1vc3QgbG92ZWQsbW9zdCBiZWF1dGlmdWwsbW9zdCBsdXh1cmlvdXM=",
);
const esc = (w) =>
  w
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\-/g, "[- ]?")
    .replace(/ /g, "\\s+");
const wordRe = (list) => new RegExp(`(^|[^\\w-])(${list.map(esc).join("|")})(?![\\w-])`, "i");
const BUZZ_RE = wordRe(BUZZ);
const SPARKLE_RE = wordRe(SPARKLE);
const SUPER_RE = wordRe(SUPERLATIVES);

const NOT_X_Y = [
  /\b(it'?s|it is|this is|we are|we're|that'?s|this isn'?t)\s+not\s+(just\s+|only\s+|merely\s+|about\s+)?[^.!?\n]{2,50}[,;:]?\s*(it'?s|it is|but|this is|we're|that'?s)\b/i,
  /\bnot\s+(just|only|merely)\s+[^.!?\n]{2,50},?\s+but\b/i,
  /\b(isn'?t|aren'?t|wasn'?t|don'?t|doesn'?t)\s+(just\s+|only\s+)?[^.!?\n]{2,40}[,;]\s*(it'?s|it is|they'?re|we)\b/i,
  new RegExp(`\\bmore than (just )?an? [^.!?\\n]{2,40}[,.${DASH}]\\s*(it'?s|it is)\\b`, "i"),
];
const TRIPLET =
  /^\s*[A-Za-z'-]+(?:\s[A-Za-z'-]+)?,\s[A-Za-z'-]+(?:\s[A-Za-z'-]+)?,?\s(?:and|&)\s[A-Za-z'-]+(?:\s[A-Za-z'-]+)?\.?\s*$/;

/** Visible text outside verbatim quotes and reviews, as leaf strings tagged with their element. */
const TEXTS_JS = `(() => {
  const out = [];
  for (const el of window.__v3.leafs()) {
    if (window.__v3.exempt(el)) continue;
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').replace(/\\s+/g, ' ').trim();
    if (t) out.push({ tag: el.tagName.toLowerCase(), text: t, btn: !!el.closest('button,[role=button],a.btn') });
  }
  return out;
})()`;

export const C11 = {
  id: "C11",
  title: "no emoji in visible text, titles, buttons, link previews",
  viewport: "desktop",
  async run({ page }) {
    const r = await page.evaluate(`(() => {
      const texts = ${TEXTS_JS}.map((t) => t.text);
      const metas = [...document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"],meta[name=description]')].map((m) => m.content || '');
      return [...texts, document.title, ...metas, ...[...document.querySelectorAll('[aria-label],[alt]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('alt') || '')];
    })()`);
    const emoji = /(?![©®™←-⇿])[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}⃣]/u;
    const hits = r.filter((t) => emoji.test(t));
    return { fails: hits.map((t) => fail(t, `emoji in "${t.slice(0, 50)}"`)) };
  },
};

export const C34 = {
  id: "C34",
  title: "no placeholder info (example.com, 555 numbers, 123 Main, Lorem, [Company])",
  viewport: "desktop",
  async run({ page }) {
    const r = await page.evaluate(`(() => {
      const t = ${TEXTS_JS}.map((x) => x.text);
      const h = [...document.querySelectorAll('a[href],img[alt],form[action]')].map((e) => e.getAttribute('href') || e.getAttribute('alt') || e.getAttribute('action') || '');
      return [...t, ...h, document.title];
    })()`);
    const re = [
      [/\bexample\.(com|org|net)\b/i, "example.com address"],
      [/(\(|\b)555[-.\s)]\s?\d{3,4}\b|\b555-?01\d\d\b/, "555 phone number"],
      [/\b123 (main|elm|oak|fake)\b/i, "123 Main address"],
      [/lorem ipsum|dolor sit amet/i, "lorem ipsum"],
      [/\[(your |company|business|name|logo|insert|add)[^\]]*\]/i, "bracketed placeholder"],
      [/\b(your@email|youremail@|name@domain|you@yourdomain|user@domain)/i, "stand-in email"],
      [/\b(TODO|TBD|FIXME)\b/, "TODO marker"],
      [/\b(xxx-xxx|XXX-XXXX|000-000-0000)\b/i, "stand-in number"],
    ];
    const fails = [];
    for (const s of r)
      for (const [rx, name] of re)
        if (rx.test(s))
          fails.push(
            fail(`${name}: ${s.slice(0, 50)}`, `${name} on the page: "${s.slice(0, 50)}"`),
          );
    return { fails: [...new Map(fails.map((f) => [f.item, f])).values()] };
  },
};

export const C35 = {
  id: "C35",
  title: "every number and superlative matches a sourced fact-sheet row",
  viewport: "desktop",
  async run({ page, ctx }) {
    if (!ctx.facts) return { unproven: "UNPROVEN: no fact sheet (docs/design/FACTS.md)" };
    const text = await page.evaluate(`(() => {
      const keep = ${TEXTS_JS}.filter((t) => !/^(script|style|time|address)$/.test(t.tag));
      return keep.map((t) => t.text).join(' \\n ');
    })()`);
    const live = await page.evaluate(() =>
      [...document.querySelectorAll("[data-fact-live]")].map((e) => e.innerText),
    );
    const liveText = live.join(" ");
    const factNums = new Set((ctx.facts.text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(digitsOf));
    const fails = [];
    const clean = text
      .replace(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, " ")
      .replace(/\b(19|20)\d{2}\b/g, " ")
      .replace(/\b\d{5}(-\d{4})?\b/g, " ")
      .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/gi, " ")
      .replace(/\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)\b/gi, " ");
    const seen = new Set();
    for (const m of clean.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)) {
      const d = digitsOf(m[0]);
      if (!d || seen.has(d) || liveText.includes(m[0])) continue;
      seen.add(d);
      if (!factNums.has(d))
        fails.push(fail(`num ${m[0]}`, `number "${m[0]}" has no fact-sheet row`));
    }
    for (const sentence of text.split(/[.!?\n]+/)) {
      const m = SUPER_RE.exec(sentence);
      if (!m) continue;
      const w = m[2].toLowerCase();
      if (!ctx.facts.text.includes(w))
        fails.push(
          fail(
            `super ${w}`,
            `superlative "${w}" has no sourced fact-sheet row ("${sentence.trim().slice(0, 50)}")`,
          ),
        );
    }
    return {
      fails: [...new Map(fails.map((f) => [f.item, f])).values()].slice(0, 80),
      note: `${seen.size} numbers read against ${ctx.facts.rows.length} facts`,
    };
  },
};

export const C36 = {
  id: "C36",
  title: "no copy fingerprints (not-X-it's-Y, triplets, buzzwords, sparkle words, em dashes)",
  viewport: "desktop",
  async run({ page }) {
    const texts = await page.evaluate(TEXTS_JS);
    const fails = [];
    const add = (kind, s) =>
      fails.push(fail(`${kind}: ${s.slice(0, 60)}`, `${kind}: "${s.slice(0, 60)}"`));
    for (const { tag, text, btn } of texts) {
      if (text.includes(DASH)) add("em dash", text);
      if (NOT_X_Y.some((r) => r.test(text))) add("not-X-it's-Y", text);
      const m = BUZZ_RE.exec(text);
      if (m) add(`buzzword "${m[2]}"`, text);
      const s = SPARKLE_RE.exec(text);
      if (s) add(`sparkle word "${s[2]}"`, text);
      if (/^(h[1-3]|p|button|a)$/.test(tag) && !btn) {
        for (const sent of text.split(/(?<=[.!?])\s+/)) {
          if (!/\d/.test(sent) && sent.split(" ").length <= 10 && TRIPLET.test(sent))
            add("forced triplet", sent);
        }
      }
    }
    return { fails: [...new Map(fails.map((f) => [f.item, f])).values()] };
  },
};

const STOP = new Set(
  "the and for with your you our are this that from have has not but all can will get one two three about into over more than then them they their there what when where which while home stay stays welcome book booking guest guests rental rentals vacation place places room rooms house find best great local near area".split(
    " ",
  ),
);
const toks = (s) =>
  (s.toLowerCase().match(/[a-z0-9$%.,]{3,}/g) ?? []).map((w) => w.replace(/[.,]+$/, ""));

export const C41 = {
  id: "C41",
  title: "every hero and section headline holds a concrete fact-sheet item",
  viewport: "desktop",
  async run({ page, ctx }) {
    if (!ctx.facts) return { unproven: "UNPROVEN: no fact sheet (docs/design/FACTS.md)" };
    const heads = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2")]
        .filter((h) => window.__v3.vis(h) && !window.__v3.exempt(h))
        .map((h) => h.innerText.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    );
    const vocab = new Set(toks(ctx.facts.text).filter((w) => !STOP.has(w)));
    const fails = [];
    for (const h of heads) {
      const hit = toks(h).some((w) => !STOP.has(w) && vocab.has(w));
      if (!hit) fails.push(fail(h, `headline holds no fact-sheet item: "${h.slice(0, 60)}"`));
    }
    return { fails, note: `${heads.length} headlines read against ${ctx.facts.rows.length} facts` };
  },
};

/** Page-load measurements for a throttled phone, installed before any page script runs. */
const VITALS_INIT = `(() => {
  const v = { lcp: 0, cls: 0, inp: 0, events: 0 };
  window.__vitals = v;
  let sess = 0, first = 0, last = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    if (sess && e.startTime - last < 1000 && e.startTime - first < 5000) sess += e.value; else { sess = e.value; first = e.startTime; }
    last = e.startTime; v.cls = Math.max(v.cls, sess); } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.interactionId) { v.events++; v.inp = Math.max(v.inp, e.duration); } } }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
})()`;

export const C43 = {
  id: "C43",
  title: "LCP under 2.5 s, INP under 0.2 s, CLS under 0.1 on a throttled phone",
  viewport: "desktop",
  scope: "home",
  async run({ url, fresh }) {
    const s = await fresh({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      navigate: false,
    });
    try {
      const { page } = s;
      await page.addInitScript(VITALS_INIT);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 94000,
      });
      await page.goto(url, { waitUntil: "load", timeout: 90000 });
      await page.waitForTimeout(3600);
      await page.touchscreen.tap(8, 400).catch(() => {});
      await page.keyboard.press("Tab");
      await page.waitForTimeout(400);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(1200);
      const v = await page.evaluate(() => window.__vitals);
      const fails = [];
      if (v.lcp > 2500) fails.push(fail("LCP", `LCP ${(v.lcp / 1000).toFixed(1)} s (limit 2.5 s)`));
      if (v.cls > 0.1) fails.push(fail("CLS", `CLS ${v.cls.toFixed(2)} (limit 0.1)`));
      if (v.inp > 200) fails.push(fail("INP", `INP ${Math.round(v.inp)} ms (limit 200 ms)`));
      return {
        fails,
        note: `LCP ${(v.lcp / 1000).toFixed(1)} s, CLS ${v.cls.toFixed(2)}, INP ${v.events ? `${Math.round(v.inp)} ms` : "under 16 ms (no slow event)"}`,
      };
    } finally {
      await s.close();
    }
  },
};

const OVERLAY =
  /accessibe|userway|audioeye|equalweb|eye-able|reciteme|facil-?iti|maxaccess|adally|allyable|essentialaccessibility|accessibilityoverlay|acsbapp|acsb\.js/i;

export const C44 = {
  id: "C44",
  title: "WCAG 2.2 AA everywhere, 7:1 on body text, no overlay widgets",
  viewport: "desktop",
  async run({ page }) {
    const fails = [];
    let axeNote = "";
    try {
      const mod = await import("@axe-core/playwright");
      const AxeBuilder = mod.default ?? mod.AxeBuilder;
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      for (const v of violations)
        fails.push(
          fail(
            `axe ${v.id}`,
            `${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
          ),
        );
      axeNote = `axe: ${violations.length} rules failed`;
    } catch (e) {
      return { error: `axe could not run (${String(e.message).slice(0, 60)})` };
    }
    const r = await page.evaluate(() => {
      const low = [];
      let n = 0;
      let skipped = 0;
      for (const el of document.querySelectorAll("p,li,dd,td,blockquote,label,span,a")) {
        const own = [...el.childNodes].some(
          (c) => c.nodeType === 3 && c.nodeValue.trim().length > 12,
        );
        if (!own || !window.__v3.vis(el)) continue;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        const large = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
        const bg = window.__v3.bgOf(el);
        if (!bg) {
          skipped++;
          continue;
        }
        const fg = window.__v3.rgba(cs.color);
        const mix = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
        const ratio = window.__v3.contrast(mix, bg);
        n++;
        if (ratio < (large ? 4.5 : 7)) low.push(`${window.__v3.label(el)} ${ratio.toFixed(1)}:1`);
      }
      const overlay = [...document.querySelectorAll("script[src],link[href],iframe[src]")]
        .map((e) => e.src || e.href)
        .concat(
          [...document.querySelectorAll("[id],[class]")].map(
            (e) => `${e.id} ${typeof e.className === "string" ? e.className : ""}`,
          ),
        );
      return { low, n, skipped, overlay };
    });
    for (const t of r.low.slice(0, 60))
      fails.push(fail(`7:1 ${t}`, `body text under 7:1 contrast: ${t}`));
    const ow = r.overlay.filter((s) => OVERLAY.test(s));
    for (const o of ow.slice(0, 5))
      fails.push(
        fail(
          `overlay ${o.slice(0, 40)}`,
          `accessibility overlay widget is banned: ${o.slice(0, 50)}`,
        ),
      );
    return {
      fails,
      note: `${axeNote}; ${r.n} text blocks read for 7:1${r.skipped ? `, ${r.skipped} over images not measurable` : ""}`,
    };
  },
};

export const C46 = {
  id: "C46",
  title:
    "email templates render at phone width in light and dark, no sideways scroll or clipped table",
  scope: "site",
  async run({ ctx, fresh }) {
    const dir = ctx.emailsDir;
    if (!dir)
      return { unproven: "UNPROVEN: no email previews given (--emails <folder of .html files>)" };
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".html"));
    } catch {
      return { unproven: `UNPROVEN: cannot read the email folder ${dir}` };
    }
    if (!files.length) return { unproven: `UNPROVEN: no .html email previews in ${dir}` };
    const fails = [];
    for (const f of files) {
      for (const scheme of ["light", "dark"]) {
        const s = await fresh({
          viewport: { width: 390, height: 844 },
          colorScheme: scheme,
          navigate: false,
        });
        try {
          await s.page.goto(pathToFileURL(resolve(join(dir, f))).href);
          const r = await s.page.evaluate(() => {
            const bad = [];
            if (document.documentElement.scrollWidth > innerWidth + 1) bad.push("sideways scroll");
            for (const t of document.querySelectorAll("table")) {
              const r = t.getBoundingClientRect();
              if (r.right > innerWidth + 1 || r.left < -1) bad.push("table runs past the screen");
              const p = t.parentElement;
              if (
                p &&
                p.scrollWidth > p.clientWidth + 1 &&
                getComputedStyle(p).overflowX !== "visible"
              )
                bad.push("table clipped");
            }
            return bad;
          });
          for (const b of new Set(r))
            fails.push(fail(`${f} ${scheme} ${b}`, `${f} (${scheme}): ${b}`));
        } finally {
          await s.close();
        }
      }
    }
    return { fails, note: `${files.length} emails, light and dark` };
  },
};

const AI_BOTS = [
  "gptbot",
  "claudebot",
  "perplexitybot",
  "google-extended",
  "ccbot",
  "oai-searchbot",
  "anthropic-ai",
  "applebot-extended",
  "bytespider",
];

export const C47 = {
  id: "C47",
  title: "honest structured data, AI-crawler policy present",
  viewport: "desktop",
  scope: "home",
  async run({ page, origin }) {
    const fails = [];
    const blocks = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (s) => s.textContent,
      ),
    );
    const text = await page.evaluate(() => document.body.innerText);
    const flat = [];
    const walk = (o) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === "object") {
        flat.push(o);
        Object.values(o).forEach(walk);
      }
    };
    let parsed = 0;
    for (const b of blocks) {
      try {
        walk(JSON.parse(b));
        parsed++;
      } catch {
        fails.push(fail("bad json-ld", "a JSON-LD block is not valid JSON"));
      }
    }
    if (!blocks.length) fails.push(fail("no json-ld", "no structured data on the home page"));
    for (const o of flat) {
      if (o.aggregateRating) {
        const rv = String(o.aggregateRating.ratingValue ?? "");
        const rc = String(o.aggregateRating.reviewCount ?? o.aggregateRating.ratingCount ?? "");
        if (!rv || !rc || !text.includes(rv) || !text.replace(/,/g, "").includes(rc)) {
          fails.push(
            fail(
              "aggregateRating",
              `aggregateRating ${rv}/${rc} is not shown on the page (fake rating risk)`,
            ),
          );
        }
      }
    }
    let robots = "";
    try {
      const res = await fetch(new URL("/robots.txt", origin));
      robots = res.ok ? (await res.text()).toLowerCase() : "";
    } catch {
      robots = "";
    }
    const named = AI_BOTS.filter((b) => robots.includes(b));
    if (!robots) fails.push(fail("no robots", "no robots.txt, so no AI-crawler policy"));
    else if (named.length < 3 && !/content-signal/.test(robots))
      fails.push(
        fail(
          "no ai policy",
          `robots.txt names ${named.length} AI crawlers (need 3 or a Content-Signal line)`,
        ),
      );
    return { fails, note: `${parsed} JSON-LD blocks, ${named.length} AI crawlers named` };
  },
};

export const CONTENT = [C11, C34, C35, C36, C41, C43, C44, C46, C47];
