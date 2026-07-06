import { deleteField, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import type { AgencyOpsProvisionInput, AgencyOpsProvisionResult } from './agency-ops-provision-firestore';
import { isAgencyOpsTenantCancelled } from './agency-ops-tenant-status';

const AGENCY_OPS_DEMO_TENANT = 'agency-ops-demo';
const DEFAULT_AGENCY_OPS_URL = 'https://kolthoff-consulting.com/agency-ops/';

function slugifyAgencyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeAgencyTenantId(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return trimmed.startsWith('agency-') ? trimmed : `agency-${trimmed}`;
}

function validateAgencyTenantId(tenantId: string): void {
  if (!/^agency-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Tenant ID must look like agency-pixel-wave (lowercase letters, numbers, hyphens).');
  }
  if (tenantId === AGENCY_OPS_DEMO_TENANT) {
    throw new Error('agency-ops-demo is reserved for the sales demo');
  }
}

function generateAgencyPasscode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function agencyOpsConsoleUrl(tenantId: string): string {
  return `${DEFAULT_AGENCY_OPS_URL}?tenant=${encodeURIComponent(tenantId)}`;
}

/** Client-side provisioning — no Cloud Function cold start (requires isKolthoffFirmAdmin rules) */
export async function provisionAgencyOpsDirect(
  input: AgencyOpsProvisionInput,
): Promise<AgencyOpsProvisionResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) throw new Error('Sign in required before provisioning Agency Ops tenants.');

  const clientName = input.clientName.trim();
  if (!clientName) throw new Error('Client name required');

  const tenantId = input.tenantId?.trim()
    ? normalizeAgencyTenantId(input.tenantId)
    : `agency-${slugifyAgencyName(clientName)}`;
  validateAgencyTenantId(tenantId);

  const passcode = (input.passcode?.trim() || generateAgencyPasscode()).toLowerCase();
  const consoleUrl = agencyOpsConsoleUrl(tenantId);
  const profileId = input.profileId?.trim() || null;

  const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'agency_ops_tenants', tenantId);
  const [configSnap, registrySnap] = await Promise.all([getDoc(configRef), getDoc(registryRef)]);

  let created = false;
  let quoteId: string | null = null;

  if (profileId) {
    const profileSnap = await getDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles', profileId));
    if (profileSnap.exists()) {
      quoteId = (profileSnap.data()?.quoteId as string) || null;
    }
  }

  const registryData = registrySnap.exists() ? (registrySnap.data() as Record<string, unknown>) : null;
  const configData = configSnap.exists() ? (configSnap.data() as Record<string, unknown>) : null;
  const isCancelled = isAgencyOpsTenantCancelled(registryData) || isAgencyOpsTenantCancelled(configData);

  if (!configSnap.exists() && !registrySnap.exists()) {
    const now = Date.now();
    const branding = {
      companyName: clientName,
      tagline: 'Creative & Digital Services',
      primaryColor: '#4f46e5',
      logoUrl: '',
    };
    const batch = writeBatch(db);
    batch.set(configRef, {
      id: 'config',
      productId: 'agency-ops-starter',
      clientName,
      accountStatus: 'active',
      features: { messenger: false, approvals: false, vault: false, crm: false },
      branding,
      activeBrandingPresetId: 'default',
      brandingPresets: {
        default: { id: 'default', name: branding.companyName, ...branding, updatedAt: now },
      },
      createdAt: now,
      createdBy: auth.currentUser.uid,
      provisionedBy: 'admin-direct',
    });
    batch.set(doc(db, 'artifacts', tenantId, 'public', 'data', 'admin_credentials', passcode), {
      role: 'kolthoff_admin',
      note: `Agency Ops tenant ${tenantId}`,
      createdAt: now,
    });
    batch.set(registryRef, {
      id: tenantId,
      tenantId,
      clientName,
      productId: 'agency-ops-starter',
      status: 'active',
      consoleUrl,
      provisioningStatus: 'ready',
      profileId,
      quoteId,
      initialPasscode: passcode,
      initialPasscodeSetAt: now,
      provisioningMethod: 'manual',
      createdAt: now,
      createdBy: auth.currentUser.uid,
    });
    await batch.commit();
    created = true;
  } else if (isCancelled) {
    const now = Date.now();
    const existingBranding = (configData?.branding as Record<string, unknown> | undefined) || {};
    const branding = {
      companyName: clientName,
      tagline: String(existingBranding.tagline || 'Creative & Digital Services'),
      primaryColor: String(existingBranding.primaryColor || '#4f46e5'),
      logoUrl: String(existingBranding.logoUrl || ''),
    };
    const batch = writeBatch(db);
    batch.set(configRef, {
      clientName,
      accountStatus: 'active',
      status: 'active',
      branding,
      cancelledAt: deleteField(),
      cancelledBy: deleteField(),
      cancellationReason: deleteField(),
      reactivatedAt: now,
      reactivatedBy: auth.currentUser.uid,
      updatedAt: now,
    }, { merge: true });
    batch.set(doc(db, 'artifacts', tenantId, 'public', 'data', 'admin_credentials', passcode), {
      role: 'kolthoff_admin',
      note: `Agency Ops tenant ${tenantId}`,
      createdAt: now,
      reactivatedAt: now,
    });
    batch.set(registryRef, {
      clientName,
      status: 'active',
      consoleUrl,
      provisioningStatus: 'ready',
      profileId,
      quoteId,
      initialPasscode: passcode,
      initialPasscodeSetAt: now,
      cancelledAt: deleteField(),
      cancelledBy: deleteField(),
      cancellationReason: deleteField(),
      reactivatedAt: now,
      reactivatedBy: auth.currentUser.uid,
      updatedAt: now,
    }, { merge: true });
    await batch.commit();
  }

  if (profileId) {
    await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles', profileId), {
      agencyOpsTenantId: tenantId,
      provisioningStatus: 'ready',
      provisioningError: deleteField(),
      links: { agencyOpsConsoleUrl: consoleUrl },
      updatedAt: Date.now(),
    }, { merge: true });
  }

  const handoff =
    `Your Agency Ops workspace is ready.\n\n` +
    `1. Open: ${consoleUrl}\n` +
    `2. Sign in with passcode: ${passcode}\n\n` +
    `Save this passcode securely — it is shown once during provisioning.`;

  const repEmail = input.repEmail?.trim();
  const mailtoUrl = repEmail
    ? `mailto:${encodeURIComponent(repEmail)}?subject=${encodeURIComponent(`${clientName} — Agency Ops Access`)}&body=${encodeURIComponent(handoff)}`
    : undefined;

  return {
    tenantId,
    clientName,
    consoleUrl,
    passcode,
    profileId,
    quoteId,
    mailtoUrl,
    created,
    message: created
      ? `Provisioned Agency Ops for ${clientName}. Share the console URL and passcode with the client.`
      : isCancelled
        ? `Reactivated Agency Ops for ${clientName}. Share the new passcode with the client.`
        : `Agency Ops tenant ${tenantId} already exists — credentials shown below.`,
  };
}
