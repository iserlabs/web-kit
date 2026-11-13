/**
 * Spike: a plain consumer (no Next, no bundler) renders a guide with the kit's
 * TSX straight out of node_modules under tsx. Prints the HTML size and head.
 *
 *   pnpm install && pnpm exec tsx render.tsx
 */
import { type GuideBrand, type GuideModel, planGuide, resolveCopy } from "@iserlabs/web-kit/guest-guide";
import { renderGuideHtml } from "@iserlabs/web-kit/guest-guide/static";

const S = { source: "spike", checked: "2026-11-11" };
const model: GuideModel = {
  slug: "spike-house",
  name: "1 Spike Lane",
  address: {
    value: { street: "1 Spike Lane", city: "Testville", state: "CO", zip: "80000" },
    mapUrl: "https://www.google.com/maps/search/?api=1&query=1%20Spike%20Lane",
    ...S,
  },
  checkIn: { value: "4:00 PM", ...S },
  checkOut: { value: "10:00 AM", ...S },
  entry: {
    lock: { value: "A keypad on the front door.", ...S },
    steps: { value: ["Enter your code on the keypad."], ...S },
    codeDelivery: { value: "Your door code arrives in the check-in message.", ...S },
  },
  parking: { value: "The driveway.", ...S },
  wifi: { kind: "printed", network: { value: "SpikeNet", ...S }, password: { value: "spikepass", ...S } },
  contact: { label: "Message us in your booking app.", ...S },
  sections: [{ id: "house", title: "The house", items: [{ label: "Beds", body: "Two queen beds.", ...S }] }],
  tables: [],
  nearby: [],
  photos: [],
  look: { cover: { kind: "type", title: ["1", "Spike Lane"], ...S } },
};
const brand: GuideBrand = {
  id: "fixture",
  name: "Spike Stays",
  wordmark: { kind: "text", text: "Spike Stays", face: "display" },
  faces: {
    display: { family: "Newsreader", fallback: "Georgia, serif", weight: 300 },
    head: { family: "Newsreader", fallback: "Georgia, serif", weight: 400 },
    text: { family: "Instrument Sans", fallback: "Arial, sans-serif", weight: 400, strong: 600 },
    figure: { family: "IBM Plex Mono", fallback: "monospace", weight: 400, large: 300 },
  },
  ink: "#1c2129",
  sec: "#45454b",
  accent: "#8f3a1f",
  accentText: "#8f3a1f",
  onPhoto: "#ffffff",
  button: { fill: "#e9c2a4", ink: "#1c2129", doneFill: "#1c2129", doneInk: "#f3ebdc" },
  fields: {
    arrival: "#e9c2a4",
    first: "#eed6aa",
    house: "#e5c3b9",
    know: "#dcd2e0",
    rules: "#d3dce3",
    out: "#cfe0ea",
    near: "#d6e2c9",
    paper: "#f3ebdc",
  },
  phone: "never",
  cachePrefix: "spike-guides",
};

const plan = planGuide(model, resolveCopy(model, { approvals: [] }));
const html = renderGuideHtml({ plan, brand, head: { canonical: "https://example.invalid/spike" } });
console.log(`spike: rendered ${html.length} characters of HTML`);
console.log(html.slice(0, 200));
