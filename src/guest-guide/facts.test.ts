import { describe, expect, it } from "vitest";
import { factsMarkdown, factsTable } from "./facts";
import type { GuestGuide } from "./types";

const s = (value: string) => ({ value, source: "Hospitable details", checked: "2026-10-20" });
const guide: GuestGuide = {
  slug: "t",
  name: "1 Test St",
  address: {
    value: { street: "1 Test St", city: "Colorado Springs", state: "CO", zip: "80903" },
    source: "Ops Hub",
    checked: "2026-10-20",
    mapUrl: "https://maps.google.com",
  },
  checkIn: s("4:00 PM"),
  checkOut: s("10:00 AM"),
  entry: {
    lock: s("Keypad"),
    steps: { value: ["Enter code", "Press lock"], source: "Hospitable", checked: "2026-10-20" },
    codeDelivery: s("Check-in message"),
  },
  parking: s("Driveway"),
  wifi: { network: s("Net"), password: s("pw-123-abc") },
  contact: { label: "Text us", phone: "(719) 555-0100", source: "site", checked: "2026-10-20" },
  sections: [
    {
      id: "house",
      title: "The house",
      items: [
        {
          label: "Heat",
          body: "Hall thermostat.",
          source: "WhatsApp, Anthony",
          checked: "2026-10-18",
        },
      ],
    },
  ],
  nearby: [
    {
      name: "Shop",
      kind: "grocery",
      note: "Closest",
      url: "https://e.com",
      hours: "7 AM to 10 PM",
      source: "e.com",
      checked: "2026-10-22",
    },
  ],
  photos: [],
};

describe("factsTable", () => {
  it("lists every sourced value with where it lives", () => {
    const rows = factsTable(guide);
    expect(rows).toContainEqual({
      claim: "4:00 PM",
      where: "checkIn",
      source: "Hospitable details",
      checked: "2026-10-20",
    });
    expect(rows).toContainEqual({
      claim: "Enter code; Press lock",
      where: "entry.steps",
      source: "Hospitable",
      checked: "2026-10-20",
    });
    expect(rows).toContainEqual({
      claim: "1 Test St, Colorado Springs, CO 80903",
      where: "address",
      source: "Ops Hub",
      checked: "2026-10-20",
    });
    expect(rows).toContainEqual({
      claim: "Heat: Hall thermostat.",
      where: "sections.house.Heat",
      source: "WhatsApp, Anthony",
      checked: "2026-10-18",
    });
    expect(rows).toContainEqual({
      claim: "Shop (7 AM to 10 PM)",
      where: "nearby.grocery",
      source: "e.com",
      checked: "2026-10-22",
    });
  });

  it("renders a markdown table with a header", () => {
    const md = factsMarkdown(guide);
    expect(md.split("\n")[0]).toBe("| claim | where | source | checked |");
    expect(md).toContain("| 4:00 PM | checkIn | Hospitable details | 2026-10-20 |");
  });

  it("adds rows for the map link, the contact, and each pick's note and distance", () => {
    const g: GuestGuide = {
      ...guide,
      nearby: [
        ...guide.nearby,
        {
          name: "Park",
          kind: "park",
          note: "Swings",
          url: "https://p.com",
          distance: "6 min drive",
          source: "p.com",
          checked: "2026-10-21",
        },
      ],
    };
    const rows = factsTable(g);
    expect(rows).toContainEqual({
      claim: "https://maps.google.com",
      where: "address.mapUrl",
      source: "Ops Hub",
      checked: "2026-10-20",
    });
    expect(rows).toContainEqual({
      claim: "Text us: (719) 555-0100",
      where: "contact",
      source: "site",
      checked: "2026-10-20",
    });
    expect(rows.some((r) => r.where === "contact.phone")).toBe(false);
    expect(rows).toContainEqual({
      claim: "Closest",
      where: "nearby.grocery.Shop.note",
      source: "e.com",
      checked: "2026-10-22",
    });
    expect(rows).toContainEqual({
      claim: "Park",
      where: "nearby.park",
      source: "p.com",
      checked: "2026-10-21",
    });
    expect(rows).toContainEqual({
      claim: "6 min drive",
      where: "nearby.park.Park.distance",
      source: "p.com",
      checked: "2026-10-21",
    });
    expect(rows.some((r) => r.where === "nearby.grocery.Shop.distance")).toBe(false);
  });

  it("adds a door row when there is a door", () => {
    const rows = factsTable({ ...guide, door: s("Left door") });
    expect(rows).toContainEqual({
      claim: "Left door",
      where: "door",
      source: "Hospitable details",
      checked: "2026-10-20",
    });
  });

  it("names a pick with no hours by its name alone", () => {
    const g: GuestGuide = {
      ...guide,
      nearby: [
        {
          name: "Park",
          kind: "park",
          note: "Swings",
          url: "https://p.com",
          source: "p.com",
          checked: "2026-10-21",
        },
      ],
    };
    expect(factsTable(g)).toContainEqual({
      claim: "Park",
      where: "nearby.park",
      source: "p.com",
      checked: "2026-10-21",
    });
  });

  it("escapes pipes and flattens newlines in every cell", () => {
    const g: GuestGuide = {
      ...guide,
      parking: { value: "A | B\nC", source: "x|y", checked: "2026-10-20" },
    };
    const lines = factsMarkdown(g).split("\n");
    expect(lines.find((l) => l.includes("| parking |"))).toBe(
      "| A \\| B C | parking | x\\|y | 2026-10-20 |",
    );
    expect(lines).toHaveLength(factsTable(g).length + 2);
  });

  it("writes the contact row without a phone", () => {
    const g: GuestGuide = {
      ...guide,
      contact: { label: "Message us in your booking app", source: "owner", checked: "2026-10-20" },
    };
    expect(factsTable(g).filter((r) => r.where.startsWith("contact"))).toEqual([
      {
        claim: "Message us in your booking app",
        where: "contact",
        source: "owner",
        checked: "2026-10-20",
      },
    ]);
  });
});
