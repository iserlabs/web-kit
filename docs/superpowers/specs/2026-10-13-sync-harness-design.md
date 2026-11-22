# Sync harness: one self-healing runner for every scheduled external-source sync

**Date:** 2026-10-13
**Status:** built on `feat/sync-harness`. The PLFA job is configured for it but still runs on its
old runner until someone switches the launchd job over (see "Switching PLFA over").
**Package:** `@iserlabs/web-kit`, new `src/sync-harness/` (bash), no new export
**Out-of-repo pieces:** `~/Claude/clients/plfa-sync.d/{config.sh,hooks.sh}`, the PLFA instance

## The problem it solves

Web platforms keep growing a nightly or hourly job that copies something in from outside: an
inventory archive (Perry Lawson's Artwork Archive), a booking system, a feed. Each one fails in
the same handful of ways (the source is slow, a bot check, a sign-out, a permission, a code
change that breaks the build, the network), and each one has so far learned how to cope from
scratch.

The Perry Lawson archive sync learned it the hard way. From 2026-10-03 to 10-12 it failed 43
times, gave the wrong cause 14 times, said "sign in" 44 times when nobody had signed out, pulled
Safari to the front dozens of times a day with no backoff, went 58 hours without a good read
with nothing telling anyone, and cost 620 Claude tool calls in log reading
(`~/Claude/_reports/teardown-plfa-sync-2026-10-12/report.md`). The rebuilt runner fixed all of
that, but in a 248-line script welded to Safari and Artwork Archive. The next platform would
have to rediscover every rule.

The harness keeps the rules and moves everything about the source into a config file and four
small hooks.

## What an owner gets, in plain words

The job checks in on a schedule, runs the real sync once a day (or whatever cadence is set),
and heals itself: a half read is retried within the hour, a failed read waits 15, then 30, then
60 minutes instead of hammering the source, and a broken code change waits for a fix instead of
re-running every 15 minutes. It sends at most one alert every six hours, and none at all as Mac
pop-ups while the no-pop-ups switch is on. It only turns red on the business dashboard after
three failures in a row or 30 hours without a good read, and one command answers "is it
healthy" in six lines.

## Pieces

| File | What it does |
|---|---|
| `run.sh <job>` | One beat: decides if a run is due, runs the sync, asks the classify hook for one verdict, records state, exits 0 or 1 for the watchdog |
| `sync-harness status\|week\|now\|unstick <job>` | The one-call answer, same output as `~/Claude/clients/plfa-sync` |
| `beat.sh <job>` | The launchd entry: the runner, THEN the Business OS heartbeat |
| `install.sh <job>` | Copies the harness to `~/.local/share/sync-harness`, writes the launchd plist, prints (never writes) the `/os` registry row |
| `replay.sh <job> --since DATE` | Runs the classify hook over every run already in the log, as a table |
| `lib.sh` | Config loading, defaults, state read/write, the clock |
| `examples/plfa/` | The first consumer, a byte-for-byte reference of the live copy |
| `test/run-tests.sh` | 136 behavior checks against real-log fixtures (also run by `pnpm test`) |

A job is found by name as `<dir>/<job>.d/config.sh` along `SYNC_HARNESS_PATH` (default
`~/.config/sync-harness:~/Claude/clients`), or given as a path.

## The verdicts

The classify hook reads this run's stretch of the log and the sync's exit code and prints one
verdict, optionally followed by a reason word that only the explain hook reads.

| Verdict | Meaning | What the runner does |
|---|---|---|
| `ok` | a good read | last good read = now; clears failures and partials |
| `partial` | it published, but part of it did not work | counts a partial; next read at the normal cadence; alert after 3 in a row |
| `partial-retry-soon` | it published, but a read came back half done | same, but the next read is due within `SOON_MIN`; calls `after_fail` |
| `fail-browser` | the read from the source failed | backs off `BACKOFF_MIN` (15, 30, 60); `explain` then `after_fail`; alert at `RED_AFTER` |
| `fail-code` | new code fails its own check | remembers the branch tip and waits for it to move, or `CODE_WAIT_MIN`; alert after 2 |
| `fail-build` | the read was fine, the build or publish stopped | retries in `BUILD_RETRY_MIN`, flat; alert after 2 |
| `fail-permission` | macOS refused a permission | retries in `PERMISSION_RETRY_MIN`; alert after 2 |
| `skip` | the run read nothing (a dark-wake skip, standing down) | no state change at all |

`fail-build` is the one verdict added beyond the brief's list of seven. The PLFA runner treats
"stopped after the archive read" differently from both a Safari failure (no backoff, no tab
cleanup) and a code failure (no wait for main), so folding it into either would have changed
behavior.

A job with no classify hook gets a default: a non-zero exit is `fail-browser`; a zero exit is
`skip` only when `SKIP_RE` matches and `FINISHED_RE` does not, so another run's "stood down" line
in a shared log never turns a finished run into a skip.

## Hooks

Shell functions in the job's hooks file (default `hooks.sh` next to the config). All optional.

- `hook_classify FRESH CODE` prints `<verdict> [reason]`.
- `hook_explain VERDICT REASON FRESH` prints two lines: the log text, then the alert text. For
  a partial, line 1 follows `partial run N in a row: `; for a failure it follows
  `failure N in a row` and starts with `: ` or `. `. That split is what lets the PLFA log lines
  come out word for word.
- `hook_before_run` prints a sentence to log, or nothing (PLFA: stuck tabs it closed).
- `hook_after_fail VERDICT` prints a note, or nothing (PLFA: `Closed N stuck tab(s).`).
- `hook_head` prints the code branch tip; default `git ls-remote` on `CODE_REPO`.
- `hook_unstick` is the CLI's unstick report; `hook_replay_then` maps an old runner line to a
  verdict for the replay's comparison column.

While a hook runs, `HARNESS_NOW`, `HARNESS_FAILS`, `HARNESS_DEGRADED`, `HARNESS_CODE` and
`HARNESS_WAIT_MIN` describe the run. Under `SYNC_HARNESS_DRY` (the replay) a hook must not touch
an app or write a file; the PLFA hooks return canned answers.

## Rules kept from the PLFA runner

1. Skip while a run is already going (`pgrep -f SYNC_MATCH`, or the runner's own pid file).
2. A run that finished is never a skip because another beat's "stood down" line landed in it.
3. Backoff 15, 30, 60 minutes on read failures.
4. After a code failure, wait for the branch tip to move, or `CODE_WAIT_MIN`.
5. Exit 1 only after `RED_AFTER` failures in a row, or `STALE_HOURS` with no good read.
6. Trim the log past `LOG_MAX_BYTES` to its last `LOG_KEEP_LINES`.
7. One alert per `NOTIFY_GAP_HOURS`; log-only while the no-pop-ups file exists.
8. When this Mac cannot look up a `DNS_FALLBACK_HOSTS` host, pin the router's answer for this
   run's git calls only, through `GIT_CONFIG_*` variables.
9. The state file keeps the exact six-key format of `plfa-sync-runner.state`, so the PLFA job
   can switch without losing its streaks. It is now read key by key rather than sourced, so a
   damaged state file can never run a command.
10. The heartbeat runs after the runner, never around it: wrapping the runner in python made
    macOS judge python as the process driving Safari and refuse it.

## Tests

`bash src/sync-harness/test/run-tests.sh` (or `pnpm test:sync-harness`; `pnpm test` runs it
too). A fake sync replays one of twelve fixtures cut from the real `plfa-sync.log` (a good run,
a quiet run, NOT SIGNED IN with Safari on a bot check and on a real sign-in page, ARCHIVE READ
INCOMPLETE, a self-check failure, a Cloudflare failure, a Safari timeout, a permission failure,
a dark-wake skip, a stood-down interleave and a lone stood-down, and the GitHub fetch-failed
partial) and exits with the code that run had. The checks assert the state file, the exit code,
the exact log line and the alerts, then the backoff ladder, the six-hour alert gap, the
no-pop-ups switch, the code-failure wait in a real git repo whose main moves, the busy skip, the
log trim, the DNS pin, the CLI output, the beat order, the install, and the replay. osascript,
DNS and the clock are stubbed; the test refuses to run unless osascript resolves to the stub and
every path points into its temp directory.

The ARCHIVE READ INCOMPLETE fixture is the only synthesized one: the not-signed-in run re-worded
the way `sync_aa.sh` has said it since 90-north #265, because that wording had not yet run live.

## Replay against the real log

`sync-harness replay plfa-sync --since 2026-10-03` over 73 runs: 22 fail-browser, 13 skip, 12
fail-code, 9 ok, 9 fail-build, 4 partial-retry-soon, 3 partial, 1 fail-permission. It differs
from the line the runner wrote at the time on 15 of the 50 runs that have one, and every
difference is a rule the 2026-10-12 rebuild added: 12 self-check failures on 10-07 that the old
runner logged as "after the archive read", two Safari timeouts (10-09, 10-11) it logged as
permission problems, and one "Safari refused an instruction" (10-03) it logged as a build stop.
The replay cannot look at Safari as it was, so it reads every NOT SIGNED IN as a slow page or
bot check, which is what all 44 really were.

## Switching PLFA over (not done; a launchd change)

1. `sync-harness install plfa-sync --force` (from the kit checkout). It copies the harness to
   `~/.local/share/sync-harness`, backs up `host.xenia.plfa-sync.plist` and writes the new one,
   which runs `beat.sh` with `~/Claude/clients/plfa-sync.d/config.sh`.
2. Reload it with the `launchctl` line the install prints.
3. The `/os` registry row is unchanged (same job name, label, cadence and grace).
4. Watch `sync-harness status plfa-sync` for a day; the old `plfa-sync-runner.sh` and
   `plfa-sync` stay in place as the fallback.

## Adding a sync to a new platform

See the README section "Sync harness". Five steps: write `config.sh`, write `hooks.sh` (or rely
on `FINISHED_RE`/`SKIP_RE`), cut fixtures from a real log and add them to the tests, replay the
real log, then install and add the printed registry row.

## Not reproduced exactly

- The PLFA runner sourced its state file; the harness parses it (safer, same format).
- AppleScript alert text now escapes double quotes; the PLFA text has none, so nothing changes.
- With several `DNS_FALLBACK_HOSTS`, each pinned host gets its own `GIT_CONFIG_KEY_n`; with
  PLFA's one host the variables are identical to today's.
