#!/usr/bin/env bash
# Seed Agency Ops Starter demo tenant (agency-ops-demo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/scripts/seed-firestore"

if [ ! -d node_modules ]; then
  npm install --silent
fi

TENANT="${1:-agency-ops-demo}"
FORCE="${2:-}"

ARGS=(--tenant "$TENANT" --data-dir agency-ops)
if [ "$FORCE" = "--force" ]; then
  ARGS+=(--force)
fi

echo "Seeding Agency Ops Starter demo tenant: $TENANT"
node seed.mjs "${ARGS[@]}"
