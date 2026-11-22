/**
 * Behavior checks: C21 C23 C24 C25 C26 C27 C28 C29 C30 C31 C32 C33.
 * Each `run` gets { page, ctx, url, fresh } and returns { fails, note?, unproven? }.
 * `fresh(opts)` opens a new page in its own browser context (with the in-page helpers and any
 * emulation) and returns { page, close }.
 */
const fail = (item, detail) => ({ item, detail: detail ?? item });

/** Text elements that are invisible right now but occupy space: candidates for a scroll reveal. */
const HIDDEN_TEXT_JS = `(() => {
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|PATH|OPTION)$/i.test(el.tagName)) continue;
    let own = false;
    for (const c of el.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) { own = true; break; }
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.closest('[aria-hidden="true"],[hidden],[inert]')) continue;
    if (window.__v3.effOpacity(el) < 0.1 || cs.visibility === 'hidden') {
      if (el.closest('dialog:not([open]),[role=dialog],[role=tooltip],[popover],details:not([open]),[aria-expanded="false"] + *,[data-state="closed"]')) continue;
      out.push(window.__v3.label(el));
    }
  }
  return out;
})()`;

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = 600;
  for (let y = 0; y < h; y += step) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
}

export const C21 = {
  id: "C21",
  title: "at most one filled accent button per 390px view",
  viewport: "phone",
  async run({ page }) {
    const r = await page.evaluate(() => {
      const H = innerHeight;
      const items = [];
      for (const el of document.querySelectorAll("button,a,input[type=submit],[role=button]")) {
        if (!window.__v3.vis(el)) continue;
        const cs = getComputedStyle(el);
        const bg = window.__v3.rgba(cs.backgroundColor);
        if (bg[3] < 0.9) continue;
        const isButton =
          el.matches("button,input[type=submit],[role=button]") ||
          /btn|button|cta/i.test(el.className) ||
          parseFloat(cs.paddingTop) >= 8;
        if (!isButton) continue;
        const par = window.__v3.bgOf(el.parentElement || document.body);
        if (
          par &&
          Math.abs(par[0] - bg[0]) + Math.abs(par[1] - bg[1]) + Math.abs(par[2] - bg[2]) < 24
        )
          continue; // same as the surface behind it
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 24) continue;
        const fixed =
          ["fixed", "sticky"].includes(cs.position) ||
          !!el.closest("header[style*=fixed],[style*='position: fixed']");
        items.push({
          key: el.innerText.trim().toLowerCase() + "|" + (el.getAttribute("href") || ""),
          label: el.innerText.trim().slice(0, 24) || window.__v3.label(el),
          top: r.top + scrollY,
          h: r.height,
          fixed,
        });
      }
      const seen = new Map();
      for (const i of items) if (!seen.has(i.key)) seen.set(i.key, i);
      const list = [...seen.values()];
      const worst = new Map();
      const total = document.documentElement.scrollHeight;
      for (let y = 0; y <= Math.max(0, total - H); y += 100) {
        const inView = list.filter(
          (i) => i.fixed || (i.top + i.h / 2 >= y && i.top + i.h / 2 <= y + H),
        );
        if (inView.length > 1)
          worst.set(
            inView
              .map((i) => i.label)
              .sort()
              .join(" + "),
            y,
          );
      }
      return [...worst.entries()];
    });
    return {
      fails: r.map(([k, y]) =>
        fail(k, `${k} are filled accent buttons in one phone view (near ${y}px down)`),
      ),
    };
  },
};

const VAGUE =
  /^(learn more|click here|click|submit|get started|read more|more|here|find out more|see more|view more|details|go|continue reading|know more|discover more|explore more|start now|sign up now)$/i;

