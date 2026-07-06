import { AGENCY_OPS_DEMO_TENANT } from './agency-ops-tenant-status';

export const ACTIVE_AGENCY_OPS_TENANT_KEY = 'kolthoff-active-agency-ops-tenant';
const AGENCY_OPS_CONSOLE_PATH = '/agency-ops/';

const activeTenantListeners = new Set<() => void>();

function isValidPaidAgencyTenantId(tenantId: string): boolean {
  return /^agency-[a-z0-9-]+$/.test(tenantId) && tenantId !== AGENCY_OPS_DEMO_TENANT;
}

export function agencyOpsConsoleUrl(tenantId: string): string {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${AGENCY_OPS_CONSOLE_PATH}`
      : `https://kolthoff-consulting.com${AGENCY_OPS_CONSOLE_PATH}`;
  return `${base}?tenant=${encodeURIComponent(tenantId)}`;
}

export function getActiveAgencyOpsTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(ACTIVE_AGENCY_OPS_TENANT_KEY)?.trim();
  if (stored && isValidPaidAgencyTenantId(stored)) return stored;
  return null;
}

export function subscribeActiveAgencyOpsTenant(listener: () => void): () => void {
  activeTenantListeners.add(listener);
  return () => activeTenantListeners.delete(listener);
}

export function setActiveAgencyOpsTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return;
  if (!isValidPaidAgencyTenantId(tenantId)) {
    throw new Error('Invalid Agency Ops tenant ID.');
  }
  sessionStorage.setItem(ACTIVE_AGENCY_OPS_TENANT_KEY, tenantId);
  activeTenantListeners.forEach((listener) => listener());
}

export function clearActiveAgencyOpsTenantId(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACTIVE_AGENCY_OPS_TENANT_KEY);
  activeTenantListeners.forEach((listener) => listener());
}

export function getActiveAgencyOpsConsoleUrl(): string | null {
  const tenantId = getActiveAgencyOpsTenantId();
  return tenantId ? agencyOpsConsoleUrl(tenantId) : null;
}

export function getAgencyOpsManagerUrl(): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://kolthoff-consulting.com';
  const adminBase = (import.meta.env.BASE_URL || '/admin/').replace(/\/$/, '');
  return `${base}${adminBase}/agency-ops-manager`;
}

export function buildAgencyOpsHandoffText(consoleUrl: string, passcode: string): string {
  return (
    `Agency Ops Console: ${consoleUrl}\nPasscode: ${passcode}\n\n` +
    'Open the URL, enter the passcode, and complete branding under Settings.'
  );
}
