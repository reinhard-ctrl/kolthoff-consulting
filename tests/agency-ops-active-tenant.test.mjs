/**
 * Kolthoff staff active Agency Ops tenant selection — no Firebase required.
 */
import assert from 'node:assert/strict';

const ACTIVE_AGENCY_OPS_TENANT_KEY = 'kolthoff-active-agency-ops-tenant';
const AGENCY_OPS_DEMO_TENANT = 'agency-ops-demo';

function isValidPaidAgencyTenantId(tenantId) {
  return /^agency-[a-z0-9-]+$/.test(tenantId) && tenantId !== AGENCY_OPS_DEMO_TENANT;
}

function agencyOpsConsoleUrl(tenantId, origin = 'https://kolthoff-consulting.com') {
  return `${origin}/agency-ops/?tenant=${encodeURIComponent(tenantId)}`;
}

function getActiveAgencyOpsTenantId(storage) {
  const stored = storage.get(ACTIVE_AGENCY_OPS_TENANT_KEY)?.trim();
  if (stored && isValidPaidAgencyTenantId(stored)) return stored;
  return null;
}

function setActiveAgencyOpsTenantId(storage, tenantId) {
  if (!isValidPaidAgencyTenantId(tenantId)) {
    throw new Error('Invalid Agency Ops tenant ID.');
  }
  storage.set(ACTIVE_AGENCY_OPS_TENANT_KEY, tenantId);
}

{
  const storage = new Map();
  setActiveAgencyOpsTenantId(storage, 'agency-pixel-wave');
  assert.equal(getActiveAgencyOpsTenantId(storage), 'agency-pixel-wave');
  assert.equal(
    agencyOpsConsoleUrl('agency-pixel-wave'),
    'https://kolthoff-consulting.com/agency-ops/?tenant=agency-pixel-wave',
  );
}

{
  const storage = new Map([[ACTIVE_AGENCY_OPS_TENANT_KEY, 'agency-ops-demo']]);
  assert.equal(getActiveAgencyOpsTenantId(storage), null);
}

{
  const storage = new Map();
  assert.throws(() => setActiveAgencyOpsTenantId(storage, 'agency-ops-demo'), /Invalid Agency Ops tenant ID/);
}

console.log('agency-ops-active-tenant.test.mjs: ok');