export const C23 = {
  id: "C23",
  title: "no vague button labels; 3 words max",
  viewport: "desktop",
  async run({ page }) {
    const labels = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "button,input[type=submit],[role=button],a.btn,a[class*=btn],a[class*=button],a[class*=cta]",
        ),
      ]
        .filter((el) => window.__v3.vis(el))
        .map((el) =>
          (el.innerText || el.value || el.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean),
    );
    const fails = [];
    for (const t of new Set(labels)) {
      const clean = t.replace(/[.!→>›»]+$/g, "").trim();
      if (VAGUE.test(clean)) fails.push(fail(t, `vague button label "${t}"`));
      else if (clean.split(" ").length > 3)
        fails.push(fail(t, `button label over 3 words: "${t}"`));
    }
    return { fails, note: `${labels.length} buttons read` };
  },
};

export const C24 = {
  id: "C24",
  title: "5 visible required form fields at most, unless data-fields-reason",
  viewport: "desktop",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      for (const f of document.querySelectorAll("form")) {
        if (!window.__v3.vis(f) || f.hasAttribute("data-fields-reason")) continue;
        const fields = [...f.querySelectorAll("input,select,textarea")].filter(
          (e) =>
            (!/^(hidden|submit|button|reset|image)$/.test(e.type) &&
              window.__v3.vis(e) &&
              getComputedStyle(e).position !== "absolute") ||
            (e.type === "checkbox" && window.__v3.vis(e)),
        );
        const required = fields.filter(
          (e) => e.required || e.getAttribute("aria-required") === "true",
        );
        const n = required.length ? required.length : fields.length;
        if (n > 5)
          out.push(
            `${window.__v3.label(f)} shows ${n} ${required.length ? "required " : ""}fields`,
          );
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, t)) };
  },
};

