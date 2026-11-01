"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  defaultSelection,
  formatDollars,
  groupStatements,
  monthName,
  monthStatusWord,
  nextTabIndex,
  parseSelection,
} from "./core";
import { STATEMENT_TABS_CSS } from "./styles";
import type { OwnerPortalModel, StatementEntry, YearMonth } from "./types";

const STATUS_WORD = { final: "Final", draft: "Draft", waiting: "Waiting" } as const;

function Entry({ entry }: { entry: StatementEntry }) {
  const figures: [string, number, boolean][] = [];
  if (entry.bookedRevenue !== undefined)
    figures.push(["Booked revenue", entry.bookedRevenue, false]);
  if (entry.managementFee !== undefined)
    figures.push(["Management fee", entry.managementFee, false]);
  if (entry.toOwner !== undefined)
    figures.push([entry.toOwnerLabel ?? "To you", entry.toOwner, true]);
  return (
    <article className="op-entry" data-status={entry.status}>
      <div className="op-head">
        <h4 className="op-title">{entry.label}</h4>
        <span className="op-badge" data-status={entry.status}>
          {STATUS_WORD[entry.status]}
        </span>
      </div>
      {figures.length > 0 && (
        <dl className="op-figs">
          {figures.map(([name, value, bottom]) => (
            <div key={name} style={{ display: "contents" }}>
              <dt className={bottom ? "op-bottom" : undefined}>{name}</dt>
              <dd className={bottom ? "op-bottom" : undefined}>{formatDollars(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {entry.note && <p className="op-note">{entry.note}</p>}
      {entry.href && (
        <a className="op-open" href={entry.href}>
          Open the full statement
        </a>
      )}
    </article>
  );
}

/**
 * Statements by year, then by month, as accessible tabs. Styled only through
 * --op-ink, --op-paper, --op-accent, --op-muted, --op-rule and --op-font.
 */
export function StatementTabs({
  model,
  initial,
}: {
  model: OwnerPortalModel;
  initial?: YearMonth;
}) {
  const groups = useMemo(() => groupStatements(model), [model]);
  const base = useId();
  const [sel, setSel] = useState<YearMonth | null>(() => {
    if (
      initial &&
      groups.some((g) => g.year === initial.year && g.months.some((m) => m.month === initial.month))
    )
      return initial;
    return defaultSelection(groups);
  });
  const yearRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const monthRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusNext = useRef<"year" | "month" | null>(null);

  // Read ?year=&month= once on load.
  useEffect(() => {
    const fromUrl = parseSelection(window.location.search, groups);
    if (fromUrl) setSel(fromUrl);
  }, [groups]);

  const choose = useCallback((next: YearMonth) => {
    setSel(next);
    const url = new URL(window.location.href);
    url.searchParams.set("year", String(next.year));
    url.searchParams.set("month", String(next.month));
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    if (!focusNext.current || !sel) return;
    const refs = focusNext.current === "year" ? yearRefs : monthRefs;
    const idx =
      focusNext.current === "year"
        ? groups.findIndex((g) => g.year === sel.year)
        : (groups
            .find((g) => g.year === sel.year)
            ?.months.findIndex((m) => m.month === sel.month) ?? -1);
    refs.current[idx]?.focus();
    focusNext.current = null;
  }, [sel, groups]);

  if (groups.length === 0 || !sel) {
    return (
      <div className="op-tabs">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant stylesheet string, no user input */}
        <style dangerouslySetInnerHTML={{ __html: STATEMENT_TABS_CSS }} />
        <p className="op-empty">No statement months to show yet.</p>
      </div>
    );
  }

  const yearIdx = Math.max(
    0,
    groups.findIndex((g) => g.year === sel.year),
  );
  const yearGroup = groups[yearIdx] as (typeof groups)[number];
  const monthIdx = Math.max(
    0,
    yearGroup.months.findIndex((m) => m.month === sel.month),
  );
  const monthGroup = yearGroup.months[monthIdx] as (typeof yearGroup.months)[number];

  const yearTabId = (y: number) => `${base}-y${y}`;
  const monthTabId = (y: number, m: number) => `${base}-y${y}-m${m}`;

  const onYearKey = (e: React.KeyboardEvent) => {
    const to = nextTabIndex(e.key, yearIdx, groups.length);
    if (to === null) return;
    e.preventDefault();
    const g = groups[to];
    if (!g) return;
    const keep = g.months.find((m) => m.month === sel.month) ?? g.months[0];
    if (!keep) return;
    focusNext.current = "year";
    choose({ year: g.year, month: keep.month });
  };
  const onMonthKey = (e: React.KeyboardEvent) => {
    const to = nextTabIndex(e.key, monthIdx, yearGroup.months.length);
    if (to === null) return;
    e.preventDefault();
    const m = yearGroup.months[to];
    if (!m) return;
    focusNext.current = "month";
    choose({ year: yearGroup.year, month: m.month });
  };

  return (
    <div className="op-tabs">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant stylesheet string, no user input */}
      <style dangerouslySetInnerHTML={{ __html: STATEMENT_TABS_CSS }} />
      <div
        className="op-list op-years"
        role="tablist"
        aria-label="Statement year"
        onKeyDown={onYearKey}
      >
        {groups.map((g, i) => {
          const selected = g.year === yearGroup.year;
          return (
            <button
              key={g.year}
              ref={(el) => {
                yearRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={yearTabId(g.year)}
              className="op-tab"
              aria-selected={selected}
              aria-controls={`${yearTabId(g.year)}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                const keep = g.months.find((m) => m.month === sel.month) ?? g.months[0];
                if (keep) choose({ year: g.year, month: keep.month });
              }}
            >
              {g.year}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${yearTabId(yearGroup.year)}-panel`}
        aria-labelledby={yearTabId(yearGroup.year)}
        className="op-panel"
      >
        <div
          className="op-list op-months"
          role="tablist"
          aria-label={`Month in ${yearGroup.year}`}
          onKeyDown={onMonthKey}
        >
          {yearGroup.months.map((m, i) => {
            const selected = m.month === monthGroup.month;
            return (
              <button
                key={m.month}
                ref={(el) => {
                  monthRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={monthTabId(yearGroup.year, m.month)}
                className="op-tab op-month"
                aria-selected={selected}
                aria-controls={`${monthTabId(yearGroup.year, m.month)}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose({ year: yearGroup.year, month: m.month })}
              >
                <span>{monthName(m.month)}</span>
                <small>{monthStatusWord(m.entries)}</small>
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`${monthTabId(yearGroup.year, monthGroup.month)}-panel`}
          aria-labelledby={monthTabId(yearGroup.year, monthGroup.month)}
          className="op-panel"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabs pattern, the panel is focusable so keyboard users can reach its content
          tabIndex={0}
        >
          {monthGroup.entries.length === 0 ? (
            <p className="op-empty">There is no statement for {monthGroup.label}.</p>
          ) : (
            monthGroup.entries.map((e) => (
              <Entry key={`${e.label}-${e.property ?? ""}`} entry={e} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
