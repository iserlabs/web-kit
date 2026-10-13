#!/bin/bash
# sync-harness runner: one beat of a scheduled external-source sync.
#   run.sh <job | config file>
#
# launchd fires the beat (beat.sh) every INTERVAL_MIN minutes; this runner decides whether the
# real sync is due, runs it, reads what this run wrote to the log, asks the job's classify hook for
# ONE verdict, and records the result in the state file. The exit code is what the Business OS
# watchdog reads: 0 while things are fine or a hiccup is still being retried, 1 after RED_AFTER
# failures in a row or STALE_HOURS without a good read.
#
# Extracted from the Perry Lawson archive sync runner (plfa-sync-runner.sh, rebuilt 2026-10-12
# after 43 failures in nine days). Every behavior below is one that runner earned:
#  1) once a good read is in, nothing runs again until DUE_HOURS later (less a little slack so
#     beat jitter never skips a day); a half read is retried within SOON_MIN minutes instead.
#  2) a run already going owns the log; this beat stays out of its way and says nothing.
#  3) another run's "stood down" line can land in this run's stretch of the shared log, so a run
#     that finished is never counted as skipped (the classify hook decides; see FINISHED_RE).
#  4) read failures back off 15, 30, then 60 minutes (BACKOFF_MIN).
#  5) a code failure cannot pass until the code changes, so it waits for CODE_BRANCH to move (or
#     CODE_WAIT_MIN) instead of re-running every beat.
#  6) at most one alert per NOTIFY_GAP_HOURS, and log-only while the no-pop-ups file exists.
#  7) the log is trimmed past LOG_MAX_BYTES to its last LOG_KEEP_LINES lines.
#  8) when this Mac cannot look up a DNS_FALLBACK_HOSTS host, its address is pinned for this run's
#     git calls only, from a direct query to the router. Nothing on the Mac changes.
#
# Bash on purpose: launchd starts it, and macOS judges automation permission (driving Safari, for
# one) by the process that launchd started. Wrapping this in python made macOS refuse the sync.
#
# Hooks (shell functions in the job's hooks file, all optional):
#   hook_classify FRESH CODE   print "<verdict> [reason]". Verdicts: ok, partial, partial-retry-soon,
#                              fail-browser, fail-code, fail-build, fail-permission, skip.
#   hook_explain VERDICT REASON FRESH
#                              print two lines: the log text, then the alert text. For a partial,
#                              line 1 is the sentence after "partial run N in a row: ". For a
#                              failure, it is everything after "failure N in a row" (start it with
#                              ": " or ". ").
#   hook_before_run            print a sentence to log, or nothing (e.g. closed stuck tabs)
#   hook_after_fail VERDICT    after a read failure or a half read; print a note, or nothing
#   hook_head                  print the code branch tip (default: git ls-remote on CODE_REPO)
# While a hook runs, HARNESS_NOW, HARNESS_FAILS, HARNESS_DEGRADED, HARNESS_CODE and
# HARNESS_WAIT_MIN describe the run.

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"
harness_load "$(harness_find_config "${1:-}")"

say() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "runner: $*" >> "$LOG"; }

harness_read_state
save() { harness_write_state; }

