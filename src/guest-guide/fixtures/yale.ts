import type { HeldLine } from "../copy";
import type { GuideModel, ItemV2 } from "../model";

/**
 * Fixture: the house on the approved Alpenglow board (d2-s1, d2-s2). The
 * wording is the live guide's own, verbatim; the held lines in `drafts` are
 * the board's new wording, which prints only with an approval. The Wi-Fi
 * network and password are fixture values of the same length as the real ones:
 * this repo is public, and a credential never belongs in it.
 */
const LISTING = "Airbnb listing, 2026-10-23";
const HOSP = "Hospitable property details, read 2026-10-23";
const HUB = "Hospitable knowledge hub, 2026-09-04";
const RULING = "Jake ruling, 2026-10-23";
const T = "checkout tasks, read 2026-10-23";
const it = (label: string, body: string, extra: Partial<ItemV2> = {}): ItemV2 => ({
  label,
  body,
  source: extra.source ?? LISTING,
  checked: extra.checked ?? "2026-10-23",
  ...extra,
});

const drafts: HeldLine[] = [
  ...(
    [
      ["arrival", "Front door and keypad"],
      ["first-hour", "Too warm upstairs, too cold?"],
      ["house", "Who sleeps in which bedroom?"],
      ["help", "Help any hour"],
    ] as const
  ).map(
    ([chapter, text]): HeldLine => ({
      at: { kind: "chapter-head", chapter },
      text,
      why: "Chapter head as the guest's question",
      writtenBy: "guide v2 board",
      writtenOn: "2026-11-11",
    }),
  ),
  {
    at: { kind: "subhead", chapter: "first-hour", group: "Cooling" },
    text: "Top floor too warm",
    replaces: "Cooling",
    why: "The question a guest has, not the system's name",
    writtenBy: "guide v2 board",
    writtenOn: "2026-11-11",
  },
  {
    at: { kind: "subhead", chapter: "first-hour", group: "first-hour.gas-fireplace" },
    text: "Gas fireplace wall switch",
    replaces: "Gas fireplace",
    why: "Names the switch the guest looks for",
    writtenBy: "guide v2 board",
    writtenOn: "2026-11-11",
  },
  {
    at: { kind: "subhead", chapter: "house", group: "house.for-kids" },
    text: "Pack 'n play in the primary closet",
    replaces: "For kids",
    why: "The most-asked kid item first",
    writtenBy: "guide v2 board",
    writtenOn: "2026-11-11",
  },
  {
    at: { kind: "subhead", chapter: "house", group: "house.trash-day" },
    text: "Bins out Tuesday by 9:00 AM",
    replaces: "Trash day",
    why: "The day and time in the head",
    writtenBy: "guide v2 board",
    writtenOn: "2026-11-11",
  },
  {
    at: { kind: "cover-line", row: "parking" },
    text: "Garage, two in the driveway, one street spot",
    why: "The cover row fits on one line",
    writtenBy: "guide v2 board",
    writtenOn: "2026-11-11",
  },
  {
    at: {
      kind: "if-code-fails",
      steps: ["Enter the code again, slowly.", "Message us in your booking app, any hour."],
    },
    text: "",
    why: "A fallback ladder at the door; the Lock-button wake is not on record for this house",
    writtenBy: "guide v2 board",
    writtenOn: "2026-11-11",
  },
  ...(
    [
      ["wifi", "Wi-Fi on FixtureLink8719", undefined],
      [
        "door",
        "The front door keypad",
        "Your code arrives by message in your booking app on check-in day. Key it in, press Lock/Unlock, pull the door gently.",
      ],
      [
        "parking",
        "Garage or driveway?",
        "Both. Two cars in the garage, two in the driveway, one street spot out front. Never on the yard.",
      ],
      [
        "first-hour.cooler-upstairs",
        "Top floor too warm?",
        "Shut the lower-level vents, fully or halfway, to send cool air upstairs.",
      ],
      [
        "first-hour.upstairs-in-winter",
        "Too cold upstairs?",
        "Heat holds at 70°F. Spare space heaters are upstairs.",
      ],
      [
        "first-hour.gas-fireplace",
        "Gas fireplace switch?",
        "The left wall switch, nearest the fireplace.",
      ],
      ["house.blankets", "Blankets for the beds?", undefined],
      ["house.for-kids", "Pack 'n play for kids?", "Top-floor primary bedroom closet. No charge."],
      [
        "house.trash-day",
        "Bins out Tuesday?",
        "Curb by 9:00 AM that morning. Never the night before.",
      ],
      [
        "checkout",
        "Checkout time?",
        "10:00 AM. Late checkout at 11:00 AM is $45; ask us the day before.",
      ],
    ] as const
  ).map(
    ([ref, question, answer]): HeldLine => ({
      at: { kind: "quick-find", ref, question, ...(answer ? { answer } : {}) },
      text: question,
      why: "Quick find as the ten questions guests ask",
      writtenBy: "guide v2 board",
      writtenOn: "2026-11-11",
    }),
  ),
];

