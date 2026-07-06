import { bootstrapAuth, functions, httpsCallable } from './firebase';
import {
  provisionClientWorkspaceViaFirestore,
  type ClientProvisionInput,
  type ClientProvisionResult,
} from './client-provision-firestore';

const CALLABLE_TIMEOUT_MS = 120000;
const FIRESTORE_TIMEOUT_MS = 45000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]);
}

/** Callable first (fast); Firestore queue when org policy blocks public invoke */
export async function prepareClientWorkspace(
  input: ClientProvisionInput,
  options?: { onProgress?: (message: string) => void },
): Promise<ClientProvisionResult> {
  await bootstrapAuth();

  options?.onProgress?.('Provisioning workspace…');

  try {
    const prepare = httpsCallable(functions, 'prepareClientWorkspace');
    const result = await withTimeout(
      prepare({
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
      CALLABLE_TIMEOUT_MS,
      'Direct provision',
    );
    return result.data as ClientProvisionResult;
  } catch (callableErr) {
    const callableMsg = callableErr instanceof Error ? callableErr.message : String(callableErr);
    console.warn('prepareClientWorkspace callable failed; trying Firestore queue:', callableMsg);
    options?.onProgress?.('Direct provision unavailable — waiting for server queue…');
    return provisionClientWorkspaceViaFirestore(input, {
      timeoutMs: FIRESTORE_TIMEOUT_MS,
      onProgress: options?.onProgress,
    });
  }
}
