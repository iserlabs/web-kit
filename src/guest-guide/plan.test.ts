import { describe, expect, it } from "vitest";
import { type Approval, resolveCopy } from "./copy";
import {
  ALL_APPROVED,
  columbus52Fixture,
  longNameFixture,
  noPhotoFixture,
  sunMountainBrand,
  unknownsFixture,
  wifiInMessageFixture,
  yaleFixture,
} from "./fixtures";
import type { GuideModel } from "./model";
import {
  type Block,
  firstSentence,
  formatDay,
  monthYear,
  nameStep,
  type Plan,
  placedPhotos,
  planGuide,
} from "./plan";

const live = (m: GuideModel) =>
  planGuide(m, resolveCopy(m, { approvals: [], brandLabels: sunMountainBrand.labels }));
const full = (m: GuideModel, approvals: Approval[] = ALL_APPROVED) =>
  planGuide(m, resolveCopy(m, { approvals, brandLabels: sunMountainBrand.labels }));

/** Every item key the plan prints, in order, wherever it landed. */
function printedKeys(p: Plan): string[] {
  const keys: string[] = [];
  const visit = (b: Block) => {
    if ("key" in b && b.key) keys.push(b.key);
    if (b.kind === "steps") for (const s of b.items) if (s.key) keys.push(s.key);
    if (b.kind === "wifi") for (const r of b.rows) visit(r);
  };
  for (const c of [...p.chapters, p.help]) for (const b of c.blocks) visit(b);
  return keys;
}

const allBlocks = (p: Plan) => [...p.chapters, p.help].flatMap((c) => c.blocks);
const textOf = (p: Plan) => JSON.stringify(p);

describe("planGuide: content mapping", () => {
  it("every live item appears exactly once", () => {
    for (const m of [yaleFixture, columbus52Fixture]) {
      const p = live(m);
      const keys = printedKeys(p);
      const want = m.sections
        .flatMap((s) => s.items.map((i) => `${s.id}.${i.label}`))
        .filter((k) => !/^help\.(Emergencies|Anything else)$/.test(k));
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.length).toBe(want.length);
    }
  });

  it("drops the help rows that only restate the 911 or message-us box (v1 rule)", () => {
    const keys = printedKeys(live(yaleFixture));
    expect(keys).not.toContain("help.emergencies");
    expect(keys).toContain("help.water-and-gas-shutoffs");
  });

  it("moves Wi-Fi rows into the Arrival Wi-Fi block and Read this first after the steps", () => {
    const p = live(yaleFixture);
    const arrival = p.chapters[0];
    expect(arrival?.id).toBe("arrival");
    const kinds = arrival?.blocks.map((b) => b.kind) ?? [];
    expect(kinds.indexOf("steps")).toBeLessThan(kinds.indexOf("note"));
    expect(kinds.indexOf("note")).toBeLessThan(kinds.indexOf("wifi"));
    const wifi = arrival?.blocks.find((b) => b.kind === "wifi");
    expect(wifi?.kind === "wifi" && wifi.rows.map((r) => ("key" in r ? r.key : ""))).toEqual([
      "good-to-know.wi-fi-reset",
    ]);
    const note = arrival?.blocks.find((b) => b.kind === "note");
    expect(note?.kind === "note" && note.key).toBe("good-to-know.wildlife");
  });

  it("prints the door-code timing verbatim in Arrival (R6)", () => {
    const p = live(yaleFixture);
    const door = p.chapters[0]?.blocks.find((b) => b.kind === "p" && b.id === "door");
    expect(door?.kind === "p" && door.text).toBe(yaleFixture.entry.codeDelivery.value);
  });

  it("order changes order only", () => {
    const p = live(yaleFixture);
    const first = p.chapters.find((c) => c.id === "first-hour");
    const steps = first?.blocks.find((b) => b.kind === "steps");
    expect(steps?.kind === "steps" && steps.items.map((s) => s.key)).toEqual([
      "first-hour.cooler-upstairs",
      "first-hour.whole-house-fan",
      "first-hour.evaporative-cooler",
      "first-hour.portable-a-c",
    ]);
    const bodies = steps?.kind === "steps" ? steps.items.map((s) => s.text) : [];
    const source = yaleFixture.sections[0]?.items
      .filter((i) => i.group === "Cooling")
      .map((i) => i.body);
    expect([...bodies].sort()).toEqual([...(source ?? [])].sort());
  });

  it("a figure is a verbatim substring of the sentence that carries it", () => {
    for (const b of allBlocks(live(yaleFixture)))
      if (b.kind === "figure") expect(b.text).toContain(b.value);
    expect(allBlocks(live(yaleFixture)).filter((b) => b.kind === "figure")).toHaveLength(2);
  });
});

