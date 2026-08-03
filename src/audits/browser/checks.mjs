/**
 * The browser tier's checks: what a page DOES at a real size, which is the tier the
 * required and extended tiers cannot reach. Required reads HTML and CSS; extended runs
 * Lighthouse and axe on one viewport. Neither can tell you that a hero stops 200px
 * short of the fold on a phone, that a heading is clipped at 834px, or that the page
 * cannot be scrolled with a finger.
 *
 * MEASURE AND GRADE ARE SEPARATE. `measureExpression()` returns a string of DOM code
 * that gathers numbers; every `grade*` function below is pure and takes those numbers.
 * That split is what makes the logic testable without a browser, the same shape
 * `gradeLighthouse` uses in the extended tier.
 */

/** The set every site is judged against. Landscape phone is the row that breaks. */
export const GEOMETRIES = [
  { name: "iPhone 14/15", w: 390, h: 844, dpr: 3, mobile: true },
  { name: "iPhone 16 Pro", w: 402, h: 874, dpr: 3, mobile: true },
  { name: "iPhone 16 Pro Max", w: 440, h: 956, dpr: 3, mobile: true },
  { name: "iPhone SE", w: 375, h: 667, dpr: 2, mobile: true },
  { name: "phone landscape", w: 874, h: 402, dpr: 3, mobile: true },
  { name: "small android", w: 360, h: 640, dpr: 3, mobile: true },
  { name: "iPad portrait", w: 834, h: 1194, dpr: 2, mobile: true },
  { name: "iPad landscape", w: 1194, h: 834, dpr: 2, mobile: true },
  { name: "laptop", w: 1280, h: 800, dpr: 2, mobile: false },
  { name: "large desktop", w: 1728, h: 1080, dpr: 2, mobile: false },
  { name: "short window", w: 1440, h: 600, dpr: 1, mobile: false },
  { name: "very short window", w: 1440, h: 480, dpr: 1, mobile: false },
  { name: "narrow window", w: 320, h: 720, dpr: 1, mobile: false },
];

/**
 * The DOM code that gathers one geometry's numbers.
 *
 * Tap targets are measured on things a finger actually goes for, and only when they are
 * visible: a 0x0 control in a closed menu is not a 44px failure, and reporting it as one
 * is how a check gets switched off.
 */
export function measureExpression({ heroSelector }) {
  return `(() => {
  /* A skip link is deliberately one pixel and clipped until it is focused. Counting it
     as a 1px tap target and as clipped text is how an audit gets switched off, so the
     sr-only signature is excluded by shape rather than by class name. */
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) <= 0.05) return false;
    if (/inset\(50%\)/.test(s.clipPath) || /rect\(0px, 0px, 0px, 0px\)/.test(s.clip)) return false;
    return true;
  };
  /* Anything living inside a horizontal rail is meant to be off to the right; that is
     what a carousel IS. Only elements whose nearest scroll container is the document
     are actually off the page. */
  const inScroller = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(o.overflowX) || /(auto|scroll|overlay)/.test(o.overflow)) return true;
    }
    return false;
  };
  /* A card with a zooming image inside overflows by design. Only a TEXT LEAF whose own
     words do not fit is text the reader will never see. */
  const textLeaf = (el) =>
    el.children.length === 0 ||
    [...el.children].every((c) => getComputedStyle(c).display.startsWith("inline"));
  const path = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "";
    return (el.tagName.toLowerCase() + id + cls).slice(0, 60);
  };

  const hero = ${heroSelector ? `document.querySelector(${JSON.stringify(heroSelector)})` : "null"};
  let heroData = null;
  if (hero) {
    const b = hero.getBoundingClientRect();
    const next = hero.nextElementSibling?.getBoundingClientRect() ?? null;
    const inner = [...hero.querySelectorAll("h1,h2,p,a,button")].filter(vis);
    heroData = {
      top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height),
      nextTop: next ? Math.round(next.top) : null,
      contentBottom: inner.length ? Math.round(Math.max(...inner.map((e) => e.getBoundingClientRect().bottom))) : 0,
      contentTop: inner.length ? Math.round(Math.min(...inner.map((e) => e.getBoundingClientRect().top))) : 0,
    };
  }

  const targets = [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[role="button"]')]
    .filter(vis)
    .map((el) => ({ sel: path(el), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));

  /* A clipped element is one whose own content is wider than its box while its overflow
     is hidden: that is text the reader will never see, as opposed to a scroll region. */
  const clipped = [...document.querySelectorAll("h1,h2,h3,h4,p,li,button,a,span,div")]
    .filter(vis)
    .filter((el) => {
      const s = getComputedStyle(el);
      if (s.overflowX !== "hidden" && s.overflow !== "hidden") return false;
      if (el.scrollWidth <= el.clientWidth + 1) return false;
      if (!textLeaf(el)) return false;
      return (el.textContent ?? "").trim().length > 0;
    })
    .slice(0, 8)
    .map((el) => ({ sel: path(el), text: (el.textContent ?? "").trim().replace(/\\s+/g, " ").slice(0, 40) }));

  /* Anything visible that starts beyond the right edge is off the page, not styled. */
  const offRight = [...document.querySelectorAll("body *")]
    .filter(vis)
    .filter((el) => el.getBoundingClientRect().left > window.innerWidth + 1)
    .filter((el) => !inScroller(el))
    .slice(0, 5)
    .map((el) => path(el));

  return {
    vw: window.innerWidth, vh: window.innerHeight,
    docWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
    sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    hero: heroData, targets, clipped, offRight,
  };
})()`;
}

