/**
 * Look-and-feel checks: C06 C07 C08 C12 C13 C14 C15 C16 C18 C22 C38 C39 C40 C42 C45.
 * Each `run` gets { page, ctx } and returns { fails, note?, unproven? }.
 */
const fail = (item, detail) => ({ item, detail: detail ?? item });

/**
 * In-page helper (as source text) that walks every readable style rule. Cross-origin sheets the
 * browser refuses to read are counted in `blocked` so the check can say so.
 */
const RULES_JS = String.raw`
  const walkRules = () => {
    const out = []; let blocked = 0;
    const visit = (rules, media) => {
      for (const r of rules) {
        const name = r.constructor.name;
        if (name === 'CSSKeyframesRule' || name === 'CSSFontFaceRule') continue;
        if (name === 'CSSStyleRule') {
          out.push({ sel: r.selectorText, css: r.style.cssText, media });
          if (r.cssRules && r.cssRules.length) visit(r.cssRules, media);
        } else if (r.cssRules) visit(r.cssRules, (r.conditionText || r.media?.mediaText || '') || media);
      }
    };
    for (const s of document.styleSheets) { try { visit(s.cssRules, ''); } catch (e) { blocked++; } }
    return { rules: out, blocked };
  };
  const decls = (css) => css.split(/;(?![^(]*\))/).map((d) => { const i = d.indexOf(':'); return i < 0 ? null : [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }).filter(Boolean);
`;

export const C06 = {
  id: "C06",
  title: "gradients only as photo darkening or inside charts, always in oklch",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(`(() => {
      ${RULES_JS}
      const { rules } = walkRules();
      const out = [];
      const overMedia = (sel) => {
        if (/scrim|overlay|shade|darken|veil|gradient-mask/i.test(sel)) return true;
        let els = [];
        try { els = [...document.querySelectorAll(sel.replace(/::?(before|after|hover|focus|active)\\b/g, '')) ]; } catch (e) { return false; }
        /* A rule in a shared stylesheet that nothing on this page uses draws nothing here;
           the page that does use it is the one judged. */
        if (!els.length) return true;
        /* Shading often sits in a text layer above the photo, not beside it: a photo or film in
           the same section whose box overlaps the shaded box counts as being under it. */
        const underMedia = (e) => {
          const b = e.getBoundingClientRect();
          if (b.width < 1 || b.height < 1) return false;
          const scope = e.closest('section,header,footer,article,aside,figure') || e.parentElement;
          return !!scope && [...scope.querySelectorAll('img,picture,video')].some((m) => {
            const r = m.getBoundingClientRect();
            return Math.min(b.right, r.right) - Math.max(b.left, r.left) > 1 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 1;
          });
        };
        return els.every((e) => e.closest('svg,canvas,[class*=chart i],[data-chart]') || e.parentElement?.querySelector(':scope > img,:scope > picture,:scope > video') || e.querySelector('img,video,picture') || e.tagName === 'IMG' || e.tagName === 'VIDEO' || underMedia(e));
      };
      for (const r of rules) {
        for (const [p, v] of decls(r.css)) {
          if (!/gradient\\(/.test(v) || !/^(background|background-image|mask|mask-image|-webkit-mask-image|border-image)/.test(p)) continue;
          const bg = /^background/.test(p);
          if (!/in oklch/.test(v)) out.push(r.sel + ' { ' + p + ' } is not "in oklch"');
          else if (bg && !overMedia(r.sel)) out.push(r.sel + ' gradient is not over a photo or chart');
          else if (!bg && !/^mask|^-webkit-mask/.test(p)) out.push(r.sel + ' ' + p);
        }
      }
      for (const el of document.querySelectorAll('[style*="gradient"]')) {
        const s = el.getAttribute('style');
        if (!/in oklch/.test(s)) out.push('inline gradient not in oklch: ' + window.__v3.label(el));
        else if (!(el.closest('svg,canvas,[class*=chart i]') || el.parentElement?.querySelector(':scope > img,:scope > video'))) out.push('inline gradient not over media: ' + window.__v3.label(el));
      }
      for (const el of document.querySelectorAll('*')) {
        if (/text/.test(getComputedStyle(el).webkitBackgroundClip) && /gradient/.test(getComputedStyle(el).backgroundImage)) out.push('gradient text: ' + window.__v3.label(el));
      }
      return [...new Set(out)];
    })()`);
    return { fails: bad.map((t) => fail(t, t)) };
  },
};

