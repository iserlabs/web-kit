#!/bin/bash
# sync-harness replay: run a job's classify hook over every run already in a log, as a table, so
# a new or changed hook can be compared with what really happened. Read-only: it never runs the
# sync, never writes the state, and runs the hooks in dry mode (SYNC_HARNESS_DRY=1) with an
# osascript that refuses, so no app is touched and no file is written.
#   replay.sh <job | config file> [--log FILE] [--since YYYY-MM-DD]
#
# The log is cut into runs with the config's RUN_START_RE. A run whose first line matches
# SHORT_RUN_RE (a dark-wake skip, or a beat standing down for a run already going) keeps only that
# line and its indented continuations; the lines after it go back to the run still going, which is
# how the stood-down interleave of 2026-10-11 and 10-12 really happened. The exit code of each run
# is read with REPLAY_EXIT_RE (one group, the code); runs without a match count as exit 0.
# Runner and manual lines are left out of what the hook sees; the runner's own line is shown as
# "then", mapped to a verdict by the optional hook_replay_then.

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"

target=""; log=""; since=""
while [ $# -gt 0 ]; do
  case $1 in
    --log) log=$2; shift 2 ;;
    --since) since=$2; shift 2 ;;
    -*) harness_die "unknown option $1" ;;
    *) target=$1; shift ;;
  esac
done
export SYNC_HARNESS_DRY=1
harness_load "$(harness_find_config "$target")"
[ -n "$RUN_START_RE" ] || harness_die "$CONFIG has no RUN_START_RE, so its log cannot be cut into runs"
log=${log:-$LOG}
[ -r "$log" ] || harness_die "cannot read $log"

work=$(mktemp -d "${TMPDIR:-/tmp}/sync-harness-replay.XXXXXX")
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin" && printf '#!/bin/sh\nexit 1\n' > "$work/bin/osascript" && chmod +x "$work/bin/osascript"
export PATH="$work/bin:$PATH"

python3 - "$log" "$since" "$RUN_START_RE" "$SHORT_RUN_RE" "$REPLAY_EXIT_RE" "$work" <<'PY' || harness_die "could not cut the log into runs"
import re, sys
log, since, start_re, short_re, exit_re, work = sys.argv[1:7]
start_re = re.compile(start_re)
short_re = re.compile(short_re) if short_re else None
exit_re = re.compile(exit_re) if exit_re else None
ts = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)  ")
runs = []; open_run = None; pending = None; short = None
for line in open(log, errors="ignore"):
    line = line.rstrip("\n")
    m = ts.match(line)
    if start_re.search(line):
        pending = {"start": m.group(1) if m else "?", "lines": [line]}
        runs.append(pending); short = None
        continue
    if pending is not None:
        first, pending = pending, None
        if short_re and short_re.search(line):
            first["lines"].append(line); short = first
            continue
        open_run = first
    if short is not None:
        if m and line[m.end():].startswith(" "):
            short["lines"].append(line); continue
        if open_run is None: open_run = short
        short = None
    if open_run is not None:
        open_run["lines"].append(line)
skip = ("runner: ", "manual: ")
noise = ("runner: closed", "runner: this Mac", "runner: alert", "runner: xos beat")
with open(f"{work}/runs.tsv", "w") as idx:
    for i, r in enumerate(runs):
        if since and r["start"][:10] < since: continue
        body = [l for l in r["lines"] if not (ts.match(l) and l[ts.match(l).end():].startswith(skip))]
        said = next((l[ts.match(l).end():] for l in r["lines"] if ts.match(l)
                     and l[ts.match(l).end():].startswith("runner: ")
                     and not l[ts.match(l).end():].startswith(noise)), "-")
        code = 0
        if exit_re:
            for l in body:
                e = exit_re.search(l)
                if e: code = int(e.group(1))
        open(f"{work}/run-{i}.txt", "w").write("\n".join(body) + "\n")
        idx.write("\t".join([str(i), r["start"], str(len(body)), str(code), said.replace("\t", " ")]) + "\n")
PY

family() { case $1 in partial|partial-retry-soon) echo partial ;; *) echo "$1" ;; esac; }
total=0; compared=0; differ=0
counts=""
printf '%-19s %5s %4s  %-18s %-14s %-16s %s\n' "run started" lines exit verdict reason "runner said then" ""
while IFS=$'\t' read -r i start n code said; do
  if harness_has hook_classify; then
    out=$(HARNESS_CODE=$code hook_classify "$work/run-$i.txt" "$code")
  else
    out=$(if [ "$code" -ne 0 ]; then echo fail-browser; else echo ok; fi)
  fi
  read -r v reason <<< "$out"
  harness_is_verdict "$v" || v="NOT-A-VERDICT"
  then="-"
  if [ "$said" != "-" ]; then
    if harness_has hook_replay_then; then then=$(hook_replay_then "$said"); else then="${said:8:16}"; fi
  fi
  mark=""
  if [ "$then" != "-" ]; then
    compared=$((compared + 1))
    if [ "$(family "$v")" = "$(family "$then")" ]; then mark="same"; else mark="DIFFERS"; differ=$((differ + 1)); fi
  fi
  printf '%-19s %5s %4s  %-18s %-14s %-16s %s\n' "$start" "$n" "$code" "$v" "${reason:--}" "$then" "$mark"
  total=$((total + 1))
  counts="$counts$v"$'\n'
done < "$work/runs.tsv"
echo
echo "$total runs${since:+ since $since} in $log"
printf '%s' "$counts" | sort | uniq -c | sort -rn | awk '{printf "  %-20s %s\n", $2, $1}'
echo "verdict family differs from the runner's own line at the time: $differ of $compared runs that had one"
