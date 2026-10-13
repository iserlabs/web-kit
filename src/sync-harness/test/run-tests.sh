#!/usr/bin/env bash
# Behavior tests for the sync harness. One command, no framework:
#   bash src/sync-harness/test/run-tests.sh
# Drives the real runner, CLI, beat, install and replay with a fake sync that replays excerpts of
# the real Perry Lawson log (test/fixtures) and exits with the code that run really had. osascript,
# DNS and the clock are stubbed, so nothing here touches Safari, the network, launchd or the real
# log and state. PLFA_DIR picks the PLFA config and hooks under test (default: examples/plfa).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
H=$(cd "$HERE/.." && pwd)
FIX="$HERE/fixtures"
PLFA_DIR=${PLFA_DIR:-$H/examples/plfa}
pass=0; fail=0
T=$(mktemp -d "${TMPDIR:-/tmp}/sync-harness-test.XXXXXX") && T=$(cd "$T" && pwd)
busy=""
trap '[ -n "$busy" ] && kill "$busy" 2>/dev/null; rm -rf "$T"' EXIT

ok()  { echo "ok: $1"; pass=$((pass + 1)); }
bad() { echo "FAIL: $1"; fail=$((fail + 1)); }
eq()  { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }
has() { if grep -qF -- "$3" "$2" 2>/dev/null; then ok "$1"; else bad "$1 ('$3' not in $(basename "$2"))"; fi; }
hasnt() { if grep -qF -- "$3" "$2" 2>/dev/null; then bad "$1 ('$3' found in $(basename "$2"))"; else ok "$1"; fi; }
check() { local d=$1; shift; if "$@"; then ok "$d"; else bad "$d"; fi; }

# ---- stubs: osascript, DNS, a fake Business OS, and the fake sync ----
mkdir -p "$T/stubs" "$T/xos-tools/xos"
cat > "$T/stubs/osascript" <<'EOF'
#!/bin/bash
s=""; while [ $# -gt 0 ]; do if [ "$1" = -e ]; then s="$s$2"; shift; fi; shift; done
case "$s" in
  *"display notification"*) echo notify >> "$FAKE_OSA_LOG"; printf '%s\n' "$s" >> "$FAKE_OSA_LOG.notify" ;;
  *"other archive tabs"*) echo report >> "$FAKE_OSA_LOG"; echo "closed ${FAKE_CLOSED:-0} stuck tab(s); other archive tabs: Perry Lawson Fine Art | " ;;
  *"close tb"*) echo unstick >> "$FAKE_OSA_LOG"; echo "${FAKE_CLOSED:-0}" ;;
  *"source of t"*) echo shows >> "$FAKE_OSA_LOG"; printf '%s' "${FAKE_SAFARI:-none}" ;;
  *) echo other >> "$FAKE_OSA_LOG" ;;
esac
EOF
printf '#!/bin/sh\nexit 0\n' > "$T/stubs/resolve-ok"
printf '#!/bin/sh\nexit 1\n' > "$T/stubs/resolve-fail"
printf '#!/bin/sh\necho "github.com has address 140.82.114.4"\n' > "$T/stubs/host"
cat > "$T/fake-sync.sh" <<'EOF'
#!/bin/bash
# $1 = the log to append to, or - for stdout. Replays FAKE_FIXTURE and exits with its code.
echo sync >> "$FAKE_CALLS"
env | grep '^GIT_CONFIG' | sort > "$FAKE_ENV_OUT"
if [ "$1" = - ]; then grep -v '^# ' "$FAKE_FIXTURE"; else grep -v '^# ' "$FAKE_FIXTURE" >> "$1"; fi
exit "$(sed -n 's/^# exit: //p' "$FAKE_FIXTURE")"
EOF
: > "$T/xos-tools/xos/__init__.py"; : > "$T/xos-tools/xos/heartbeat.py"
printf 'import os, sys\nopen(os.environ["FAKE_CALLS"], "a").write("beat " + " ".join(sys.argv[1:]) + "\\n")\n' > "$T/xos-tools/xos/__main__.py"
chmod +x "$T/stubs/"* "$T/fake-sync.sh"
export PATH="$T/stubs:$PATH" HARNESS_PYTHON="$T/stubs/resolve-ok" FAKE_SYNC="$T/fake-sync.sh"
export FAKE_OSA_LOG="$T/osa.log" FAKE_CALLS="$T/calls" FAKE_ENV_OUT="$T/env.out"
[ "$(command -v osascript)" = "$T/stubs/osascript" ] || { echo "FAIL: osascript is not stubbed; refusing to run"; exit 1; }

