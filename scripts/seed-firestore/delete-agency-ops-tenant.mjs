#!/usr/bin/env node
/**
 * Permanently remove an Agency Ops tenant from Firestore.
 *
 * Run in Google Cloud Shell (project kolthoff-portal):
 *   cd scripts/seed-firestore && npm install
 *   node delete-agency-ops-tenant.mjs agency-new-workspace-corp --dry-run
 *   node delete-agency-ops-tenant.mjs agency-new-workspace-corp
 *
 * Options:
 *   --dry-run         Print actions without writing
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_TENANT = 'kolthoff-admin-app';
const DEMO_TENANT = 'agency-ops-demo';

function parseArgs(argv) {
  const opts = { tenantId: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (!arg.startsWith('-')) opts.tenantId = arg.trim();
  }
  return opts;
}

function validateTenantId(tenantId) {
  if (!tenantId) throw new Error('Tenant ID required. Example: node delete-agency-ops-tenant.mjs agency-new-workspace-corp');
  if (tenantId === DEMO_TENANT) throw new Error(`${DEMO_TENANT} is reserved for the sales demo.`);
  if (!/^agency-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Tenant ID must look like agency-pixel-wave (lowercase letters, numbers, hyphens).');
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  validateTenantId(opts.tenantId);

  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'kolthoff-portal';
  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();

  const registryRef = db.doc(`artifacts/${ADMIN_TENANT}/public/data/agency_ops_tenants/${opts.tenantId}`);
  const configRef = db.doc(`artifacts/${opts.tenantId}/public/data/tenant_settings/config`);
  const registrySnap = await registryRef.get();

  if (!registrySnap.exists) {
    throw new Error(`Agency Ops tenant "${opts.tenantId}" was not found in the registry.`);
  }

  const registry = registrySnap.data() || {};
  const passcode = typeof registry.initialPasscode === 'string' ? registry.initialPasscode.trim().toLowerCase() : '';
  const profileId = typeof registry.profileId === 'string' ? registry.profileId.trim() : '';

  console.log(`Project: ${projectId}`);
  console.log(`Tenant:  ${opts.tenantId}`);
  console.log(`Client:  ${registry.clientName || '(unknown)'}`);
  if (opts.dryRun) {
    console.log('\nDry run — would delete:');
    console.log(`  - ${registryRef.path}`);
    console.log(`  - ${configRef.path}`);
    if (passcode) console.log(`  - artifacts/${opts.tenantId}/public/data/admin_credentials/${passcode}`);
    if (profileId) console.log(`  - clear agencyOpsTenantId on workbook_profiles/${profileId}`);
    return;
  }

  await registryRef.delete();
  try {
    await configRef.delete();
  } catch (err) {
    console.warn(`Could not delete tenant settings: ${err.message}`);
  }
  if (passcode) {
    try {
      await db.doc(`artifacts/${opts.tenantId}/public/data/admin_credentials/${passcode}`).delete();
    } catch (err) {
      console.warn(`Could not delete passcode credential: ${err.message}`);
    }
  }
  if (profileId) {
    await db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${profileId}`).set({
      agencyOpsTenantId: admin.firestore.FieldValue.delete(),
      provisioningStatus: admin.firestore.FieldValue.delete(),
      provisioningError: admin.firestore.FieldValue.delete(),
      links: admin.firestore.FieldValue.delete(),
      updatedAt: Date.now(),
    }, { merge: true });
  }

  console.log(`Deleted Agency Ops tenant ${opts.tenantId}.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
