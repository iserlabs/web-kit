# Desk engines

`@iserlabs/web-kit/desk/*` holds the general parts of a site's back-office Desk. Each file is its own import path, so a browser page never pulls in server code. Screens, stores and sign-in stay in each site.

| Path | What it does | Site hands in |
|---|---|---|
| `desk/visits` | Daily visitor counts from Vercel's analytics drain, how people found the site, which AI assistant sent them, and time on page and on site (from a `page_time` custom event the site sends) | `createVisits({ hosts, project, team, staffPrefixes?, listingHosts?, utmSources? })` |
| `desk/trail` | How one person found the site, kept with their inquiry | `describeTrail(trail, sourceOf)`, with `sourceOf` from `createVisits` |
| `desk/ics` | A one-event calendar file for "Add to calendar" | `icsFor({ calendar: { name, domain, product? }, title, start, ... })` |
| `desk/intake-guard` | Body cap and rate limit for a public POST | nothing |
| `desk/dispatch-schedule` | Choosing a newsletter send time, refused in a sentence when it cannot work | nothing |
| `desk/dispatch-text` | Typed marks (`*italic*`, `**bold**`, `[words](https://address)`) to email HTML, escaped first | a `Look` for the colors and fonts |
| `desk/list-search` | Search first, then the first twenty-five | nothing |
| `desk/shrink-photo` | A large photo made small enough to send through a form (browser only) | nothing |
| `desk/unsaved` | One place that asks before leaving unsaved work (React 19) | nothing |
| `desk/fold-groups` | Which groups of a grouped list are folded shut | nothing |
| `desk/session-age` | How long a sign-in lasts | nothing |

## Binding a site

```ts
// src/office/lib/visits.ts
import { createVisits } from "@iserlabs/web-kit/desk/visits";

export * from "@iserlabs/web-kit/desk/visits";
export const { skipReason, sourceOf, foldDay, sortBatch } = createVisits({
  hosts: ["www.example.org", "example.org"],
  project: "prj_...",
  team: "team_...",
});
```

The site keeps its signature check and visitor hash in its own server file, because they need `node:crypto`.

## Limits

1) Times are New York's. The function names say so (`nyDay`, `nyWallToUtc`), and a site in another zone needs them made configurable first.
2) `visits` labels listing referrers "Event and art listings", which suits a venue; change the label before using it for a site where that reads wrong.
3) This repo is public. A site's name, address, staff and hosting IDs stay in the site, in code and in comments.
