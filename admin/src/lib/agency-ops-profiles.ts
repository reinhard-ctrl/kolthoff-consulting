/** Match server-side isPro1AgencyOpsProfile (functions/src/index.ts) */
export interface AgencyOpsProfileFields {
  engagementType?: string;
  productId?: string;
  selectedPackageId?: string;
  agencyOpsTenantId?: string;
  provisioningStatus?: string;
  provisioningError?: string;
}

export function isPro1AgencyOpsProfile(profile: AgencyOpsProfileFields | undefined | null): boolean {
  if (!profile) return false;
  if (profile.productId === 'pro1') return true;
  if (profile.selectedPackageId === 'pro1-agency-ops-starter') return true;
  if (profile.engagementType === 'product') {
    return !profile.productId || profile.productId === 'pro1';
  }
  return false;
}

export function needsAgencyOpsTenant(profile: AgencyOpsProfileFields | undefined | null): boolean {
  return isPro1AgencyOpsProfile(profile) && !profile?.agencyOpsTenantId;
}

export type AgencyOpsProvisionUiState = 'failed' | 'provisioning' | 'awaiting';

export function agencyOpsProvisionUiState(
  profile: AgencyOpsProfileFields | undefined | null,
): AgencyOpsProvisionUiState | null {
  if (!needsAgencyOpsTenant(profile)) return null;
  if (profile?.provisioningStatus === 'failed' || profile?.provisioningError) return 'failed';
  if (profile?.provisioningStatus === 'provisioning') return 'provisioning';
  return 'awaiting';
}
