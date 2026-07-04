#!/usr/bin/env bash
# Create Agency Ops Starter demo passcode in Firestore. Run in Google Cloud Shell:
#   bash scripts/seed-agency-ops-passcode.sh
# Optional custom passcode:
#   bash scripts/seed-agency-ops-passcode.sh mypasscode
set -euo pipefail

PASSCODE="${1:-demostart2026}"
TENANT="${2:-agency-ops-demo}"
PROJECT="${GCP_PROJECT:-kolthoff-portal}"
DOC="artifacts/${TENANT}/public/data/admin_credentials/${PASSCODE}"

echo "Creating Agency Ops demo passcode document: ${DOC}"
gcloud firestore documents create \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}" \
  --data='{"role":"kolthoff_admin"}' \
  2>/dev/null || \
gcloud firestore documents update \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}" \
  --data='{"role":"kolthoff_admin"}'

echo "Done. Log in at https://kolthoff-consulting.com/agency-ops/ with passcode: ${PASSCODE}"
