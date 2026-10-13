# shellcheck shell=bash
# Shared by every sync-harness command: find a job's config, load it with the defaults filled in,
# and read the clock. Sourced, never run.
#
# A job is ONE config file of shell variables (see examples/plfa/config.sh for every knob) plus an
# optional hooks file of shell functions. The config may live anywhere; by name it is looked up as
# <dir>/<job>.d/config.sh in each directory of SYNC_HARNESS_PATH.

harness_die() { printf 'sync-harness: %s\n' "$*" >&2; exit 2; }

# The clock. SYNC_HARNESS_NOW pins it, so the tests can say "an hour later" without waiting.
harness_now() {
  if [ -n "${SYNC_HARNESS_NOW:-}" ]; then printf '%s\n' "$SYNC_HARNESS_NOW"; else date +%s; fi
}

# $1 = a job name or a path to a config file. Prints the config path.
harness_find_config() {
  local job=${1:-} dir search
  [ -n "$job" ] || harness_die "name a job (or a config file) after the command"
  if [ -f "$job" ]; then printf '%s\n' "$job"; return; fi
  search=${SYNC_HARNESS_PATH:-$HOME/.config/sync-harness:$HOME/Claude/clients}
  local IFS=:
  for dir in $search; do
    if [ -f "$dir/$job.d/config.sh" ]; then printf '%s\n' "$dir/$job.d/config.sh"; return; fi
  done
  harness_die "no config for '$job': looked for $job.d/config.sh in $search"
}