export const C07 = {
  id: "C07",
  title: "borders only on form fields, booking inputs, data tables, as alpha hairlines",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!window.__v3.vis(el)) continue;
        const cs = getComputedStyle(el);
        const sides = ["Top", "Right", "Bottom", "Left"].filter(
          (s) =>
            parseFloat(cs[`border${s}Width`]) > 0 &&
            cs[`border${s}Style`] !== "none" &&
            window.__v3.rgba(cs[`border${s}Color`])[3] > 0,
        );
        if (sides.length < 2) continue; // one-sided lines belong to the divider check
        if (
          /^(BUTTON|SVG|IMG|VIDEO)$/i.test(el.tagName) ||
          el.closest("svg") ||
          el.matches("[role=button],a.btn,[class*=btn],[class*=button]")
        )
          continue;
        const allowed =
          el.matches("input,select,textarea,table,th,td,tr,[data-booking],[data-booking] *") ||
          el.closest("table,[data-booking]");
        const w = Math.max(...sides.map((s) => parseFloat(cs[`border${s}Width`])));
        const a = Math.min(...sides.map((s) => window.__v3.rgba(cs[`border${s}Color`])[3]));
        if (!allowed) out.push(`${window.__v3.label(el)} has a box border`);
        else if (w > 1.01 || a >= 0.999)
          out.push(
            `${window.__v3.label(el)} border is not an alpha hairline (${w}px, alpha ${a.toFixed(2)})`,
          );
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, t)) };
  },
};

export const C08 = {
  id: "C08",
  title: "opacity and alpha colors only from named tokens (text, muted, hairline, scrim, hover)",
  viewport: "desktop",
  async run({ page }) {
    const { bad, blocked } = await page.evaluate(`(() => {
      ${RULES_JS}
      const { rules, blocked } = walkRules();
      const named = /(text|muted|hairline|scrim|hover)/i;
      const alpha = /(rgba?|hsla?)\\([^)]*(,\\s*0?\\.\\d+|\\/\\s*[\\d.]+%?)\\s*\\)|#[0-9a-f]{8}\\b|#[0-9a-f]{4}\\b|color-mix\\(|(oklch|oklab|lch|lab|color)\\([^)]*\\/\\s*[\\d.]+%?\\s*\\)/i;
      const bad = [];
      for (const r of rules) {
        if (/::selection|::placeholder/.test(r.sel)) continue;
        for (const [p, v] of decls(r.css)) {
          if (p.startsWith('--tw-')) continue;
          if (p === 'opacity') {
            if (/^var\\(--[^)]*\\)$/.test(v)) { if (!named.test(v)) bad.push(r.sel + ' opacity ' + v); continue; }
            const n = parseFloat(v);
            if (n > 0 && n < 1) bad.push(r.sel + ' opacity ' + v);
          } else if (p.startsWith('--')) {
            if (alpha.test(v) && !named.test(p)) bad.push(r.sel + ' ' + p + ': ' + v);
          } else if (alpha.test(v) && !/^var\\(--[^)]*\\)$/.test(v) && !/(transition|animation|will-change|content)$/.test(p)) {
            if (!/^(color|background|border|outline|fill|stroke|box-shadow|text-shadow|caret|accent|text-decoration)/.test(p)) continue;
            if (/shadow/.test(p)) continue; // shadows are tinted by nature
            bad.push(r.sel + ' ' + p + ': ' + v);
          }
        }
      }
      return { bad: [...new Set(bad)].slice(0, 400), blocked };
    })()`);
    return {
      fails: bad.map((t) => fail(t, `one-off transparency: ${t.slice(0, 80)}`)),
      note: blocked ? `${blocked} stylesheets unreadable` : "",
    };
  },
};

