import { deleteField, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import type { ClientProvisionInput, ClientProvisionResult } from './client-provision-firestore';
import { deployStarterPackToTenant } from './approval-starter-templates';
import { derivePortalCodeFromName, slugifyClientName } from './provision-profile-defaults';
import { INTERNAL_WORKSPACE_TENANT } from './workspace-tenant-status';

const DEFAULT_FEATURES = {
  messenger: true,
  approvals: true,
  vault: true,
  crm: false,
};

function normalizeTenantId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith('client-') ? trimmed : `client-${trimmed}`;
}

function validateTenantId(tenantId: string): void {
  if (!/^client-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Tenant ID must look like client-acme-corp (lowercase letters, numbers, hyphens).');
  }
  if (tenantId === INTERNAL_WORKSPACE_TENANT) {
    throw new Error('Reserved tenant ID.');
  }
}

function workspaceUrlFor(tenantId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kolthoff-consulting.com';
  return `${origin}/workspace/?tenant=${encodeURIComponent(tenantId)}`;
}

function portalUrlFor(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kolthoff-consulting.com';
  return `${origin}/apps/public/portal.html`;
}

function derivePortalCode(clientName: string, tenantId: string, requested?: string): string {
  if (requested?.trim()) {
    return requested.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  }
  return derivePortalCodeFromName(clientName, tenantId);
}

async function upsertPortalDelivery(params: {
  portalAccessCode: string;
  clientName: string;
  repName?: string;
  workspaceUrl: string;
  workspaceTenantId: string;
}): Promise<void> {
  const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'clients', params.portalAccessCode);
  const existing = await getDoc(ref);
  const existingData = existing.exists() ? existing.data() : {};

  const workspaceAction = {
    id: Date.now(),
    title: 'Open Core Workspace',
    desc: 'Sign in with your organizational email. Choose "Forgot password or first-time setup" to create your password.',
    type: 'link',
    link: params.workspaceUrl,
    status: 'pending',
  };

  const actionItems = Array.isArray(existingData.actionItems) ? [...existingData.actionItems] : [];
  const filteredActions = actionItems.filter((item: { link?: string; title?: string }) => {
    const title = item.title || '';
    const link = item.link || '';
    return !(link.includes('/workspace/') || title.toLowerCase().includes('core workspace'));
  });

  await setDoc(ref, {
    companyName: params.clientName,
    repName: params.repName || existingData.repName || 'Client Representative',
    sowReference: params.portalAccessCode,
    workspaceUrl: params.workspaceUrl,
    workspaceTenantId: params.workspaceTenantId,
    portalAccessCode: params.portalAccessCode,
    currentPhase: existingData.currentPhase || 'MOD 1: Core Workspace Provisioning',
    progressPercentage: existingData.progressPercentage ?? 5,
    metrics: existingData.metrics || {
      annualLeakageIdentified: 0,
      chaosTaxEliminated: 0,
      saasSavingsIdentified: 0,
    },
    actionItems: [workspaceAction, ...filteredActions],
    roadmap: existingData.roadmap || [],
    assets: existingData.assets || [],
    contracts: existingData.contracts || [],
    workspacePreparedAt: Date.now(),
    updatedAt: Date.now(),
  }, { merge: true });
}

/** Client-side provisioning — no Cloud Function required (requires isKolthoffFirmAdmin rules). */
export async function provisionClientWorkspaceDirect(
  input: ClientProvisionInput,
): Promise<ClientProvisionResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) {
    throw new Error('Sign in required before provisioning client workspaces.');
  }

  const clientName = input.clientName.trim();
  if (!clientName) throw new Error('Client name required');

  const tenantId = input.tenantId?.trim()
    ? normalizeTenantId(input.tenantId)
    : slugifyClientName(clientName);
  validateTenantId(tenantId);

  const deliverViaPortal = input.deliverViaPortal !== false;
  const portalAccessCode = derivePortalCode(clientName, tenantId, input.portalAccessCode);
  const workspaceUrl = workspaceUrlFor(tenantId);
  const portalUrl = portalUrlFor();
  const repEmail = input.repEmail?.trim();
  const repName = input.repName?.trim();

  const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'core_workspaces', tenantId);
  const [configSnap, registrySnap] = await Promise.all([getDoc(configRef), getDoc(registryRef)]);

  let workspaceCreated = false;
  const now = Date.now();
  const uid = auth.currentUser.uid;

  if (!configSnap.exists() && !registrySnap.exists()) {
    const batch = writeBatch(db);
    batch.set(configRef, {
      id: 'config',
      clientName,
      features: DEFAULT_FEATURES,
      createdAt: now,
      createdBy: uid,
    });
    batch.set(registryRef, {
      id: tenantId,
      tenantId,
      clientName,
      status: 'active',
      features: DEFAULT_FEATURES,
      workspaceUrl,
      portalAccessCode,
      portalUrl,
      createdAt: now,
      createdBy: uid,
      provisionedBy: 'admin-direct',
    });
    await batch.commit();
    workspaceCreated = true;
  } else {
    await setDoc(registryRef, {
      clientName,
      workspaceUrl,
      portalAccessCode,
      portalUrl,
      updatedAt: now,
    }, { merge: true });
  }

  if (deliverViaPortal) {
    await upsertPortalDelivery({
      portalAccessCode,
      clientName,
      repName,
      workspaceUrl,
      workspaceTenantId: tenantId,
    });
    await setDoc(registryRef, {
      portalAccessCode,
      portalUrl,
      updatedAt: Date.now(),
    }, { merge: true });
  }

  const profileId = input.profileId?.trim();
  if (profileId) {
    await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles', profileId), {
      coreWorkspaceTenantId: tenantId,
      provisioningStatus: 'ready',
      provisioningError: deleteField(),
      updatedAt: Date.now(),
    }, { merge: true });
  }

  if (input.deployStarterTemplates !== false) {
    await deployStarterPackToTenant(tenantId);
  }

  const portalInstructions =
    `Your Core Workspace is ready.\n\n` +
    `1. Open the Client Portal: ${portalUrl}\n` +
    `2. Enter access code: ${portalAccessCode}\n` +
    `3. Click "Open Core Workspace" on your dashboard\n` +
    `   Direct link: ${workspaceUrl}\n\n` +
    (repEmail
      ? `Sign in with ${repEmail} and use "Forgot password or first-time setup" if this is your first visit.`
      : 'Ask your Kolthoff contact to invite your team email.');

  const mailtoUrl = repEmail
    ? `mailto:${encodeURIComponent(repEmail)}?subject=${encodeURIComponent(`${clientName} — Core Workspace Access`)}&body=${encodeURIComponent(portalInstructions)}`
    : undefined;

  const deliveryParts = [
    deliverViaPortal ? `Client Portal (code ${portalAccessCode})` : null,
    input.inviteContact && repEmail
      ? 'invite contact from Users & Flags (email requires server)'
      : null,
    input.deployStarterTemplates !== false ? 'approval templates deployed' : null,
  ].filter(Boolean);

  return {
    tenantId,
    clientName,
    workspaceUrl,
    portalUrl,
    portalAccessCode,
    portalDelivered: deliverViaPortal,
    passwordEmailSent: false,
    mailtoUrl,
    workspaceCreated,
    message: deliveryParts.length
      ? `Prepared ${clientName}. Delivered via ${deliveryParts.join(' + ')}.`
      : `Prepared ${clientName}. Copy the workspace link below to share manually.`,
  };
}
