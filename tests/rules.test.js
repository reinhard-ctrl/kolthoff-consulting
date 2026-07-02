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
  const unauth = testEnv.unauthenticatedContext();
  await assertFails(
    unauth.firestore().doc('artifacts/client-test/public/data/core_users/u1').get()
  );

  // Kolthoff admin can read admin namespace
  const admin = testEnv.authenticatedContext('admin1', { role: 'kolthoff_admin' });
  await assertSucceeds(
    admin.firestore().doc('artifacts/kolthoff-admin-app/public/data/workbook_profiles/p1').get()
  );

  // admin_credentials: no list; authenticated get allowed (doc id is the secret)
  await assertFails(
    unauth.firestore().doc('artifacts/kolthoff-admin-app/public/data/admin_credentials/SECRET').get()
  );
  await assertFails(
    admin.firestore().collection('artifacts/kolthoff-admin-app/public/data/admin_credentials').get()
  );

  // Anonymous users cannot read firm CRM / planner data
  const anon = testEnv.authenticatedContext('anon1', {}, { provider: 'anonymous' });
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/crm_deals/d1').get()
  );

  // Anonymous users cannot read arbitrary workbook profiles
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/workbook_profiles/p1').get()
  );

  // Anonymous users can read sent contract signing documents
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('artifacts/kolthoff-admin-app/public/data/contracts_ledger/contract-client-abc').set({
      id: 'contract-client-abc',
      profileId: 'client-abc',
      status: 'sent',
      generatedAt: new Date().toISOString(),
      auditTrail: [],
    });
    await context.firestore().doc('artifacts/kolthoff-admin-app/public/data/workbook_profiles/client-abc').set({
      clientCompany: 'Test Co',
      quoteId: 'Q-1',
      tasks: [],
    });
  });
  await assertSucceeds(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/contracts_ledger/contract-client-abc').get()
  );
  await assertSucceeds(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/workbook_profiles/client-abc').get()
  );
  await assertSucceeds(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/contracts_ledger/contract-client-abc').update({
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedBy: 'Jane Doe',
      ipAddress: '127.0.0.1',
      auditTrail: [{ action: 'E-Signed', timestamp: new Date().toISOString() }],
    })
  );
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/contracts_ledger/contract-client-abc').update({
      status: 'draft',
    })
  );

  // Anonymous users can read enabled CRM public share snapshots
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('artifacts/kolthoff-admin-app/public/data/crm_share_links/share-token-1').set({
      enabled: true,
      token: 'share-token-1',
    });
    await context.firestore().doc('artifacts/kolthoff-admin-app/public/data/crm_public_view/share-token-1').set({
      syncedAt: Date.now(),
      deals: [],
      stats: { activeCount: 0, totalValue: 0 },
    });
  });
  await assertSucceeds(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/crm_public_view/share-token-1').get()
  );
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/crm_public_view/disabled-token').get()
  );

  // core_users directory is staff-only
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/core_users/u1').get()
  );

  // Portal clients can read only their own client doc
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('artifacts/kolthoff-admin-app/public/data/clients/APARRI-2026').set({
      companyName: 'Test Client',
      sowReference: 'SOW-1',
    });
    await context.firestore().doc('artifacts/kolthoff-admin-app/public/data/clients/OTHER-2026').set({
      companyName: 'Other Client',
    });
  });

  const portalClient = testEnv.authenticatedContext('portal_aparri', {
    role: 'portal_client',
    accessCode: 'APARRI-2026',
    tenantId: 'kolthoff-admin-app',
  });
  await assertSucceeds(
    portalClient.firestore().doc('artifacts/kolthoff-admin-app/public/data/clients/APARRI-2026').get()
  );
  await assertFails(
    portalClient.firestore().doc('artifacts/kolthoff-admin-app/public/data/clients/OTHER-2026').get()
  );
  await assertFails(
    anon.firestore().doc('artifacts/kolthoff-admin-app/public/data/clients/APARRI-2026').get()
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
