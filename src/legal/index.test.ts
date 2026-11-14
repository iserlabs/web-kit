import { describe, expect, it } from "vitest";
import { hasCookieConsent, legalText, privacyPolicy, termsAndConditions, type LegalConfig } from "./index";

const base: LegalConfig = {
  brand: "Example Stays",
  legalName: "Example Stays LLC",
  domain: "example.com",
  email: "hello@example.com",
  state: "New Jersey",
  effective: "November 13, 2026",
};

const all = (c: LegalConfig) => legalText(privacyPolicy(c)) + legalText(termsAndConditions(c));

describe("legal pages", () => {
  it("never prints an em dash, a placeholder or an undefined", () => {
    const text = all({ ...base, formFields: "your name and email", bookingEngine: "Guesty", textMessages: true, analytics: { consentCookies: ["Google Analytics"] } });
    expect(text).not.toMatch(/—|undefined|\{|\}|TODO|\[/);
  });
  it("shows no cookie notice language without tracking cookies", () => {
    expect(hasCookieConsent(base)).toBe(false);
    expect(legalText(privacyPolicy(base))).toContain("sets no advertising or tracking cookies");
  });
  it("describes consent and GPC when tracking cookies exist", () => {
    const c = { ...base, analytics: { consentCookies: ["Google Analytics", "Meta Pixel"], advertising: true } };
    const t = legalText(privacyPolicy(c));
    expect(hasCookieConsent(c)).toBe(true);
    expect(t).toContain("Google Analytics and Meta Pixel also record");
    expect(t).toContain("Global Privacy Control");
    expect(t).toContain("Cookie settings");
  });
  it("adds the carrier text line only when the site texts people", () => {
    expect(legalText(privacyPolicy(base))).not.toContain("STOP");
    expect(legalText(privacyPolicy({ ...base, textMessages: true }))).toContain("never shared with third parties or affiliates for their marketing");
  });
  it("defers health information to the practice notice", () => {
    expect(legalText(privacyPolicy({ ...base, healthcare: true }))).toContain("Notice of Privacy Practices");
  });
  it("governs by the configured state and caps site liability", () => {
    const t = legalText(termsAndConditions({ ...base, state: "Colorado" }));
    expect(t).toContain("laws of the State of Colorado");
    expect(t).toContain("one hundred dollars ($100)");
  });
  it("opens with a short summary of promises that match the facts", () => {
    const none = privacyPolicy(base).summary;
    expect(none.length).toBeGreaterThanOrEqual(4);
    expect(none.length).toBeLessThanOrEqual(6);
    expect(none).toContain("No tracking or advertising cookies.");
    const ads = privacyPolicy({ ...base, bookingEngine: "Guesty", textMessages: true, analytics: { consentCookies: ["Meta Pixel"], advertising: true } }).summary;
    expect(ads).toContain("Analytics and advertising cookies load only if you say yes.");
    expect(ads.join(" ")).toContain("Payments run through Guesty");
    expect(termsAndConditions(base).summary).toContain("New Jersey law applies.");
  });
  it("tabulates what is collected, with every row as wide as the header", () => {
    const t = privacyPolicy({ ...base, formFields: "your name and email", bookingEngine: "Guesty", analytics: { consentCookies: ["Google Analytics"] } })
      .sections.find((s) => s.id === "collect")?.table;
    expect(t?.columns).toHaveLength(5);
    for (const r of t?.rows ?? []) expect(r).toHaveLength(5);
    expect(t?.rows.map((r) => r[0])).toEqual(["What you send us", "Booking details", "Payment card", "Visit data", "Analytics"]);
  });
  it("gives every section a unique anchor id", () => {
    for (const doc of [privacyPolicy(base), termsAndConditions(base)]) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("names the brand once when there is no separate entity", () => {
    const t = privacyPolicy({ ...base, legalName: "Example Stays" }).intro;
    expect(t).toContain("the website of Example Stays (");
  });
});