alert() {   # $1 title, $2 body
  if [ -e "$NO_POPUPS" ]; then say "alert (Mac pop-up off): $1: $2"
  else
    local t=${1//\"/\\\"} b=${2//\"/\\\"}
    osascript -e "display notification \"$b\" with title \"$t\"" >/dev/null 2>&1
  fi
  notified=$now
}

verdict() {   # the exit code the watchdog reads
  if [ "$fails" -ge "$RED_AFTER" ] || [ $((now - last_good)) -ge "$STALE" ]; then exit 1; fi
  exit 0
}

# The default answer when a job has no classify hook.
default_classify() {   # $1 fresh file, $2 exit code
  if [ "$2" -ne 0 ]; then echo fail-browser; return; fi
  if [ -n "$FINISHED_RE" ] && grep -Eq "$FINISHED_RE" "$1"; then echo ok; return; fi
  if [ -n "$SKIP_RE" ] && grep -Eq "$SKIP_RE" "$1"; then echo skip; return; fi
  echo ok
}

default_explain() {   # $1 verdict, $2 reason
  case $1 in
    partial|partial-retry-soon)
      printf '%s\n%s\n' "the sync finished but part of it did not work${2:+ ($2)}." \
        "It still publishes, but part of the read did not work${2:+ ($2)}. It retries by itself." ;;
    fail-permission)
      printf '%s\n%s\n' ": macOS refused a permission the sync needs." \
        "macOS blocked the sync. System Settings, Privacy and Security: allow it, then it retries by itself." ;;
    fail-code)
      printf '%s\n%s\n' ": new code fails its own check (exit $HARNESS_CODE). Nothing was published. Waiting for $CODE_BRANCH to change, or $CODE_WAIT_MIN minutes." \
        "A code change fails the self-check. Nothing was published. Needs a look in Claude Code." ;;
    fail-build)
      printf '%s\n%s\n' ": the sync stopped after reading the source (exit $HARNESS_CODE)." \
        "The source read fine but the sync stopped itself before publishing. Needs a look in Claude Code." ;;
    *)
      printf '%s\n%s\n' ": the read from the source failed (exit $HARNESS_CODE)." \
        "$HARNESS_FAILS runs in a row could not read the source. It retries by itself." ;;
  esac
}

explain() {   # sets line1 and line2
  local out
  if harness_has hook_explain; then out=$(hook_explain "$v" "$reason" "$FRESH"); else out=$(default_explain "$v" "$reason"); fi
  line1=$(printf '%s\n' "$out" | sed -n 1p)
  line2=$(printf '%s\n' "$out" | sed -n 2p)
}

after_fail() { harness_has hook_after_fail && hook_after_fail "$v"; }

now=$(harness_now)

# Keep the log from growing without end (the PLFA log reached 2 MB and 38,000 lines).
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt "$LOG_MAX_BYTES" ]; then
  tail -n "$LOG_KEEP_LINES" "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

# SYNC_HARNESS_FORCE=1 (from `sync-harness now`) skips the waiting rules below WITHOUT forgetting
# when the last good read was. Zeroing last_good to force a run (the first version) made any forced
# run that then failed read as 30 hours stale, so the watchdog went red on a single hiccup.
if [ "${SYNC_HARNESS_FORCE:-0}" != 1 ]; then
[ $((now - last_good)) -lt "$DUE" ] && verdict
[ "$now" -lt "${next_try:-0}" ] && verdict
if [ -n "$fail_head" ]; then
  head=$(harness_code_head)
  if [ -n "$head" ] && [ "$head" = "$fail_head" ] && [ "$now" -lt $((next_try + CODE_WAIT)) ]; then verdict; fi
fi
fi

# A run already going owns the log and whatever it drives; this beat says nothing.
FRESH=""; own_pid=0
cleanup() { [ -n "$FRESH" ] && rm -f "$FRESH"; [ "$own_pid" = 1 ] && rm -f "$STATE.pid"; }
trap cleanup EXIT
if [ -n "$SYNC_MATCH" ]; then
  pgrep -f "$SYNC_MATCH" >/dev/null && verdict
else
  if [ -f "$STATE.pid" ] && kill -0 "$(cat "$STATE.pid" 2>/dev/null)" 2>/dev/null; then verdict; fi
  echo $$ > "$STATE.pid"; own_pid=1
fi

export HARNESS_NOW=$now HARNESS_FAILS=$fails HARNESS_DEGRADED=$degraded HARNESS_CODE=0 HARNESS_WAIT_MIN=0
if harness_has hook_before_run; then
  note=$(hook_before_run)
  [ -n "$note" ] && say "$note"
fi

n=0
for host in $DNS_FALLBACK_HOSTS; do
  harness_resolves "$host" && continue
  ip=$(host -W 3 -t A "$host" 2>/dev/null | awk '/has address/ {print $4; exit}')
  [ -n "$ip" ] || continue
  export "GIT_CONFIG_KEY_$n=http.curloptResolve" "GIT_CONFIG_VALUE_$n=$host:443:$ip"
  n=$((n + 1))
  say "this Mac could not look up $host; using $ip from the router for this run's git calls"