export const C12 = {
  id: "C12",
  title: "no backdrop blur (glass)",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const v = cs.backdropFilter || cs.webkitBackdropFilter || "";
          return v && v !== "none";
        })
        .map((el) => window.__v3.label(el)),
    );
    return { fails: bad.map((t) => fail(t, `backdrop blur on ${t}`)) };
  },
};

export const C13 = {
  id: "C13",
  title: "no Lucide default icons (Phosphor)",
  viewport: "desktop",
  async run({ page }) {
    const n = await page.evaluate(() => {
      const hits = [];
      for (const s of document.querySelectorAll("svg")) {
        const cls =
          (s.getAttribute("class") || "") + " " + (s.parentElement?.getAttribute("class") || "");
        const sig =
          /lucide/i.test(cls) ||
          (s.getAttribute("viewBox") === "0 0 24 24" &&
            s.getAttribute("fill") === "none" &&
            s.getAttribute("stroke") === "currentColor" &&
            s.getAttribute("stroke-linecap") === "round" &&
            s.getAttribute("stroke-linejoin") === "round" &&
            ["2", "1.5", "1"].includes(s.getAttribute("stroke-width") || ""));
        if (sig) hits.push(window.__v3.label(s.parentElement || s));
      }
      for (let i = 0; i < document.querySelectorAll("[data-lucide]").length; i++)
        hits.push("data-lucide icon");
      return hits;
    });
    return { fails: n.map((t) => fail(t, `Lucide icon in ${t}`)) };
  },
};

export const C14 = {
  id: "C14",
  title: "icon stroke weight matches the adjacent text weight",
  viewport: "desktop",
  async run({ page }) {
    const r = await page.evaluate(() => {
      const bad = [];
      let measured = 0;
      let icons = 0;
      const stem = (fs, wt) => fs * (0.04 + 0.00018 * (wt - 300));
      for (const el of document.querySelectorAll("svg,i[class*='ph-'],i.ph")) {
        if (!window.__v3.vis(el)) continue;
        const host = el.parentElement;
        if (!host) continue;
        const text =
          [...host.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim()).length ||
          [...host.children].some((c) => c !== el && c.textContent.trim());
        if (!text) continue;
        icons++;
        const tcs = getComputedStyle(host);
        const fs = parseFloat(tcs.fontSize);
        const wt = parseInt(tcs.fontWeight, 10) || 400;
        if (el.tagName === "I") {
          const c = el.className;
          const iw = /ph-thin/.test(c)
            ? 100
            : /ph-light/.test(c)
              ? 300
              : /ph-bold/.test(c)
                ? 700
                : /ph-fill/.test(c)
                  ? null
                  : 400;
          if (iw == null) continue;
          measured++;
          if (Math.abs(iw - wt) > 200)
            bad.push(`${window.__v3.label(host)} icon weight ${iw} vs text ${wt}`);
          continue;
        }
        const path = el.querySelector("path,line,circle,polyline,rect") || el;
        const pcs = getComputedStyle(path);
        if (pcs.stroke === "none" || !parseFloat(pcs.strokeWidth)) continue; // filled icon: no stroke to measure
        const vb = (el.getAttribute("viewBox") || "0 0 24 24").split(/\s+/).map(Number);
        const scale = el.getBoundingClientRect().width / (vb[2] || 24);
        const px = parseFloat(pcs.strokeWidth) * scale;
        measured++;
        const want = stem(fs, wt);
        if (px / want > 1.9 || px / want < 0.45)
          bad.push(
            `${window.__v3.label(host)} stroke ${px.toFixed(1)}px vs text stem ${want.toFixed(1)}px`,
          );
      }
      return { bad, measured, icons };
    });
    if (!r.bad.length && r.icons > 0 && r.measured === 0) {
      return {
        unproven: `UNPROVEN: ${r.icons} icons are filled shapes, stroke weight cannot be measured from outside`,
      };
    }
    return { fails: r.bad.map((t) => fail(t, t)), note: `${r.measured} icons measured` };
  },
};

