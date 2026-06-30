#!/usr/bin/env bash
# Kolthoff go-live bootstrap — run in Google Cloud Shell:
#   curl -sL https://raw.githubusercontent.com/reinhard-ctrl/kolthoff-consulting/main/scripts/go-live-cloudshell.sh | bash
# Or from a cloned repo:
#   bash scripts/go-live-cloudshell.sh
#
# Requires: gcloud authenticated to project kolthoff-portal
set -euo pipefail

PROJECT="${GCP_PROJECT:-kolthoff-portal}"
PASSCODE="${ADMIN_PASSCODE:-kolthoff2026}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=============================================="
echo " Kolthoff Go-Live Bootstrap"
echo " Project:  ${PROJECT}"
echo " Passcode: ${PASSCODE}"
echo "=============================================="
echo ""

# --- Step 1: Admin passcode ---
echo ">>> [1/3] Seeding admin passcode..."
bash "${REPO_ROOT}/scripts/seed-admin-passcode.sh" "${PASSCODE}"
echo ""

# --- Step 2: Production data ---
echo ">>> [2/3] Seeding production Firestore data..."
bash "${REPO_ROOT}/scripts/seed-production-data.sh"
echo ""

# --- Step 3: Verify counts ---
echo ">>> [3/3] Verifying Firestore document counts..."
COLLECTIONS=(
  "artifacts/kolthoff-admin-app/public/data/admin_credentials/${PASSCODE}"
  "artifacts/kolthoff-admin-app/public/data/crm_deals"
  "artifacts/kolthoff-admin-app/public/data/tenant_settings/config"
)

for path in "${COLLECTIONS[@]}"; do
  if gcloud firestore documents describe \
    "projects/${PROJECT}/databases/(default)/documents/${path}" \
    --project="${PROJECT}" >/dev/null 2>&1; then
    echo "  OK  ${path}"
  elif [[ "$path" == *"/crm_deals" ]]; then
    count=$(gcloud firestore documents list \
      "projects/${PROJECT}/databases/(default)/documents/${path}" \
      --project="${PROJECT}" --format='value(name)' 2>/dev/null | wc -l)
    echo "  OK  ${path} (${count} documents)"
  else
    echo "  WARN missing or unreadable: ${path}"
  fi
done

echo ""
echo "=============================================="
echo " Cloud Shell steps complete."
echo ""
echo " YOU must still do manually in Console:"
echo "   1. Firebase Auth → enable Anonymous + Email/Password"
echo "   2. GCP Credentials → add HTTP referrers for API key"
echo "      https://kolthoff-portal.web.app/*"
echo "      https://kolthoff-consulting.com/*"
echo "      https://www.kolthoff-consulting.com/*"
echo ""
echo " Then verify in browser:"
echo "   https://kolthoff-portal.web.app/admin/"
echo "   Passcode: ${PASSCODE}"
echo ""
echo " Optional next:"
echo "   - SOW profiles: Project Planner or workbook_profiles.json"
echo "   - Client portals: /admin/portals"
echo "   - Team invites: /admin/tenants"
echo "   - DNS cutover: docs/dns-cutover.md"
echo "=============================================="
