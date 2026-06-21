#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
fail=0

echo "== Biome extends-from-package =="
( cd "$ROOT/biome-fixture" && pnpm install --silent && pnpm exec biome check sample.ts ) \
  && echo "PASS biome" || { echo "FAIL biome"; fail=1; }

echo "== TS extends-from-package =="
( cd "$ROOT/ts-fixture" && pnpm install --silent && pnpm exec tsc --showConfig | grep -q '"strict": true' ) \
  && echo "PASS tsconfig" || { echo "FAIL tsconfig"; fail=1; }

echo "== Tailwind @import-from-package =="
( cd "$ROOT/tailwind-fixture" && pnpm install --silent \
  && pnpm exec tailwindcss -i input.css -o out.css \
  && grep -q "border-radius" out.css ) \
  && echo "PASS tailwind" || { echo "FAIL tailwind"; fail=1; }

echo "== bin runs (plain node) =="
( cd "$ROOT/biome-fixture" && pnpm exec web-kit doctor . | grep -q "web-kit doctor: OK" ) \
  && echo "PASS bin" || { echo "FAIL bin"; fail=1; }

echo "== TS subpath import via tsx =="
( cd "$ROOT/biome-fixture" && pnpm exec tsx -e "import('@iserlabs/web-kit/utils').then(m => { if (typeof m !== 'object') process.exit(1) })" ) \
  && echo "PASS ts-import" || { echo "FAIL ts-import"; fail=1; }

echo ""
echo "spike fail flag (risky resolvers only): $fail"
exit $fail
