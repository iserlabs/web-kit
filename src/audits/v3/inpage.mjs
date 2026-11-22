/**
 * Helpers installed into every page before it loads (context.addInitScript). They run in the
 * browser, so this is a string of plain JavaScript, not an importable module.
 *
 * window.__v3 offers: rgba(css) any CSS color to [r,g,b,a]; effOpacity(el); vis(el); label(el);
 * leafs() every element with its own visible text; exempt(el) true inside a verbatim quote or
 * review; words(str); lum / contrast for WCAG math. It also records mouse-move listeners
 * (window.__v3.moves) and long tasks so the checks can read them later.
 */
export const INPAGE = String.raw`(() => {
  if (window.__v3) return;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  let cx = null;
  const rgba = (s) => {
    cx = cx || cv.getContext('2d', { willReadFrequently: true });
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  };
  const effOpacity = (el) => {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const label = (el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : '') + (t ? ' "' + t + '"' : '');
  };
  const exempt = (el) => !!el.closest('blockquote,q,cite,[data-verbatim],[data-review],[class*="review" i],[class*="testimonial" i]');
  const leafs = () => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n instanceof SVGElement || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(n.tagName)) continue;
      let own = false;
      for (const c of n.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) { own = true; break; }
      if (own && vis(n)) out.push(n);
    }
    return out;
  };
  const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { stack.push(c); if (c[3] >= 0.999) break; }
    }
    let base = [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) { const c = stack[i]; base = base.map((v, k) => c[k] * c[3] + v * (1 - c[3])); }
    return base;
  };
  const moves = [];
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'mousemove' || type === 'pointermove') {
      let who = this === window ? 'window' : this === document ? 'document' : (this.tagName ? this.tagName.toLowerCase() : 'target');
      moves.push(type + ' on ' + who + ' from ' + ((new Error().stack || '').split('\n')[2] || '').trim().slice(0, 90));
    }
    return orig.call(this, type, fn, opts);
  };
  window.__v3 = { rgba, effOpacity, vis, label, exempt, leafs, words, lum, contrast, bgOf, moves };
})();`;
