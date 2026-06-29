#!/usr/bin/env bash
# Behavioral tests for vercel-ignore.sh. No framework — temp git repos + exit-code asserts.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/vercel-ignore.sh"
pass=0; fail=0

# make_repo <path-changed-in-HEAD> [--no-parent] -> prints repo dir
make_repo() {
  local changed="$1"; local noparent="${2:-}"
  local d; d="$(mktemp -d)"
  git -C "$d" init -q; git -C "$d" config user.email t@t.t; git -C "$d" config user.name t
  mkdir -p "$d/src"; echo base > "$d/src/page.tsx"
  git -C "$d" add -A; git -C "$d" commit -qm base
  if [ "$noparent" = "--no-parent" ]; then echo "$d"; return; fi
  mkdir -p "$d/$(dirname "$changed")"; echo change >> "$d/$changed"
  git -C "$d" add -A; git -C "$d" commit -qm "change"
  echo "$d"
}

# assert <desc> <expected-exit> <repo> [ENV=val ...]
assert() {
  local desc="$1" expected="$2" repo="$3"; shift 3
  ( cd "$repo" && env "$@" bash "$SCRIPT" >/dev/null 2>&1 ); local got=$?
  if [ "$got" = "$expected" ]; then echo "ok: $desc"; pass=$((pass+1))
  else echo "FAIL: $desc (got $got, want $expected)"; fail=$((fail+1)); fi
  rm -rf "$repo"
}

assert "preview build is skipped"            0 "$(make_repo src/page.tsx)" VERCEL_ENV=preview
assert "preview kept when KEEP_PREVIEWS=1"   1 "$(make_repo src/page.tsx)" VERCEL_ENV=preview KEEP_PREVIEWS=1
assert "FORCE_BUILD overrides no-op skip"    1 "$(make_repo CLAUDE.md)"    VERCEL_ENV=production FORCE_BUILD=1
assert "doc-only prod change is skipped"     0 "$(make_repo CLAUDE.md)"    VERCEL_ENV=production
assert "docs/ change is skipped"             0 "$(make_repo docs/x.md)"    VERCEL_ENV=production
assert "real source change builds"           1 "$(make_repo src/page.tsx)" VERCEL_ENV=production
assert "content .md change builds"           1 "$(make_repo src/content/post.md)" VERCEL_ENV=production
assert "no parent commit builds (failsafe)"  1 "$(make_repo x --no-parent)" VERCEL_ENV=production

echo "----- $pass passed, $fail failed -----"
[ "$fail" = 0 ]
