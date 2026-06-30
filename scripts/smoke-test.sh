#!/usr/bin/env bash
# Quick HTTP smoke test for Kolthoff Firebase hosting deployment.
# Usage: bash scripts/smoke-test.sh [base-url]
set -euo pipefail

BASE="${1:-https://kolthoff-portal.web.app}"
PASS=0
FAIL=0

check() {
  local path="$1"
  local expect="${2:-200}"
  local url="${BASE}${path}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $code  $url"
    PASS=$((PASS + 1))
  else
    echo "FAIL expected $expect got $code  $url"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke testing $BASE"
echo "---"

check "/"
check "/admin/"
check "/workspace/"
check "/apps/operations/crm_pipeline.html"
check "/apps/delivery/project_planner.html"
check "/apps/public/portal.html"
check "/admin/legacy/index.html"
check "/shared/auth-gate.js"

echo "---"
echo "Passed: $PASS  Failed: $FAIL"
[[ "$FAIL" -eq 0 ]]
