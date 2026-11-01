// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StatementTabs } from "./index";
import type { OwnerPortalModel, StatementLabels } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const model: OwnerPortalModel = {
  owner: "Test Owner",
  brand: "Test Brand",
  properties: ["A"],
  from: { year: 2026, month: 11 },
  through: { year: 2027, month: 1 },
  statements: [
    {
      year: 2026,
      month: 12,
      label: "December 2026",
      status: "final",
      href: "/r/dec",
      bookedRevenue: 1000,
      managementFee: 150,
      toOwner: 850,
      toOwnerLabel: "To you",
    },
    {
      year: 2027,
      month: 1,
      label: "January 2027",
      status: "draft",
      href: "/r/jan",
      note: "Waiting on the last invoice.",
    },
  ],
};

let host: HTMLDivElement;
let root: Root;

function mount(
  initial?: { year: number; month: number },
  extra?: { labels?: StatementLabels; model?: OwnerPortalModel },
) {
  act(() => {
    root.render(
      <StatementTabs model={extra?.model ?? model} initial={initial} labels={extra?.labels} />,
    );
  });
}
const tabs = (label: string) =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`[role=tablist][aria-label^="${label}"] [role=tab]`),
  );
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  });

beforeEach(() => {
  window.history.replaceState(null, "", "/statements");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("StatementTabs", () => {
  it("renders tablist / tab / tabpanel roles, years then months, newest first", () => {
    mount();
    expect(tabs("Statement year").map((t) => t.textContent)).toEqual(["2027", "2026"]);
    expect(tabs("Statement year")[0]?.getAttribute("aria-selected")).toBe("true");
    expect(document.querySelectorAll("[role=tabpanel]").length).toBe(2);
    expect(tabs("Month in 2027").map((t) => t.textContent)).toEqual(["JanuaryDraft"]);
  });

  it("shows the entry with badge, note and the link to the full statement", () => {
    mount();
    const panel = document.querySelector("[role=tabpanel] [role=tabpanel]") as HTMLElement;
    expect(panel.textContent).toContain("Draft");
    expect(panel.textContent).toContain("Waiting on the last invoice.");
    const a = panel.querySelector("a") as HTMLAnchorElement;
    expect(a.textContent).toBe("Open the full statement");
    expect(a.getAttribute("href")).toBe("/r/jan");
  });

  it("moves between years with the arrow keys, wraps, and moves focus", () => {
    mount();
    const years = tabs("Statement year");
    (years[0] as HTMLElement).focus();
    key(years[0] as HTMLElement, "ArrowRight");
    expect(tabs("Statement year")[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement?.textContent).toBe("2026");
    key(document.activeElement as Element, "ArrowRight");
    expect(tabs("Statement year")[0]?.getAttribute("aria-selected")).toBe("true");
    key(document.activeElement as Element, "End");
    expect(document.activeElement?.textContent).toBe("2026");
    key(document.activeElement as Element, "Home");
    expect(document.activeElement?.textContent).toBe("2027");
  });

  it("uses roving tabindex: only the selected tab is in the tab order", () => {
    mount();
    expect(tabs("Statement year").map((t) => t.tabIndex)).toEqual([0, -1]);
  });

  it("moves between months with arrows and shows the empty-month message", () => {
    mount({ year: 2026, month: 12 });
    const months = tabs("Month in 2026");
    expect(months.map((t) => t.firstChild?.textContent)).toEqual(["December", "November"]);
    (months[0] as HTMLElement).focus();
    key(months[0] as HTMLElement, "ArrowRight");
    expect(document.activeElement?.firstChild?.textContent).toBe("November");
    const panel = document.querySelector("[role=tabpanel] [role=tabpanel]") as HTMLElement;
    expect(panel.textContent).toBe("There is no statement for November 2026.");
  });

  it("writes the selection to the URL with replaceState and reads a deep link on load", () => {
    mount();
    const years = tabs("Statement year");
    act(() => (years[1] as HTMLElement).click());
    expect(window.location.search).toBe("?year=2026&month=12");

    act(() => root.unmount());
    root = createRoot(host);
    window.history.replaceState(null, "", "/statements?year=2026&month=11");
    mount();
    expect(
      tabs("Month in 2026").find((t) => t.getAttribute("aria-selected") === "true")?.firstChild
        ?.textContent,
    ).toBe("November");
  });

  it("shows a plain message when the range has no months", () => {
    act(() => {
      root.render(<StatementTabs model={{ ...model, through: { year: 2026, month: 1 } }} />);
    });
    expect(host.textContent).toContain("No statement months to show yet.");
  });

  it("keeps the default captions and empty-month sentence when no labels are given", () => {
    mount({ year: 2026, month: 12 });
    const panel = document.querySelector("[role=tabpanel] [role=tabpanel]") as HTMLElement;
    const dts = Array.from(panel.querySelectorAll("dt")).map((d) => d.textContent);
    expect(dts).toEqual(["Booked revenue", "Management fee", "To you"]);
  });

  it("renames the three figure captions with labels", () => {
    mount(
      { year: 2026, month: 12 },
      {
        labels: {
          bookedRevenue: "Payout counted",
          managementFee: "Costs",
          toOwner: "Net before pending costs",
        },
      },
    );
    // The entry sets toOwnerLabel "To you", which still wins over labels.toOwner.
    const dts = Array.from(document.querySelectorAll("dt")).map((d) => d.textContent);
    expect(dts).toEqual(["Payout counted", "Costs", "To you"]);
  });

  it("uses labels.toOwner when the entry has no toOwnerLabel", () => {
    const noOwn: OwnerPortalModel = {
      ...model,
      statements: model.statements.map((s) => ({ ...s, toOwnerLabel: undefined })),
    };
    mount(
      { year: 2026, month: 12 },
      { model: noOwn, labels: { toOwner: "Net before pending costs" } },
    );
    const dts = Array.from(document.querySelectorAll("dt")).map((d) => d.textContent);
    expect(dts).toEqual(["Booked revenue", "Management fee", "Net before pending costs"]);
  });

  it("renames the empty-month sentence with labels.emptyMonth", () => {
    mount(
      { year: 2026, month: 11 },
      { labels: { emptyMonth: (m) => `Nothing was issued for ${m}.` } },
    );
    const panel = document.querySelector("[role=tabpanel] [role=tabpanel]") as HTMLElement;
    expect(panel.textContent).toBe("Nothing was issued for November 2026.");
  });

  it("shows an emptyMonthNotes reason for that month only, ahead of labels.emptyMonth", () => {
    const withNote: OwnerPortalModel = {
      ...model,
      emptyMonthNotes: { "2026-11": "No statement: operations began in December." },
    };
    mount(
      { year: 2026, month: 11 },
      { model: withNote, labels: { emptyMonth: (m) => `Nothing for ${m}.` } },
    );
    const panel = () => document.querySelector("[role=tabpanel] [role=tabpanel]") as HTMLElement;
    expect(panel().textContent).toBe("No statement: operations began in December.");
    // A month with a statement is untouched by the notes.
    const months = tabs("Month in 2026");
    act(() => (months[0] as HTMLElement).click());
    expect(panel().textContent).toContain("Final");
  });
});
