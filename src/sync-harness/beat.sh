#!/bin/bash
# sync-harness launchd entry: runs the runner exactly as launchd always has, THEN records the
# Business OS heartbeat from its exit code, so /os and the watchdog see the job.
#   beat.sh <job | config file>
#
# Why the heartbeat comes after and not around (PLFA, 2026-10-12): wrapping the runner in
# `python3 -m xos beat` made python the process macOS judged when the sync drove Safari, and macOS
# refused it. The runner must stay a direct child of the bash that launchd started.
# A job with no XOS_TOOLS set gets no heartbeat; the runner still runs and still exits the same.

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"
harness_load "$(harness_find_config "${1:-}")"

/bin/bash "$HERE/run.sh" "$CONFIG"
rc=$?
if [ -n "$XOS_TOOLS" ]; then
  if PYTHONPATH="$XOS_TOOLS" "$XOS_PY" -c "import xos.heartbeat" >/dev/null 2>&1; then
    PYTHONPATH="$XOS_TOOLS" "$XOS_PY" -m xos beat "$JOB" -- /bin/sh -c "exit $rc" >/dev/null 2>&1
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S')  runner: xos beat could not load, so /os did not get this heartbeat" >> "$LOG"
  fi
fi
exit $rc