export const C25 = {
  id: "C25",
  title: "tap targets 44x44px at 390px",
  viewport: "phone",
  async run({ page }) {
    const bad = await page.evaluate(() => {
      const out = [];
      const sel =
        "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary,[tabindex]:not([tabindex='-1'])";
      for (const el of document.querySelectorAll(sel)) {
        if (!window.__v3.vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.right < 0 || r.left > innerWidth) continue;
        if (
          el.matches("a") &&
          getComputedStyle(el).display === "inline" &&
          el.closest("p,li,dd,td,span,small")
        ) {
          const par = el.parentElement;
          if (par && par.innerText.trim().length > el.innerText.trim().length + 8) continue; // a link inside a sentence
        }
        if (r.width >= 43.5 && r.height >= 43.5) continue;
        // a padded tap area: points 21px off-center still land on this control
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        const pts = [
          [-21, 0],
          [21, 0],
          [0, -21],
          [0, 21],
        ].map(([dx, dy]) => [cx + dx, cy + dy]);
        const hit = (p) => {
          if (p[0] < 0 || p[1] < 0 || p[0] >= innerWidth || p[1] >= innerHeight) return true;
          const e = document.elementFromPoint(p[0], p[1]);
          return !!e && (el === e || el.contains(e) || (e.contains(el) && e.matches("label")));
        };
        const wide = r.width >= 43.5 || pts.slice(0, 2).every(hit);
        const tall = r.height >= 43.5 || pts.slice(2).every(hit);
        if (!(wide && tall))
          out.push(`${window.__v3.label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    return { fails: bad.map((t) => fail(t, `small tap target ${t}`)) };
  },
};

export const C26 = {
  id: "C26",
  title: "top menu 5 links max plus one action",
  viewport: "desktop",
  scope: "home",
  async run({ page }) {
    const r = await page.evaluate(() => {
      const nav = [
        ...document.querySelectorAll(
          "header nav,nav[aria-label*=main i],nav[aria-label*=primary i],header [role=navigation],nav",
        ),
      ].find((n) => window.__v3.vis(n) && !n.closest("footer"));
      if (!nav) return null;
      const top = [...nav.querySelectorAll("a[href],button")].filter(
        (e) =>
          window.__v3.vis(e) &&
          !e.closest("ul ul,li li,[role=menu],[class*=dropdown i],[class*=submenu i]"),
      );
      const items = top.filter(
        (e, i) =>
          !(i === 0 && e.querySelector("img,svg") && !e.innerText.trim()) &&
          !(e.getAttribute("href") === "/" && !e.innerText.trim()),
      );
      let action = 0;
      let links = 0;
      for (const e of items) {
        const cs = getComputedStyle(e);
        const filled =
          window.__v3.rgba(cs.backgroundColor)[3] > 0.5 ||
          parseFloat(cs.borderTopWidth) > 0 ||
          /btn|button|cta/i.test(e.className) ||
          (e.tagName === "BUTTON" &&
            !/menu|nav/i.test(e.getAttribute("aria-label") || e.className));
        if (filled) action++;
        else links++;
      }
      return { links, action, labels: items.map((e) => e.innerText.trim().slice(0, 14)) };
    });
    if (!r) return { unproven: "UNPROVEN: no visible main menu found at desktop width" };
    const fails = [];
    if (r.links > 5)
      fails.push(fail("links", `${r.links} top-level menu links (max 5): ${r.labels.join(", ")}`));
    if (r.action > 1) fails.push(fail("actions", `${r.action} menu actions (max 1)`));
    return { fails, note: `${r.links} links + ${r.action} action` };
  },
};

export const C27 = {
  id: "C27",
  title: "keyboard walk: reachable, visible focus, no trap, submit by keyboard",
  viewport: "desktop",
  scope: "home",
  async run({ page }) {
    const sel =
      "a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex='-1'])";
    const total = await page.evaluate((sel) => {
      for (const e of document.querySelectorAll(sel)) delete e.__v3seen;
      return [...document.querySelectorAll(sel)].filter(
        (e) => window.__v3.vis(e) && !e.closest("[aria-hidden=true],[inert]"),
      ).length;
    }, sel);
    const fails = [];
    const seen = new Set();
    let first = null;
    let steps = 0;
    let wrapped = false;
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, 0);
    });
    for (let i = 0; i < 320; i++) {
      await page.keyboard.press("Tab");
      steps++;
      const info = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body || e === document.documentElement) return { body: true };
        e.__v3seen = true;
        if (e.tagName === "IFRAME") return { skip: true }; // focus moves inside the frame, which draws its own ring
        const sig = () => {
          const c = getComputedStyle(e);
          return [
            c.outlineStyle,
            c.outlineWidth,
            c.outlineColor,
            c.boxShadow,
            c.borderTopColor,
            c.backgroundColor,
            c.color,
            c.textDecorationLine,
            c.filter,
            c.transform,
          ].join("|");
        };
        const c = getComputedStyle(e);
        const outline =
          c.outlineStyle !== "none" &&
          parseFloat(c.outlineWidth) > 0 &&
          window.__v3.rgba(c.outlineColor)[3] > 0;
        const withFocus = sig();
        e.blur();
        const without = sig();
        e.focus({ preventScroll: true });
        const r = e.getBoundingClientRect();
        return {
          key: window.__v3.label(e) + "@" + Math.round(r.left) + "," + Math.round(r.top + scrollY),
          visible: outline || withFocus !== without || c.boxShadow !== "none",
          label: window.__v3.label(e),
        };
      });
      if (info.skip) continue;
      if (info.body) {
        if (i > 0) {
          wrapped = true;
          break;
        }
        continue;
      }
      if (first == null) first = info.key;
      else if (info.key === first) {
        wrapped = true;
        break;
      }
      if (seen.has(info.key)) {
        fails.push(fail(`trap ${info.label}`, `keyboard trap: focus loops on ${info.label}`));
        break;
      }
      seen.add(info.key);
      if (!info.visible)
        fails.push(fail(`nofocus ${info.label}`, `no visible focus style on ${info.label}`));
    }
    const missed = await page.evaluate(
      (sel) =>
        [...document.querySelectorAll(sel)]
          .filter(
            (e) =>
              window.__v3.vis(e) &&
              !e.__v3seen &&
              !e.closest("[aria-hidden=true],[inert]") &&
              e.tabIndex >= 0,
          )
          .map((e) => window.__v3.label(e)),
      sel,
    );
    for (const m of missed.slice(0, 30))
      fails.push(fail(`unreachable ${m}`, `not reachable by keyboard: ${m}`));
    if (!wrapped && !fails.some((f) => f.item.startsWith("trap")))
      fails.push(fail("no wrap", `focus never came back to the start after ${steps} Tab presses`));
    const forms = await page.evaluate(() =>
      [...document.querySelectorAll("form")]
        .filter((f) => window.__v3.vis(f))
        .flatMap((f) => {
          const fields = [
            ...f.querySelectorAll(
              "input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select",
            ),
          ].filter((e) => window.__v3.vis(e));
          const submit = f.querySelector(
            "button:not([type=button]):not([type=reset]),input[type=submit],input[type=image]",
          );
          return fields.length > 1 && !submit ? [window.__v3.label(f)] : [];
        }),
    );
    for (const f of forms)
      fails.push(
        fail(`submit ${f}`, `form cannot be submitted from the keyboard (no submit button): ${f}`),
      );
    return { fails, note: `${steps} Tab presses, ${total} controls` };
  },
};

export const C28 = {
  id: "C28",
  title: "every embed renders on the live URL and has a visible fallback link",
  viewport: "desktop",
  scope: "home",
  async run({ page }) {
    await scrollThrough(page);
    const frames = await page.$$("iframe");
    const fails = [];
    let n = 0;
    for (const h of frames) {
      const info = await h.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const src = el.getAttribute("src") || el.getAttribute("data-src") || "";
        const par = el.closest("figure,section,div") || el.parentElement;
        const fb = [
          ...(el.parentElement?.parentElement || par || document.body).querySelectorAll("a[href]"),
        ].some(
          (a) => !a.contains(el) && window.__v3.vis(a) && /^(https?:|tel:|mailto:)/.test(a.href),
        );
        return {
          src,
          w: r.width,
          h: r.height,
          hidden: r.width < 5 || r.height < 5 || getComputedStyle(el).display === "none",
          fb,
          booking:
            /book|reserve|guesty|hostaway|lodgify|ownerrez|hospitable|checkout|calendly|availability/i.test(
              src + " " + el.className + " " + el.id,
            ),
        };
      });
      if (!info.src || info.src === "about:blank" || info.hidden) continue;
      n++;
      const frame = await h.contentFrame();
      let ok = !!frame && !/^chrome-error:/.test(frame.url());
      if (ok) {
        const size = await frame
          .evaluate(() =>
            document.body ? document.body.children.length + document.body.innerText.length : 0,
          )
          .catch(() => 0);
        ok = size > 0;
      }
      const name = info.src.replace(/^https?:\/\//, "").slice(0, 50);
      if (!ok)
        fails.push(
          fail(
            `render ${name}`,
            `${info.booking ? "booking widget" : "embed"} did not render: ${name}`,
          ),
        );
      if (!info.fb)
        fails.push(fail(`fallback ${name}`, `no visible fallback link beside the embed: ${name}`));
    }
    const empty = await page.evaluate(() =>
      [...document.querySelectorAll("[data-embed],[data-widget]")]
        .filter((e) => window.__v3.vis(e) && !e.children.length && !e.innerText.trim())
        .map((e) => window.__v3.label(e)),
    );
    for (const e of empty) fails.push(fail(`empty ${e}`, `embed container is empty: ${e}`));
    return { fails, note: `${n} embeds checked` };
  },
};

const LOADER =
  "[aria-busy='true'],[class*='skeleton' i],[class*='spinner' i],[class*='loading' i],[class*='shimmer' i],[role=progressbar],[data-loading],[data-skeleton]";
const ERRORISH =
  /couldn.?t|could not|unable to|try again|something went wrong|not available|isn.?t loading|failed to load|please call|contact us|reload/i;

export const C29 = {
  id: "C29",
  title: "slow 3G: a designed loading shape and a plain-words error with a fallback",
  viewport: "desktop",
  scope: "home",
  async run({ ctx, url, fresh }) {
    const shot = await fresh({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      navigate: false,
    });
    const { page } = shot;
    const pending = new Map();
    const seen = [];
    try {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 400,
        downloadThroughput: 62500,
        uploadThroughput: 50000,
      });
      const noise =
        /google-analytics|googletagmanager|_vercel|sentry|doubleclick|facebook|hotjar|clarity|\/_next\/image|fonts\.g/i;
      page.on("request", (rq) => {
        if (["fetch", "xhr"].includes(rq.resourceType()) && !noise.test(rq.url())) {
          pending.set(rq, Date.now());
          if (!seen.includes(rq.url())) seen.push(rq.url());
        }
      });
      const done = (rq) => pending.delete(rq);
      page.on("requestfinished", done);
      page.on("requestfailed", done);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      let loaderSeen = false;
      let wasPending = false;
      for (let i = 0; i < 70; i++) {
        await page.waitForTimeout(300);
        if (pending.size) {
          wasPending = true;
          if (!loaderSeen)
            loaderSeen = await page
              .evaluate(
                (s) => [...document.querySelectorAll(s)].some((e) => window.__v3.vis(e)),
                LOADER,
              )
              .catch(() => false);
        } else if (i > 12 && wasPending) break;
        else if (i > 25) break;
      }
      if (!seen.length) return { fails: [], note: "no fetching areas found on this page" };
      const fails = [];
      if (wasPending && !loaderSeen)
        fails.push(
          fail(
            "no loading shape",
            `${seen.length} data request(s) show no skeleton or spinner while pending on slow 3G (first: ${seen[0].slice(0, 60)})`,
          ),
        );
      await shot.close();
      // pass 2: make the same requests fail and look for a plain-words error with a way out
      const blocked = await fresh({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        navigate: false,
      });
      await blocked.page.route("**/*", (route) => {
        const u = route.request().url();
        return seen.includes(u) ? route.abort() : route.continue();
      });
      await blocked.page.goto(url, { waitUntil: "load", timeout: 45000 }).catch(() => {});
      await blocked.page.waitForTimeout(2500);
      const err = await blocked.page.evaluate((re) => {
        const rx = new RegExp(re, "i");
        return [
          ...document.querySelectorAll(
            "[role=alert],[role=status],[class*=error i],[class*=fallback i],p,div",
          ),
        ].some(
          (e) =>
            window.__v3.vis(e) &&
            rx.test(e.innerText || "") &&
            (e.querySelector("a[href],button") ||
              e.closest("section,div")?.querySelector("a[href^=tel],a[href^=mailto],button")),
        );
      }, ERRORISH.source);
      await blocked.close();
      if (!err)
        fails.push(
          fail(
            "no error state",
            `when ${seen.length} data request(s) fail, no plain-words error with a fallback action appears`,
          ),
        );
      return { fails, note: `${seen.length} fetching requests tested` };
    } finally {
      await shot.close().catch(() => {});
    }
  },
};

export const C30 = {
  id: "C30",
  title: "feedback: visible response within 0.1 s, finished state within 0.4 s",
  viewport: "desktop",
  scope: "home",
  async run({ page }) {
    const r = await page.evaluate(async () => {
      const bad = [];
      let tested = 0;
      const ctrls = [
        ...document.querySelectorAll(
          "button[aria-expanded],[role=tab],summary,[aria-pressed],button[aria-controls]",
        ),
      ]
        .filter((e) => window.__v3.vis(e))
        .slice(0, 6);
      for (const el of ctrls) {
        tested++;
        const ms = await new Promise((res) => {
          const t0 = performance.now();
          const mo = new MutationObserver(() => {
            mo.disconnect();
            res(performance.now() - t0);
          });
          mo.observe(document.body, {
            subtree: true,
            attributes: true,
            childList: true,
            characterData: true,
          });
          el.click();
          setTimeout(() => {
            mo.disconnect();
            res(null);
          }, 700);
        });
        if (ms == null) bad.push(`${window.__v3.label(el)} shows no response`);
        else if (ms > 100) bad.push(`${window.__v3.label(el)} responds after ${Math.round(ms)} ms`);
      }
      for (const el of document.querySelectorAll("a,button,input,select,summary,[role=button]")) {
        if (!window.__v3.vis(el)) continue;
        const d = Math.max(
          ...getComputedStyle(el)
            .transitionDuration.split(",")
            .map((s) => parseFloat(s) * (/ms$/.test(s.trim()) ? 0.001 : 1)),
        );
        if (d > 0.4) bad.push(`${window.__v3.label(el)} takes ${d.toFixed(2)} s to finish`);
      }
      return { bad, tested };
    });
    return {
      fails: r.bad.map((t) => fail(t, t)),
      note: r.tested ? `${r.tested} controls timed` : "no toggle controls on the page to time",
    };
  },
};

export const C31 = {
  id: "C31",
  title: "text and hero never start hidden for a scroll reveal",
  viewport: "desktop",
  scope: "home",
  async run({ url, fresh }) {
    const s = await fresh({ viewport: { width: 1440, height: 900 }, navigate: true });
    try {
      const { page } = s;
      await page.waitForTimeout(500);
      const atLoad = await page.evaluate(HIDDEN_TEXT_JS);
      const aos = await page.evaluate(() =>
        [...document.querySelectorAll("[data-aos],[data-scroll-reveal],[data-reveal]")]
          .filter((e) => e.textContent.trim().length > 2)
          .map((e) => window.__v3.label(e)),
      );
      await scrollThrough(page);
      const stillHidden = await page.evaluate(HIDDEN_TEXT_JS);
      const revealed = atLoad.filter((l) => !stillHidden.includes(l));
      const items = [...new Set([...revealed, ...aos])];
      return {
        fails: items.map((t) => fail(t, `text starts hidden and reveals on scroll: ${t}`)),
        note: `${atLoad.length} hidden at load`,
      };
    } finally {
      await s.close();
    }
  },
};

export const C32 = {
  id: "C32",
  title: "no custom cursor, mouse-follow effects, magnetic buttons, blurred blobs",
  viewport: "desktop",
  async run({ page }) {
    await page.mouse.move(300, 300);
    await page.mouse.move(520, 400, { steps: 4 });
    const r = await page.evaluate(() => {
      const out = [];
      for (const m of new Set(window.__v3.moves))
        if (!/addHitTarget|UtilityScript|<anonymous>/.test(m))
          out.push(`mouse-move listener: ${m}`);
      for (const el of document.querySelectorAll("html,body,body *")) {
        const cs = getComputedStyle(el);
        if (/url\(/.test(cs.cursor)) out.push(`custom cursor on ${window.__v3.label(el)}`);
        const m = /blur\((\d+(?:\.\d+)?)px\)/.exec(cs.filter);
        const r = el.getBoundingClientRect();
        if (
          m &&
          parseFloat(m[1]) >= 24 &&
          r.width >= 80 &&
          !el.querySelector("img,video") &&
          el.tagName !== "IMG"
        )
          out.push(`blurred blob ${window.__v3.label(el)}`);
      }
      return out;
    });
    return { fails: r.map((t) => fail(t, t)) };
  },
};

export const C33 = {
  id: "C33",
  title: "reduced motion: nothing moves, nothing missing",
  viewport: "desktop",
  scope: "home",
  async run({ url, fresh }) {
    const s = await fresh({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
      navigate: true,
    });
    try {
      const { page } = s;
      await page.waitForTimeout(800);
      const motion = await page.evaluate(() => {
        const out = [];
        for (const a of document.getAnimations()) {
          const t = a.effect?.getComputedTiming?.();
          if (a.playState !== "running" || !t) continue;
          const el = a.effect.target;
          if (t.iterations === Infinity || t.duration > 100)
            out.push(`${a.constructor.name} moving on ${el ? window.__v3.label(el) : "page"}`);
        }
        for (const v of document.querySelectorAll("video"))
          if (!v.paused && !v.ended && window.__v3.vis(v))
            out.push(`video playing: ${v.currentSrc.slice(-30) || "inline"}`);
        return [...new Set(out)];
      });
      await scrollThrough(page);
      const missing = await page.evaluate(HIDDEN_TEXT_JS);
      const fails = [
        ...motion.map((t) => fail(t, `moves with reduced motion on: ${t}`)),
        ...missing.map((t) =>
          fail(`missing ${t}`, `text still hidden with reduced motion on: ${t}`),
        ),
      ];
      return { fails, note: "signature still version is a judgment item (critic panel)" };
    } finally {
      await s.close();
    }
  },
};

export const INTERACTION = [C21, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33];
