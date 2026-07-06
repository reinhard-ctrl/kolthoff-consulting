#!/usr/bin/env bash
# HTTP smoke test for Kolthoff Firebase hosting deployment.
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
  code=$(curl -sS -o /dev/null -w '%{http_code}' -L "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $code  $url"
    PASS=$((PASS + 1))
  else
    echo "FAIL expected $expect got $code  $url"
    FAIL=$((FAIL + 1))
  fi
}

# Accept 200 or 301/302 for legacy redirects
check_redirect() {
  local path="$1"
  local dest_contains="$2"
  local url="${BASE}${path}"
  local headers
  headers=$(curl -sS -I "$url" 2>/dev/null || true)
  local code
  code=$(echo "$headers" | head -1 | awk '{print $2}')
  local location
  location=$(echo "$headers" | rg -i '^location:' | awk '{print $2}' | tr -d '\r' || true)
  if [[ "$code" == "301" || "$code" == "302" ]] && [[ "$location" == *"$dest_contains"* ]]; then
    echo "OK  ${code}→${location}  $url"
    PASS=$((PASS + 1))
  elif [[ "$code" == "200" ]]; then
    echo "OK  200  $url"
    PASS=$((PASS + 1))
  else
    echo "FAIL redirect check  code=$code location=$location  $url"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke testing $BASE"
echo "---"

# Public
check "/"
check "/apps/public/portal.html"
check "/apps/public/contract_sign.html"

# SPAs
check "/admin/"
check "/admin/portals"
check "/admin/contracts"
check "/admin/org-chart"
check "/admin/master"
check "/admin/tenants"
check "/workspace/"

# Delivery / ops HTML apps
check "/apps/operations/crm_pipeline.html"
check "/apps/public/crm_pipeline_view.html"
check "/apps/delivery/project_planner.html"
check "/apps/operations/policy_studio.html"

# Shared modules
check "/shared/auth-gate.js"
check "/shared/firebase-init.js"
check "/shared/crm-share.js"

# Portal auth API (Hosting rewrite → private Cloud Function)
check_post_api() {
  local path="$1"
  local url="${BASE}${path}"
  local body
  local code
  body=$(curl -sS -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d '{"accessCode":"SMOKE-TEST-NO-SUCH-CLIENT"}' 2>/dev/null || echo "")
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d '{"accessCode":"SMOKE-TEST-NO-SUCH-CLIENT"}' 2>/dev/null || echo "000")
  if echo "$body" | rg -q '"code"[[:space:]]*:[[:space:]]*"not-found"'; then
    echo "OK  404 JSON (portal auth API live)  $url"
    PASS=$((PASS + 1))
  elif [[ "$code" == "403" ]]; then
    echo "WARN 403 (private invoker — portal uses Firestore-direct auth; OK if org policy blocks public IAM)  $url"
    PASS=$((PASS + 1))
  elif echo "$body" | rg -qi 'Page Not Found|<!doctype html>'; then
    echo "FAIL rewrite missing (Hosting 404 HTML — deploy functions + hosting)  $url"
    FAIL=$((FAIL + 1))
  else
    echo "WARN unexpected portal auth response code=$code  $url"
    FAIL=$((FAIL + 1))
  fi
}
check_post_api "/api/generatePortalToken"

# Legacy redirects
check_redirect "/admin/legacy/index.html" "/admin"
check_redirect "/crm_pipeline.html" "crm_pipeline"
check_redirect "/admin_console.html" "/admin/portals"

echo "---"
echo "Passed: $PASS  Failed: $FAIL"
[[ "$FAIL" -eq 0 ]]
