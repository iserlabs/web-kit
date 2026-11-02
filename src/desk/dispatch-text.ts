/**
 * The words of a Dispatch: what is typed in the Desk, and how it becomes the HTML of an email.
 * Pure functions, no I/O, so the Desk's preview, the proof, the mailing and the tests all use
 * the same ones.
 *
 * WHAT CAN BE TYPED (the marks a word processor has taught everyone):
 *   *italic*   **bold**   ***both***   and [words](https://address) for a link.
 * Nothing else is markup. Everything typed is escaped FIRST, so nothing a person types can reach
 * an email as a tag.
 */

export function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const BOTH = /\*\*\*(?=\S)(.+?)(?<=\S)\*\*\*/g;
const BOLD = /\*\*(?=\S)(.+?)(?<=\S)\*\*/g;
const ITAL = /\*(?=[^\s*])(.+?)(?<=[^\s*])\*/g;

/** Paired marks to tags. Only the asterisks a pair consumes are taken, so "5 * 3" keeps its star. */
export function marks(escaped: string): string {
  return String(escaped)
    .replace(BOTH, "<strong><em>$1</em></strong>")
    .replace(BOLD, "<strong>$1</strong>")
    .replace(ITAL, "<em>$1</em>");
}

/** The same words with only the paired marks (and link brackets) taken out, for places that print
    no markup: the inbox preview line, the page title, a picture's alt words. */
export function plainMarks(s: unknown): string {
  return stripLinks(String(s == null ? "" : s))
    .replace(BOTH, "$1")
    .replace(BOLD, "$1")
    .replace(ITAL, "$1");
}

/* ---- Links inside the words -------------------------------------------------------------- */

const LINK = /\[([^[\]\n]*)\]\(([^()\s]*)\)/g;

/** "[words](https://x)" to "words". */
export function stripLinks(s: string): string {
  return s.replace(LINK, "$1");
}

/**
 * Whether a link somebody typed is safe to put in a few hundred inboxes, as a plain sentence, or
 * "" when it is fine (or empty).
 *
 * `esc()` stops a quote breaking out of the attribute but does nothing about WHAT the address is:
 * `javascript:` and `data:` survive escaping intact. The commoner mistake is innocent: `www.x.com`
 * with no `https://`, which a mail client treats as a path relative to nothing, so the button goes
 * nowhere. Both are caught at SAVE with a sentence a person can act on, not found after the mailing
 * by the people who received it. `mailto` is allowed for links; a picture must be fetched from the web.
 */
export function linkProblem(url: unknown, { mailto = false } = {}): string {
  const u = String(url == null ? "" : url).trim();
  if (!u) return "";
  const shown = u.slice(0, 80);
  if (/^www\./i.test(u) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(u)) {
    return `"${shown}" needs https:// in front of it, or it will not open from an email.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return `"${shown}" is not a web address.`;
  }
  if (/\s/.test(u)) return `"${shown}" has a space in it, so it will not open from an email.`;
  if (parsed.protocol === "https:") return "";
  if (mailto && parsed.protocol === "mailto:") return "";
  if (parsed.protocol === "http:") {
    return `"${shown}" starts with http://. Use the https:// address so mail programs do not flag it.`;
  }
  return `"${shown}" is not a kind of link an email can safely carry. Use an https:// address${
    mailto ? " or a mailto: address" : ""
  }.`;
}

/** The address as given when it passes `linkProblem`, otherwise "". Applied at render. */
export function safeHref(url: unknown, opts?: { mailto?: boolean }): string {
  const u = String(url == null ? "" : url).trim();
  return u && !linkProblem(u, opts) ? u : "";
}

/**
 * Every problem with the links typed inside some words. A link needs words to click and an
 * address that passes `linkProblem`; a bracket pair that is not a finished link is named, because
 * a half-typed "[see the show](www.x.com" would otherwise print as plain text and look like a link
 * that went missing.
 */
export function wordsLinkProblems(words: unknown): string[] {
  const text = String(words == null ? "" : words);
  const out: string[] = [];
  for (const m of text.matchAll(LINK)) {
    const label = m[1].trim();
    const href = m[2];
    if (!label) {
      out.push(`A link in the words has an address but no words to click: ${href.slice(0, 60)}`);
      continue;
    }
    if (!href) {
      out.push(`The link "${label.slice(0, 60)}" has no address.`);
      continue;
    }
    const bad = linkProblem(href, { mailto: true });
    if (bad) out.push(`The link "${label.slice(0, 60)}": ${bad}`);
  }
  if (/\]\(/.test(text.replace(LINK, ""))) {
    out.push(
      "A link in the words is not finished. It should read [words to click](https://address).",
    );
  }
  return out;
}

/* ---- Words to HTML ----------------------------------------------------------------------- */

export type Look = { ink: string; link: string };

const OPEN = "";
const CLOSE = "";

/**
 * Typed words to the inside of an email paragraph: escaped, then links, then marks. A link whose
 * address does not pass is printed as its plain words, never as a link: a bad address never
 * reaches an inbox as something clickable.
 */
export function inline(words: unknown, look: Look): string {
  const found: Array<{ label: string; href: string }> = [];
  const held = String(words == null ? "" : words).replace(
    LINK,
    (_m, label: string, href: string) => {
      found.push({ label, href });
      return `${OPEN}${found.length - 1}${CLOSE}`;
    },
  );
  return marks(esc(held)).replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, "g"), (_m, n: string) => {
    const l = found[Number(n)];
    const label = marks(esc(l.label.trim()));
    const href = safeHref(l.href, { mailto: true });
    return href
      ? `<a href="${esc(href)}" style="color:${look.link};text-decoration:underline;text-underline-offset:3px">${label}</a>`
      : label;
  });
}

/** Blank lines separate paragraphs, which is how people actually type. */
export function paragraphsOf(words: unknown): string[] {
  return String(words == null ? "" : words)
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);

/** A range typed "3 to 5 pm" or "12-5 PM" prints with the kit's dash. No long dash is ever printed. */
export function dash(s: string): string {
  return s
    .split(EM_DASH)
    .join(EN_DASH)
    .replace(
      /(\d(?::\d{2})?\s*(?:[ap]\.?m\.?)?)\s*(?:-|–|\bto\b)\s*(?=\d)/gi,
      (_m, a: string) => `${a.trimEnd()}${EN_DASH}`,
    );
}

/** Lines typed one per line: the dates, the time, the place. */
export function lines(value: unknown, max = 6): string[] {
  const list = Array.isArray(value) ? value : String(value == null ? "" : value).split(/\n/);
  return list
    .map((l) => dash(String(l == null ? "" : l).trim()))
    .filter(Boolean)
    .slice(0, max);
}