export const yaleFixture: GuideModel = {
  slug: "yale",
  name: "135 Yale",
  address: {
    value: { street: "135 Yale Avenue", city: "Colorado Springs", state: "CO", zip: "80904" },
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=135%20Yale%20Avenue%2C%20Colorado%20Springs%2C%20CO%2080904",
    source: HOSP,
    checked: "2026-10-23",
  },
  checkIn: { value: "4:00 PM", source: HOSP, checked: "2026-10-23" },
  checkOut: { value: "10:00 AM", source: `${LISTING} (house rules)`, checked: "2026-10-23" },
  entry: {
    lock: {
      value:
        "A Schlage Encode smart deadbolt on the front door, with a keypad and a Lock/Unlock button.",
      source: "Brain property record (access, 2026-09-11)",
      checked: "2026-09-18",
    },
    hideLock: true,
    steps: {
      value: [
        "At the front door, enter your code on the keypad.",
        "Press the Lock/Unlock button.",
        "Pull the door gently toward you while it unlocks.",
        "When you leave, lock the door behind you.",
      ],
      source: "Hospitable knowledge hub (Access Codes), 2026-09-04",
      checked: "2026-09-25",
    },
    codeDelivery: {
      value:
        "Your door code arrives in the check-in message in your booking app, the day before you arrive. If you do not have it by the morning of check-in, message us.",
      source:
        "Hospitable check-in message, updated 2026-09-29; Jake ruling on entry codes, 2026-10-23",
      checked: "2026-10-23",
    },
    codeDeliveryNext: {
      text: "Your door code comes in the check-in message in your booking app on check-in day.",
    },
    landmark: {
      unknown: true,
      reason: "No owner-supplied landmark for the front door on record",
      source: "guide v2 board, 2026-11-11",
      checked: "2026-11-11",
    },
  },
  parking: {
    value:
      "The two-car garage, room for two cars in the driveway, and one street spot directly in front of the house (the neighborhood allows only that one). Keep cars off the yard. The garage remote is in the tray on the console table behind the living room couch.",
    source: "Hospitable knowledge hub (Parking), 2026-09-04; house manual, read 2026-10-23",
    checked: "2026-10-23",
  },
  wifi: {
    kind: "printed",
    network: { value: "FixtureLink8719", source: "fixture value", checked: "2026-10-23" },
    password: { value: "fxtr4242abcd9q", source: "fixture value", checked: "2026-10-23" },
  },
  contact: {
    label: "Message us in your booking app. We answer any hour.",
    source: RULING,
    checked: "2026-10-23",
  },
  sections: [
    {
      id: "first-hour",
      title: "First hour",
      items: [
        it(
          "Heat and A/C",
          "Central heat and A/C both run on the thermostat. The heat is set to 70°F and is not locked; only the A/C setting is locked. Please do not change the thermostat: if the house is too warm or too cold, message us. Please leave the thermostat equipment plugged in and as it is.",
          { group: "Heat", source: "cleaning team and owner, 2026-10-14", checked: "2026-10-29" },
        ),
        it("Upstairs in winter", "Spare space heaters are kept upstairs.", {
          group: "Heat",
          source: "Brain property record (known issues), 2026-09-11",
          checked: "2026-09-11",
        }),
        it(
          "Gas fireplace",
          "The pilot light stays on. To start the fire, flip the wall switch on the left, the one closest to the fireplace; flip it back to turn it off. Keep blankets and anything else that can burn away from the glass, and turn it off before bed or when you go out.",
          {
            group: "Heat",
            where: "Living room",
            source: "owner, 2026-10-28",
            checked: "2026-10-29",
          },
        ),
        it(
          "Portable A/C",
          "Two portable A/C units help on hot days. If one is not set out, message us and we can set it out.",
          {
            group: "Cooling",
            where: "One upstairs, one in the dining room",
            source: `Team reply to a guest, 2026-10-09; ${HUB}`,
            checked: "2026-10-09",
          },
        ),
        it(
          "Evaporative cooler",
          "Keep its tank full of water and add the ice packs from the freezer.",
          {
            group: "Cooling",
            where: "Top-floor primary bedroom closet",
            source: HUB,
            checked: "2026-09-04",
          },
        ),
        it("Whole-house fan", "Its switch is in the linen closet.", {
          group: "Cooling",
          where: "Upstairs, at the top of the stairs",
          source: HUB,
          checked: "2026-09-04",
        }),
        it(
          "Cooler upstairs",
          "Close or half-close the lower-level vents to push cool air upstairs.",
          {
            group: "Cooling",
            source: HUB,
            checked: "2026-09-04",
          },
        ),
      ],
    },
    {
      id: "house",
      title: "The house",
      intro:
        "Four bedrooms on a split level: two on the top floor and two on the lower level, with about four partial flights of stairs between them.",
      items: [
        it(
          "Primary bedroom",
          "King bed, Smart TV, a walk-in closet with the washer and dryer, and a private west-facing balcony.",
          {
            level: "Top floor",
            room: true,
            photo: "img/d2-yale-bedroom-1.jpg",
          },
        ),
        it("Bedroom 2", "Queen bed, a desk for working and a Smart TV.", {
          level: "Top floor",
          room: true,
          photo: "img/d2-yale-bedroom-2.jpg",
        }),
        it(
          "For kids",
          "High chair, a pack 'n play at no charge (kept in the top-floor primary bedroom closet), baby gates on each level, outlet covers, children's dinnerware, toys and books.",
          { source: `Team reply to a guest, 2026-10-08; ${LISTING}` },
        ),
        it(
          "Trash day",
          "Pickup is Tuesday. The bins live in the garage. If you are here on a Tuesday, please roll them to the curb that morning by 9:00 AM, never the night before, because of bears and wind. There is no separate recycling; everything goes in the trash bins.",
          { source: "Jake ruling, 2026-09-06", checked: "2026-09-06" },
        ),
      ],
      unknowns: [
        {
          key: "house.blankets",
          label: "Blankets for the beds?",
          fact: {
            unknown: true,
            reason: "Extra blankets are not on record for this house",
            source: "guide v2 board, 2026-11-11",
            checked: "2026-11-11",
          },
        },
      ],
    },
    {
      id: "good-to-know",
      title: "Good to know",
      items: [
        it(
          "Wildlife",
          "Bears, deer and foxes are common here. Keep food, pet bowls, coolers and trash inside, never leave trash outside overnight, and do not feed or approach wildlife. Clean the grill and take every bit of food off it as soon as you finish: food left outside draws bears, and the fines are high.",
          { source: `${LISTING} (house rules); owner, 2026-10-28`, checked: "2026-10-28" },
        ),
        it(
          "Wi-Fi reset",
          "The router is mounted near the ceiling in the garage. To reset it, unplug it for about 30 seconds, plug it back in and wait a few minutes. It may take a ladder; message us and we will arrange help.",
          { source: HUB, checked: "2026-09-04" },
        ),
        it(
          "Stairs",
          "The house is split-level, with about four partial flights of stairs between the lower level and the top floor. Two bedrooms are on the lower level.",
        ),
      ],
    },
    {
      id: "rules",
      title: "House rules and fees",
      items: [
        it(
          "Guests",
          "Up to 10 guests, or 6 on stays of 30 nights or more. Registered guests only.",
        ),
        it(
          "Quiet hours",
          "10:00 PM to 8:00 AM. This is a very quiet street, and neighbors do complain about noise, so keep voices low outside at any hour.",
          { source: RULING, checked: "2026-10-28" },
        ),
        it(
          "Smoking",
          "No smoking or vaping anywhere on the property, inside or out, including the balconies, patios, yard and driveway.",
          { source: RULING, checked: "2026-11-05" },
        ),
      ],
    },
    {
      id: "checkout",
      title: "Checkout",
      items: [
        it("Dishes", "If you can, load your dishes and start the dishwasher.", { source: T }),
        it("Towels", "Please leave used towels together in the bathroom.", { source: T }),
        it("Lights and windows", "Please turn off the lights and close the windows.", {
          source: T,
        }),
        it("Front door", "Please lock the door behind you.", { source: T }),
      ],
    },
    {
      id: "help",
      title: "Help",
      items: [
        it("Emergencies", "Call 911.", { source: RULING }),
        it("Anything else", "Message us in your booking app. We answer any hour, every day.", {
          source: RULING,
        }),
        it("Water and gas shutoffs", "Both are in the downstairs furnace room.", {
          source: "Brain property record (safety), 2026-09-11",
          checked: "2026-09-11",
        }),
      ],
    },
  ],
  tables: [
    {
      chapter: "rules",
      title: "Late checkout",
      rows: [
        { item: "11:00 AM", price: "$45" },
        { item: "12:00 PM", price: "$65" },
        { item: "1:00 PM", price: "$95" },
      ],
      terms: "Ask us the day before. The cleaner decides, so it is never guaranteed.",
      source: "Jake rulings, 2026-10-23 (RULINGS.md part D: B1)",
      checked: "2026-10-23",
    },
    {
      chapter: "rules",
      title: "Charges",
      rows: [
        { item: "A party", price: "$500" },
        { item: "Smoking inside", price: "$500" },
        {
          item: "A late checkout we did not approve",
          price: "Ladder price",
          note: "billed at the late checkout price",
        },
      ],
      source: "Jake rulings, 2026-10-23 (RULINGS.md part D: F1)",
      checked: "2026-10-23",
    },
  ],
  nearby: [
    {
      name: "Safeway, 3275 W Colorado Ave",
      kind: "grocery",
      note: "Full grocery store on the main street of Old Colorado City.",
      url: "https://local.safeway.com/safeway/co/colorado-springs/3275-w-colorado-ave.html",
      hours: "6 AM to 11 PM daily",
      distance: "2 min drive",
      source: "local.safeway.com store page; drive time via OSRM",
      checked: "2026-10-23",
    },
    {
      name: "Red Rock Canyon Open Space, 3550 W High St",
      kind: "trail",
      note: "Red rock formations, old quarry steps and the Contemplative, Sand Canyon and Roundup trails.",
      url: "https://coloradosprings.gov/redrockcanyon",
      distance: "4 min drive",
      source: "coloradosprings.gov; drive time via OSRM",
      checked: "2026-10-23",
    },
    {
      name: "Penrose Hospital Emergency Department, 2222 N Nevada Ave",
      kind: "er",
      note: "After 8:30 PM use the emergency department walk-in entrance. For a life-threatening emergency call 911.",
      url: "https://www.mountain.commonspirit.org/location/penrose-hospital",
      hours: "Open 24 hours, every day",
      distance: "12 min drive",
      source: "mountain.commonspirit.org location page; drive time via OSRM",
      checked: "2026-10-29",
    },
  ],
  photos: [
    {
      src: "img/d2-yale-cover-tall.jpg",
      alt: "The valley below 135 Yale at sunset: green treetops, the mountains behind, and a red rock outcrop in the foreground",
      room: "The view from the house",
      width: 744,
      height: 1328,
    },
    {
      src: "img/d2-yale-exterior-2.jpg",
      alt: "135 Yale from above: a three-story stucco house among green trees, with the mountains behind it",
      room: "Exterior",
      width: 1170,
      height: 1463,
    },
    {
      src: "img/d2-yale-living-1.jpg",
      alt: "The living room: a deep white sectional facing a wall-mounted TV, with windows to the deck",
      room: "Living room",
      width: 1024,
      height: 1280,
    },
    {
      src: "img/d2-yale-bedroom-1.jpg",
      alt: "The primary bedroom: a king bed in white and brown linens under wide windows with a view of the red rock",
      room: "Primary bedroom, king",
      width: 720,
      height: 960,
    },
    {
      src: "img/d2-yale-bedroom-2.jpg",
      alt: "Bedroom 2: a bed in white and navy bedding beside a shoji-screen window",
      room: "Bedroom 2, queen",
      width: 720,
      height: 960,
    },
    {
      src: "img/yale-deck-dining-1.jpg",
      alt: "Back deck with a set patio dining table under a green umbrella",
      room: "Back patio",
      width: 2400,
      height: 1599,
      shows: ["defect"],
    },
  ],
  look: {
    size: { bedrooms: 4, sleeps: 10, source: LISTING, checked: "2026-10-23" },
    cover: {
      kind: "photo",
      src: "img/d2-yale-cover-tall.jpg",
      focus: { portrait: "50% 0%", landscape: "50% 50%" },
      layout: "low",
      nameInk: "ink",
      factsInk: "onPhoto",
      shade: { from: 0.45, max: 0.35 },
      measured: { on: "2026-11-11", worstName: 3.29, worstFacts: 4.5, tool: "design-check" },
      portrait: { src: "img/d2-yale-cover-tall.jpg", width: 744, height: 1328 },
      wide: { src: "img/d2-yale-cover-wide.jpg", width: 2400, height: 1328 },
    },
    readFirst: "good-to-know.wildlife",
    plates: {
      arrival: "img/d2-yale-exterior-2.jpg",
      "first-hour": "img/d2-yale-living-1.jpg",
      house: ["img/d2-yale-bedroom-1.jpg", "img/d2-yale-bedroom-2.jpg"],
    },
    figures: [
      { key: "first-hour.heat-and-a-c", value: "70°F" },
      { key: "house.trash-day", value: "9:00 AM" },
    ],
    quickFind: [
      "wifi",
      "door",
      "parking",
      "first-hour.cooler-upstairs",
      "first-hour.upstairs-in-winter",
      "first-hour.gas-fireplace",
      "house.blankets",
      "house.for-kids",
      "house.trash-day",
      "checkout",
    ],
    order: {
      Cooling: [
        "first-hour.cooler-upstairs",
        "first-hour.whole-house-fan",
        "first-hour.evaporative-cooler",
        "first-hour.portable-a-c",
      ],
    },
    coverRows: { door: "lead" },
  },
  drafts,
};
