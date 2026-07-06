#!/usr/bin/env node
/**
 * Remove kolthoff-admin-app from core_workspaces (client registry only).
 * Admin console credentials and SOW data are not deleted.
 *
 * Run in Google Cloud Shell (project kolthoff-portal):
 *   cd scripts/seed-firestore && npm install
 *   node unregister-internal-workspace.mjs --dry-run
 *   node unregister-internal-workspace.mjs
 */
import admin from 'firebase-admin';

const ADMIN_TENANT = 'kolthoff-admin-app';
const REGISTRY_PATH = `artifacts/${ADMIN_TENANT}/public/data/core_workspaces/${ADMIN_TENANT}`;

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  const opts = parseArgs(process.argv);
  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'kolthoff-portal';

  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();
  const ref = db.doc(REGISTRY_PATH);
  const snap = await ref.get();

  console.log(`Project: ${projectId}`);
  console.log(`Registry doc: ${REGISTRY_PATH}`);

  if (!snap.exists) {
    console.log('Internal workspace is not registered — nothing to do.');
    return;
  }

  console.log(`Client name: ${snap.data()?.clientName || '(unknown)'}`);

  if (opts.dryRun) {
    console.log('\nDry run — would delete registry doc only.');
    return;
  }

  await ref.delete();
  console.log('Removed internal workspace from core_workspaces registry.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
