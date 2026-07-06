import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';

const PROVISION_TIMEOUT_MS = 90000;

export interface ClientProvisionInput {
  clientName: string;
  tenantId?: string;
  profileId?: string;
  portalAccessCode?: string;
  repName?: string;
  repEmail?: string;
  deliverViaPortal?: boolean;
  inviteContact?: boolean;
  deployStarterTemplates?: boolean;
}

export interface ClientProvisionResult {
  tenantId: string;
  clientName: string;
  workspaceUrl: string;
  portalUrl: string;
  portalAccessCode: string;
  portalDelivered: boolean;
  passwordEmailSent: boolean;
  mailtoUrl?: string;
  message: string;
  workspaceCreated: boolean;
}

function provisionRequestRef(requestId: string) {
  return doc(db, 'artifacts', adminAppId, 'public', 'data', 'client_provision_requests', requestId);
}

function newRequestId(): string {
  return `cw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function waitForProvision(
  requestId: string,
  timeoutMs: number,
  onProgress?: (message: string) => void,
): Promise<ClientProvisionResult> {
  const ref = provisionRequestRef(requestId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('Client workspace provisioning timed out. Deploy Cloud Functions and Firestore rules, then retry.'));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (!data) return;

        if (data.status === 'pending') {
          onProgress?.('Server is provisioning the workspace…');
        } else if (data.status === 'complete') {
          clearTimeout(timeout);
          unsub();
          resolve({
            tenantId: String(data.tenantId),
            clientName: String(data.clientName),
            workspaceUrl: String(data.workspaceUrl),
            portalUrl: String(data.portalUrl || ''),
            portalAccessCode: String(data.portalAccessCode || ''),
            portalDelivered: Boolean(data.portalDelivered),
            passwordEmailSent: Boolean(data.passwordEmailSent),
            mailtoUrl: typeof data.mailtoUrl === 'string' ? data.mailtoUrl : undefined,
            message: String(data.message || 'Client workspace provisioned.'),
            workspaceCreated: Boolean(data.workspaceCreated),
          });
        } else if (data.status === 'error') {
          clearTimeout(timeout);
          unsub();
          reject(new Error(String(data.error || 'Client workspace provisioning failed')));
        }
      },
      (err) => {
        clearTimeout(timeout);
        unsub();
        reject(err);
      },
    );
  });
}

async function enqueueProvisionRequest(input: ClientProvisionInput): Promise<string> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required before provisioning client workspaces.');

  const requestId = newRequestId();
  const ref = provisionRequestRef(requestId);
  const payload = {
    status: 'pending' as const,
    clientName: input.clientName.trim(),
    tenantId: input.tenantId?.trim() || null,
    profileId: input.profileId?.trim() || null,
    portalAccessCode: input.portalAccessCode?.trim() || null,
    repName: input.repName?.trim() || null,
    repEmail: input.repEmail?.trim() || null,
    deliverViaPortal: input.deliverViaPortal !== false,
    inviteContact: input.inviteContact !== false,
    deployStarterTemplates: input.deployStarterTemplates !== false,
    requestedAt: Date.now(),
    requestedBy: uid,
  };

  await setDoc(ref, payload);
  return requestId;
}

/** Provision via Firestore trigger — works when Cloud Functions are not publicly invokable */
export async function provisionClientWorkspaceViaFirestore(
  input: ClientProvisionInput,
  options?: { timeoutMs?: number; onProgress?: (message: string) => void },
): Promise<ClientProvisionResult> {
  options?.onProgress?.('Queuing provision request…');
  const requestId = await enqueueProvisionRequest(input);
  return waitForProvision(requestId, options?.timeoutMs ?? PROVISION_TIMEOUT_MS, options?.onProgress);
}

export async function retryClientProvisionRequest(
  requestId: string,
  input: ClientProvisionInput,
): Promise<ClientProvisionResult> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required.');

  const ref = provisionRequestRef(requestId);
  const existing = await getDoc(ref);
  const priorRequestedAt = typeof existing.data()?.requestedAt === 'number' ? existing.data()!.requestedAt : 0;

  await updateDoc(ref, {
    status: 'pending',
    clientName: input.clientName.trim(),
    tenantId: input.tenantId?.trim() || null,
    profileId: input.profileId?.trim() || null,
    portalAccessCode: input.portalAccessCode?.trim() || null,
    repName: input.repName?.trim() || null,
    repEmail: input.repEmail?.trim() || null,
    deliverViaPortal: input.deliverViaPortal !== false,
    inviteContact: input.inviteContact !== false,
    deployStarterTemplates: input.deployStarterTemplates !== false,
    requestedAt: Math.max(Date.now(), priorRequestedAt + 1),
    requestedBy: uid,
    error: null,
  });

  return waitForProvision(requestId, PROVISION_TIMEOUT_MS);
}