describe("planGuide: chapters", () => {
  it("numbers 1..N over the chapters present, help last", () => {
    const p = live(yaleFixture);
    const all = [...p.chapters, p.help];
    expect(all.map((c) => c.number)).toEqual(all.map((_, i) => i + 1));
    expect(all.map((c) => c.id)).toEqual([
      "arrival",
      "first-hour",
      "house",
      "good-to-know",
      "rules",
      "checkout",
      "nearby",
      "help",
    ]);
  });

  it("an empty section is not rendered and the numbers close up", () => {
    const m = structuredClone(yaleFixture);
    m.sections = m.sections.filter((s) => s.id !== "house");
    const p = live(m);
    expect(p.chapters.map((c) => c.id)).not.toContain("house");
    expect([...p.chapters, p.help].map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("never sets a plate on rules, checkout or help", () => {
    const m = structuredClone(yaleFixture);
    m.look.plates = { ...m.look.plates, rules: "img/d2-yale-living-1.jpg" };
    const p = live(m);
    for (const c of p.chapters)
      if (["rules", "checkout", "help"].includes(c.id)) expect(c.plate).toBeUndefined();
  });

  it("a missing plate opens on the label and head; one usable photo of a diptych is one plate", () => {
    const m = structuredClone(yaleFixture);
    m.look.plates = {
      "first-hour": "img/missing.jpg",
      house: ["img/d2-yale-bedroom-1.jpg", "img/yale-deck-dining-1.jpg"],
    };
    const p = live(m);
    expect(p.chapters.find((c) => c.id === "first-hour")?.plate).toBeUndefined();
    const house = p.chapters.find((c) => c.id === "house")?.plate;
    expect(Array.isArray(house)).toBe(false);
    expect(house && !Array.isArray(house) && house.src).toBe("img/d2-yale-bedroom-1.jpg");
  });

  it("places each photo once, and never a skipped, AI, unconfirmed or door photo", () => {
    for (const m of [yaleFixture, columbus52Fixture]) {
      const srcs = placedPhotos(live(m)).map((x) => x.src);
      expect(new Set(srcs).size).toBe(srcs.length);
      expect(srcs).not.toContain("img/yale-deck-dining-1.jpg");
      expect(srcs).not.toContain("img/hero-1.jpg");
    }
    const m = structuredClone(yaleFixture);
    m.look.skip = ["img/d2-yale-living-1.jpg"];
    const photo = m.photos.find((x) => x.src === "img/d2-yale-exterior-2.jpg");
    if (photo) photo.rights = "unconfirmed";
    const srcs = placedPhotos(live(m)).map((x) => x.src);
    expect(srcs).not.toContain("img/d2-yale-living-1.jpg");
    expect(srcs).not.toContain("img/d2-yale-exterior-2.jpg");
  });

  it("live: the label shows only the number and the head is the live title", () => {
    const first = live(yaleFixture).chapters.find((c) => c.id === "first-hour");
    expect(first?.head).toEqual({ text: "First hour", from: "live" });
    expect(first?.showName).toBe(false);
    const appr = full(yaleFixture).chapters.find((c) => c.id === "first-hour");
    expect(appr?.head.text).toBe("Too warm upstairs, too cold?");
    expect(appr?.showName).toBe(true);
    expect(full(yaleFixture).chapters[0]?.name).toBe("Arrival");
  });

  it("each chapter carries its field and the one before it", () => {
    const p = live(yaleFixture);
    expect(p.chapters.map((c) => c.field)).toEqual([
      "arrival",
      "first",
      "house",
      "know",
      "rules",
      "out",
      "near",
    ]);
    expect(p.chapters[1]?.prevField).toBe("arrival");
    expect(p.help.field).toBe("paper");
    expect(p.help.prevField).toBe("near");
  });
});

describe("planGuide: the cover", () => {
  it("live-only cover rows: long labels, the live door sentence, a parking link", () => {
    const c = live(yaleFixture).cover;
    expect(c.rows.map((r) => r.label)).toEqual([
      "Check-in",
      "Wi-Fi",
      "Password",
      "Getting in",
      "Parking",
      "Help",
    ]);
    const door = c.rows.find((r) => r.id === "door");
    expect(door?.kind === "text" && door.text).toBe(
      "Your door code arrives in the check-in message in your booking app, the day before you arrive.",
    );
    const park = c.rows.find((r) => r.id === "parking");
    expect(park?.kind).toBe("link");
    expect(park?.kind === "link" && park.href).toBe("#park");
    expect(c.labelWidth).toBeGreaterThan(60);
    expect(c.labelWidth).toBeLessThanOrEqual(104);
  });

  it("approved cover rows: short labels, one Wi-Fi row, the held parking line", () => {
    const c = full(yaleFixture).cover;
    expect(c.rows.map((r) => r.label)).toEqual(["In", "Wi-Fi", "Door", "Park", "Help"]);
    expect(c.labelWidth).toBe(60);
    const park = c.rows.find((r) => r.id === "parking");
    expect(park?.kind === "text" && park.text).toBe("Garage, two in the driveway, one street spot");
  });

  it("a cover row over 90 characters becomes a link unless the house asks otherwise", () => {
    const m = structuredClone(yaleFixture);
    delete m.look.coverRows;
    const door = live(m).cover.rows.find((r) => r.id === "door");
    expect(door?.kind).toBe("link");
    expect(door?.kind === "link" && door.href).toBe("#door");
  });

  it("long-name steps: 80 to 12 characters, 64 to 18, 52 to 26, else 44", () => {
    expect(nameStep("135 Yale")).toBe(80);
    expect(nameStep("52 Cottage Street")).toBe(64);
    expect(nameStep("Crown Ridge Cottage")).toBe(52);
    expect(nameStep(longNameFixture.name)).toBe(44);
    expect(live(longNameFixture).cover.nameStep).toBe(44);
  });

  it("no photo: the type cover", () => {
    const c = live(noPhotoFixture).cover;
    expect(c.kind).toBe("type");
    expect(c.typeTitle).toEqual(["135", "Yale Avenue"]);
    expect(placedPhotos(live(noPhotoFixture))).toEqual([]);
  });

  it("Wi-Fi in a message: the live line, no copy", () => {
    const p = live(wifiInMessageFixture);
    const row = p.cover.rows.find((r) => r.id === "wifi");
    expect(row?.kind).toBe("text");
    expect(JSON.stringify(p.cover.rows)).not.toContain('"copy"');
    expect(JSON.stringify(p.quickFind.rows)).not.toContain('"wifi":');
    expect(p.print.wifiQr).toBeUndefined();
  });

  it("print carries a Wi-Fi QR payload with special characters escaped", () => {
    const m = structuredClone(yaleFixture);
    if (m.wifi.kind === "printed") m.wifi.network.value = 'a;b,c:d"e\\f';
    expect(live(m).print.wifiQr).toBe('WIFI:T:WPA;S:a\\;b\\,c\\:d\\"e\\\\f;P:fxtr4242abcd9q;;');
  });
});

describe("planGuide: unknowns in both modes", () => {
  it("live: an Unknown prints its liveLine or nothing", () => {
    const p = live(unknownsFixture);
    const s = textOf(p);
    expect(s).toContain("Filled in before arrival");
    expect(s).toContain("Not confirmed yet. Ask us before you arrive.");
    expect(s).not.toContain("Not confirmed yet. Message us in your booking app.");
    expect(p.cover.rows.find((r) => r.id === "times")?.kind === "times").toBe(true);
    // The landmark and the blankets row have no liveLine: they are omitted.
    expect(s).not.toContain("Blankets for the beds?");
  });

  it("approved: the unknown line", () => {
    const p = full(unknownsFixture);
    const s = textOf(p);
    expect(s).toContain("Not confirmed yet. Message us in your booking app.");
    expect(s).toContain("Blankets for the beds?");
    expect(s).toContain("Finding the front door");
  });
});

describe("planGuide: quick find", () => {
  it("live: item labels and short live first sentences, each linking to its row", () => {
    const p = live(yaleFixture);
    expect(p.quickFind.head.text).toBe("Quick find");
    const rows = p.quickFind.rows;
    expect(rows.map((r) => r.n)).toEqual(rows.map((_, i) => String(i + 1).padStart(2, "0")));
    expect(rows.find((r) => r.ref === "first-hour.cooler-upstairs")).toMatchObject({
      question: "Cooler upstairs",
      answer: "Close or half-close the lower-level vents to push cool air upstairs.",
      href: "#i-first-hour-cooler-upstairs",
    });
    // An unknown row with no live line is left out, and the numbers close up.
    expect(rows.find((r) => r.ref === "house.blankets")).toBeUndefined();
    expect(rows).toHaveLength(9);
  });

  it("every quick-find link resolves to an id in the plan", () => {
    for (const p of [live(yaleFixture), full(yaleFixture), live(columbus52Fixture)]) {
      const ids = new Set(p.ids);
      for (const r of p.quickFind.rows) expect(ids.has(r.href.slice(1)), r.href).toBe(true);
      for (const r of p.cover.rows)
        if (r.kind === "link") expect(ids.has(r.href.slice(1)), r.href).toBe(true);
    }
  });

  it("approved: the ten questions", () => {
    const p = full(yaleFixture);
    expect(p.quickFind.head.text).toBe("10 questions");
    expect(p.quickFind.rows).toHaveLength(10);
    expect(p.quickFind.rows[9]?.question).toBe("Checkout time?");
  });

  it("without a quickFind list: one row per chapter, the v1 shape", () => {
    const p = live(columbus52Fixture);
    expect(p.quickFind.rows.map((r) => r.href)).toEqual(
      [...p.chapters, p.help].map((c) => `#${c.id}`),
    );
  });
});

describe("planGuide: help, colophon, offline", () => {
  it("live colophon: Checked <day>; approved: Checked <Month YYYY>", () => {
    expect(live(yaleFixture).colophon.checked).toBe("Checked Nov 11, 2026");
    expect(full(yaleFixture).colophon.checked).toBe("Checked November 2026");
    const m = structuredClone(yaleFixture);
    m.checkedBy = { value: "A Checker", source: "s", checked: "2026-11-11" };
    expect(full(m).colophon.checked).toBe("Checked November 2026 by A Checker");
  });

  it("offline URLs: the page, the extras, and one phone-width URL per placed photo", () => {
    const m = yaleFixture;
    const p = planGuide(m, resolveCopy(m, { approvals: [] }), {
      page: "/guides/yale",
      extraUrls: ["/fonts/a.woff2"],
      imageUrl: (src, w) => `${src}?w=${w}`,
    });
    expect(p.offlineUrls[0]).toBe("/guides/yale");
    expect(p.offlineUrls).toContain("/fonts/a.woff2");
    const photos = placedPhotos(p);
    expect(p.offlineUrls.filter((u) => u.includes("?w="))).toHaveLength(photos.length);
    expect(new Set(p.offlineUrls).size).toBe(p.offlineUrls.length);
  });

  it("a brand that never prints a phone gets none in help", () => {
    const m = structuredClone(yaleFixture);
    m.contact.phone = "(555) 010-0100";
    const p = planGuide(m, resolveCopy(m, { approvals: [] }), { phone: "never" });
    expect(p.help.phone).toBeUndefined();
    const q = planGuide(m, resolveCopy(m, { approvals: [] }), { phone: "allowed" });
    expect(q.help.phone).toBe("(555) 010-0100");
  });
});

describe("text helpers", () => {
  it("firstSentence keeps the words", () => {
    expect(firstSentence("Your code arrives. Then go in.")).toBe("Your code arrives.");
    expect(firstSentence("No end")).toBe("No end");
  });
  it("formats calendar days without a clock", () => {
    expect(formatDay("2026-10-27")).toBe("Oct 27, 2026");
    expect(monthYear("2026-11-01")).toBe("November 2026");
  });
});