# A code repo whose origin's main can move, for the "wait for main" rule.
G() { git -c core.hooksPath=/dev/null -c user.email=t@t.t -c user.name=t "$@"; }
G init -q "$T/work" && G -C "$T/work" commit -q --allow-empty -m one
G init -q --bare "$T/origin.git" && G -C "$T/work" push -q "$T/origin.git" HEAD:refs/heads/main
G clone -q "$T/origin.git" "$T/code" 2>/dev/null
move_main() { G -C "$T/work" commit -q --allow-empty -m "$1" && G -C "$T/work" push -q "$T/origin.git" HEAD:refs/heads/main; }
head_sha() { git -C "$T/code" ls-remote -q origin refs/heads/main | cut -c1-40; }

# The PLFA job, every path pointed into the temp dir.
mkdir -p "$T/plfa.d"
cat > "$T/plfa.d/config.sh" <<EOF
. "$PLFA_DIR/config.sh"
HOOKS="$PLFA_DIR/hooks.sh"
LOG="$T/plfa-sync.log"; STATE="$T/plfa-sync-runner.state"; PAGE="$T/page.html"; LAUNCHD_LOG="$T/launchd.log"
SYNC_CMD='/bin/bash "\$FAKE_SYNC" "\$LOG"'
SYNC_MATCH='fake-busy-$$'
NO_POPUPS="$T/no-popups"
CODE_REPO="$T/code"
XOS_TOOLS="$T/xos-tools"; XOS_PY=python3
EOF
CFG="$T/plfa.d/config.sh"; LOG="$T/plfa-sync.log"; STATE="$T/plfa-sync-runner.state"
bash "$H/sync-harness" config "$CFG" > "$T/resolved"
for k in LOG STATE NO_POPUPS CODE_REPO XOS_TOOLS; do
  grep -q "^$k=$T/" "$T/resolved" || { echo "FAIL: $k does not point into the temp dir; refusing to run"; exit 1; }
done
ok "the test job resolves every path into the temp dir"

N=2000000000; DUE=86100; SOON=3600
PAGE_CHECK=$'https://www.artworkarchive.com/profile/perry-lawson-fine-art\nJust a moment...\n<script src="/cdn-cgi/challenge-platform/h/b"></script>'
PAGE_SIGNIN=$'https://www.artworkarchive.com/users/sign_in\nSign in\n<input type="password" name="user[password]">'
PAGE_OK=$'https://www.artworkarchive.com/pieces/collections\nCollections\n<div class="piece">works</div>'

st() { sed -n "s/^$1=//p" "$STATE"; }
seed() { printf 'last_good=%s\nfails=%s\nnotified=%s\ndegraded=%s\nnext_try=%s\nfail_head=%s\n' "$@" > "$STATE"; }
reset() { rm -f "$STATE" "$LOG" "$FAKE_OSA_LOG" "$FAKE_OSA_LOG.notify" "$T/page.html" "$T/no-popups" "$FAKE_ENV_OUT"; : > "$FAKE_CALLS"; }
calls() { grep -c '^sync$' "$FAKE_CALLS"; }
notifies() { grep -c '^notify$' "$FAKE_OSA_LOG" 2>/dev/null; }
beat() {  # fixture now [VAR=value ...]
  local fx=$1 now=$2; shift 2
  env FAKE_FIXTURE="$FIX/$fx.txt" SYNC_HARNESS_NOW="$now" "$@" bash "$H/run.sh" "$CFG" >/dev/null 2>&1; rc=$?
}

echo "== every fixture, from a day-old good read =="
reset; seed $((N - DUE)) 0 0 0 0 ""; beat good-run $N
eq "good run: exit 0" $rc 0; eq "good run: last good read is now" "$(st last_good)" $N; eq "good run: ran the sync once" "$(calls)" 1
eq "good run: no failures" "$(st fails)" 0; hasnt "good run: no runner line (the sync's done. line says it)" "$LOG" "runner:"

