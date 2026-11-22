# v3 design checks

`web-kit audit --tier v3` runs 47 machine checks (C01 to C47) against a live or preview URL in a real
browser (Playwright, Chromium). One plain line per check: `PASS`, `FAIL`, `WARN` or `UNPROVEN`, then the
check ID, its tier, a short reason and the count.

```
pnpm exec web-kit audit --tier v3 --url https://your-site.example
```

## Tiers

| Tier | Meaning | A failure |
|---|---|---|
| T1 | AI fingerprint | blocks unless `docs/design/DECISIONS.md` has a line naming the check ID with a real reason (3 or more words) |
| T2 | quality, honesty, legal | always blocks |
| T3 | taste call held to written limits | blocks unless waived the same way as T1 |
| warn | C37 word budgets | printed, never blocks |

`UNPROVEN` means the check could not be settled (no fact sheet, no scale file, no email folder, or the
check itself crashed). It is printed loudly and counted in the summary line, and it never turns into a quiet
pass. Pass `--strict` to make UNPROVEN block too.

## Probation

Judgment-heavy checks (C14, C15, C16, C18, C22, C32, C38, C40) print as `WARN` instead of `FAIL` until
2026-12-22, with `[probation until 2026-12-22, does not block yet]` on the line. After that date the same
failure blocks with no code change. The dates live in `PROBATION` in `src/audits/v3/lib.mjs`; push a date
out to extend a check that misfired, or delete its line to make it block now.

## Baseline

`web-kit audit --tier v3 --record-baseline` writes `.web-kit/v3-baseline.json`: the failures the site has
today. A normal run fails only on failures that are not in that file (a check ID plus the exact items that
failed). A new site has no file, so every failure is new. Commit the file; it shrinks as fixes land.

## Data files the checks read from the site repo

| File | Used by | Shape |
|---|---|---|
| `docs/design/FACTS.md` | C35, C41 | table `| claim | where | source | match |`; rows marked no, unsourced, missing or guess are ignored |
| `docs/design/scales.json` | C16, C17, C18 | `{ "radius": [0,8,16], "fontSizes": [14,16,18,32,48], "spacing": [4,8,16,24,48,96] }` (`fontSizes` may be `{desktop:[...], phone:[...]}`) |
| `docs/design/DECISIONS.md` | waivers | any line with a check ID and a reason, such as `C01: the wordmark ends with a period` |

Missing file means `UNPROVEN: no fact sheet` or `UNPROVEN: no brand scale on file`, except where the check
can still fail without it (the 6-size cap in C17, the 96 and 64 px section gaps in C18).

## Options

| Flag | Effect |
|---|---|
| `--url` | the address to audit (or `v3.url` in `web-kit.audits.config.mjs`) |
| `--scope marketing\|app\|document\|email` | runs the subset for that surface (boards 93 to 95); default marketing runs everything |
| `--max-pages N` | home plus up to N-1 pages from `sitemap.xml` (default 6); heavy checks run on home only |
| `--emails <folder>` | HTML email previews for C46 |
| `--only C01,C02` | run just these |
| `--json <file>` | also write the full result |
| `--record-baseline` | record the baseline and exit 0 |
| `--strict` | UNPROVEN also blocks |

## Deploy-time hook

The kit has no deploy hook of its own: its blocking checks are CLI commands that each site wires into its
own scripts, as `wk:audit` is. Do the same for v3. In the site's `package.json`:

```json
"scripts": {
  "wk:v3": "web-kit audit --tier v3 --url $WK_V3_URL"
}
```

Run it after the preview deploy, against the preview URL, and make a failing exit code stop the promotion.
On Vercel, call it from the deploy pipeline step that already runs `wk:audit`; on a post-deploy webhook,
`WK_V3_URL` is the deployment URL. Exit code 1 means a failure that is not in the baseline; 2 means no URL
was given.

## Checks C27, C29, C43 and friends are measured, not guessed

C19 resizes the page through the 17 geometries. C27 presses Tab up to 320 times. C29 loads the page on slow
3G, then again with its data requests failing. C43 loads on a 4x slower phone CPU with a slow 4G network.
Those are the slow ones (about a minute together); the rest finish in seconds.
