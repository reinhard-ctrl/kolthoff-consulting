#!/usr/bin/env bash
# Post-seed verification: HTTP smoke test + manual checklist.
# Usage: bash scripts/verify-go-live.sh [base-url]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${1:-https://kolthoff-portal.web.app}"

echo "=== Kolthoff Go-Live Verification ==="
echo ""

echo "--- HTTP smoke test ---"
bash "${ROOT}/scripts/smoke-test.sh" "${BASE}"
echo ""

echo "--- Manual checks (browser) ---"
cat <<EOF
After Cloud Shell seed (bash scripts/go-live-cloudshell.sh):

  [ ] Admin login at ${BASE}/admin/ (passcode: kolthoff2026)
  [ ] Dashboard shows client/SOW/deal counts > 0
  [ ] CRM board shows 8 deals at ${BASE}/apps/operations/crm_pipeline.html
  [ ] Planner loads workspaces at ${BASE}/apps/delivery/project_planner.html
  [ ] Tenant Manager feature flags ON at ${BASE}/admin/tenants

Optional:
  [ ] Invite team member at /admin/tenants
  [ ] Create client portal at /admin/portals
  [ ] DNS cutover per docs/dns-cutover.md
EOF