const err = (code, message, route, geometry) => ({
  severity: "error",
  code,
  message: `${geometry}: ${message}`,
  route,
});

/** Pure. One geometry's numbers to findings. */
export function gradeGeometry(m, { route, geometry, minTapTarget = 44, requireHero = true }) {
  const findings = [];
  const g = geometry.name;

  if (m.sideways) {
    findings.push(err("browser-sideways-scroll", `page scrolls sideways (${m.docWidth}px in ${m.vw}px)`, route, g));
  }
  for (const c of m.clipped) {
    findings.push(err("browser-text-clipped", `"${c.text}" is clipped in ${c.sel}`, route, g));
  }
  for (const sel of m.offRight) {
    findings.push(err("browser-offscreen", `${sel} sits past the right edge`, route, g));
  }
  const small = m.targets.filter((t) => t.h < minTapTarget);
  if (small.length) {
    const worst = small.reduce((a, b) => (a.h < b.h ? a : b));
    findings.push(
      err("browser-tap-target", `${small.length} target(s) under ${minTapTarget}px, smallest ${worst.sel} at ${worst.h}px`, route, g),
    );
  }

  if (requireHero && m.hero) {
    if (m.hero.bottom < m.vh - 1) {
      findings.push(err("browser-hero-short", `hero ends at ${m.hero.bottom} of ${m.vh}, short of the fold`, route, g));
    }
    if (m.hero.top > 1) {
      findings.push(err("browser-hero-offset", `hero starts ${m.hero.top}px down`, route, g));
    }
    if (m.hero.nextTop !== null && m.hero.nextTop < m.vh - 1) {
      findings.push(err("browser-hero-bleed", `the next section shows at ${m.hero.nextTop}, above the fold`, route, g));
    }
    if (m.hero.contentBottom > m.vh || m.hero.contentTop < 0) {
      findings.push(err("browser-hero-cut", `hero content runs ${m.hero.contentTop} to ${m.hero.contentBottom} in ${m.vh}px`, route, g));
    }
  }
  if (requireHero && !m.hero) {
    findings.push(err("browser-hero-missing", "no element matched the configured hero selector", route, g));
  }
  return findings;
}

/** Pure. Console output to findings. */
export function gradeConsole(errors, { route, geometry }) {
  return errors.slice(0, 3).map((text) => err("browser-console-error", text, route, geometry.name));
}

/** Pure. Did a finger move the page? Only asked of geometries that have fingers. */
export function gradeTouch({ before, after, scrollable }, { route, geometry }) {
  if (!scrollable) return [];
  if (after > before + 60) return [];
  return [
    err("browser-touch-frozen", `a swipe moved the page from ${before} to ${after}: touch scrolling is blocked`, route, geometry.name),
  ];
}