# $1 = config path. Sets every setting, then sources the config, then the hooks file.
harness_load() {
  CONFIG=$1
  CONFIG_DIR=$(cd "$(dirname "$CONFIG")" && pwd)
  CONFIG="$CONFIG_DIR/$(basename "$CONFIG")"

  # What the job is.
  JOB=""; TITLE=""; SHORT_NAME=""; PLAIN=""; LABEL=""
  SYNC_CMD=""          # run with eval, inside the runner's own shell (no extra process in between)
  SYNC_MATCH=""        # pgrep -f pattern for "a run is already going"; empty = the runner's own pid file
  SYNC_WRITES_LOG=0    # 1 = the sync appends to LOG itself; 0 = the runner appends its output
  LOG=""; STATE=""; HOOKS=""
  # When it runs and how it heals.
  DUE_HOURS=24; DUE_SLACK_SEC=300     # a good read is due again after DUE_HOURS, less a little slack
  SOON_MIN=60                         # a half read is tried again within this many minutes
  CODE_WAIT_MIN=180                   # a code failure on an unchanged branch is retried this often
  STALE_HOURS=30                      # past this with no good read, the watchdog is told
  RED_AFTER=3                         # failures in a row before the watchdog is told
  BACKOFF_MIN="15 30 60"              # waits after the 1st, 2nd, 3rd and later read failures
  BUILD_RETRY_MIN=15                  # wait after a failure past the read (fail-build)
  PERMISSION_RETRY_MIN=60             # wait after macOS refused a permission
  ALERT_AFTER=2                       # failures in a row before a code, build or permission alert
  BROWSER_ALERT_AFTER=""              # failures in a row before a read-failure alert (default RED_AFTER)
  PARTIAL_ALERT_AFTER=3               # partial runs in a row before a "partly working" alert
  NOTIFY_GAP_HOURS=6                  # at most one alert per this many hours
  NO_POPUPS="$HOME/.config/xenia/no-mac-popups"   # while this file exists, alerts go to the log only
  DNS_FALLBACK_HOSTS=""               # hosts whose address is pinned for git when this Mac cannot look them up
  CODE_REPO=""; CODE_BRANCH=main      # where "has main moved?" is asked after a fail-code
  LOG_MAX_BYTES=3000000; LOG_KEEP_LINES=10000
  SAY_OK=1                            # 1 = log "runner: good run" after an ok run
  # How the CLI reads the log.
  GOOD_RE=""                          # extra log lines that mean a good read happened (python regex)
  EVENT_NOISE=""                      # log prefixes the "last event" line skips
  HEAL_RE='[Cc]losed ([0-9]+)'        # a self-repair count inside a runner line
  HEAL_LABEL="self-repairs"
  PARTIAL_NOTE="it still publishes; the last event says what was missed"
  # Default classification, for a job with no classify hook.
  FINISHED_RE=""; SKIP_RE=""
  # Replay: how to cut the log into runs.
  RUN_START_RE=""; SHORT_RUN_RE=""; REPLAY_EXIT_RE=""
  # Scheduling and the Business OS heartbeat.
  INTERVAL_MIN=15; GRACE_MIN=45; LAUNCHD_LOG=""
  XOS_TOOLS=""; XOS_PY=python3

  # shellcheck disable=SC1090
  . "$CONFIG" || harness_die "$CONFIG could not be read"

  [ -n "$JOB" ] || harness_die "$CONFIG: JOB is not set"
  case $JOB in *[!A-Za-z0-9._-]*) harness_die "$CONFIG: JOB may use letters, digits, dot, dash and underscore only" ;; esac
  : "${TITLE:=$JOB}" "${SHORT_NAME:=$TITLE}" "${PLAIN:=$TITLE}" "${LABEL:=host.xenia.$JOB}"
  : "${LOG:=$HOME/Library/Logs/$JOB.log}" "${STATE:=$HOME/Library/Logs/$JOB-runner.state}"
  : "${LAUNCHD_LOG:=${LOG%.log}.launchd.log}" "${BROWSER_ALERT_AFTER:=$RED_AFTER}"

  DUE=$((DUE_HOURS * 3600 - DUE_SLACK_SEC))
  SOON=$((SOON_MIN * 60))
  CODE_WAIT=$((CODE_WAIT_MIN * 60))
  STALE=$((STALE_HOURS * 3600))
  NOTIFY_GAP=$((NOTIFY_GAP_HOURS * 3600))

  if [ -z "$HOOKS" ] && [ -f "$CONFIG_DIR/hooks.sh" ]; then HOOKS="$CONFIG_DIR/hooks.sh"; fi
  if [ -n "$HOOKS" ]; then
    case $HOOKS in /*) ;; *) HOOKS="$CONFIG_DIR/$HOOKS" ;; esac
    [ -f "$HOOKS" ] || harness_die "$CONFIG names hooks file $HOOKS, which does not exist"
    # shellcheck disable=SC1090
    . "$HOOKS" || harness_die "$HOOKS could not be read"
  fi
}

harness_has() { declare -F "$1" >/dev/null; }

# Reads the state file without running it: only the six known keys, numbers checked.
harness_read_state() {
  last_good=0; fails=0; notified=0; degraded=0; next_try=0; fail_head=""
  [ -f "$STATE" ] || return 0
  local k v
  while IFS='=' read -r k v; do
    case $k in
      last_good|fails|notified|degraded|next_try)
        case $v in ''|*[!0-9]*) v=0 ;; esac
        printf -v "$k" '%s' "$v" ;;
      fail_head)
        case $v in *[!0-9a-fA-F]*) v="" ;; esac
        fail_head=$v ;;
    esac
  done < "$STATE"
}

harness_write_state() {
  printf 'last_good=%s\nfails=%s\nnotified=%s\ndegraded=%s\nnext_try=%s\nfail_head=%s\n' \
    "$last_good" "$fails" "$notified" "$degraded" "$next_try" "$fail_head" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
}

# The current tip of CODE_BRANCH on the code repo's remote, or the hook's answer. Empty when unknown.
harness_code_head() {
  if harness_has hook_head; then hook_head; return; fi
  [ -n "$CODE_REPO" ] || return 0
  git -C "$CODE_REPO" ls-remote -q origin "refs/heads/$CODE_BRANCH" 2>/dev/null | cut -c1-40
}

harness_has_code_head() { harness_has hook_head || [ -n "$CODE_REPO" ]; }

# 0 when this Mac can look the host up. HARNESS_PYTHON lets the tests stand in for it.
harness_resolves() {
  "${HARNESS_PYTHON:-/usr/bin/python3}" -c 'import socket, sys; socket.getaddrinfo(sys.argv[1], 443)' "$1" 2>/dev/null
}

harness_is_verdict() {
  case $1 in ok|partial|partial-retry-soon|fail-browser|fail-code|fail-build|fail-permission|skip) return 0 ;; esac
  return 1
}
