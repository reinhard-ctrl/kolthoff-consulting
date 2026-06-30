#!/usr/bin/env node
/**
 * Idempotent Firestore seed loader for Kolthoff production data.
 *
 * Run in Google Cloud Shell (project kolthoff-portal):
 *   cd scripts/seed-firestore && npm install
 *   node seed.mjs --dry-run
 *   node seed.mjs
 *
 * Options:
 *   --tenant ID       Tenant app ID (default: kolthoff-admin-app)
 *   --only LIST       Comma-separated collections to seed (default: all with data)
 *   --dry-run         Print actions without writing
 *   --force           Overwrite existing documents
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

/** Map JSON filename (without .json) → Firestore collection name */
const COLLECTION_MAP = {
  crm_deals: 'crm_deals',
  crm_contacts: 'crm_contacts',
  crm_partners: 'crm_partners',
  tenant_settings: 'tenant_settings',
  core_departments: 'core_departments',
  workbook_profiles: 'workbook_profiles',
  clients: 'clients',
};

function parseArgs(argv) {
  const opts = {
    tenant: 'kolthoff-admin-app',
    only: null,
    dryRun: false,
    force: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--tenant' && argv[i + 1]) opts.tenant = argv[++i];
    else if (arg === '--only' && argv[i + 1]) opts.only = argv[++i].split(',').map((s) => s.trim());
  }
  return opts;
}

function loadJsonCollection(name) {
  const path = join(DATA_DIR, `${name}.json`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  const docs = JSON.parse(raw);
  if (!Array.isArray(docs)) throw new Error(`${name}.json must be a JSON array`);
  return docs;
}

function docPath(tenantId, collection, docId) {
  return `artifacts/${tenantId}/public/data/${collection}/${docId}`;
}

async function main() {
  const opts = parseArgs(process.argv);
  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'kolthoff-portal';

  const available = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

  const toSeed = (opts.only || available).filter((name) => COLLECTION_MAP[name]);

  console.log(`Project:  ${projectId}`);
  console.log(`Tenant:   ${opts.tenant}`);
  console.log(`Mode:     ${opts.dryRun ? 'DRY RUN' : 'WRITE'}${opts.force ? ' (force overwrite)' : ''}`);
  console.log(`Collections: ${toSeed.join(', ') || '(none)'}`);
  console.log('---');

  let db = null;
  if (!opts.dryRun) {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId });
    }
    db = admin.firestore();
  }

  let written = 0;
  let skipped = 0;

  for (const fileKey of toSeed) {
    const collection = COLLECTION_MAP[fileKey];
    const docs = loadJsonCollection(fileKey);
    if (!docs || docs.length === 0) {
      console.log(`SKIP ${collection} — no documents in data/${fileKey}.json`);
      continue;
    }

    for (const item of docs) {
      const { id, ...data } = item;
      if (!id) {
        console.warn(`WARN ${collection}: document missing "id" field, skipping`);
        continue;
      }

      const ref = db ? db.doc(docPath(opts.tenant, collection, id)) : null;
      let exists = false;
      if (db) {
        const existing = await ref.get();
        exists = existing.exists;
        if (exists && !opts.force) {
          console.log(`SKIP exists  ${collection}/${id}`);
          skipped++;
          continue;
        }
      }

      const payload = { ...data, id };
      if (opts.dryRun) {
        console.log(`WOULD create  ${collection}/${id}`);
      } else {
        await ref.set(payload, { merge: !opts.force });
        console.log(`${exists ? 'UPDATE' : 'CREATE'}  ${collection}/${id}`);
      }
      written++;
    }
  }

  console.log('---');
  console.log(`Done. ${opts.dryRun ? 'Would write' : 'Wrote'}: ${written}, skipped: ${skipped}`);
  if (opts.dryRun) console.log('Re-run without --dry-run to apply.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