reset; seed $((N - DUE)) 0 0 2 0 ""; beat quiet-run $N
eq "quiet run: counts as a good read" "$(st last_good)" $N; eq "quiet run: clears the partial streak" "$(st degraded)" 0

reset; seed $((N - DUE)) 0 0 0 0 ""; beat not-signed-in $N FAKE_SAFARI="$PAGE_CHECK"
eq "NOT SIGNED IN on a bot check: retried within the hour" "$(st last_good)" $((N - DUE + SOON))
eq "NOT SIGNED IN: partial streak 1" "$(st degraded)" 1; eq "NOT SIGNED IN: exit 0" $rc 0
has "NOT SIGNED IN: says slow page or bot check, not sign in" "$LOG" "runner: partial run 1 in a row: the archive was slow or showed its bot check, so the artist and show lists were not refreshed this time. Sales and prices did publish. Trying again within the hour."
eq "NOT SIGNED IN: looked at Safari, then cleared stuck tabs" "$(tr '\n' ' ' < "$FAKE_OSA_LOG")" "unstick shows unstick "
has "NOT SIGNED IN: saved the page Safari showed" "$T/page.html" "Just a moment"

reset; seed $((N - DUE)) 0 0 0 0 ""; beat not-signed-in $N FAKE_SAFARI="$PAGE_SIGNIN"
eq "real sign-out: next read tomorrow, not within the hour" "$(st last_good)" $N
has "real sign-out: asks for a sign-in" "$LOG" "because Safari is signed out of Artwork Archive. Open Safari and sign in as the gallery."

reset; seed $((N - DUE)) 0 0 0 0 ""; beat archive-incomplete $N
eq "ARCHIVE READ INCOMPLETE: retried within the hour" "$(st last_good)" $((N - DUE + SOON))
has "ARCHIVE READ INCOMPLETE: names the first kind" "$LOG" "runner: partial run 1 in a row: the archive showed slow page on one read, so part of the artist and show lists was not refreshed."

reset; seed $((N - DUE)) 0 0 0 0 ""; beat self-check-failure $N
eq "self-check failure: counted" "$(st fails)" 1; eq "self-check failure: remembers main's tip" "$(st fail_head)" "$(head_sha)"
eq "self-check failure: exit 0 on the first one" $rc 0
has "self-check failure: named as code, not Safari" "$LOG" "runner: failure 1 in a row: new code from main fails the self-check (2026-10-07 14:10:25  FAILED (exit 1). New code from main failed the self-check. Nothing was published; the live site is as it was.). Nothing was published and the live site is fine. Waiting for main to change, or 3 hours."

reset; seed $((N - DUE)) 0 0 0 0 ""; beat cloudflare-failure $N FAKE_SAFARI="$PAGE_CHECK" FAKE_CLOSED=1
eq "Cloudflare failure: counted" "$(st fails)" 1; eq "Cloudflare failure: retry in 15 minutes" "$(st next_try)" $((N + 900))
has "Cloudflare failure: closed a stuck tab before starting" "$LOG" "runner: closed 1 archive tab(s) stuck on the bot check before starting"
has "Cloudflare failure: says what Safari showed" "$LOG" "runner: failure 1 in a row. Safari was on the archive's Cloudflare check (verify you are human). Page saved to $T/page.html. Closed 1 stuck tab(s). Retrying in 15 minutes."

reset; seed $((N - DUE)) 0 0 0 0 ""; beat safari-timeout $N FAKE_SAFARI="$PAGE_OK"
has "Safari timeout: a Safari failure, despite a stood-down line inside it" "$LOG" "runner: failure 1 in a row. Safari was on a page that did not finish loading in time."
hasnt "Safari timeout: not called a permission problem (the 10-11 misread)" "$LOG" "macOS is not letting"

reset; seed $((N - DUE)) 0 0 0 0 ""; beat permission-failure $N
eq "permission failure: retry in an hour" "$(st next_try)" $((N + 3600))
has "permission failure: says so" "$LOG" "runner: failure 1 in a row: macOS is not letting the sync control Safari."
hasnt "permission failure: never touched Safari's tabs after" "$FAKE_OSA_LOG" "shows"

reset; seed $((N - DUE)) 0 0 1 0 ""; cp "$STATE" "$T/before"; beat dark-wake-skip $N
check "dark-wake skip: state untouched" cmp -s "$STATE" "$T/before"; eq "dark-wake skip: exit 0" $rc 0

