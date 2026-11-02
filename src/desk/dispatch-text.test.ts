import { describe, expect, it } from "vitest";
import {
  dash,
  esc,
  inline,
  linkProblem,
  marks,
  plainMarks,
  safeHref,
  wordsLinkProblems,
} from "./dispatch-text";

const LOOK = { ink: "#000", link: "#111" };

describe("marks", () => {
  it("sets italic, bold and both, and leaves a lone star alone", () => {
    expect(marks("*a* **b** ***c*** 5 * 3")).toBe(
      "<em>a</em> <strong>b</strong> <strong><em>c</em></strong> 5 * 3",
    );
  });
  it("strips marks and link brackets for places that print no markup", () => {
    expect(plainMarks("*Dusk* [see it](https://x.com/a)")).toBe("Dusk see it");
  });
});

describe("links", () => {
  it("explains a bad address in a sentence", () => {
    expect(linkProblem("www.example-house.org")).toContain("needs https://");
    expect(linkProblem("http://x.com")).toContain("starts with http://");
    expect(linkProblem("javascript:alert(1)")).toContain("not a kind of link");
    expect(linkProblem("data:text/html,hi")).toContain("not a kind of link");
    expect(linkProblem("https://x.com/a b")).toContain("space");
    expect(linkProblem("https://x.com")).toBe("");
    expect(linkProblem("")).toBe("");
  });
  it("allows mailto only where asked", () => {
    expect(linkProblem("mailto:info@example-house.org")).not.toBe("");
    expect(linkProblem("mailto:info@example-house.org", { mailto: true })).toBe("");
  });
  it("finds every unfinished or bad link typed in some words", () => {
    expect(wordsLinkProblems("see [the show](https://example-house.org/happenings) now")).toEqual(
      [],
    );
    expect(wordsLinkProblems("[the show](www.x.com)")[0]).toContain("needs https://");
    expect(wordsLinkProblems("[](https://x.com)")[0]).toContain("no words to click");
    expect(wordsLinkProblems("[the show]()")[0]).toContain("no address");
    expect(wordsLinkProblems("[the show](https://x.com")[0]).toContain("not finished");
    expect(wordsLinkProblems("see [the show](https://x.com and more")[0]).toContain("not finished");
    expect(wordsLinkProblems("[a](https://x.com) [b](javascript:x)")).toHaveLength(1);
  });
  it("turns a finished link into a real anchor with marks inside", () => {
    const html = inline("Visit [*the* house](https://www.example-house.org/about) today", LOOK);
    expect(html).toContain('<a href="https://www.example-house.org/about"');
    expect(html).toContain("<em>the</em> house</a>");
  });
  it("never prints a bad address as a link, only as its words", () => {
    const html = inline("[click](javascript:alert(1)) and [also](www.x.com)", LOOK);
    expect(html).not.toContain("<a ");
    expect(wordsLinkProblems("[click](javascript:alert(1))")[0]).toContain("not finished");
  });
  it("escapes everything typed first, so no tag gets through", () => {
    expect(inline('<script>x</script> & "q"', LOOK)).toBe(
      "&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot;",
    );
    expect(esc("<b>")).toBe("&lt;b&gt;");
  });
  it("escapes an ampersand inside a link address once", () => {
    const html = inline("[go](https://x.com/a?b=1&c=2)", LOOK);
    expect(html).toContain('href="https://x.com/a?b=1&amp;c=2"');
  });
  it("safeHref passes only addresses that pass the rule", () => {
    expect(safeHref("https://x.com")).toBe("https://x.com");
    expect(safeHref("ftp://x.com")).toBe("");
  });
});

describe("dash", () => {
  it("prints time and date ranges with an en dash and never a long dash", () => {
    expect(dash("3 to 5 pm")).toBe("3–5 pm");
    expect(dash("12-5 PM")).toBe("12–5 PM");
    expect(dash("Nov 14-16")).toBe("Nov 14–16");
    expect(dash(`a ${String.fromCharCode(8212)} b`)).not.toContain(String.fromCharCode(8212));
  });
});
