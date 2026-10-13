# shellcheck shell=bash
# Hooks for the Perry Lawson archive sync (see config.sh). Every string the sync prints and every
# sentence the runner writes is copied from ~/Claude/clients/plfa-sync-runner.sh as of 2026-10-12.
# Functions only: this file is sourced by the runner, the CLI, the beat and the replay.
#
# Safari is touched in three places only: closing archive tabs stuck on Cloudflare's "Just a
# moment..." page (never a tab Jake is working in), reading what the archive tabs show, and the
# CLI's unstick report. Under SYNC_HARNESS_DRY (replay) none of them call osascript.

# Close archive tabs stuck on the Cloudflare check. Prints how many.
plfa_unstick() {
  if [ -n "${SYNC_HARNESS_DRY:-}" ]; then echo 0; return; fi
  osascript -e 'tell application "Safari"
  set n to 0
  repeat with w from (count of windows) to 1 by -1
   repeat with t from (count of tabs of window w) to 1 by -1
    set tb to tab t of window w
    if (URL of tb contains "artworkarchive.com") and (name of tb starts with "Just a moment") then
     close tb
     set n to n + 1
    end if
   end repeat
  end repeat
  return n
 end tell' 2>/dev/null || echo 0
}

# What Safari's archive tabs show: signin, check, ok or none. Saves the page to $PAGE.
plfa_archive_shows() {
  if [ -n "${SYNC_HARNESS_DRY:-}" ]; then echo "${SYNC_HARNESS_DRY_SAFARI:-none}"; return; fi
  local src
  src=$(osascript -e 'tell application "Safari"
  set out to ""
  repeat with w in windows
   repeat with t in tabs of w
    if URL of t contains "artworkarchive" then set out to out & (URL of t) & linefeed & (name of t) & linefeed & (source of t) & linefeed
   end repeat
  end repeat
  if out is "" then return "none"
  return out
 end tell' 2>/dev/null)
  printf '%s' "$src" > "$PAGE"
  case "$src" in
    none|"") echo none ;;
    *'type="password"'*|*"/users/sign_in"*|*"/logins/sign_in"*) echo signin ;;
    *challenge-platform*|*"Verify you are human"*|*"Just a moment"*) echo check ;;
    *) echo ok ;;
  esac
}

hook_before_run() {
  local closed
  closed=$(plfa_unstick)
  if [ "${closed:-0}" -gt 0 ] 2>/dev/null; then echo "closed $closed archive tab(s) stuck on the bot check before starting"; fi
}

hook_after_fail() {
  local closed
  closed=$(plfa_unstick)
  if [ "${closed:-0}" -gt 0 ] 2>/dev/null; then echo "Closed $closed stuck tab(s)."; fi
}

# $1 = this run's stretch of the log, $2 = the sync's exit code. Prints "<verdict> [reason]".
hook_classify() {
  local fresh code=$2 reached_build=0 safari=0
  fresh=$(cat "$1")
  if [ "$code" -eq 0 ]; then
    # A dark-wake skip, or standing down for a run already going, reads nothing: not a good run.
    # Only a run that did not finish is a skip; another run's "stood down" line can land in
    # this run's stretch of the shared log.
    case "$fresh" in
      *"nothing to publish"*|*"done. "*|*"checked in, so the health"*) ;;
      *"skipped: the Mac is asleep"*|*"stood down: another run"*) echo skip; return ;;
    esac
    case "$fresh" in
      *"NOT SIGNED IN"*)
        # Never once a real sign-out from 2026-10-03 to 10-12 (0 of 44): look at Safari first.
        if [ "$(plfa_archive_shows)" = signin ]; then echo "partial signed-out"
        else echo "partial-retry-soon slow-or-check"; fi ;;
      *"ARCHIVE READ INCOMPLETE"*) echo "partial-retry-soon incomplete" ;;
      *"NOT RUNNING THE LATEST CODE"*) echo "partial old-code" ;;
      *"fetch failed"*) echo "partial fetch-failed" ;;
      *) echo ok ;;
    esac
    return
  fi
  case "$fresh" in *"FAILED: macOS will not let"*) echo fail-permission; return ;; esac
  case "$fresh" in *"rebuilding the show checklists"*) reached_build=1 ;; esac
  case "$fresh" in
    *"held no works after"*|*"Safari did not render http"*|*"no Safari tab on"*|*"Safari did not answer"*|*"Safari refused an instruction"*)
      [ $reached_build = 1 ] || safari=1 ;;
  esac
  if [ $safari = 1 ]; then echo fail-browser; return; fi
  case "$fresh" in
    *"New code from main failed"*) echo "fail-code self-check" ;;
    *) echo fail-build ;;
  esac
}