reset; seed $((N - DUE)) 0 0 0 0 ""; cp "$STATE" "$T/before"; beat stood-down-only $N
check "stood down: state untouched" cmp -s "$STATE" "$T/before"

reset; seed $((N - DUE)) 0 0 0 0 ""; beat stood-down-interleave $N
eq "finished run with another run's stood-down line: not a skip" "$(st degraded)" 1
eq "finished run with another run's stood-down line: last good read now" "$(st last_good)" $N

reset; seed $((N - DUE)) 0 0 0 0 ""; beat fetch-failed-partial $N
eq "GitHub fetch failed: partial, next read tomorrow" "$(st last_good)" $N
has "GitHub fetch failed: says so" "$LOG" "runner: partial run 1 in a row: it could not reach GitHub, so it may be on old code. It retries by itself."

echo "== backoff, red, and one alert per six hours =="
reset; seed $((N - DUE)) 0 0 0 0 ""; t=$N; prev=0
for want in 900 1800 3600 3600; do
  beat cloudflare-failure $t FAKE_SAFARI="$PAGE_CHECK"
  eq "backoff after failure $(st fails): $((want / 60)) minutes" $(($(st next_try) - t)) $want
  prev=$rc; codes="${codes:-}$rc"; t=$(st next_try)
done
eq "exit codes across four failures: 0 0 1 1" "$codes" "0011"
eq "one pop-up across failures 3 and 4 (an hour apart)" "$(notifies)" 1
has "the pop-up asks for the tick box" "$FAKE_OSA_LOG.notify" 'display notification "3 runs in a row. Open Safari, go to the Artwork Archive tab and tick the box if one shows. It retries by itself." with title "Perry Lawson sync blocked"'
before=$(calls); beat cloudflare-failure $((t - 1)); eq "nothing runs before the next try" "$(calls)" "$before"
beat good-run $t
eq "a good read clears the failures" "$(st fails)/$(st next_try)/$(st fail_head)" "0/0/"

reset; seed $((N - DUE)) 0 0 0 0 ""; touch "$T/no-popups"; t=$N
for i in 1 2 3; do beat cloudflare-failure $t FAKE_SAFARI="$PAGE_CHECK"; t=$(st next_try); done
eq "no-pop-ups file: no pop-up" "$(notifies)" 0
has "no-pop-ups file: the alert goes to the log" "$LOG" "runner: alert (Mac pop-up off): Perry Lawson sync blocked: 3 runs in a row."

reset; seed $((N - DUE)) 0 0 0 0 ""; t=$N
for i in 1 2 3; do beat fetch-failed-partial $t; t=$((t + DUE)); done
eq "three partials in a row: one pop-up" "$(notifies)" 1
has "three partials: titled partly working" "$FAKE_OSA_LOG.notify" 'with title "Perry Lawson sync is only partly working"'
has "three partials: sales still publish" "$FAKE_OSA_LOG.notify" "Sales still publish, but it could not reach GitHub"

reset; seed $((N - DUE)) 1 0 0 0 ""; beat permission-failure $N
eq "second permission failure: one pop-up" "$(notifies)" 1

echo "== when it runs at all =="
reset; seed $((N - 3600)) 0 0 0 0 ""; beat good-run $N
eq "not due an hour after a good read" "$(calls)" 0; eq "not due: exit 0" $rc 0
reset; seed $((N - DUE)) 1 0 0 $((N + 600)) ""; beat good-run $N
eq "waits for next try" "$(calls)" 0
reset; seed $((N - 31 * 3600)) 0 0 0 $((N + 600)) ""; beat good-run $N
eq "31 hours without a good read: exit 1 even while waiting" $rc 1

reset; seed $((N - DUE)) 0 0 0 0 ""; beat self-check-failure $N
beat good-run $((N + 900)); eq "after a code failure, same main: does not run" "$(calls)" 1
move_main two; beat good-run $((N + 1800)); eq "main moved: runs again" "$(calls)" 2
reset; seed $((N - DUE)) 0 0 0 0 ""; beat self-check-failure $N
beat good-run $((N + 3 * 3600 + 1)); eq "same main but 3 hours on: runs again" "$(calls)" 2

