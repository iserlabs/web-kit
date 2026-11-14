// The visitor's cookie choice, shared by the notice and by whatever loads analytics or ad pixels.
// Framework-free. Only a site whose LegalConfig lists `analytics.consentCookies` uses it; a site
// with no tracking cookies shows no notice at all.
//
// Behavior every site keeps:
// 1) Nothing that sets a tracking cookie loads until the choice is "granted".
// 2) A Global Privacy Control signal counts as "denied" and the notice never shows.
// 3) Accept and Decline are equal buttons; the notice is a small bar, never a modal.
// 4) The footer carries a "Cookie settings" link that calls `openConsentSettings()`.

export type ConsentChoice = "granted" | "denied";

export const CONSENT_KEY = "wk-consent";
export const CONSENT_EVENT = "wk:consent";
export const CONSENT_OPEN_EVENT = "wk:consent-open";

const hasWindow = (): boolean => typeof window !== "undefined";

export function gpcEnabled(): boolean {
  if (!hasWindow()) return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/** The stored choice, "denied" under GPC, or null when the visitor has not chosen yet. */
export function getConsent(): ConsentChoice | null {
  if (!hasWindow()) return null;
  if (gpcEnabled()) return "denied";
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Storage blocked: the choice holds for this page view only, which is the safe direction.
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
}

/** Runs `load` once, now if consent is already granted, otherwise the moment it is. */
export function onConsentGranted(load: () => void): () => void {
  if (!hasWindow()) return () => {};
  let done = false;
  const run = () => {
    if (!done) {
      done = true;
      load();
    }
  };
  if (getConsent() === "granted") {
    run();
    return () => {};
  }
  const handler = (e: Event) => {
    if ((e as CustomEvent<ConsentChoice>).detail === "granted") run();
  };
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

/** The notice should show: no choice yet and no GPC signal. */
export function needsConsentNotice(): boolean {
  return getConsent() === null;
}

/** Called by the footer's "Cookie settings" link to bring the notice back. */
export function openConsentSettings(): void {
  if (!hasWindow()) return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/** Notice wording, identical on every site. */
export const CONSENT_COPY = {
  message: "We use cookies to see how visitors use this site. Nothing loads unless you accept.",
  messageAds: "We use cookies to see how visitors use this site and to measure our ads. Nothing loads unless you accept.",
  accept: "Accept",
  decline: "Decline",
  policy: "Privacy Policy",
  settings: "Cookie settings",
} as const;