done
[ "$n" -gt 0 ] && export GIT_CONFIG_COUNT=$n

touch "$LOG"
mark=$(wc -l < "$LOG")
if [ "$SYNC_WRITES_LOG" = 1 ]; then
  eval "$SYNC_CMD"
else
  eval "$SYNC_CMD" >> "$LOG" 2>&1
fi
code=$?
now=$(harness_now)
FRESH=$(mktemp "${TMPDIR:-/tmp}/sync-harness-$JOB.XXXXXX")
tail -n +$((mark + 1)) "$LOG" > "$FRESH"

export HARNESS_NOW=$now HARNESS_CODE=$code
if harness_has hook_classify; then out=$(hook_classify "$FRESH" "$code"); else out=$(default_classify "$FRESH" "$code"); fi
read -r v reason <<< "$out"
if ! harness_is_verdict "$v"; then
  say "the classify hook answered '${out:0:80}', which is not a verdict; counting this run as a failure"
  v=fail-build; reason=""
fi

[ "$v" = skip ] && verdict   # a dark-wake skip, or standing down for a run already going: reads nothing

if [ "$v" = ok ] || [ "$v" = partial ] || [ "$v" = partial-retry-soon ]; then
  fails=0; next_try=0; fail_head=""
  if [ "$v" = ok ]; then
    last_good=$now; degraded=0
    [ "$SAY_OK" = 1 ] && say "good run"
  else
    [ "$v" = partial-retry-soon ] && after_fail >/dev/null
    degraded=$((degraded + 1))
    export HARNESS_DEGRADED=$degraded HARNESS_FAILS=0
    explain
    # The run published what matters most; a half read is tried again soon.
    if [ "$v" = partial-retry-soon ]; then last_good=$((now - DUE + SOON)); else last_good=$now; fi
    say "partial run $degraded in a row: $line1"
    if [ "$degraded" -ge "$PARTIAL_ALERT_AFTER" ] && [ $((now - notified)) -ge "$NOTIFY_GAP" ]; then
      alert "$TITLE is only partly working" "$line2"
    fi
  fi
  save; verdict
fi

fails=$((fails + 1))
export HARNESS_FAILS=$fails

case $v in
  fail-permission)
    explain
    say "failure $fails in a row$line1"
    next_try=$((now + PERMISSION_RETRY_MIN * 60))
    if [ "$fails" -ge "$ALERT_AFTER" ] && [ $((now - notified)) -ge "$NOTIFY_GAP" ]; then alert "$TITLE blocked" "$line2"; fi
    save; verdict ;;
  fail-code|fail-build)
    retry=""
    if [ "$v" = fail-code ]; then
      if harness_has_code_head; then fail_head=$(harness_code_head); next_try=$now
      else next_try=$((now + CODE_WAIT)); fi
    else
      next_try=$((now + BUILD_RETRY_MIN * 60)); retry=" Retrying in $BUILD_RETRY_MIN minutes."
    fi
    explain
    say "failure $fails in a row$line1$retry"
    if [ "$fails" -ge "$ALERT_AFTER" ] && [ $((now - notified)) -ge "$NOTIFY_GAP" ]; then alert "$TITLE blocked" "$line2"; fi
    save; verdict ;;
esac

# fail-browser: the read itself failed. Name what went wrong, let the hook clear up, back off.
fail_head=""
read -r -a steps <<< "$BACKOFF_MIN"
i=$((fails - 1)); [ "$i" -ge "${#steps[@]}" ] && i=$((${#steps[@]} - 1))
wait_min=${steps[$i]:-60}
export HARNESS_WAIT_MIN=$wait_min
explain
note=$(after_fail)
next_try=$((now + wait_min * 60))
say "failure $fails in a row$line1${note:+ $note} Retrying in $wait_min minutes."
if [ "$fails" -ge "$BROWSER_ALERT_AFTER" ] && [ $((now - notified)) -ge "$NOTIFY_GAP" ]; then alert "$TITLE blocked" "$line2"; fi
save; verdict
