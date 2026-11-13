/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { GuideBrand } from "../brand";
import { brandCss } from "../brand";
import type { Plan } from "../plan";
import { BEHAVIOR_JS } from "./behavior";
import { Chapter } from "./chapter";
import { Cover } from "./cover";
import { Help } from "./help";
import { defaultImage, type ImageUrl, identityUrl, type RenderImage } from "./image";
import { QuickFind } from "./quick-find";
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
}: AlpenglowGuideProps) {
  const render = renderImage ?? defaultImage(imageUrl);
  const css = `${brandCss(brand)}${ALPENGLOW_CSS}`;
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
      data-offline={serviceWorker ? JSON.stringify(plan.offlineUrls) : undefined}
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
      <Cover cover={plan.cover} brand={brand} imageUrl={imageUrl} />
      <main id="main">
        <QuickFind quickFind={plan.quickFind} />
        {plan.chapters.map((c) => (
          <Chapter key={c.id} c={c} render={render} />
        ))}
        <Help plan={plan} brand={brand} render={render} />
      </main>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: kit-owned inline script, no guest data */}
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BEHAVIOR_JS }} />
    </div>
  );
}
