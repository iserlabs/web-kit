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
  const rows: FactRow[] = [row("address", g.address)];
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
    rows.push({
      claim: p.hours ? `${p.name} (${p.hours})` : p.name,
      where: `nearby.${p.kind}`,
      source: p.source,
      checked: p.checked,
    });
  }
  return rows;
}

export function factsMarkdown(g: GuestGuide): string {
  const esc = (t: string) => t.replaceAll("|", "\\|");
  const lines = ["| claim | where | source | checked |", "|---|---|---|---|"];
  for (const r of factsTable(g))
    lines.push(`| ${esc(r.claim)} | ${r.where} | ${esc(r.source)} | ${r.checked} |`);
  return lines.join("\n");
}
