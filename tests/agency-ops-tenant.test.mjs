/**
 * Agency Ops runtime tenant resolution — no Firebase required.
 */
import assert from 'node:assert/strict';

const AGENCY_TENANT_SESSION_KEY = 'agency-ops-tenant-id';

function isValidAgencyTenantId(tenant) {
  return /^agency-[a-z0-9-]+$/.test(tenant) && tenant !== 'agency-ops-demo';
}

function resolveAgencyTenantId(search, storage) {
  const fromUrl = new URLSearchParams(search).get('tenant')?.trim();
  if (fromUrl && isValidAgencyTenantId(fromUrl)) {
    storage.set(AGENCY_TENANT_SESSION_KEY, fromUrl);
    return fromUrl;
  }
  const stored = storage.get(AGENCY_TENANT_SESSION_KEY);
  if (stored && isValidAgencyTenantId(stored)) return stored;
  return null;
}

function isPro1AgencyOpsProfile(profile) {
  if (profile.productId === 'pro1') return true;
  if (profile.selectedPackageId === 'pro1-agency-ops-starter') return true;
  if (profile.engagementType === 'product') {
    return !profile.productId || profile.productId === 'pro1';
  }
  return false;
}

// URL tenant wins and persists
{
  const storage = new Map();
  const tenant = resolveAgencyTenantId('?tenant=agency-pixel-wave', storage);
  assert.equal(tenant, 'agency-pixel-wave');
  assert.equal(storage.get(AGENCY_TENANT_SESSION_KEY), 'agency-pixel-wave');
}

// Session restore when URL has no tenant
{
  const storage = new Map([[AGENCY_TENANT_SESSION_KEY, 'agency-north-studio']]);
  const tenant = resolveAgencyTenantId('', storage);
  assert.equal(tenant, 'agency-north-studio');
}

// Demo tenant is rejected
{
  const storage = new Map();
  assert.equal(resolveAgencyTenantId('?tenant=agency-ops-demo', storage), null);
}

// PRO 1 profile detection
assert.equal(isPro1AgencyOpsProfile({ productId: 'pro1' }), true);
assert.equal(isPro1AgencyOpsProfile({ selectedPackageId: 'pro1-agency-ops-starter' }), true);
assert.equal(isPro1AgencyOpsProfile({ engagementType: 'product', productId: 'pro2' }), false);
assert.equal(isPro1AgencyOpsProfile({ engagementType: 'service' }), false);

function isAgencyOpsTenantCancelled(data) {
  if (!data) return false;
  const status = data.status ?? data.accountStatus ?? data.provisioningStatus;
  return status === 'cancelled';
}

function agencyOpsStatusLabel(data) {
  if (isAgencyOpsTenantCancelled(data)) return 'cancelled';
  const status = data?.provisioningStatus ?? data?.status ?? data?.accountStatus;
  return typeof status === 'string' && status ? status : 'active';
}

assert.equal(isAgencyOpsTenantCancelled({ status: 'cancelled' }), true);
assert.equal(isAgencyOpsTenantCancelled({ accountStatus: 'cancelled' }), true);
assert.equal(isAgencyOpsTenantCancelled({ provisioningStatus: 'ready' }), false);
assert.equal(agencyOpsStatusLabel({ provisioningStatus: 'ready' }), 'ready');
assert.equal(agencyOpsStatusLabel({ status: 'cancelled' }), 'cancelled');

console.log('agency-ops-tenant.test.mjs — all passed');