reset; seed $((N - DUE)) 0 0 0 0 ""; cp "$STATE" "$T/before"
bash -c 'sleep 30; :' "fake-busy-$$" & busy=$!; sleep 0.3
beat good-run $N; eq "a run already going: this beat does nothing" "$(calls)" 0
check "a run already going: state untouched" cmp -s "$STATE" "$T/before"
kill "$busy" 2>/dev/null; wait "$busy" 2>/dev/null; busy=""

reset; printf 'last_good=%s\nfails=$(touch %s/pwned)\n' $((N - 3600)) "$T" > "$STATE"; beat good-run $N
check "the state file is read, never run" test ! -e "$T/pwned"

reset; seed $((N - DUE)) 0 0 0 0 ""; beat quiet-run $N HARNESS_PYTHON="$T/stubs/resolve-fail"
has "DNS fallback: says what it pinned" "$LOG" "runner: this Mac could not look up github.com; using 140.82.114.4 from the router for this run's git calls"
eq "DNS fallback: the sync's git sees the pin" "$(tr '\n' ' ' < "$FAKE_ENV_OUT")" "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.curloptResolve GIT_CONFIG_VALUE_0=github.com:443:140.82.114.4 "
reset; seed $((N - DUE)) 0 0 0 0 ""; beat quiet-run $N
eq "DNS fine: no pin" "$(cat "$FAKE_ENV_OUT")" ""

printf '. "%s"\nLOG_MAX_BYTES=2000; LOG_KEEP_LINES=50\n' "$CFG" > "$T/plfa.d/trim.sh"
reset; seed $((N - DUE)) 0 0 0 0 ""
for i in $(seq 1 500); do echo "2026-10-01 00:00:00  filler $i"; done > "$LOG"
FAKE_FIXTURE="$FIX/quiet-run.txt" SYNC_HARNESS_NOW=$N bash "$H/run.sh" "$T/plfa.d/trim.sh" >/dev/null 2>&1
eq "log trimmed to its last 50 lines before the run" "$(head -1 "$LOG")" "2026-10-01 00:00:00  filler 451"
eq "log length after trim and run" "$(wc -l < "$LOG" | tr -d ' ')" $((50 + $(grep -vc '^# ' "$FIX/quiet-run.txt")))

echo "== a job with no hooks (the generic defaults) =="
mkdir -p "$T/demo.d" "$T/odd.d"
cat > "$T/demo.d/config.sh" <<EOF
JOB=demo; TITLE="Demo feed"
SYNC_CMD='/bin/bash "\$FAKE_SYNC" -'
LOG="$T/demo.log"; STATE="$T/demo.state"; NO_POPUPS="$T/no-popups"
FINISHED_RE='published'; SKIP_RE='stood down'
EOF
printf '# exit: 0\npublished 3 items\nstood down: another run (process 1) is still going\n' > "$T/demo-ok.txt"
printf '# exit: 0\nstood down: another run (process 1) is still going\n' > "$T/demo-skip.txt"
printf '# exit: 3\ncould not reach the feed\n' > "$T/demo-fail.txt"
D="$T/demo.d/config.sh"; DS="$T/demo.state"
dbeat() { FAKE_FIXTURE="$T/$1.txt" SYNC_HARNESS_NOW=$2 bash "$H/run.sh" "$D" >/dev/null 2>&1; rc=$?; }
: > "$FAKE_CALLS"; printf 'last_good=%s\n' $((N - DUE)) > "$DS"; dbeat demo-ok $N
eq "generic: finished run is ok despite a stood-down line" "$(sed -n 's/^last_good=//p' "$DS")" $N
has "generic: the sync's output lands in the log" "$T/demo.log" "published 3 items"
has "generic: says good run" "$T/demo.log" "runner: good run"
printf 'last_good=%s\n' $((N - DUE)) > "$DS"; cp "$DS" "$T/before"; dbeat demo-skip $N
check "generic: an unfinished stood-down run is a skip" cmp -s "$DS" "$T/before"
dbeat demo-fail $N
has "generic: a failed exit backs off" "$T/demo.log" "runner: failure 1 in a row: the read from the source failed (exit 3). Retrying in 15 minutes."
rm -f "$DS"; printf 'last_good=%s\n' $((N - DUE)) > "$DS"
sleep 30 & busy=$!; echo "$busy" > "$DS.pid"; before=$(calls); dbeat demo-ok $N
eq "generic: no SYNC_MATCH, a live pid file means a run is going" "$(calls)" "$before"
kill "$busy" 2>/dev/null; wait "$busy" 2>/dev/null; busy=""
dbeat demo-ok $N; eq "generic: a dead pid file does not block" "$(calls)" $((before + 1))
check "generic: the pid file is removed after the run" test ! -e "$DS.pid"