export const C15 = {
  id: "C15",
  title: "nested corners: inner radius = outer minus padding (2px)",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      const rad = (cs) => parseFloat(cs.borderTopLeftRadius) || 0;
      for (const el of document.querySelectorAll("body *")) {
        if (!window.__v3.vis(el)) continue;
        const cs = getComputedStyle(el);
        const outer = rad(cs);
        if (outer < 2 || /%/.test(cs.borderTopLeftRadius)) continue;
        const pr = el.getBoundingClientRect();
        if (outer >= Math.min(pr.width, pr.height) / 2 - 1) continue; // pill or circle
        for (const child of el.children) {
          if (!window.__v3.vis(child)) continue;
          const ccs = getComputedStyle(child);
          if (ccs.position === "absolute" || ccs.position === "fixed") continue;
          const cr = child.getBoundingClientRect();
          const gap = Math.max(
            0,
            Math.min(
              cr.left - pr.left,
              cr.top - pr.top,
              pr.right - cr.right,
              pr.bottom - cr.bottom,
            ),
          );
          const hasBox =
            parseFloat(ccs.borderTopLeftRadius) > 0 ||
            (ccs.backgroundColor !== "rgba(0, 0, 0, 0)" && gap > 0) ||
            child.tagName === "IMG";
          if (!hasBox) continue;
          const inner = rad(ccs);
          const want = Math.max(outer - gap, 0);
          const clipped = gap < 0.5 && cs.overflow !== "visible"; // the parent clips a square child
          if (clipped && inner <= want + 2) continue;
          if (Math.abs(inner - want) > 2)
            out.push(
              `${window.__v3.label(child)} radius ${inner}px inside ${outer}px with ${gap.toFixed(0)}px padding (want ${want.toFixed(0)}px)`,
            );
        }
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, t)) };
  },
};

export const C16 = {
  id: "C16",
  title: "corner radii on the brand's locked scale",
  viewport: "desktop",
  scope: "home",
  async run({ page, ctx }) {
    const radii = await page.evaluate(() => {
      const m = new Map();
      for (const el of document.querySelectorAll("body *")) {
        if (!window.__v3.vis(el)) continue;
        const cs = getComputedStyle(el);
        const v = cs.borderTopLeftRadius;
        if (!v || v === "0px") continue;
        const r = el.getBoundingClientRect();
        const px = /%/.test(v)
          ? (parseFloat(v) / 100) * Math.min(r.width, r.height)
          : parseFloat(v);
        if (px >= Math.min(r.width, r.height) / 2 - 1) continue; // full round
        const k = Math.round(px * 2) / 2;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()];
    });
    const scale = ctx.scales?.radius;
    if (!Array.isArray(scale)) {
      return {
        unproven: `UNPROVEN: no corner scale on file (docs/design/scales.json); radii in use: ${
          radii
            .map((r) => r[0])
            .sort((a, b) => a - b)
            .join(", ") || "none"
        }px`,
      };
    }
    const off = radii.filter(([px]) => !scale.some((s) => Math.abs(s - px) <= 0.75));
    return {
      fails: off.map(([px, n]) =>
        fail(`${px}px`, `${px}px corners on ${n} elements, not on the scale (${scale.join(", ")})`),
      ),
      note: `${radii.length} radii all on scale`,
    };
  },
};

