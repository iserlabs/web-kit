#!/bin/bash
# sync-harness install: put one job on launchd's schedule.
#   install.sh <job | config file> [--agents-dir DIR] [--home DIR] [--force]
#
# 1) Copies the harness scripts to a stable home (default ~/.local/share/sync-harness), one file at
#    a time through a temporary name, so a branch switch in the web-kit checkout never changes the
#    code a live job runs, and a run in progress never reads a half-written file.
# 2) Writes the launchd plist for the job (default ~/Library/LaunchAgents/<LABEL>.plist). An
#    existing plist with different contents is left alone unless --force is given.
# 3) Prints, and does NOT run, the launchctl lines that load it, and prints, and does NOT write,
#    the /os registry row to add, so the watchdog watches the job.

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"

target=""; agents="$HOME/Library/LaunchAgents"; home="${SYNC_HARNESS_HOME:-$HOME/.local/share/sync-harness}"; force=0
while [ $# -gt 0 ]; do
  case $1 in
    --agents-dir) agents=$2; shift 2 ;;
    --home) home=$2; shift 2 ;;
    --force) force=1; shift ;;
    -*) harness_die "unknown option $1" ;;
    *) target=$1; shift ;;
  esac
done
harness_load "$(harness_find_config "$target")"

case "$home$CONFIG$LAUNCHD_LOG" in *"'"*|*'&'*|*'<'*|*'>'*) harness_die "paths with ' & < or > are not supported in a plist here" ;; esac

mkdir -p "$home" "$agents" || harness_die "could not create $home or $agents"
for f in lib.sh run.sh beat.sh sync-harness replay.sh install.sh; do
  cp "$HERE/$f" "$home/.$f.tmp" && chmod +x "$home/.$f.tmp" && mv "$home/.$f.tmp" "$home/$f" || harness_die "could not copy $f"
done
echo "harness copied to $home"

plist="$agents/$LABEL.plist"
new=$(mktemp "${TMPDIR:-/tmp}/sync-harness-plist.XXXXXX")
trap 'rm -f "$new"' EXIT
cat > "$new" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>-lc</string>
		<string>/bin/bash '$home/beat.sh' '$CONFIG'</string>
	</array>
	<key>RunAtLoad</key>
	<false/>
	<key>StandardErrorPath</key>
	<string>$LAUNCHD_LOG</string>
	<key>StandardOutPath</key>
	<string>$LAUNCHD_LOG</string>
	<key>StartInterval</key>
	<integer>$((INTERVAL_MIN * 60))</integer>
</dict>
</plist>
PLIST
if command -v plutil >/dev/null 2>&1; then plutil -lint -s "$new" || harness_die "the plist did not pass plutil -lint"; fi

if [ -f "$plist" ] && ! cmp -s "$new" "$plist"; then
  if [ "$force" != 1 ]; then
    echo "$plist already exists with different contents, so it was left alone. The difference:"
    diff "$plist" "$new"
    echo "Run again with --force to replace it."
    exit 3
  fi
  cp "$plist" "$plist.bak-$(date +%Y%m%d%H%M%S)"
fi
cp "$new" "$plist"
echo "launchd plist written: $plist"
echo
echo "To load it (not done for you):"
echo "  launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null; launchctl bootstrap gui/$(id -u) '$plist'"
echo
echo "Add this row to the /os registry (xenia-brain/tools/xos/registry.json, under \"jobs\"); not done for you:"
python3 -c 'import json, sys; job, label, plain, every, grace = sys.argv[1:6]
print("    %s: %s," % (json.dumps(job), json.dumps({"label": label, "plain": plain, "every_min": int(every), "grace_min": int(grace), "active": True})))' \
  "$JOB" "$LABEL" "$PLAIN" "$INTERVAL_MIN" "$GRACE_MIN"