sed "s#demo.log#odd.log#; s#demo.state#odd.state#" "$D" > "$T/odd.d/config.sh"
echo 'hook_classify() { echo banana; }' > "$T/odd.d/hooks.sh"
printf 'last_good=%s\n' $((N - DUE)) > "$T/odd.state"
FAKE_FIXTURE="$T/demo-ok.txt" SYNC_HARNESS_NOW=$N bash "$H/run.sh" "$T/odd.d/config.sh" >/dev/null 2>&1
has "a hooks.sh next to the config is found, and a non-verdict counts as a failure" "$T/odd.log" "the classify hook answered 'banana', which is not a verdict"
SYNC_HARNESS_PATH="$T" bash "$H/sync-harness" config demo > "$T/byname" 2>&1
has "a job is found by name along SYNC_HARNESS_PATH" "$T/byname" "CONFIG=$T/demo.d/config.sh"

echo "== the CLI =="
cli() { SYNC_HARNESS_NOW=$1 bash "$H/sync-harness" "$2" "$CFG" > "$T/out" 2>&1; }
reset; seed $((N - DUE)) 0 0 0 0 ""; beat good-run $N; cli $((N + 60)) status
eq "status: healthy" "$(sed -n 1p "$T/out")" "PLFA sync: HEALTHY"
eq "status: last good read" "$(sed -n 2p "$T/out" | sed 's/: .*, /: X, /')" "last good read: X, 1 min ago"
eq "status: failures" "$(sed -n 3p "$T/out")" "failures in a row: 0"
has "status: next run due" "$T/out" "next run due: "
has "status: last event" "$T/out" "last event: 2026-10-11 15:04:33  done. no change across 151 works"
has "status: the week line" "$T/out" "week: "
eq "status: six lines" "$(wc -l < "$T/out" | tr -d ' ')" 6
reset; seed $((N - DUE)) 0 0 0 0 ""; beat cloudflare-failure $N; cli $((N + 60)) status
eq "status: retrying" "$(sed -n 1p "$T/out")" "PLFA sync: RETRYING (a hiccup, it heals itself)"; has "status: next try" "$T/out" "next try: "
reset; seed $((N - DUE)) 0 0 0 0 ""; beat self-check-failure $N; cli $((N + 60)) status
has "status: waiting on main" "$T/out" "next try: when main changes, or 3 hours after the last failure"
reset; seed $((N - DUE)) 0 0 0 0 ""; beat fetch-failed-partial $N; cli $((N + 60)) status
eq "status: partial" "$(sed -n 1p "$T/out")" "PLFA sync: PARTIAL (sales publish; the last event says what was missed)"
has "status: partial streak" "$T/out" "failures in a row: 0, partial runs in a row: 1"
reset; seed $((N - DUE)) 2 0 0 0 ""; beat permission-failure $N; cli $((N + 60)) status
eq "status: red after three" "$(sed -n 1p "$T/out")" "PLFA sync: RED"
printf '%s\n' "2026-10-12 19:19:04  vercel: /x/vercel" >> "$LOG"; cli $((N + 60)) status
check "status: last event skips noise lines" grep -Eq "^last event: [0-9-]+ [0-9:]+  runner: failure 3 in a row: macOS is not letting the sync control Safari.$" "$T/out"

