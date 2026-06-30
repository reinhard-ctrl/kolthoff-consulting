#!/usr/bin/env bash
# Standalone passcode seed — paste into Cloud Shell (no git clone required):
#   curl -sL https://raw.githubusercontent.com/reinhard-ctrl/kolthoff-consulting/main/scripts/seed-passcode-cloudshell.sh | bash
set -euo pipefail

PASSCODE="${1:-kolthoff2026}"
PROJECT="${GCP_PROJECT:-kolthoff-portal}"
DOC="artifacts/kolthoff-admin-app/public/data/admin_credentials/${PASSCODE}"

gcloud config set project "${PROJECT}" >/dev/null

echo "Creating passcode document: ${DOC}"
gcloud firestore documents create \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}" \
  --data='{"role":"kolthoff_admin"}' \
  2>/dev/null || \
gcloud firestore documents update \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}" \
  --data='{"role":"kolthoff_admin"}'

echo ""
echo "Verifying..."
gcloud firestore documents describe \
  "projects/${PROJECT}/databases/(default)/documents/${DOC}" \
  --project="${PROJECT}"

echo ""
echo "Done. Log in at https://kolthoff-portal.web.app/admin/"
echo "Passcode: ${PASSCODE}"
