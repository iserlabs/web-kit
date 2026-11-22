# owner-portal

Owner statements by year, then by month, for any brand. The kit holds the grouping, the totals and
the tabs; each site holds the owners, the statement URLs and the figures.

```ts
import { StatementTabs, groupStatements, portalTotals, validateModel } from "@iserlabs/web-kit/owner-portal";
```

## Model

`OwnerPortalModel` is `{ owner, brand, properties, from, through, statements }`. A
`StatementEntry` is one statement: `year`, `month` (1 to 12), `label`, optional `property`,
`status` (`final`, `draft` or `waiting`), `href` (required unless `waiting`), the three figures
`bookedRevenue`, `managementFee`, `toOwner` in dollars, `toOwnerLabel` and `note`.

Rules:
- Figures are read from the statement the owner opens. The kit never recomputes a figure.
- `groupStatements` returns every month from `from` through `through`, newest first, grouped by
  year. A month with no statement is present with `entries: []`. Statements outside the range are
  not shown.
- `portalTotals` sums in whole cents. `final` and `draft` stay separate; `waiting` is not counted.
- `validateModel(model)` returns plain-words problems. Run it in a site test, together with a check
  that every `href` points at a real page.

## Tabs

`<StatementTabs model={model} initial={{ year, month }} />` is a client component. Keyboard: arrow
keys move and select (they wrap), Home and End jump to the ends. The selection is written to
`?year=&month=` with `history.replaceState` and read back on load; a server page may pass the same
values as `initial` so the first paint is already right.

## Wording (v0.14.1)

All optional; with none set the output is identical to v0.14.0.

- `<StatementTabs labels={{ bookedRevenue, managementFee, toOwner, emptyMonth }} />` renames the three
  figure captions (defaults "Booked revenue", "Management fee", "To you") and the empty-month
  sentence (`emptyMonth(monthLabel)`). An entry's own `toOwnerLabel` still wins over `labels.toOwner`.
- `model.emptyMonthNotes` is a `Record<"YYYY-MM", string>` saying why a month has no statement. It is
  shown in place of the empty-month sentence for that month only.

## Styling

Only CSS variables: `--op-ink`, `--op-paper`, `--op-accent`, `--op-muted`, `--op-rule`, and
`--op-font` (inherits by default). Set them on a wrapper in the site. Status is always written
as a word on the badge and on the month tab, never color alone.

The site needs `@iserlabs/web-kit` in `transpilePackages` (Next), as with the other modules.
