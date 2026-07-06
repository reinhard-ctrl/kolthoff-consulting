import { deleteDoc, deleteField, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import { AGENCY_OPS_DEMO_TENANT, isAgencyOpsTenantCancelled } from './agency-ops-tenant-status';

export interface CancelAgencyOpsTenantInput {
  tenantId: string;
  reason?: string;
}

export interface CancelAgencyOpsTenantResult {
  tenantId: string;
  clientName: string;
  profileId?: string | null;
  message: string;
}

function validateCancelTarget(tenantId: string): void {
  if (tenantId === AGENCY_OPS_DEMO_TENANT) {
    throw new Error('The sales demo tenant cannot be cancelled.');
  }
  if (!/^agency-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Invalid Agency Ops tenant ID.');
  }
}

/** Soft-cancel — disables login, clears profile link; tenant data is retained. */
export async function cancelAgencyOpsTenant(
  input: CancelAgencyOpsTenantInput,
): Promise<CancelAgencyOpsTenantResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) throw new Error('Sign in required before cancelling Agency Ops tenants.');

  const tenantId = input.tenantId.trim();
  validateCancelTarget(tenantId);

  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'agency_ops_tenants', tenantId);
  const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
  const registrySnap = await getDoc(registryRef);

  if (!registrySnap.exists()) {
    throw new Error(`Agency Ops tenant "${tenantId}" was not found in the registry.`);
  }

  const registry = registrySnap.data() as Record<string, unknown>;
  if (isAgencyOpsTenantCancelled(registry)) {
    throw new Error(`Agency Ops tenant "${tenantId}" is already cancelled.`);
  }

  const clientName = String(registry.clientName || tenantId);
  const profileId = (registry.profileId as string | undefined) || null;
  const passcode = typeof registry.initialPasscode === 'string' ? registry.initialPasscode.trim().toLowerCase() : '';
  const now = Date.now();
  const cancelledBy = auth.currentUser.uid;
  const reason = input.reason?.trim() || null;

  const batch = writeBatch(db);
  batch.set(registryRef, {
    status: 'cancelled',
    provisioningStatus: 'cancelled',
    cancelledAt: now,
    cancelledBy,
    cancellationReason: reason,
    updatedAt: now,
  }, { merge: true });
  batch.set(configRef, {
    accountStatus: 'cancelled',
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy,
    cancellationReason: reason,
    updatedAt: now,
  }, { merge: true });

  if (profileId) {
    batch.set(doc(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles', profileId), {
      agencyOpsTenantId: deleteField(),
      provisioningStatus: 'cancelled',
      links: deleteField(),
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();

  if (passcode) {
    const credRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'admin_credentials', passcode);
    try {
      await deleteDoc(credRef);
    } catch (err) {
      console.warn(`Could not delete passcode credential for ${tenantId}:`, err);
    }
  }

  return {
    tenantId,
    clientName,
    profileId,
    message: `Cancelled Agency Ops account for ${clientName}. Console access is disabled.`,
  };
}