export const C18 = {
  id: "C18",
  title: "spacing on the brand scale; section gaps 96px desktop, 64px phone",
  viewport: "desktop",
  scope: "home",
  async run({ page, ctx }) {
    const gapsAt = async (w, h, min) => {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(80);
      return page.evaluate((min) => {
        const root = document.querySelector("main") || document.body;
        const secs = [...root.children].filter(
          (e) =>
            !/^(HEADER|FOOTER|NAV|SCRIPT|STYLE|TEMPLATE)$/.test(e.tagName) &&
            window.__v3.vis(e) &&
            e.getBoundingClientRect().height > 80,
        );
        const out = [];
        for (let i = 1; i < secs.length; i++) {
          const a = secs[i - 1],
            b = secs[i];
          const ar = a.getBoundingClientRect(),
            br = b.getBoundingClientRect();
          const gap =
            br.top -
            ar.bottom +
            parseFloat(getComputedStyle(a).paddingBottom) +
            parseFloat(getComputedStyle(b).paddingTop);
          if (gap < min - 0.5)
            out.push(`${Math.round(gap)}px between sections ${i} and ${i + 1} (min ${min}px)`);
        }
        return { out, n: secs.length };
      }, min);
    };
    const d = await gapsAt(1440, 900, 96);
    const p = await gapsAt(390, 844, 64);
    await page.setViewportSize({ width: 1440, height: 900 });
    const fails = [
      ...d.out.map((t) => fail(`desktop ${t}`, `desktop ${t}`)),
      ...p.out.map((t) => fail(`phone ${t}`, `phone ${t}`)),
    ];
    const scale = ctx.scales?.spacing;
    if (Array.isArray(scale)) {
      const off = await page.evaluate((scale) => {
        let total = 0;
        const bad = new Map();
        for (const el of document.querySelectorAll("body *")) {
          if (!window.__v3.vis(el)) continue;
          const cs = getComputedStyle(el);
          total++;
          for (const p of [
            "paddingTop",
            "paddingBottom",
            "paddingLeft",
            "paddingRight",
            "marginTop",
            "marginBottom",
            "rowGap",
            "columnGap",
          ]) {
            const v = parseFloat(cs[p]);
            if (!(v > 1.5) || cs[p].includes("%")) continue;
            if (!scale.some((s) => Math.abs(s - v) <= 1))
              bad.set(Math.round(v), (bad.get(Math.round(v)) ?? 0) + 1);
          }
        }
        return { total, bad: [...bad.entries()] };
      }, scale);
      const offEls = off.bad.reduce((a, b) => a + b[1], 0);
      if (offEls > off.total * 0.06)
        fails.push(
          fail(
            "off-scale",
            `${off.bad.length} off-scale spacing values on ${offEls} declarations: ${off.bad
              .slice(0, 6)
              .map((b) => b[0] + "px")
              .join(", ")}`,
          ),
        );
    }
    if (!fails.length && !Array.isArray(scale)) {
      return {
        unproven: `UNPROVEN: no spacing scale on file (docs/design/scales.json); section gaps hold across ${d.n} sections`,
      };
    }
    return { fails, note: `${d.n} sections, gaps ok` };
  },
};

export const C22 = {
  id: "C22",
  title: "no row of 3-4 equal feature blocks (listings exempt via data-listing)",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("[data-listing],footer,nav,header,[role=navigation]")) continue;
        const kids = [...el.children].filter((c) => window.__v3.vis(c));
        if (kids.length < 3 || kids.length > 4) continue;
        const rs = kids.map((k) => k.getBoundingClientRect());
        if (rs.some((r) => Math.abs(r.top - rs[0].top) > 8)) continue;
        if (rs.some((r) => Math.abs(r.width - rs[0].width) > rs[0].width * 0.04)) continue;
        const feature = (k) =>
          k.querySelector("h2,h3,h4,h5,[class*=title i]") &&
          k.querySelector("p") &&
          !k.querySelector("blockquote,[class*=review i]");
        if (!kids.every(feature)) continue;
        if (
          kids.every(
            (k) => k.tagName === "A" && k.matches("[data-listing],[href*='/stay'],[href*='/room']"),
          )
        )
          continue;
        out.push(`${window.__v3.label(el)} holds ${kids.length} equal blocks`);
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, t)) };
  },
};

