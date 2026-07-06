/**
 * Core Workspace profile lane detection — mirrors admin/src/lib/core-workspace-profiles.ts
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

function needsCoreWorkspaceTenant(profile) {
  return isCoreWorkspaceProfile(profile) && !profile?.coreWorkspaceTenantId;
}

function coreWorkspaceProvisionUiState(profile) {
  if (!needsCoreWorkspaceTenant(profile)) return null;
  if (profile?.provisioningStatus === 'failed' || profile?.provisioningError) return 'failed';
  if (profile?.provisioningStatus === 'provisioning') return 'provisioning';
  return 'awaiting';
}

assert.equal(isCoreWorkspaceProfile({ engagementType: 'service' }), true);
assert.equal(isCoreWorkspaceProfile({ productId: 'pro2' }), true);
assert.equal(isCoreWorkspaceProfile({ productId: 'pro1', engagementType: 'product' }), false);
assert.equal(needsCoreWorkspaceTenant({ engagementType: 'service' }), true);
assert.equal(needsCoreWorkspaceTenant({ engagementType: 'service', coreWorkspaceTenantId: 'client-x' }), false);
assert.equal(coreWorkspaceProvisionUiState({ engagementType: 'service', provisioningStatus: 'failed' }), 'failed');

console.log('core-workspace-profiles.test.mjs OK');
