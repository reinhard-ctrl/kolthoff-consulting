#!/usr/bin/env node
/**
 * Clear stale diagnosis report slices from all workbook_profiles documents.
 *
 * Removes persisted demo flowcharts (e.g. "Sales Pipeline (Demo)"), RACI assignments,
 * SaaS audit rows, and synthesis matrix data while preserving Project Planner fields.
 *
 * Run in Google Cloud Shell (project kolthoff-portal):
 *   cd scripts/seed-firestore && npm install
 *   npm run reset-diagnosis:dry
 *   npm run reset-diagnosis
 *
 * Options:
 *   --tenant ID       Tenant app ID (default: kolthoff-admin-app)
 *   --dry-run         List changes without writing
 *   --profile ID      Reset a single profile only
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DIAGNOSIS_FIELD_KEYS = [
  'tabs',
  'activeTabId',
  'diagnosisWorkflow',
  'workflowBuilder',
  'raciAssignments',
  'subSaaS',
  'synthesis',
  'preparedBy',
];

function parseArgs(argv) {
  const opts = {
    tenant: 'kolthoff-admin-app',
    dryRun: false,
    profile: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--tenant' && argv[i + 1]) opts.tenant = argv[++i];
    else if (arg === '--profile' && argv[i + 1]) opts.profile = argv[++i];
  }
  return opts;
}

function docPath(tenantId, profileId) {
  return `artifacts/${tenantId}/public/data/workbook_profiles/${profileId}`;
}

function hasDiagnosisSlices(data) {
  return DIAGNOSIS_FIELD_KEYS.some((key) => data[key] !== undefined && data[key] !== null);
}

function hasDiagnosisChaosTax(data) {
  return data?.chaosTax?.source === 'diagnosis';
}

function describeProfile(data) {
  const tabNames = [];
  const wfTabs = data?.workflowBuilder?.tabs || [];
  const dxTabs = data?.diagnosisWorkflow?.tabs || [];
  const legacyTabs = data?.tabs || [];
  [...wfTabs, ...dxTabs, ...legacyTabs].forEach((tab) => {
    if (tab?.name) tabNames.push(tab.name);
  });
  const uniqueNames = [...new Set(tabNames)];
  const parts = [];
  if (uniqueNames.length) parts.push(`tabs: ${uniqueNames.join(', ')}`);
  if (data?.raciAssignments && Object.keys(data.raciAssignments).length) parts.push('raci');
  if (Array.isArray(data?.subSaaS) && data.subSaaS.length) parts.push(`saas(${data.subSaaS.length})`);
  if (data?.synthesis) parts.push('synthesis');
  if (hasDiagnosisChaosTax(data)) parts.push('chaosTax:diagnosis');
  return parts.length ? parts.join(' · ') : 'no diagnosis slices';
}

function buildResetUpdate(data) {
  const { FieldValue } = admin.firestore;
  const update = {};
  DIAGNOSIS_FIELD_KEYS.forEach((key) => {
    update[key] = FieldValue.delete();
  });
  if (hasDiagnosisChaosTax(data)) {
    update.chaosTax = FieldValue.delete();
    update.annualOperationalLeakage = FieldValue.delete();
  }
  return update;
}

async function main() {
  const opts = parseArgs(process.argv);
  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'kolthoff-portal';

  console.log(`Project: ${projectId}`);
  console.log(`Tenant:  ${opts.tenant}`);
  console.log(`Mode:    ${opts.dryRun ? 'DRY RUN' : 'WRITE'}`);
  if (opts.profile) console.log(`Profile: ${opts.profile}`);
  console.log('---');

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();
  const collectionPath = `artifacts/${opts.tenant}/public/data/workbook_profiles`;

  let docs;
  if (opts.profile) {
    const snap = await db.doc(docPath(opts.tenant, opts.profile)).get();
    docs = snap.exists ? [{ id: snap.id, data: () => snap.data() }] : [];
    if (!docs.length) {
      console.error(`Profile not found: ${opts.profile}`);
      process.exit(1);
    }
  } else {
    const snap = await db.collection(collectionPath).get();
    docs = snap.docs;
  }

  let resetCount = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchOps = 0;

  const flushBatch = async () => {
    if (batchOps === 0 || opts.dryRun) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const doc of docs) {
    const data = doc.data();
    if (!hasDiagnosisSlices(data) && !hasDiagnosisChaosTax(data)) {
      skipped++;
      continue;
    }

    const label = data.workspaceName || data.clientCompany || doc.id;
    console.log(`${opts.dryRun ? 'WOULD reset' : 'RESET'}  ${doc.id}  (${label}) — ${describeProfile(data)}`);

    if (!opts.dryRun) {
      batch.update(doc.ref, buildResetUpdate(data));
      batchOps++;
      if (batchOps >= 400) await flushBatch();
    }
    resetCount++;
  }

  await flushBatch();

  console.log('---');
  console.log(`${opts.dryRun ? 'Would reset' : 'Reset'}: ${resetCount}, skipped (clean): ${skipped}, total scanned: ${docs.length}`);
  if (opts.dryRun) console.log('Re-run without --dry-run to apply.');
  else console.log('Open Diagnosis Reports and verify each workspace shows a blank report.');
}

main().catch((err) => {
  console.error('Reset failed:', err.message || err);
  process.exit(1);
});
