import type { HeldLine } from "../copy";
import type { GuideModel, ItemV2 } from "../model";

/**
 * Fixture: the building on the approved Alpenglow board (d2-s3). Facts high in
 * the sky in navy, the opposite of the low cover. Live wording verbatim; the
 * Wi-Fi values are fixture strings of the real lengths (public repo).
 */
const SHEET = "guide sheet, 2026-10-27";
const C = "2026-10-27";
const it = (label: string, body: string, extra: Partial<ItemV2> = {}): ItemV2 => ({
  label,
  body,
  source: SHEET,
  checked: C,
  ...extra,
});
const held = (at: HeldLine["at"], text: string): HeldLine => ({
  at,
  text,
  why: "Alpenglow board wording",
  writtenBy: "guide v2 board",
  writtenOn: "2026-11-11",
});

export const columbus52Fixture: GuideModel = {
  slug: "52-cottage",
  name: "52 Cottage Street",
  address: {
    value: { street: "52 Cottage Street", city: "Middletown", state: "NY", zip: "10940" },
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=52%20Cottage%20Street%2C%20Middletown%2C%20NY%2010940",
    source: SHEET,
    checked: C,
  },
  checkIn: { value: "4:00 PM", source: SHEET, checked: C },
  checkOut: { value: "10:00 AM", source: SHEET, checked: C },
  entry: {
    lock: {
      value: "Two keypad doors: the main entrance, then your room.",
      source: SHEET,
      checked: C,
    },
    steps: {
      value: [
        "From the parking lot across the street, walk to the entrance marked 52. It is at street level. Enter the building code on the keypad. The whole building shares one code.",
        "Take the stairs to your floor. There is no elevator.",
        "At your room door, enter your own room code on its keypad.",
        "If a code does not work, message us in your booking app. A wrong code puts the lock on a short timeout. We check the name and phone number on your registration against the reservation, then send you both codes again.",
        "A door can always be opened from the inside.",
      ],
      source: SHEET,
      checked: C,
    },
    codeDelivery: {
      value:
        "Both codes, the building code and your room code, arrive in our check-in message after you finish the guest registration form. No form, no codes. The message comes to your booking app, or by email if you booked on Expedia or direct. We send it at 12:00 PM on your check-in day, or the minute you submit the form if you finish it after that. The codes work from 4:00 PM on your check-in day. Airbnb's own door-lock message shows only the room code, so use our message for the building code.",
      source: `${SHEET}; check-in message audit, 2026-10-20`,
      checked: C,
    },
  },
  parking: {
    value:
      "A free guest lot sits directly across the street, signed 53-55 Cottage Parking Lot, with about 18 spaces. Take your room's marked space if it has one, otherwise any open space. The lot has a security gate. The gate code comes in your check-in message, and the gate opens by itself when you drive out. Free street parking is also around the building, subject to City rules. Tickets and tows are the guest's.",
    source: SHEET,
    checked: C,
  },
  wifi: {
    kind: "printed",
    network: { value: "52 Fixture St.", source: "fixture value", checked: C },
    password: { value: "Fixture52", source: "fixture value", checked: C },
  },
  contact: {
    label: "Message us in your booking app first. The hotel has no front desk and no one on site.",
    source: SHEET,
    checked: C,
  },
  sections: [
    {
      id: "first-hour",
      title: "Settling in",
      items: [
        it(
          "Heat and cooling",
          "Most rooms have a wall-mounted mini-split with a remote. Room 406 has a space heater instead. Use the remote for temperature and on or off. Keep the windows closed while it runs. If your room is too warm or too cold, message us in your booking app.",
        ),
        it(
          "Towels",
          "Each room starts with 2 bath towels, 1 hand towel and 2 washcloths. Ask us for extra towels at no charge for a normal request.",
        ),
      ],
    },
    {
      id: "house",
      title: "The rooms",
      items: [
        it(
          "Stairs only",
          "There is no elevator. Rooms 201 to 204 are on the second floor, one flight up. Rooms 301 to 304 are on the third floor, two flights up. Rooms 402 and 406 are on the fourth floor, three flights up.",
        ),
        it("Kitchenette", "Every room has a kitchenette except 406, which has none."),
      ],
    },
    {
      id: "rules",
      title: "House rules",
      intro: "No smoking or vaping anywhere on the property, indoors or out.",
      items: [
        it(
          "Quiet hours",
          "Quiet hours are 9:00 PM to 8:00 AM. Both buildings have permanent residents. No amplified music at any time.",
        ),
        it(
          "Pets",
          "No pets. A trained service animal for a person with a disability is not a pet and is welcome at no fee. Tell us before you arrive.",
        ),
      ],
    },
    {
      id: "checkout",
      title: "Checkout",
      items: [
        it("Towels", "Put used towels in the tub or shower."),
        it("Door", "Pull the door shut behind you. It locks itself. There are no keys to return."),
      ],
    },
    {
      id: "help",
      title: "Help",
      items: [
        it(
          "Hospital",
          "The nearest hospital on file is Garnet Health Medical Center in Middletown.",
        ),
      ],
    },
  ],
  tables: [],
  nearby: [],
  photos: [
    {
      src: "img/d2-col-cover-tall.jpg",
      alt: "The view off a balcony at 52 Cottage Street: an iron railing, a cushioned chair, and Cottage Street under a summer sky",
      room: "Balcony view",
      width: 745,
      height: 1331,
    },
    {
      src: "img/hero-1.jpg",
      alt: "The brick facade at dusk",
      room: "Exterior",
      width: 2400,
      height: 1600,
      ai: true,
    },
  ],
  look: {
    cover: {
      kind: "photo",
      src: "img/d2-col-cover-tall.jpg",
      focus: { portrait: "45% 0%", landscape: "50% 40%" },
      layout: "high",
      nameInk: "ink",
      factsInk: "ink",
      shade: { from: 0.6, max: 0.35 },
      measured: { on: "2026-11-11", worstName: 7.16, worstFacts: 7.16, tool: "design-check" },
      portrait: { src: "img/d2-col-cover-tall.jpg", width: 745, height: 1331 },
      wide: { src: "img/d2-col-cover-wide.jpg", width: 2000, height: 1331 },
    },
    readFirst: "house.stairs-only",
    plates: { house: "img/hero-1.jpg" },
  },
  drafts: [
    held({ kind: "chapter-head", chapter: "arrival" }, "How do we get in?"),
    held({ kind: "chapter-head", chapter: "help" }, "Need us?"),
    held(
      { kind: "cover-line", row: "door" },
      "Two keypad doors: the main entrance, then your room. No form, no codes.",
    ),
    held({ kind: "cover-line", row: "parking" }, "Free guest lot directly across the street"),
    held({ kind: "subhead", chapter: "arrival", group: "parking" }, "Where do we park?"),
  ],
};
