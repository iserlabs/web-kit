import { describe, expect, it } from "vitest";
import { factsMarkdown, factsTable } from "./facts";
import type { GuestGuide } from "./types";

const s = (value: string) => ({ value, source: "Hospitable details", checked: "2026-10-20" });
const guide = {
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
} satisfies GuestGuide;

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
});
