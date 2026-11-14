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
  it("names the brand once when there is no separate entity", () => {
    const t = privacyPolicy({ ...base, legalName: "Example Stays" }).intro;
    expect(t).toContain("the website of Example Stays (");
  });
});
