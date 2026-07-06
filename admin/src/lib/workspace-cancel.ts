import { deleteField, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import { INTERNAL_WORKSPACE_TENANT, isWorkspaceTenantCancelled } from './workspace-tenant-status';

export interface CancelWorkspaceTenantInput {
  tenantId: string;
  reason?: string;
}

export interface CancelWorkspaceTenantResult {
  tenantId: string;
  clientName: string;
  portalAccessCode?: string | null;
  message: string;
}

function validateCancelTarget(tenantId: string): void {
  if (tenantId === INTERNAL_WORKSPACE_TENANT) {
    throw new Error('The internal Kolthoff workspace cannot be cancelled.');
  }
  if (!/^client-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Invalid workspace tenant ID.');
  }
}

/** Soft-cancel — disables workspace access while retaining tenant data. */
export async function cancelWorkspaceTenant(
  input: CancelWorkspaceTenantInput,
): Promise<CancelWorkspaceTenantResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) throw new Error('Sign in required before cancelling workspaces.');

  const tenantId = input.tenantId.trim();
  validateCancelTarget(tenantId);

  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'core_workspaces', tenantId);
  const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
  const registrySnap = await getDoc(registryRef);

  if (!registrySnap.exists()) {
    throw new Error(`Workspace "${tenantId}" was not found in the registry.`);
  }

  const registry = registrySnap.data() as Record<string, unknown>;
  if (isWorkspaceTenantCancelled(registry)) {
    throw new Error(`Workspace "${tenantId}" is already cancelled.`);
  }

  const clientName = String(registry.clientName || tenantId);
  const portalAccessCode = (registry.portalAccessCode as string | undefined) || null;
  const now = Date.now();
  const cancelledBy = auth.currentUser.uid;
  const reason = input.reason?.trim() || null;

  const batch = writeBatch(db);
  batch.set(registryRef, {
    status: 'cancelled',
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
  await batch.commit();

  if (portalAccessCode) {
    try {
      await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'clients', portalAccessCode), {
        workspaceDisabled: true,
        workspaceCancelledAt: now,
        updatedAt: now,
      }, { merge: true });
    } catch (err) {
      console.warn(`Could not disable portal entry for ${tenantId}:`, err);
    }
  }

  return {
    tenantId,
    clientName,
    portalAccessCode,
    message: `Cancelled workspace for ${clientName}. Client access is disabled.`,
  };
}
