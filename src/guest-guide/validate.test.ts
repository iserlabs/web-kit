import { describe, expect, it } from "vitest";
import type { GuestGuide } from "./types";
import { validateGuide } from "./validate";

const TODAY = "2026-10-23";
const s = (value: string) => ({ value, source: "test fixture", checked: "2026-10-20" });

function firstItem(g: GuestGuide) {
  const item = g.sections[0]?.items[0];
  if (!item) throw new Error("fixture has no first item");
  return item;
}

function firstPick(g: GuestGuide) {
  const pick = g.nearby[0];
  if (!pick) throw new Error("fixture has no first pick");
  return pick;
}

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
    firstItem(g).body = `Thermostat${String.fromCharCode(0x2014)}hall`;
    expect(validateGuide(g, { today: TODAY })).toContain(
      "sections.0.items.0.body: contains an em dash",
    );
  });

  it("rejects a code-shaped number next to an entry word", () => {
    const g = validGuide();
    firstItem(g).body = "The lockbox code is 4821.";
    expect(validateGuide(g, { today: TODAY })).toContain(
      "sections.0.items.0.body: looks like an entry code",
    );
  });

  it("does not mistake a phone number for a code", () => {
    const g = validGuide();
    firstItem(g).body = "If the keypad is dead, call (719) 555-0100.";
    expect(validateGuide(g, { today: TODAY })).toEqual([]);
  });

  it("requires Wi-Fi and entry steps", () => {
    const g = validGuide();
    g.wifi.password = s("");
    g.entry.steps = { value: [], source: "x", checked: "2026-10-20" };
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain("wifi.password: empty");
    expect(problems).toContain("entry.steps: needs at least one step");
  });

  it("accepts a guide with no phone, and requires a contact label", () => {
    const g = validGuide();
    g.contact = {
      label: "Message us in your booking app, we answer any hour",
      source: "owner ruling",
      checked: "2026-10-20",
    };
    expect(validateGuide(g, { today: TODAY })).toEqual([]);
    g.contact.label = " ";
    expect(validateGuide(g, { today: TODAY })).toContain("contact.label: empty");
  });

  it("rejects a phone that is present but blank", () => {
    const g = validGuide();
    g.contact.phone = " ";
    expect(validateGuide(g, { today: TODAY })).toContain("contact.phone: empty");
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
    firstPick(g).url = "http://example.com";
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

  it("flags code-shaped numbers in their varied forms", () => {
    for (const body of [
      "The lockbox code is 4821.",
      "The code is 4-8-2-1",
      "code is 48 21",
      "Garage keypad: 556677",
      "pin 4.8.2.1",
    ]) {
      const g = validGuide();
      firstItem(g).body = body;
      expect(validateGuide(g, { today: TODAY }), body).toContain(
        "sections.0.items.0.body: looks like an entry code",
      );
    }
  });

  it("does not flag zip codes, years, phones, urls, sources or Wi-Fi values", () => {
    for (const body of [
      "Zip code 80903",
      "Updated PIN system in 2026",
      "If the keypad is dead, call (719) 555-0100.",
      "keypad, call 719 5550100",
    ]) {
      const g = validGuide();
      firstItem(g).body = body;
      expect(validateGuide(g, { today: TODAY }), body).toEqual([]);
    }
    const g = validGuide();
    g.wifi.network = s("code-net");
    g.wifi.password = s("12345678");
    firstItem(g).source = "Hospitable field code 12345";
    firstPick(g).url = "https://x.com/?code=12345";
    expect(validateGuide(g, { today: TODAY })).toEqual([]);
  });

  it("rejects an exclamation mark in guest copy but not in Wi-Fi values or urls", () => {
    const g = validGuide();
    firstItem(g).body = "Welcome!";
    g.wifi.password = s("pass!word");
    firstPick(g).url = "https://x.com/a!b";
    expect(validateGuide(g, { today: TODAY })).toEqual([
      "sections.0.items.0.body: contains an exclamation mark",
    ]);
  });

  it("requires 12-hour check-in and check-out times", () => {
    const g = validGuide();
    g.checkIn = s("16:00");
    g.checkOut = s("10 AM");
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain('checkIn: "16:00" is not a 12-hour time like 4:00 PM');
    expect(problems).toContain('checkOut: "10 AM" is not a 12-hour time like 4:00 PM');
  });

  it("rejects dates that do not exist", () => {
    const g = validGuide();
    g.parking = { value: "Driveway", source: "x", checked: "2026-02-30" };
    g.checkIn = { value: "4:00 PM", source: "x", checked: "2026-13-45" };
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain('parking: checked "2026-02-30" is not a real date');
    expect(problems).toContain('checkIn: checked "2026-13-45" is not a real date');
  });

  it("requires an https map link", () => {
    const g = validGuide();
    g.address.mapUrl = "http://maps.google.com";
    expect(validateGuide(g, { today: TODAY })).toContain(
      "address.mapUrl: must start with https://",
    );
  });

  it("stops the code window at a sentence boundary and ignores local phones", () => {
    for (const body of [
      "Use the keypad. Parking at 1204 Elm St.",
      "If the keypad is dead, call 555-0100.",
      "Check the PIN pad. Quiet hours start 10.20 PM",
    ]) {
      const g = validGuide();
      firstItem(g).body = body;
      expect(validateGuide(g, { today: TODAY }), body).toEqual([]);
    }
  });

  it("still flags a code before the end of its sentence, and one after a year", () => {
    for (const body of [
      "The keypad code is 4821. Parking is out front.",
      "Keypad installed in 2026, use 4821",
    ]) {
      const g = validGuide();
      firstItem(g).body = body;
      expect(validateGuide(g, { today: TODAY }), body).toContain(
        "sections.0.items.0.body: looks like an entry code",
      );
    }
  });

  it("reports an em dash in a source, url, map link or photo path", () => {
    const dash = String.fromCharCode(0x2014);
    const g = validGuide();
    firstItem(g).source = `WhatsApp${dash}Anthony`;
    firstPick(g).url = `https://x.com/a${dash}b`;
    g.address.mapUrl = `https://maps.google.com/${dash}`;
    g.photos[0] = {
      src: `/a${dash}b.jpg`,
      alt: "Living room",
      room: "Living room",
      width: 2400,
      height: 1600,
    };
    const problems = validateGuide(g, { today: TODAY });
    expect(problems).toContain("sections.0.items.0.source: contains an em dash");
    expect(problems).toContain("nearby.0.url: contains an em dash");
    expect(problems).toContain("address.mapUrl: contains an em dash");
    expect(problems).toContain("photos.0.src: contains an em dash");
  });
});