export const C38 = {
  id: "C38",
  title: "no eyebrow label above a heading (one location line above a property hero)",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((s) => s.textContent)
        .join(" ");
      const places = [...ld.matchAll(/"address(?:Locality|Region)"\s*:\s*"([^"]+)"/g)].map((m) =>
        m[1].toLowerCase(),
      );
      let h1Allowed = true;
      for (const h of document.querySelectorAll("h1,h2,h3")) {
        if (!window.__v3.vis(h)) continue;
        let prev = h.previousElementSibling;
        if (!prev && h.parentElement && h.parentElement.children.length === 1)
          prev = h.parentElement.previousElementSibling;
        if (
          !prev ||
          /^(H[1-6]|IMG|PICTURE|VIDEO|FIGURE|UL|OL|NAV|SVG)$/i.test(prev.tagName) ||
          !window.__v3.vis(prev)
        )
          continue;
        const t = prev.innerText.trim();
        if (!t || window.__v3.words(t).length > 4 || t.length > 40) continue;
        const pcs = getComputedStyle(prev);
        const hcs = getComputedStyle(h);
        if (parseFloat(pcs.fontSize) >= parseFloat(hcs.fontSize)) continue;
        const ls =
          pcs.letterSpacing === "normal"
            ? 0
            : parseFloat(pcs.letterSpacing) / parseFloat(pcs.fontSize);
        const eyebrowish =
          pcs.textTransform === "uppercase" || ls >= 0.06 || parseFloat(pcs.fontSize) <= 14;
        if (!eyebrowish) continue;
        const isLocation =
          prev.hasAttribute("data-location") || places.some((p) => t.toLowerCase().includes(p));
        if (h.tagName === "H1" && isLocation && h1Allowed) {
          h1Allowed = false;
          continue;
        }
        out.push(`"${t}" above "${h.innerText.trim().slice(0, 30)}"`);
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, `eyebrow label ${t}`)) };
  },
};

export const C39 = {
  id: "C39",
  title: "dividers only between rows of tables, price lists, amenity lists",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      const vw = innerWidth;
      for (const el of document.querySelectorAll("body *")) {
        if (
          !window.__v3.vis(el) ||
          el.closest("table,svg,[data-price-list],[data-amenities]") ||
          /^(LI|TR|TD|TH|DT|DD|INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(el.tagName)
        )
          continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (el.tagName === "HR") {
          out.push("hr");
          continue;
        }
        const line = (s) =>
          parseFloat(cs[`border${s}Width`]) > 0 &&
          cs[`border${s}Style`] !== "none" &&
          window.__v3.rgba(cs[`border${s}Color`])[3] > 0.02;
        const sides = ["Top", "Right", "Bottom", "Left"].filter(line);
        if (
          sides.length === 1 &&
          ["Top", "Bottom"].includes(sides[0]) &&
          r.width >= vw * 0.55 &&
          !el.closest("li,dl")
        )
          out.push(`${window.__v3.label(el)} rule on ${sides[0].toLowerCase()}`);
        else if (
          r.height <= 3 &&
          r.width >= vw * 0.4 &&
          cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
          !el.children.length &&
          !el.textContent.trim()
        )
          out.push(`${window.__v3.label(el)} empty rule`);
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, `divider: ${t}`)) };
  },
};

