import { BANNED_FACES, GEOMETRIES } from "../lib.mjs";

/**
 * Type and wording checks: C01 C02 C03 C04 C05 C09 C10 C17 C19 C20 C37.
 * Each `run` gets { page, ctx } and returns { fails: [{item, detail}], note?, unproven? }.
 */

const fail = (item, detail) => ({ item, detail: detail ?? item });

export const C01 = {
  id: "C01",
  title: "no heading ends with a period",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
        .filter((h) => window.__v3.vis(h))
        .map((h) => h.innerText.trim())
        .filter((t) => /\.$/.test(t) && !/\.\.\.$/.test(t)),
    );
    return { fails: bad.map((t) => fail(t, `heading ends with a period: "${t.slice(0, 50)}"`)) };
  },
};

export const C02 = {
  id: "C02",
  title: "numbering only on real sequences, plain numerals, never 01",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      const seq = (el) =>
        el.closest(
          "ol,[data-sequence],[class*='step' i],[class*='process' i],[class*='timeline' i],[id*='step' i],[id*='process' i],[id*='timeline' i],[id*='how' i]",
        );
      for (const el of window.__v3.leafs()) {
        if (/^(P|LI|TD|TH|A|BUTTON|LABEL)$/.test(el.tagName) && !/^0\d\b/.test(el.innerText.trim()))
          continue;
        const t = el.innerText.trim();
        if (/^0\d\s*([.)/:-]|$|\s)/.test(t) && t.length < 60) out.push(["padded", t]);
        else if (/^H[1-6]$/.test(el.tagName) && /^\d{1,2}\s*[.)]?\s+\S/.test(t) && !seq(el))
          out.push(["ordinary", t]);
        else if (/^\d{1,2}$/.test(t) && /^(SPAN|DIV|P|H[1-6])$/.test(el.tagName) && !seq(el))
          out.push(["ordinary", t]);
      }
      return out;
    });
    return {
      fails: bad.map(([kind, t]) =>
        fail(
          t,
          kind === "padded"
            ? `zero-padded number "${t.slice(0, 30)}"`
            : `numbering on an ordinary section: "${t.slice(0, 30)}"`,
        ),
      ),
    };
  },
};

export const C03 = {
  id: "C03",
  title: "negative letter spacing only on text 48px and up, no tighter than -0.02em",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      window.__v3.leafs().flatMap((el) => {
        const cs = getComputedStyle(el);
        if (cs.letterSpacing === "normal") return [];
        const ls = parseFloat(cs.letterSpacing);
        const fs = parseFloat(cs.fontSize);
        if (!(ls < -0.001)) return [];
        if (fs >= 48 && ls / fs >= -0.0201) return [];
        return [`${window.__v3.label(el)} ${fs}px ${(ls / fs).toFixed(3)}em`];
      }),
    );
    return { fails: bad.map((t) => fail(t, `tight tracking: ${t}`)) };
  },
};

export const C04 = {
  id: "C04",
  title: "uppercase only on menu, button and labels 13px or smaller, wide spacing",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      window.__v3.leafs().flatMap((el) => {
        const cs = getComputedStyle(el);
        const typed = el.innerText.trim();
        const shown =
          cs.textTransform === "uppercase" ||
          (typed.length >= 6 &&
            /[A-Z]{3}/.test(typed) &&
            typed === typed.toUpperCase() &&
            /^[A-Z0-9 &'.,:\-/]+$/.test(typed) &&
            !/\d.*\d.*\d/.test(typed));
        if (!shown) return [];
        const fs = parseFloat(cs.fontSize);
        const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / fs;
        const ctx = el.closest(
          "nav,button,label,[role=button],[role=navigation],a.btn,[class*=btn],[class*=button]",
        );
        const ok = ctx && fs <= 13.01 && ls >= 0.05;
        return ok ? [] : [`${window.__v3.label(el)} ${fs}px ls ${ls.toFixed(2)}em`];
      }),
    );
    return { fails: bad.map((t) => fail(t, `capitals outside the limits: ${t}`)) };
  },
};

