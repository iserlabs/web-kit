# shellcheck shell=bash disable=SC2034
# The Perry Lawson archive sync, run by the web-kit sync harness. The first consumer: every value
# here reproduces ~/Claude/clients/plfa-sync-runner.sh (rebuilt 2026-10-12) exactly, so switching
# the launchd job to the harness changes nothing in the log, the state file or the alerts.
# Live copy: ~/Claude/clients/plfa-sync.d/config.sh (outside any repo on purpose, like the runner:
# an uncommitted edit inside the sync's worktree stops it fast-forwarding). This copy in the kit is
# the reference the tests run against.

JOB=plfa-sync
TITLE="Perry Lawson sync"                  # alert titles: "<TITLE> blocked", "<TITLE> is only partly working"
SHORT_NAME="PLFA sync"                     # first word of the status line
PLAIN="the Perry Lawson archive sync"      # the /os registry's plain name
LABEL=host.xenia.plfa-sync

WT="$HOME/Claude/clients/90-north/.claude-worktrees/plfa-autosync"
SYNC="$WT/plfa/_gen/sync_aa.sh"
SYNC_CMD='PLFA_RUNNER=1 /bin/bash "$SYNC"'  # the sync stays quiet; the runner sends the one alert
SYNC_MATCH='plfa/_gen/sync_aa.sh'
SYNC_WRITES_LOG=1
LOG="$HOME/Library/Logs/plfa-sync.log"
STATE="$HOME/Library/Logs/plfa-sync-runner.state"
PAGE="$HOME/Library/Logs/plfa-sync-stuck-page.html"   # what Safari showed on the last failed read
LAUNCHD_LOG="$HOME/Library/Logs/plfa-sync.launchd.log"
HOOKS=hooks.sh

DUE_HOURS=24; DUE_SLACK_SEC=300     # once a day is enough (Jake, 2026-10-04)
SOON_MIN=60
CODE_REPO="$WT"; CODE_BRANCH=main; CODE_WAIT_MIN=180
STALE_HOURS=30
RED_AFTER=3
BACKOFF_MIN="15 30 60"
BUILD_RETRY_MIN=15
PERMISSION_RETRY_MIN=60
ALERT_AFTER=2; PARTIAL_ALERT_AFTER=3   # read failures alert at RED_AFTER
NOTIFY_GAP_HOURS=6
NO_POPUPS="$HOME/.config/xenia/no-mac-popups"   # Jake 2026-10-05: no Mac pop-ups while it exists
DNS_FALLBACK_HOSTS="github.com"
LOG_MAX_BYTES=3000000; LOG_KEEP_LINES=10000
SAY_OK=0                                # the sync's own "done." line already says it

GOOD_RE='^done\.|nothing to publish|^checked in, so the health'
EVENT_NOISE='python|safari python|vercel|fetching|fetched'
HEAL_LABEL="stuck tabs the sync closed itself"
PARTIAL_NOTE="sales publish; the last event says what was missed"

INTERVAL_MIN=15; GRACE_MIN=45
XOS_TOOLS="$HOME/Claude/xenia-brain/tools"
XOS_PY=/opt/homebrew/opt/python@3.12/libexec/bin/python3

RUN_START_RE='^[0-9-]+ [0-9:]+  start$'
SHORT_RUN_RE='  (stood down: another run|skipped: the Mac is asleep)'
REPLAY_EXIT_RE='FAILED \(exit ([0-9]+)\)'