export const C40 = {
  id: "C40",
  title: "pills only as real filters plus one honest status label",
  viewport: "desktop",
  async run({ page }) {
    const r = await page.evaluate(() => {
      const bad = [];
      let status = 0;
      for (const el of document.querySelectorAll("body *")) {
        if (!window.__v3.vis(el) || /^(A|BUTTON|INPUT|SELECT|SVG|IMG|LI|OPTION)$/i.test(el.tagName))
          continue;
        if (
          el.closest(
            "a,button,[role=tab],[aria-pressed],[aria-selected],[data-filter],label,select",
          )
        )
          continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
        if (!own) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.height > 48 || r.width < r.height * 1.3) continue;
        const rad = parseFloat(cs.borderTopLeftRadius) || 0;
        if (rad < r.height / 2 - 1) continue;
        const boxed =
          cs.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(cs.borderTopWidth) > 0;
        if (!boxed) continue;
        const t = el.innerText.trim();
        if (
          el.getAttribute("role") === "status" ||
          /^(sold( out)?|booked|available|new|pending|unavailable|full|open|closed)$/i.test(t)
        )
          status++;
        else bad.push(`"${t.slice(0, 30)}"`);
      }
      return { bad, status };
    });
    const fails = r.bad.map((t) => fail(t, `decorative pill ${t}`));
    if (r.status > 1) fails.push(fail("status labels", `${r.status} status labels (one allowed)`));
    return { fails };
  },
};

export const C42 = {
  id: "C42",
  title: "no untouched third-party component defaults (shadcn tokens)",
  viewport: "desktop",
  async run({ page }) {
    const r = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const defaults = {
        "--primary": [
          "oklch(0.205 0 0)",
          "222.2 47.4% 11.2%",
          "222.2 47.4% 11.2%".replace(/ /g, " "),
        ],
        "--muted-foreground": ["oklch(0.556 0 0)", "215.4 16.3% 46.9%"],
        "--border": ["oklch(0.922 0 0)", "214.3 31.8% 91.4%"],
        "--muted": ["oklch(0.97 0 0)", "210 40% 96.1%"],
        "--ring": ["oklch(0.708 0 0)", "222.2 84% 4.9%"],
        "--radius": ["0.625rem"],
      };
      const hits = [];
      for (const [k, vals] of Object.entries(defaults)) {
        const v = norm(cs.getPropertyValue(k));
        if (v && vals.some((d) => v === d || v === `hsl(${d})`)) hits.push(`${k}: ${v}`);
      }
      const classes = new Set();
      for (const el of document.querySelectorAll("[class]")) {
        for (const c of (el.getAttribute("class") || "").split(/\s+/)) {
          if (
            /^(bg-primary|text-primary-foreground|text-muted-foreground|bg-muted|border-input|ring-offset-background|bg-destructive|bg-popover|bg-card)$/.test(
              c,
            )
          )
            classes.add(c);
        }
      }
      return { hits, classes: [...classes] };
    });
    const fails =
      r.hits.length >= 3
        ? r.hits.map((h) =>
            fail(h, `stock shadcn token left as shipped (${r.hits.length} of 6): ${h}`),
          )
        : [];
    return { fails, note: `${r.hits.length} stock tokens, ${r.classes.length} shadcn class names` };
  },
};

export const C45 = {
  id: "C45",
  title: "marketing sites declare a light color scheme",
  viewport: "desktop",
  scope: "home",
  async run({ page }) {
    const r = await page.evaluate(`(() => {
      ${RULES_JS}
      const cs = getComputedStyle(document.documentElement).colorScheme;
      const meta = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') || '';
      const { rules } = walkRules();
      const dark = rules.filter((r) => /prefers-color-scheme:\\s*dark/.test(r.media)).length;
      return { cs, meta, dark };
    })()`);
    const fails = [];
    const declared = /^light( only)?$/i.test(r.cs.trim()) || /^light( only)?$/i.test(r.meta.trim());
    if (!declared)
      fails.push(
        fail("no declaration", `color-scheme is "${r.cs}", meta "${r.meta}": declare light only`),
      );
    if (r.dark > 0)
      fails.push(
        fail("dark rules", `${r.dark} prefers-color-scheme: dark rules auto-invert the page`),
      );
    return { fails };
  },
};

export const VISUAL = [C06, C07, C08, C12, C13, C14, C15, C16, C18, C22, C38, C39, C40, C42, C45];
