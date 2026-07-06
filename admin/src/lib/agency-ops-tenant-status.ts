export const AGENCY_OPS_DEMO_TENANT = 'agency-ops-demo';

export type AgencyOpsAccountStatus = 'active' | 'cancelled';

export function isAgencyOpsTenantCancelled(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return false;
  const status = data.status ?? data.accountStatus ?? data.provisioningStatus;
  return status === 'cancelled';
}

export function agencyOpsStatusLabel(data: Record<string, unknown> | undefined | null): string {
  if (isAgencyOpsTenantCancelled(data)) return 'cancelled';
  const status = data?.provisioningStatus ?? data?.status ?? data?.accountStatus;
  return typeof status === 'string' && status ? status : 'active';
}
