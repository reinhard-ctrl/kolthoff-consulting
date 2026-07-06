import { deleteDoc, deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import { AGENCY_OPS_DEMO_TENANT } from './agency-ops-tenant-status';

export interface DeleteAgencyOpsTenantInput {
  tenantId: string;
}

export interface DeleteAgencyOpsTenantResult {
  tenantId: string;
  clientName: string;
  profileId?: string | null;
  message: string;
}

function validateDeleteTarget(tenantId: string): void {
  if (tenantId === AGENCY_OPS_DEMO_TENANT) {
    throw new Error('The sales demo tenant cannot be deleted.');
  }
  if (!/^agency-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Invalid Agency Ops tenant ID.');
  }
}

/** Permanently removes an Agency Ops tenant from the registry and clears its credentials. */
export async function deleteAgencyOpsTenant(
  input: DeleteAgencyOpsTenantInput,
): Promise<DeleteAgencyOpsTenantResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) throw new Error('Sign in required before deleting Agency Ops tenants.');

  const tenantId = input.tenantId.trim();
  validateDeleteTarget(tenantId);

  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'agency_ops_tenants', tenantId);
  const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
  const registrySnap = await getDoc(registryRef);

  if (!registrySnap.exists()) {
    throw new Error(`Agency Ops tenant "${tenantId}" was not found in the registry.`);
  }

  const registry = registrySnap.data() as Record<string, unknown>;
  const clientName = String(registry.clientName || tenantId);
  const profileId = (registry.profileId as string | undefined) || null;
  const passcode = typeof registry.initialPasscode === 'string' ? registry.initialPasscode.trim().toLowerCase() : '';
  const now = Date.now();

  await deleteDoc(registryRef);

  try {
    await deleteDoc(configRef);
  } catch (err) {
    console.warn(`Could not delete tenant settings for ${tenantId}:`, err);
  }

  if (passcode) {
    const credRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'admin_credentials', passcode);
    try {
      await deleteDoc(credRef);
    } catch (err) {
      console.warn(`Could not delete passcode credential for ${tenantId}:`, err);
    }
  }

  if (profileId) {
    try {
      await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles', profileId), {
        agencyOpsTenantId: deleteField(),
        provisioningStatus: deleteField(),
        provisioningError: deleteField(),
        links: deleteField(),
        updatedAt: now,
      }, { merge: true });
    } catch (err) {
      console.warn(`Could not clear workbook profile link for ${tenantId}:`, err);
    }
  }

  return {
    tenantId,
    clientName,
    profileId,
    message: `Deleted Agency Ops account ${clientName} (${tenantId}).`,
  };
}
