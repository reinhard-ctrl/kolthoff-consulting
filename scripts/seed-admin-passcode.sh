#!/usr/bin/env bash
# Create admin passcode in Firestore. Run in Google Cloud Shell:
#   bash scripts/seed-admin-passcode.sh kolthoff2026
set -euo pipefail

PASSCODE="${1:-kolthoff2026}"
PROJECT="${GCP_PROJECT:-kolthoff-portal}"
DOC="artifacts/kolthoff-admin-app/public/data/admin_credentials/${PASSCODE}"

echo "Creating admin passcode document: ${DOC}"
gcloud firestore documents create \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}" \
  --data='{"role":"kolthoff_admin"}' \
  2>/dev/null || \
gcloud firestore documents update \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}" \
  --data='{"role":"kolthoff_admin"}'

echo "Done. Log in at https://kolthoff-portal.web.app/admin/ with passcode: ${PASSCODE}"
