/**
 * Core Workspace auto-provision profile detection — no Firebase required.
 */
import assert from 'node:assert/strict';

function isPro1AgencyOpsProfile(profile) {
  if (profile.productId === 'pro1') return true;
  if (profile.selectedPackageId === 'pro1-agency-ops-starter') return true;
  if (profile.engagementType === 'product') {
    return !profile.productId || profile.productId === 'pro1';
  }
  return false;
}

function isCoreWorkspaceProfile(profile) {
  if (isPro1AgencyOpsProfile(profile)) return false;
  if (profile.productId === 'pro2') return true;
  const pkg = String(profile.selectedPackageId || '');
  if (pkg.includes('pro2') || pkg.includes('core-workspace')) return true;
  if (!profile.engagementType || profile.engagementType === 'service') return true;
  return false;
}

assert.equal(isCoreWorkspaceProfile({ engagementType: 'service' }), true);
assert.equal(isCoreWorkspaceProfile({ productId: 'pro2' }), true);
assert.equal(isCoreWorkspaceProfile({ productId: 'pro1', engagementType: 'product' }), false);
assert.equal(isCoreWorkspaceProfile({ selectedPackageId: 'pro1-agency-ops-starter' }), false);

console.log('core-workspace-auto-provision.test.mjs OK');
