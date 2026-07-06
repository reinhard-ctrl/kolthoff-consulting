import { auth, bootstrapAuth } from './firebase';

const FIRESTORE_TIMEOUT_MS = 90000;

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('permission-denied')
    || msg.includes('Missing or insufficient permissions')
    || msg.includes('PERMISSION_DENIED');
}

function shouldFallbackToFirestore(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('404')
    || msg.includes('403')
    || msg.includes('502')
    || msg.includes('503')
    || msg.includes('Failed to fetch')
    || msg.includes('NetworkError');
}

async function prepareClientWorkspaceViaHosting(
  input: ClientProvisionInput,
): Promise<ClientProvisionResult> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required before provisioning client workspaces.');

  const idToken = await user.getIdToken();
  const res = await fetch('/api/prepareClientWorkspace', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      clientName: input.clientName,
      tenantId: input.tenantId,
      portalAccessCode: input.portalAccessCode,
      repName: input.repName,
      repEmail: input.repEmail,
      deliverViaPortal: input.deliverViaPortal,
      inviteContact: input.inviteContact,
      deployStarterTemplates: input.deployStarterTemplates,
      profileId: input.profileId,
    }),
  });

  const payload = await res.json().catch(() => ({})) as { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(payload.error || payload.message || `Provision failed (${res.status})`);
  }
  return payload as ClientProvisionResult;
}

/** Direct Firestore first (no Cloud Functions); Hosting API and queue as fallbacks. */
export async function prepareClientWorkspace(
  input: ClientProvisionInput,
  options?: { onProgress?: (message: string) => void },
): Promise<ClientProvisionResult> {
  await bootstrapAuth();

  options?.onProgress?.('Provisioning workspace…');

  try {
    return await provisionClientWorkspaceDirect(input);
  } catch (directErr) {
    if (!isPermissionError(directErr)) {
      throw directErr instanceof Error ? directErr : new Error(String(directErr));
    }
    console.warn('Direct provision blocked by rules; trying Hosting API:', directErr);
  }

  try {
    options?.onProgress?.('Retrying via server API…');
    return await prepareClientWorkspaceViaHosting(input);
  } catch (httpErr) {
    if (!shouldFallbackToFirestore(httpErr)) {
      throw httpErr instanceof Error ? httpErr : new Error(String(httpErr));
    }
    console.warn('Hosting provision unavailable; trying Firestore queue:', httpErr);
  }

  options?.onProgress?.('Waiting for server queue…');
  return provisionClientWorkspaceViaFirestore(input, {
    timeoutMs: FIRESTORE_TIMEOUT_MS,
    onProgress: options?.onProgress,
  });
}