# $1 verdict, $2 reason, $3 this run's log. Prints the log text, then the alert text.
hook_explain() {
  local fresh step part why msg shows ask
  fresh=$(cat "$3")
  case $1 in
    partial|partial-retry-soon)
      case $2 in
        signed-out) part="the artist and show lists were not refreshed because Safari is signed out of Artwork Archive. Open Safari and sign in as the gallery." ;;
        slow-or-check) part="the archive was slow or showed its bot check, so the artist and show lists were not refreshed this time. Sales and prices did publish. Trying again within the hour." ;;
        incomplete)
          # From #265: the sync names a slow page or the bot check itself instead of "NOT SIGNED IN".
          why=$(printf '%s\n' "$fresh" | grep -o 'ARCHIVE READ INCOMPLETE ([a-z ]*)' | head -1 | sed 's/.*(\(.*\))/\1/')
          part="the archive showed ${why:-a problem} on one read, so part of the artist and show lists was not refreshed. Sales and prices did publish. Trying again within the hour." ;;
        old-code) part="it is running old code because its copy could not catch up with main. Needs a look in Claude Code." ;;
        *) part="it could not reach GitHub, so it may be on old code. It retries by itself." ;;
      esac
      printf '%s\n%s\n' "$part" "Sales still publish, but $part" ;;
    fail-permission)
      printf '%s\n%s\n' ": macOS is not letting the sync control Safari." \
        "macOS stopped the sync from using Safari. System Settings, Privacy and Security, Automation: allow Safari for python." ;;
    fail-code|fail-build)
      # The step that actually stopped the run: the LAST decisive line, never a tolerated miss that
      # printed "Error:" earlier on (10-07: eleven self-check failures were reported as Safari).
      step=$(printf '%s\n' "$fresh" | grep -E 'New code from main failed|HELD:|FAILED:|^FAILED |[0-9]+ failed, [0-9]+ passed' | tail -1 | cut -c1-200)
      case "$fresh" in
        *"HELD: works vanished"*) msg="Works keep vanishing from the archive read, so nothing publishes until two reads agree. Check the gallery in Artwork Archive." ;;
        *"New code from main failed"*) msg="A code change on main fails the self-check. Nothing was published and the live site is fine. Needs a look in Claude Code." ;;
        *"saved on this Mac only"*|*"live site does not yet"*) msg="An archive change could not be sent to the live site. It retries by itself. Needs a look in Claude Code if this repeats." ;;
        *) msg="The archive read fine but the build stopped itself before publishing. Needs a look in Claude Code." ;;
      esac
      if [ "$1" = fail-code ]; then
        printf '%s\n%s\n' ": new code from main fails the self-check (${step:-see above}). Nothing was published and the live site is fine. Waiting for main to change, or 3 hours." "$msg"
      else
        printf '%s\n%s\n' ", after the archive read, not in Safari: ${step:-see the lines above}." "$msg"
      fi ;;
    *)
      # A Safari read failed. Name what Safari was showing; the runner then clears the stuck tab.
      shows=$(plfa_archive_shows)
      case "$shows" in
        none)   why="Safari had no Artwork Archive tab open" ;;
        check)  why="the archive's Cloudflare check (verify you are human)" ;;
        signin) why="the archive's sign-in page" ;;
        *)      why="a page that did not finish loading in time" ;;
      esac
      case "$why" in
        *sign-in*) ask="Open Safari and sign in to Artwork Archive as the gallery." ;;
        *Cloudflare*) ask="Open Safari, go to the Artwork Archive tab and tick the box if one shows." ;;
        *) ask="Open Safari to the Artwork Archive tab and check it loads." ;;
      esac
      printf '%s\n%s\n' ". Safari was on $why. Page saved to $PAGE." "$HARNESS_FAILS runs in a row. $ask It retries by itself." ;;
  esac
}

# The CLI's unstick: close stuck tabs and say what the other archive tabs show.
hook_unstick() {
  osascript -e 'tell application "Safari"
  set n to 0
  set seen to ""
  repeat with w from (count of windows) to 1 by -1
   repeat with t from (count of tabs of window w) to 1 by -1
    set tb to tab t of window w
    if URL of tb contains "artworkarchive.com" then
     if name of tb starts with "Just a moment" then
      close tb
      set n to n + 1
     else
      set seen to seen & (name of tb) & " | "
     end if
    end if
   end repeat
  end repeat
  return "closed " & n & " stuck tab(s); other archive tabs: " & seen
 end tell' 2>&1 | head -1
}

# Replay only: what the runner's own line at the time meant, as a verdict.
hook_replay_then() {
  case $1 in
    "runner: partial run"*) echo partial ;;
    *"in a row: macOS is not letting"*) echo fail-permission ;;
    *"in a row: new code from main fails"*) echo fail-code ;;
    *"in a row, after the archive read"*) echo fail-build ;;
    *"in a row. Safari was on"*) echo fail-browser ;;
    *) echo "-" ;;
  esac
}
