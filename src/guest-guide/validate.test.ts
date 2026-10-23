import { describe, expect, it } from "vitest";
import type { GuestGuide } from "./types";
import { validateGuide } from "./validate";

const TODAY = "2026-10-23";
const s = (value: string) => ({ value, source: "test fixture", checked: "2026-10-20" });

function validGuide(): GuestGuide {
  return {
    slug: "test-house",
    name: "1 Test St",
    address: {
      value: { street: "1 Test St", city: "Colorado Springs", state: "CO", zip: "80903" },
      source: "test fixture",
      checked: "2026-10-20",
      mapUrl: "https://maps.google.com/?q=1+Test+St",
    },
    checkIn: s("4:00 PM"),
    checkOut: s("10:00 AM"),
    entry: {
      lock: s("Keypad on the front door"),
      steps: {
        value: ["Enter your code", "Press the lock button"],
        source: "test fixture",
        checked: "2026-10-20",
      },
      codeDelivery: s("Your code arrives in your check-in message"),
    },
    parking: s("Driveway, two cars"),
    wifi: { network: s("TestNet"), password: s("hello-world-22") },
    contact: {
      label: "Text us",
      phone: "(719) 555-0100",
      source: "test fixture",
      checked: "2026-10-20",
    },
    sections: [
      {
        id: "house",
        title: "The house",
        items: [
          {
            label: "Heat",
            body: "Thermostat in the hall.",
            source: "test fixture",
            checked: "2026-10-20",
          },
        ],
      },
    ],
    nearby: [
      {
        name: "Shop",
        kind: "grocery",
        note: "Closest grocery",
        url: "https://example.com",
        source: "example.com",
        checked: "2026-10-20",
      },
    ],
    photos: [
      {
        src: "/guides/test-house/living.jpg",
        alt: "Living room",
        room: "Living room",
        width: 2400,
        height: 1600,
      },
    ],
  };
}

describe("validateGuide", () => {
  it("passes a complete guide", () => {
    expect(validateGuide(validGuide(), { today: TODAY })).toEqual([]);
  });

  it("rejects a bad slug", () => {
    const g = { ...validGuide(), slug: "Test House" };
    expect(validateGuide(g, { today: TODAY })).toContain(
      'slug: "Test House" is not lowercase-hyphenated',
    );
  });

  it("rejects a fact with no source", () => {
    const g = validGuide();
    g.parking = { value: "Driveway", source: "", checked: "2026-10-20" };
    expect(validateGuide(g, { today: TODAY })).toContain("parking: no source");
  });

  it("rejects a checked date that is not YYYY-MM-DD or is in the future", () => {
    const g = validGuide();
    g.checkIn = { value: "4:00 PM", source: "x", checked: "10/20/2026" };
    g.checkOut = { value: "10:00 AM", source: "x", checked: "2026-11-01" };
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain('checkIn: checked "10/20/2026" is not YYYY-MM-DD');
    expect(problems).toContain('checkOut: checked "2026-11-01" is after today');
  });

  it("rejects an em dash anywhere", () => {
    const g = validGuide();
    g.sections[0]!.items[0]!.body = `Thermostat${String.fromCharCode(0x2014)}hall`;
    expect(validateGuide(g, { today: TODAY })).toContain(
      "sections.0.items.0.body: contains an em dash",
    );
  });

  it("rejects a code-shaped number next to an entry word", () => {
    const g = validGuide();
    g.sections[0]!.items[0]!.body = "The lockbox code is 4821.";
    expect(validateGuide(g, { today: TODAY })).toContain(
      "sections.0.items.0.body: looks like an entry code",
    );
  });

  it("does not mistake a phone number for a code", () => {
    const g = validGuide();
    g.sections[0]!.items[0]!.body = "If the keypad is dead, call (719) 555-0100.";
    expect(validateGuide(g, { today: TODAY })).toEqual([]);
  });

  it("requires Wi-Fi, entry steps and a contact phone", () => {
    const g = validGuide();
    g.wifi.password = s("");
    g.entry.steps = { value: [], source: "x", checked: "2026-10-20" };
    g.contact.phone = "";
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain("wifi.password: empty");
    expect(problems).toContain("entry.steps: needs at least one step");
    expect(problems).toContain("contact.phone: empty");
  });

  it("rejects duplicate or empty sections", () => {
    const g = validGuide();
    g.sections.push({ id: "house", title: "Again", items: [] });
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain('sections: duplicate id "house"');
    expect(problems).toContain("sections.1: has no items");
  });

  it("rejects a nearby pick without an https link", () => {
    const g = validGuide();
    g.nearby[0]!.url = "http://example.com";
    expect(validateGuide(g, { today: TODAY })).toContain(
      'nearby.0: url must start with https:// ("Shop")',
    );
  });

  it("rejects a small photo or one with no alt text", () => {
    const g = validGuide();
    g.photos.push({ src: "/x.jpg", alt: "", room: "Kitchen", width: 1200, height: 800 });
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain("photos.1: no alt text");
    expect(problems).toContain("photos.1: long side 1200 px is under 2000 px");
  });
});
