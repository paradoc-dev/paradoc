#!/usr/bin/env bash
# Check that docs.paradoc.dev is serving traffic (HTTP 200 on root).
# This is an SSR site, not a JSON API — no /health route.

set -uo pipefail

URL="https://docs.paradoc.dev/"

status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null)

if [[ "$status" == "200" ]]; then
  echo "✅ docs: ${URL} (HTTP ${status})"
  exit 0
else
  echo "❌ docs: ${URL} (HTTP ${status:-unreachable})"
  exit 1
fi
