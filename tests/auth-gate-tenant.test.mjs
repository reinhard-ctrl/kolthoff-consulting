/**
 * Auth gate tenant session resolution — no Firebase required.
 */
import assert from 'node:assert/strict';

const FIRM_APP = 'kolthoff-admin-app';

function isAgencyStarterContext(params) {
  if (params.get('product') === 'agency-ops-starter') return true;
  if (params.get('tenant')?.startsWith('agency-')) return true;
  if (params.get('tenant') === 'agency-ops-demo') return true;
  return false;
}

function resolveLoginPath(search = '') {
  const params = new URLSearchParams(search);
  if (!isAgencyStarterContext(params)) return '/admin/';
  const tenant = params.get('tenant');
  if (tenant && tenant.startsWith('agency-')) {
    return `/agency-ops/?tenant=${encodeURIComponent(tenant)}`;
  }
  return '/agency-ops/';
}

async function hasStaffAccessMock(user, {
  appId,
  firmSession = false,
  tenantSession = false,
  googleStaff = false,
  hasAdminSession = false,
}) {
  if (!user) return false;
  if (googleStaff) return true;
  if (firmSession) return true;
  if (typeof hasAdminSession === 'function' && hasAdminSession()) return true;
  return tenantSession && appId !== FIRM_APP;
}

assert.equal(resolveLoginPath('?product=agency-ops-starter&tenant=agency-pixel-wave'), '/agency-ops/?tenant=agency-pixel-wave');
assert.equal(resolveLoginPath('?product=kolthoff-os'), '/admin/');
assert.equal(isAgencyStarterContext(new URLSearchParams('?tenant=agency-north')), true);

// Agency client passcode session on tenant artifact
assert.equal(await hasStaffAccessMock({ uid: 'u1' }, {
  appId: 'agency-pixel-wave',
  tenantSession: true,
  hasAdminSession: () => true,
}), true);

// Firm session does not require tenant session on kolthoff-admin-app embed
assert.equal(await hasStaffAccessMock({ uid: 'u1' }, {
  appId: FIRM_APP,
  firmSession: true,
}), true);

// Kolthoff Google staff bypass
assert.equal(await hasStaffAccessMock({ uid: 'u1' }, {
  appId: 'agency-pixel-wave',
  googleStaff: true,
}), true);

console.log('auth-gate-tenant.test.mjs — all passed');
