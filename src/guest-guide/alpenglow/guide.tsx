/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { GuideBrand } from "../brand";
import { brandCss } from "../brand";
import { planDay } from "../day";
import type { Plan } from "../plan";
import { PHONE_WIDTH } from "../plan";
import { BEHAVIOR_JS } from "./behavior";
import { Chapter } from "./chapter";
import { Cover } from "./cover";
import { DayBody, Rail } from "./day";
import { Help } from "./help";
import { defaultImage, type ImageUrl, identityUrl, type RenderImage } from "./image";
import { QuickFind } from "./quick-find";
import { DAY_CSS, RAIL_CSS, RAIL_JS } from "./rail";
import { ALPENGLOW_CSS } from "./styles";

/** v1 wording for the copy announcements (Sun Mountain copy-button.tsx). */
const SAID_COPIED = "Wi-Fi password copied.";
const SAID_BLOCKED = "Copy is blocked on this device. The password is {password}.";

export type AlpenglowGuideProps = {
  plan: Plan;
  brand: GuideBrand;
  /** A site's image renderer (next/image); the default is a plain <img> with srcset. */
  renderImage?: RenderImage;
  /** The URL of a photo at a width; must match what renderImage offers. */
  imageUrl?: ImageUrl;
  /** The CSP nonce for the inline style and script (Palisade). */
  nonce?: string;
  /** Where the kit service worker is served, and its scope. Omit both and the guide never saves itself. */
  serviceWorker?: { url: string; scope: string };
  /** The page path the worker saves; default: the page's own path at run time. */
  page?: string;
  /**
   * The body under the cover. "chapters" (default): the quick find, then the chapters.
   * "day": the Day rail (body board round 2, picked 2026-11-19) with the bottom rail.
   */
  body?: "chapters" | "day";
};

/**
 * The Alpenglow guest guide. A server component: no state, no effects, no
 * fetch. The only script is the inline behavior (Copy and the offline save).
 */
export function AlpenglowGuide({
  plan,
  brand,
  renderImage,
  imageUrl = identityUrl,
  nonce,
  serviceWorker,
  page,
  body = "chapters",
}: AlpenglowGuideProps) {
  const render = renderImage ?? defaultImage(imageUrl);
  const day = body === "day" ? planDay(plan, plan.day) : undefined;
  const css = `${brandCss(brand)}${ALPENGLOW_CSS}${day ? `${DAY_CSS}${RAIL_CSS}` : ""}`;
  // The day body shows fewer photos; the worker saves only what the page shows.
  const hidden = new Set(day?.dropped.map((p) => imageUrl(p.src, PHONE_WIDTH)));
  const offline = plan.offlineUrls.filter((u) => !hidden.has(u));
  return (
    <div
      className="gg"
      data-brand={brand.id}
      data-copied={plan.copy.labels.copied?.text ?? "Copied"}
      data-said-copied={SAID_COPIED}
      data-said-blocked={SAID_BLOCKED}
      data-sw={serviceWorker?.url}
      data-sw-scope={serviceWorker?.scope}
      data-page={page}
      data-body={day ? "day" : undefined}
      data-offline={serviceWorker ? JSON.stringify(offline) : undefined}
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: kit-owned CSS string; brand values are checked by brandCss */}
      <style nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />
      <noscript>
        <style nonce={nonce}>{".gg .copy{display:none}"}</style>
      </noscript>
      <a className="skip" href="#main">
        Skip to the guide
      </a>
      <p id="gg-status" className="vh" role="status" aria-live="polite" />
      <Cover cover={plan.cover} brand={brand} imageUrl={imageUrl} id={day ? "cover" : undefined} />
      <main id="main">
        {day ? (
          <DayBody plan={plan} day={day} brand={brand} render={render} />
        ) : (
          <>
            <QuickFind quickFind={plan.quickFind} />
            {plan.chapters.map((c) => (
              <Chapter key={c.id} c={c} render={render} />
            ))}
            <Help plan={plan} brand={brand} render={render} />
          </>
        )}
      </main>
      {day ? <Rail stops={day.stops} /> : null}
      <script
        nonce={nonce}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: kit-owned inline script, no guest data
        dangerouslySetInnerHTML={{ __html: day ? `${BEHAVIOR_JS}\n${RAIL_JS}` : BEHAVIOR_JS }}
      />
    </div>
  );
}
