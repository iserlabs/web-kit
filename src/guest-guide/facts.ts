import type { GuestGuide, Sourced } from "./types";

export type FactRow = { claim: string; where: string; source: string; checked: string };

function show(v: unknown): string {
  if (Array.isArray(v)) return v.map(show).join("; ");
  if (v && typeof v === "object") {
    const a = v as Record<string, string>;
    if ("street" in a) return `${a.street}, ${a.city}, ${a.state} ${a.zip}`;
    return Object.values(a).map(show).join(", ");
  }
  return String(v);
}

function row(where: string, f: Sourced<unknown>): FactRow {
  return { claim: show(f.value), where, source: f.source, checked: f.checked };
}

/** One row per claim the page makes, for the FACTS gate. */
export function factsTable(g: GuestGuide): FactRow[] {
  const rows: FactRow[] = [
    row("address", g.address),
    {
      claim: g.address.mapUrl,
      where: "address.mapUrl",
      source: g.address.source,
      checked: g.address.checked,
    },
  ];
  if (g.door) rows.push(row("door", g.door));
  rows.push(
    row("checkIn", g.checkIn),
    row("checkOut", g.checkOut),
    row("entry.lock", g.entry.lock),
    row("entry.steps", g.entry.steps),
    row("entry.codeDelivery", g.entry.codeDelivery),
    row("parking", g.parking),
    row("wifi.network", g.wifi.network),
    row("wifi.password", g.wifi.password),
    {
      claim: `${g.contact.label}: ${g.contact.phone}`,
      where: "contact",
      source: g.contact.source,
      checked: g.contact.checked,
    },
    {
      claim: g.contact.phone,
      where: "contact.phone",
      source: g.contact.source,
      checked: g.contact.checked,
    },
  );
  for (const sec of g.sections) {
    for (const it of sec.items) {
      rows.push({
        claim: `${it.label}: ${it.body}`,
        where: `sections.${sec.id}.${it.label}`,
        source: it.source,
        checked: it.checked,
      });
    }
  }
  for (const p of g.nearby) {
    const at = `nearby.${p.kind}`;
    const base = { source: p.source, checked: p.checked };
    rows.push({ claim: p.hours ? `${p.name} (${p.hours})` : p.name, where: at, ...base });
    rows.push({ claim: p.note, where: `${at}.${p.name}.note`, ...base });
    if (p.distance) rows.push({ claim: p.distance, where: `${at}.${p.name}.distance`, ...base });
  }
  return rows;
}

export function factsMarkdown(g: GuestGuide): string {
  const cell = (t: string) => t.replace(/\r?\n/g, " ").replaceAll("|", "\\|");
  const lines = ["| claim | where | source | checked |", "|---|---|---|---|"];
  for (const r of factsTable(g))
    lines.push(`| ${cell(r.claim)} | ${cell(r.where)} | ${cell(r.source)} | ${r.checked} |`);
  return lines.join("\n");
}
