import { isPro1AgencyOpsProfile, type AgencyOpsProfileFields } from './agency-ops-profiles';

/** Match server-side isCoreWorkspaceProfile (functions/src/index.ts) */
export interface CoreWorkspaceProfileFields extends AgencyOpsProfileFields {
  coreWorkspaceTenantId?: string;
}

export function isCoreWorkspaceProfile(
  profile: CoreWorkspaceProfileFields | undefined | null,
): boolean {
  if (!profile) return false;
  if (isPro1AgencyOpsProfile(profile)) return false;
  if (profile.productId === 'pro2') return true;
  const pkg = String(profile.selectedPackageId || '');
  if (pkg.includes('pro2') || pkg.includes('core-workspace')) return true;
  if (!profile.engagementType || profile.engagementType === 'service') return true;
  return false;
}

export function needsCoreWorkspaceTenant(
  profile: CoreWorkspaceProfileFields | undefined | null,
): boolean {
  return isCoreWorkspaceProfile(profile) && !profile?.coreWorkspaceTenantId;
}

export type CoreWorkspaceProvisionUiState = 'failed' | 'provisioning' | 'awaiting';

export function coreWorkspaceProvisionUiState(
  profile: CoreWorkspaceProfileFields | undefined | null,
): CoreWorkspaceProvisionUiState | null {
  if (!needsCoreWorkspaceTenant(profile)) return null;
  if (profile?.provisioningStatus === 'failed' || profile?.provisioningError) return 'failed';
  if (profile?.provisioningStatus === 'provisioning') return 'provisioning';
  return 'awaiting';
}
