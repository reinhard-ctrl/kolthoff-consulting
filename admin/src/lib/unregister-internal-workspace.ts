import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import { INTERNAL_WORKSPACE_TENANT } from './workspace-tenant-status';

export interface UnregisterInternalWorkspaceResult {
  removed: boolean;
  message: string;
}

/** Removes kolthoff-admin-app from core_workspaces only — admin console data stays intact. */
export async function unregisterInternalWorkspace(): Promise<UnregisterInternalWorkspaceResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) {
    throw new Error('Sign in required before removing the internal workspace.');
  }

  const registryRef = doc(
    db,
    'artifacts',
    adminAppId,
    'public',
    'data',
    'core_workspaces',
    INTERNAL_WORKSPACE_TENANT,
  );
  const snap = await getDoc(registryRef);

  if (!snap.exists()) {
    return {
      removed: false,
      message: 'Internal workspace is not in the client registry (already removed).',
    };
  }

  await deleteDoc(registryRef);

  return {
    removed: true,
    message:
      'Removed internal Kolthoff workspace from the client registry. Admin console data is unchanged. Use Quick provision to create client workspaces.',
  };
}
