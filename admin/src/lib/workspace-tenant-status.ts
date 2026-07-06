export const INTERNAL_WORKSPACE_TENANT = 'kolthoff-admin-app';

export type WorkspaceAccountStatus = 'active' | 'cancelled';

export function isWorkspaceTenantCancelled(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return false;
  const status = data.status ?? data.accountStatus;
  return status === 'cancelled';
}

export function workspaceStatusLabel(data: Record<string, unknown> | undefined | null): string {
  if (isWorkspaceTenantCancelled(data)) return 'cancelled';
  const status = data?.status ?? data?.accountStatus;
  return typeof status === 'string' && status ? status : 'active';
}