WN=$(python3 -c 'import time, datetime; print(int(time.mktime(datetime.datetime(2026, 10, 12, 21).timetuple())))')
reset
for d in 06 07 08 09 10 11 12; do echo "2026-10-$d 09:00:00  done. 1 change across 151 works"; done > "$LOG"
echo "2026-10-09 08:00:00  runner: failure 1 in a row. Safari was on x. Page saved to y. Closed 2 stuck tab(s). Retrying in 15 minutes." >> "$LOG"
echo "2026-10-10 08:00:00  runner: closed 1 archive tab(s) stuck on the bot check before starting" >> "$LOG"
cli "$WN" week
eq "week: hands-off" "$(cat "$T/out")" "week: HANDS-OFF | days with a good read 7 of 7 | failures 1 (longest streak 1) | partial runs 0 | stuck tabs the sync closed itself 3 | manual runs or unsticks 0"
echo "2026-10-11 10:00:00  manual: run now" >> "$LOG"; sed -i.bak '/2026-10-08 09/d' "$LOG"; cli "$WN" week
eq "week: a manual run and a missing day" "$(tr '\n' '|' < "$T/out")" "week: NOT YET | days with a good read 6 of 7 | failures 1 (longest streak 1) | partial runs 0 | stuck tabs the sync closed itself 3 | manual runs or unsticks 1|days with no good read: Thu Oct 8|"

reset; cli $N unstick
eq "unstick: reports what Safari shows" "$(cat "$T/out")" "closed 0 stuck tab(s); other archive tabs: Perry Lawson Fine Art | "
has "unstick: logged as manual help" "$LOG" "manual: unstick"
reset; seed $((N - DUE)) 1 0 0 $((N + 600)) ""
FAKE_FIXTURE="$FIX/quiet-run.txt" SYNC_HARNESS_NOW=$N bash "$H/sync-harness" now "$CFG" > "$T/out" 2>&1
eq "now: runs despite the wait" "$(calls)" 1; has "now: then prints the status" "$T/out" "PLFA sync: HEALTHY"
has "now: logged as manual help" "$LOG" "manual: run now"
bash -c 'sleep 30; :' "fake-busy-$$" & busy=$!; sleep 0.3; cli $N now
eq "now while a run is going: says so" "$(sed -n 1p "$T/out")" "a run is already going; status follows"
kill "$busy" 2>/dev/null; wait "$busy" 2>/dev/null; busy=""

echo "== the beat: runner first, then the heartbeat =="
reset; seed $((N - DUE)) 0 0 0 0 ""
FAKE_FIXTURE="$FIX/quiet-run.txt" SYNC_HARNESS_NOW=$N bash "$H/beat.sh" "$CFG" >/dev/null 2>&1; rc=$?
eq "beat: the sync ran, then the heartbeat with its exit code" "$(tr '\n' '|' < "$FAKE_CALLS")" "sync|beat beat plfa-sync -- /bin/sh -c exit 0|"
eq "beat: exit 0" $rc 0
reset; seed $((N - DUE)) 2 0 0 0 ""
FAKE_FIXTURE="$FIX/permission-failure.txt" SYNC_HARNESS_NOW=$N bash "$H/beat.sh" "$CFG" >/dev/null 2>&1; rc=$?
eq "beat: a red run passes exit 1 to the heartbeat" "$(tail -1 "$FAKE_CALLS")" "beat beat plfa-sync -- /bin/sh -c exit 1"
eq "beat: and exits 1 itself" $rc 1
printf '. "%s"\nXOS_TOOLS="%s/nowhere"\n' "$CFG" "$T" > "$T/plfa.d/noxos.sh"
reset; seed $((N - 3600)) 0 0 0 0 ""; SYNC_HARNESS_NOW=$N bash "$H/beat.sh" "$T/plfa.d/noxos.sh" >/dev/null 2>&1
has "beat: a missing Business OS is logged, not fatal" "$LOG" "runner: xos beat could not load, so /os did not get this heartbeat"

echo "== install: plist written, registry row printed, nothing loaded =="
bash "$H/install.sh" "$CFG" --agents-dir "$T/agents" --home "$T/hh" > "$T/out" 2>&1; rc=$?
P="$T/agents/host.xenia.plfa-sync.plist"
eq "install: exit 0" $rc 0
check "install: plist written" test -f "$P"
if command -v plutil >/dev/null; then check "install: plist passes plutil -lint" plutil -lint -s "$P"; fi
has "install: every 15 minutes" "$P" "<integer>900</integer>"
has "install: launchd runs the copied beat with the job's config" "$P" "<string>/bin/bash '$T/hh/beat.sh' '$CFG'</string>"
has "install: same launchd log as today" "$P" "<string>$T/launchd.log</string>"
check "install: the copied harness parses" bash -n "$T/hh/run.sh"
has "install: prints the launchctl line, does not run it" "$T/out" "launchctl bootstrap gui/"
row=$(grep -F '"plfa-sync": {' "$T/out")
printf '%s\n' 'import json, sys' 'row = sys.argv[1].strip().rstrip(",")' 'print(json.dumps(json.loads("{" + row + "}"), sort_keys=True))' > "$T/row.py"
eq "install: registry row matches today's" "$(python3 "$T/row.py" "$row")" \
   '{"plfa-sync": {"active": true, "every_min": 15, "grace_min": 45, "label": "host.xenia.plfa-sync", "plain": "the Perry Lawson archive sync"}}'
