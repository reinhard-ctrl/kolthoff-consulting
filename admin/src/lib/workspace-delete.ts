import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import { INTERNAL_WORKSPACE_TENANT } from './workspace-tenant-status';

export interface DeleteWorkspaceTenantInput {
  tenantId: string;
}

export interface DeleteWorkspaceTenantResult {
  tenantId: string;
  clientName: string;
  portalAccessCode?: string | null;
  profileId?: string | null;
  message: string;
}

function validateDeleteTarget(tenantId: string): void {
  if (tenantId === INTERNAL_WORKSPACE_TENANT) {
    throw new Error('The internal Kolthoff workspace cannot be deleted.');
  }
  if (!/^client-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new Error('Invalid workspace tenant ID.');
  }
}

/** Permanently removes a workspace from the registry and clears its settings. */
export async function deleteWorkspaceTenant(
  input: DeleteWorkspaceTenantInput,
): Promise<DeleteWorkspaceTenantResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) throw new Error('Sign in required before deleting workspaces.');

  const tenantId = input.tenantId.trim();
  validateDeleteTarget(tenantId);

  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'core_workspaces', tenantId);
  const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
  const registrySnap = await getDoc(registryRef);

  if (!registrySnap.exists()) {
    throw new Error(`Workspace "${tenantId}" was not found in the registry.`);
  }

  const registry = registrySnap.data() as Record<string, unknown>;
  const clientName = String(registry.clientName || tenantId);
  const portalAccessCode = (registry.portalAccessCode as string | undefined) || null;
  const registryProfileId = (registry.profileId as string | undefined) || null;
  const now = Date.now();

  let profileId = registryProfileId;
  if (!profileId) {
    try {
      const profileQuery = query(
        collection(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles'),
        where('coreWorkspaceTenantId', '==', tenantId),
      );
      const profileSnaps = await getDocs(profileQuery);
      if (!profileSnaps.empty) {
        profileId = profileSnaps.docs[0].id;
      }
    } catch (err) {
      console.warn(`Could not look up workbook profile for ${tenantId}:`, err);
    }
  }

  await deleteDoc(registryRef);

  try {
    await deleteDoc(configRef);
  } catch (err) {
    console.warn(`Could not delete tenant settings for ${tenantId}:`, err);
  }

  if (portalAccessCode) {
    try {
      await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'clients', portalAccessCode), {
        workspaceUrl: deleteField(),
        workspaceTenantId: deleteField(),
        workspaceDisabled: deleteField(),
        workspaceCancelledAt: deleteField(),
        updatedAt: now,
      }, { merge: true });
    } catch (err) {
      console.warn(`Could not clear portal link for ${tenantId}:`, err);
    }
  }

  if (profileId) {
    try {
      await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'workbook_profiles', profileId), {
        coreWorkspaceTenantId: deleteField(),
        provisioningStatus: deleteField(),
        provisioningError: deleteField(),
        updatedAt: now,
      }, { merge: true });
    } catch (err) {
      console.warn(`Could not clear workbook profile link for ${tenantId}:`, err);
    }
  }

  return {
    tenantId,
    clientName,
    portalAccessCode,
    profileId,
    message: `Deleted workspace ${clientName} (${tenantId}).`,
  };
}
