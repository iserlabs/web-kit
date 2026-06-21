import { describe, expect, it } from "vitest";
import { breadcrumb, faq, lodgingBusiness, organization } from "./index";

describe("schema builders", () => {
  it("organization includes context, type and optional fields", () => {
    const o = organization({
      name: "Acme",
      url: "https://acme.com",
      sameAs: ["https://x.com/acme"],
    });
    expect(o["@context"]).toBe("https://schema.org");
    expect(o["@type"]).toBe("Organization");
    expect(o.sameAs).toEqual(["https://x.com/acme"]);
  });

  it("breadcrumb numbers positions from 1", () => {
    const b = breadcrumb([
      { name: "Home", url: "https://x.com/" },
      { name: "Rooms", url: "https://x.com/rooms" },
    ]);
    const items = b.itemListElement as Array<{ position: number; name: string }>;
    expect(items[0]?.position).toBe(1);
    expect(items[1]?.position).toBe(2);
  });

  it("faq maps questions to accepted answers", () => {
    const f = faq([{ question: "Pets?", answer: "Yes." }]);
    const main = f.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(main[0]?.name).toBe("Pets?");
    expect(main[0]?.acceptedAnswer.text).toBe("Yes.");
  });

  it("lodgingBusiness maps the postal address", () => {
    const l = lodgingBusiness({
      name: "Inn",
      url: "https://inn.com",
      address: { street: "1 Main", city: "Town", region: "CO", postalCode: "80001", country: "US" },
    });
    const addr = l.address as Record<string, string>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.addressLocality).toBe("Town");
  });
});