printf '. "%s"\nINTERVAL_MIN=30\n' "$CFG" > "$T/plfa.d/slow.sh"
bash "$H/install.sh" "$T/plfa.d/slow.sh" --agents-dir "$T/agents" --home "$T/hh" > "$T/out" 2>&1; rc=$?
eq "install: a different existing plist is left alone without --force" $rc 3
has "install: and the old one is unchanged" "$P" "<integer>900</integer>"
bash "$H/install.sh" "$T/plfa.d/slow.sh" --agents-dir "$T/agents" --home "$T/hh" --force > "$T/out" 2>&1
has "install --force: replaced" "$P" "<integer>1800</integer>"
has_backup() { ls "$P".bak-* >/dev/null 2>&1; }
check "install --force: kept a backup" has_backup

echo "== replay: classify a log after the fact, touching nothing =="
reset
for f in dark-wake-skip good-run safari-timeout cloudflare-failure stood-down-interleave; do
  grep -v '^# ' "$FIX/$f.txt"
  [ $f = cloudflare-failure ] && echo "2026-10-12 17:33:43  runner: failure 1 in a row. Safari was on x."
done > "$T/replay.log"
bash "$H/replay.sh" "$CFG" --log "$T/replay.log" > "$T/out" 2>&1
check "replay: 7 runs (two stood-down beats cut out of the runs they interrupted)" grep -q "^7 runs in $T/replay.log" "$T/out"
for want in "skip 3" "fail-browser 2" "ok 1" "partial 1"; do
  check "replay: $want" grep -Eq "^  ${want% *} +${want#* }$" "$T/out"
done
has "replay: compares with the runner's line at the time" "$T/out" "verdict family differs from the runner's own line at the time: 0 of 1 runs that had one"
check "replay: never called osascript" test ! -e "$FAKE_OSA_LOG"
check "replay: never wrote the page file" test ! -e "$T/page.html"

echo "== every script parses =="
for f in "$H"/lib.sh "$H"/run.sh "$H"/sync-harness "$H"/beat.sh "$H"/install.sh "$H"/replay.sh "$H"/examples/plfa/*.sh "$PLFA_DIR"/*.sh; do
  check "bash -n $(basename "$(dirname "$f")")/$(basename "$f")" bash -n "$f"
done
LIVE="$HOME/Claude/clients/plfa-sync.d"
if [ -d "$LIVE" ] && [ "$PLFA_DIR" != "$LIVE" ]; then
  for f in config.sh hooks.sh; do
    cmp -s "$LIVE/$f" "$H/examples/plfa/$f" || echo "note: $LIVE/$f differs from the kit's reference copy"
  done
fi

echo "== run now keeps the last good read (2026-10-13: zeroing it made a forced failure read as stale) =="
reset; seed $((N - 3600)) 0 0 0 0 ""
FAKE_FIXTURE="$FIX/cloudflare-failure.txt" SYNC_HARNESS_NOW=$N FAKE_SAFARI="$PAGE_CHECK" bash "$H/sync-harness" now "$CFG" > "$T/out" 2>&1
eq "run now: runs even though not due" "$(calls)" 1
eq "run now: last good read kept" "$(st last_good)" $((N - 3600))
eq "run now: one failure recorded" "$(st fails)" 1
check "run now: not red after one forced failure" bash -c "! grep -q 'PLFA sync: RED' '$T/out'"
reset; seed $((N - 3600)) 0 0 0 0 ""
FAKE_FIXTURE="$FIX/cloudflare-failure.txt" SYNC_HARNESS_NOW=$N FAKE_SAFARI="$PAGE_CHECK" bash "$H/run.sh" "$CFG" >/dev/null 2>&1; rc=$?
eq "a scheduled beat still waits when not due" "$(calls)" 0

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
