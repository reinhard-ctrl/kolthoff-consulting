#!/usr/bin/env bash
# Kolthoff go-live bootstrap — run in Google Cloud Shell (project kolthoff-portal):
#
#   curl -sL https://raw.githubusercontent.com/reinhard-ctrl/kolthoff-consulting/main/scripts/go-live-cloudshell.sh | bash
#
# Or from a cloned repo:
#   bash scripts/go-live-cloudshell.sh
#
# Requires: gcloud authenticated to project kolthoff-portal
set -euo pipefail

PROJECT="${GCP_PROJECT:-kolthoff-portal}"
PASSCODE="${ADMIN_PASSCODE:-kolthoff2026}"
REPO_URL="${KOLOTHOFF_REPO:-https://github.com/reinhard-ctrl/kolthoff-consulting.git}"
CLONE_DIR="${KOLOTHOFF_CLONE_DIR:-${HOME}/kolthoff-consulting}"

resolve_repo_root() {
  local script_path="${BASH_SOURCE[0]:-}"
  if [[ -n "$script_path" && "$script_path" != "/dev/fd/"* && "$script_path" != "/dev/stdin" ]]; then
    local candidate
    candidate="$(cd "$(dirname "$script_path")/.." && pwd)"
    if [[ -f "${candidate}/scripts/seed-production-data.sh" ]]; then
      echo "$candidate"
      return 0
    fi
  fi
  if [[ -f "./scripts/seed-production-data.sh" ]]; then
    cd "$(pwd)" && pwd
    return 0
  fi
  if [[ ! -f "${CLONE_DIR}/scripts/seed-production-data.sh" ]]; then
    echo ">>> Cloning repo into ${CLONE_DIR}..."
    git clone --depth 1 "${REPO_URL}" "${CLONE_DIR}"
  else
    echo ">>> Using existing clone at ${CLONE_DIR}"
    git -C "${CLONE_DIR}" pull --ff-only origin main 2>/dev/null || true
  fi
  echo "${CLONE_DIR}"
}

REPO_ROOT="$(resolve_repo_root)"

echo "=============================================="
echo " Kolthoff Go-Live Bootstrap"
echo " Project:  ${PROJECT}"
echo " Passcode: ${PASSCODE}"
echo " Repo:     ${REPO_ROOT}"
echo "=============================================="
echo ""

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud not found. Run this in Google Cloud Shell:"
  echo "  https://shell.cloud.google.com/?project=${PROJECT}"
  exit 1
fi

gcloud config set project "${PROJECT}" >/dev/null
echo ">>> gcloud project: $(gcloud config get-value project 2>/dev/null)"
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
echo " Cloud Shell seeding complete."
echo ""
echo " Verify in browser (hard refresh):"
echo "   Admin:    https://kolthoff-portal.web.app/admin/"
echo "   CRM:      https://kolthoff-portal.web.app/apps/operations/crm_pipeline.html"
echo "   Planner:  https://kolthoff-portal.web.app/apps/delivery/project_planner.html"
echo "   Passcode: ${PASSCODE}"
echo ""
echo " Optional next:"
echo "   - SOW profiles: Project Planner UI (auto-saves to Firestore)"
echo "   - Client portals: /admin/portals → Import SOW"
echo "   - Team invites:   /admin/tenants"
echo "   - DNS cutover:    docs/dns-cutover.md"
echo "=============================================="