export const C05 = {
  id: "C05",
  title: "no banned primary typeface (list refreshed quarterly)",
  viewport: "desktop",
  async run({ page }) {
    const fams = await page.evaluate(() => {
      const seen = new Map();
      for (const el of window.__v3.leafs()) {
        const cs = getComputedStyle(el);
        const first = cs.fontFamily
          .split(",")[0]
          .trim()
          .replace(/^["']|["']$/g, "");
        const key = `${first}|${/^H1$/.test(el.tagName) ? "h1" : "t"}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      return [...seen.entries()];
    });
    const fails = [];
    for (const [key, n] of fams) {
      const [raw, role] = key.split("|");
      // next/font names look like __Name_abc123 or Name Fallback
      const name = raw
        .replace(/^__/, "")
        .replace(/_[0-9a-f]{5,8}$/i, "")
        .replace(/ Fallback$/i, "")
        .replace(/_/g, " ");
      for (const [label, re] of BANNED_FACES) {
        if (!re.test(name)) continue;
        if (/^play/i.test(label) && role !== "h1") continue; // Playfair is banned as the hero face only
        fails.push(
          fail(
            `${label} ${role}`,
            `banned face "${label}" is the primary on ${n} element${n === 1 ? "" : "s"}`,
          ),
        );
      }
    }
    return { fails, note: `${fams.length} faces in use` };
  },
};

export const C09 = {
  id: "C09",
  title: "mono only for codes, passwords, confirmation numbers, data tables",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      window.__v3.leafs().flatMap((el) => {
        const fam = getComputedStyle(el).fontFamily;
        if (
          !/(^|,)\s*(ui-)?mono(space)?\b|\bmono\b|courier|menlo|consolas|sf mono|jetbrains|fira code|roboto mono|ibm plex mono/i.test(
            fam,
          )
        )
          return [];
        if (el.closest("code,pre,kbd,samp,table,[data-mono],[data-code]")) return [];
        const t = el.innerText.trim();
        if (/^[A-Z0-9][A-Z0-9-]{4,}$/.test(t) && /\d/.test(t)) return []; // looks like a code or confirmation number
        return [window.__v3.label(el)];
      }),
    );
    return { fails: bad.map((t) => fail(t, `mono type outside codes and tables: ${t}`)) };
  },
};

export const C10 = {
  id: "C10",
  title: "no italic inside headings",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].flatMap((h) => {
        if (!window.__v3.vis(h)) return [];
        const hit =
          getComputedStyle(h).fontStyle !== "normal" ||
          [...h.querySelectorAll("*")].some((c) => getComputedStyle(c).fontStyle !== "normal");
        return hit ? [h.innerText.trim().slice(0, 50)] : [];
      }),
    );
    return { fails: bad.map((t) => fail(t, `italic inside a heading: "${t}"`)) };
  },
};

export const C17 = {
  id: "C17",
  title: "font sizes on the brand ratio scale, 6 sizes max",
  viewport: "desktop",
  scope: "home",
  async run({ page, ctx }) {
    const probe = () =>
      page.evaluate(() => {
        const m = new Map();
        for (const el of window.__v3.leafs()) {
          const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
          m.set(fs, (m.get(fs) ?? 0) + 1);
        }
        return [...m.entries()];
      });
    const sizes = await probe();
    const fails = [];
    // sizes used by only a handful of elements are still sizes: the rule is six, not "mostly six"
    if (sizes.length > 6) {
      fails.push(
        fail(
          `${sizes.length} sizes`,
          `${sizes.length} font sizes in use (max 6): ${sizes
            .map((s) => s[0])
            .sort((a, b) => a - b)
            .join(", ")}px`,
        ),
      );
    }
    const scale = ctx.scales?.fontSizes;
    const list = Array.isArray(scale)
      ? scale
      : scale
        ? [...(scale.desktop ?? []), ...(scale.phone ?? [])]
        : null;
    if (list) {
      for (const [px] of sizes) {
        if (!list.some((s) => Math.abs(s - px) <= Math.max(1, s * 0.04)))
          fails.push(fail(`${px}px`, `${px}px is not on the brand scale (${list.join(", ")})`));
      }
    }
    if (!fails.length && !list)
      return {
        unproven: `UNPROVEN: no brand scale on file (docs/design/scales.json); the 6-size cap holds at ${sizes.length}`,
      };
    return { fails, note: `${sizes.length} sizes, all on the scale` };
  },
};

export const C19 = {
  id: "C19",
  title: "headings balanced, paragraphs pretty, no stranded word at the 17 sizes",
  viewport: "phone",
  scope: "home",
  async run({ page }) {
    const fails = [];
    const wrap = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("h1,h2,h3,p")) {
        if (!window.__v3.vis(el) || window.__v3.exempt(el)) continue;
        if (window.__v3.words(el.innerText).length < 4) continue;
        const cs = getComputedStyle(el);
        const tw = cs.textWrapStyle || cs.textWrap || "";
        const isHead = /^H/.test(el.tagName);
        if (isHead && !/balance/.test(tw))
          out.push(`heading not balanced: "${el.innerText.trim().slice(0, 40)}"`);
        if (!isHead && !/(pretty|balance)/.test(tw))
          out.push(`paragraph not pretty: "${el.innerText.trim().slice(0, 40)}"`);
      }
      return out;
    });
    for (const w of wrap.slice(0, 40)) fails.push(fail(w, w));
    let strands = 0;
    for (const [name, w, h] of GEOMETRIES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(60);
      const lone = await page.evaluate(() => {
        const out = [];
        for (const el of [...document.querySelectorAll("h1,h2,h3,h4,p")].slice(0, 160)) {
          if (!window.__v3.vis(el) || window.__v3.exempt(el)) continue;
          const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const ws = [];
          for (let n = tw.nextNode(); n; n = tw.nextNode()) {
            for (const m of n.nodeValue.matchAll(/\S+/g))
              ws.push([n, m.index, m.index + m[0].length]);
          }
          if (ws.length < 4) continue;
          const rectOf = ([n, a, b]) => {
            const r = document.createRange();
            r.setStart(n, a);
            r.setEnd(n, b);
            return r.getClientRects()[0];
          };
          const last = rectOf(ws[ws.length - 1]);
          const prev = rectOf(ws[ws.length - 2]);
          if (last && prev && last.top - prev.top > 4 && !window.__v3.exempt(el))
            out.push(el.innerText.trim().slice(-30));
        }
        return out;
      });
      for (const t of lone) {
        strands++;
        if (fails.length < 60)
          fails.push(fail(`${t}@${w}`, `stranded last word at ${w}px (${name}): "...${t}"`));
      }
    }
    return { fails, note: `17 sizes, ${strands} stranded` };
  },
};

export const C20 = {
  id: "C20",
  title: "tabular numbers on every price, rate, date, count and table",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      window.__v3.leafs().flatMap((el) => {
        const t = el.innerText.trim();
        const numeric =
          /\$\s?\d|\d\s?%|\b\d{1,2}[/:]\d{1,2}\b|\b\d+(\.\d+)?\s*(nights?|guests?|beds?|baths?|bedrooms?|sq\.? ?ft|reviews?)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/i.test(
            t,
          ) ||
          (el.closest("td,th") && /\d/.test(t));
        if (!numeric) return [];
        const cs = getComputedStyle(el);
        const ok =
          /tabular-nums/.test(cs.fontVariantNumeric) ||
          /["']tnum["']/.test(cs.fontFeatureSettings) ||
          /mono/i.test(cs.fontFamily);
        return ok ? [] : [`${window.__v3.label(el)}`];
      }),
    );
    return { fails: bad.map((t) => fail(t, `numbers without tabular figures: ${t}`)) };
  },
};

export const C37 = {
  id: "C37",
  title: "word budgets: hero 10, subline 20, section heading 8, paragraph 60, button 3",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      const wc = (el) => window.__v3.words(el.innerText).length;
      const h1 = document.querySelector("h1");
      if (h1 && wc(h1) > 10) out.push(`hero headline ${wc(h1)} words`);
      if (h1) {
        const sub = h1.parentElement?.querySelector("p");
        if (sub && wc(sub) > 20) out.push(`hero subline ${wc(sub)} words`);
      }
      for (const h of document.querySelectorAll("h2"))
        if (window.__v3.vis(h) && wc(h) > 8)
          out.push(`section heading ${wc(h)} words: "${h.innerText.trim().slice(0, 30)}"`);
      for (const p of document.querySelectorAll("p")) {
        if (!window.__v3.vis(p) || window.__v3.exempt(p) || p.closest("footer")) continue;
        if (wc(p) > 60) out.push(`paragraph ${wc(p)} words: "${p.innerText.trim().slice(0, 30)}"`);
      }
      for (const b of document.querySelectorAll("button,[role=button],input[type=submit]")) {
        if (window.__v3.vis(b) && wc(b) > 3)
          out.push(`button ${wc(b)} words: "${b.innerText.trim().slice(0, 30)}"`);
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, t)) };
  },
};

export const TYPOGRAPHY = [C01, C02, C03, C04, C05, C09, C10, C17, C19, C20, C37];
