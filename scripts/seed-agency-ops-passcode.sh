#!/usr/bin/env bash
# Create Agency Ops Starter demo passcode in Firestore. Run in Google Cloud Shell:
#   bash scripts/seed-agency-ops-passcode.sh
#
# Uses Node + firebase-admin (works when gcloud firestore documents is unavailable).
set -euo pipefail

PASSCODE="${1:-demostart2026}"
TENANT="${2:-agency-ops-demo}"
PROJECT="${GCP_PROJECT:-kolthoff-portal}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED_DIR="$ROOT/scripts/seed-firestore"

if [ -f "$SEED_DIR/data/agency-ops/admin_credentials.json" ]; then
  cd "$SEED_DIR"
  [ -d node_modules ] || npm install --silent
  node seed.mjs --tenant "$TENANT" --data-dir agency-ops --only admin_credentials --force
  echo "Done. Log in at https://kolthoff-consulting.com/agency-ops/ with passcode: ${PASSCODE}"
  exit 0
fi

# Fallback: inline Node (no repo seed files required)
cd "$SEED_DIR"
[ -d node_modules ] || npm install --silent
node --input-type=module -e "
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp({ projectId: '${PROJECT}' });
const db = admin.firestore();
const ref = db.doc('artifacts/${TENANT}/public/data/admin_credentials/${PASSCODE}');
await ref.set({ role: 'kolthoff_admin' }, { merge: true });
const snap = await ref.get();
console.log('Created/updated:', snap.ref.path, snap.data());
"
echo "Done. Log in at https://kolthoff-consulting.com/agency-ops/ with passcode: ${PASSCODE}"
