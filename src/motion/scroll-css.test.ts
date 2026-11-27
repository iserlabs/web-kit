import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadingProgress } from "./ReadingProgress";

const css = readFileSync(new URL("./motion.css", import.meta.url), "utf8");

/** Each rule (selector + body) with the @-rules it sits inside. Enough CSS parsing for this file. */
function rules(text: string): Array<{ selector: string; body: string; within: string[] }> {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selector: string; body: string; within: string[] }> = [];
  const stack: string[] = [];
  let buf = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (c === "{") {
      const head = buf.trim();
      buf = "";
      if (head.startsWith("@") && !head.startsWith("@keyframes")) {
        stack.push(head);
        i++;
        continue;
      }
      const end = src.indexOf("}", i);
      const inner = src.slice(i + 1, end);
      if (head.startsWith("@keyframes")) {
        // skip nested keyframe blocks
        let depth = 1;
        let j = i + 1;
        while (depth && j < src.length) {
          if (src[j] === "{") depth++;
          if (src[j] === "}") depth--;
          j++;
        }
        i = j;
        continue;
      }
      out.push({ selector: head, body: inner, within: [...stack] });
      i = end + 1;
      continue;
    }
    if (c === "}") {
      stack.pop();
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  return out;
}

/** What house rule C31 and the reduced-motion rule demand of every scroll-timeline rule. */
function problems(text: string): string[] {
  const bad: string[] = [];
  for (const r of rules(text)) {
    if (!/animation-timeline\s*:/.test(r.body)) continue;
    const at = r.within.join(" ");
    if (!/prefers-reduced-motion:\s*no-preference/.test(at))
      bad.push(`${r.selector}: scroll animation outside a no-preference guard`);
    if (!/@supports/.test(at)) bad.push(`${r.selector}: scroll animation without @supports`);
    if (/view\(\)/.test(r.body)) {
      for (const sel of r.selector.split(",").map((s) => s.trim())) {
        const last = sel.split(/[\s>+~]+/).pop() ?? "";
        if (!/^(img|picture|video)\b/.test(last) && !/^img\./.test(last))
          bad.push(`${sel}: a view() reveal on something that is not a photo`);
      }
    }
  }
  return bad;
}

describe("native scroll animation css", () => {
  it("motion.css has the photo rise and the reading progress rules", () => {
    const sels = rules(css)
      .filter((r) => /animation-timeline/.test(r.body))
      .map((r) => r.selector);
    expect(sels.some((s) => s.includes(".wk-rise"))).toBe(true);
    expect(sels.some((s) => s.includes(".wk-progress"))).toBe(true);
  });
  it("every scroll animation is behind @supports and the reduced-motion guard, photos only", () => {
    expect(problems(css)).toEqual([]);
  });
  it("the check catches a text reveal, a missing guard and a missing @supports", () => {
    const textReveal = `@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) {
      .wk-rise > h2, .wk-rise figcaption { animation: x auto both; animation-timeline: view(); } } }`;
    expect(problems(textReveal)).toEqual([
      ".wk-rise > h2: a view() reveal on something that is not a photo",
      ".wk-rise figcaption: a view() reveal on something that is not a photo",
    ]);
    const noGuard = `@supports (animation-timeline: view()) { img.a { animation-timeline: view(); } }`;
    expect(problems(noGuard)).toEqual(["img.a: scroll animation outside a no-preference guard"]);
    const noSupports = `@media (prefers-reduced-motion: no-preference) { img.a { animation-timeline: view(); } }`;
    expect(problems(noSupports)).toEqual(["img.a: scroll animation without @supports"]);
  });
  it("fallback: outside @supports nothing is hidden and the progress bar is not drawn", () => {
    const plain = rules(css).filter((r) => !r.within.some((w) => w.startsWith("@supports")));
    const rise = plain.filter((r) => r.selector.includes("wk-rise"));
    expect(rise).toEqual([]); // no opacity:0 or offset is ever applied without support
    const bar = plain.find((r) => r.selector === ".wk-progress");
    expect(bar?.body).toMatch(/display:\s*none/);
  });
});

describe("ReadingProgress", () => {
  it("is an empty decorative bar hidden from screen readers", () => {
    const html = renderToStaticMarkup(createElement(ReadingProgress));
    expect(html).toBe('<div class="wk-progress" aria-hidden="true"></div>');
  });
  it("passes color and height through as variables", () => {
    const html = renderToStaticMarkup(createElement(ReadingProgress, { color: "#123", height: 4 }));
    expect(html).toContain("--wk-progress:#123");
    expect(html).toContain("--wk-progress-h:4px");
  });
});
