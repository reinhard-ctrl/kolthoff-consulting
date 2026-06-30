/**
 * Firestore rules smoke tests — run against emulators.
 * Start emulators first: firebase emulators:start --only firestore
 */
const { readFileSync } = require('fs');
const { join } = require('path');

let testing;
try {
  testing = require('@firebase/rules-unit-testing');
} catch {
  console.log('Skipping rules tests — @firebase/rules-unit-testing not installed');
  process.exit(0);
}

const { initializeTestEnvironment, assertFails, assertSucceeds } = testing;

const PROJECT_ID = 'kolthoff-portal-test';
const rules = readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8');

async function run() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });

  // Unauthenticated read should fail on tenant data
  const anon = testEnv.unauthenticatedContext();
  await assertFails(
    anon.firestore().doc('artifacts/client-test/public/data/core_users/u1').get()
  );

  // Kolthoff admin can read admin namespace
  const admin = testEnv.authenticatedContext('admin1', { role: 'kolthoff_admin' });
  await assertSucceeds(
    admin.firestore().doc('artifacts/kolthoff-admin-app/public/data/workbook_profiles/p1').get()
  );

  // admin_credentials: no list; authenticated get allowed (doc id is the secret)
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/admin_credentials/SECRET').get()
  );
  await assertFails(
    admin.firestore().collection('artifacts/kolthoff-admin-app/public/data/admin_credentials').get()
  );

  // Anonymous users cannot read firm CRM / planner data
  const anon = testEnv.authenticatedContext('anon1', {}, { provider: 'anonymous' });
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/crm_deals/d1').get()
  );

  console.log('All rules tests passed.');
  await testEnv.cleanup();
}

run().catch((e) => {
  if (e.code === 'ECONNREFUSED') {
    console.log('Emulator not running — skipping rules tests (start with: firebase emulators:start --only firestore)');
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
