#!/usr/bin/env bash
# Load production Firestore data (Phase 2). Run in Google Cloud Shell:
#   bash scripts/seed-production-data.sh
#   bash scripts/seed-production-data.sh --dry-run
#   bash scripts/seed-production-data.sh --only crm_deals,crm_contacts,crm_partners
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED_DIR="${ROOT}/scripts/seed-firestore"
PROJECT="${GCP_PROJECT:-kolthoff-portal}"
TENANT="${TENANT_ID:-kolthoff-admin-app}"

echo "=== Kolthoff Phase 2 — Firestore data seed ==="
echo "Project: ${PROJECT}"
echo "Tenant:  ${TENANT}"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required. Use Google Cloud Shell or install Node 20+."
  exit 1
fi

cd "${SEED_DIR}"
if [[ ! -d node_modules ]]; then
  echo "Installing seed-firestore dependencies..."
  npm install --silent
fi

export GCP_PROJECT="${PROJECT}"
node seed.mjs --tenant "${TENANT}" "$@"

echo ""
echo "Next steps:"
echo "  1. Invite team: /admin/ → Tenant Manager → Invite Workspace User"
echo "  2. Import SOW profiles: Project Planner → export JSON → merge into data/workbook_profiles.json → re-run"
echo "  3. Create client portals: /admin/portals → Import SOW from Planner"
echo "  See docs/data-seeding.md for full guide."
