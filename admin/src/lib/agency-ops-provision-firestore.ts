import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';

import type { AgencyOpsProvisionInput, AgencyOpsProvisionResult } from './agency-ops-provision-firestore';
import { provisionAgencyOpsDirect } from './agency-ops-provision-direct';

const TRIGGER_TIMEOUT_MS = 90000;
const PROVISION_TIMEOUT_MS = 180000;

export interface AgencyOpsProvisionInput {
  clientName: string;
  tenantId?: string;
  profileId?: string;
  repEmail?: string;
  passcode?: string;
  throwIfExists?: boolean;
}

export interface AgencyOpsProvisionResult {
  tenantId: string;
  clientName: string;
  consoleUrl: string;
  passcode: string;
  profileId?: string | null;
  quoteId?: string | null;
  mailtoUrl?: string;
  message: string;
  created: boolean;
}

function provisionRequestRef(requestId: string) {
  return doc(db, 'artifacts', adminAppId, 'public', 'data', 'agency_ops_provision_requests', requestId);
}

function newRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function waitForProvision(requestId: string, timeoutMs: number): Promise<AgencyOpsProvisionResult> {
  const ref = provisionRequestRef(requestId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('Cloud Function provisioning timed out. Retrying direct provision…'));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (data?.status === 'complete') {
          clearTimeout(timeout);
          unsub();
          resolve({
            tenantId: String(data.tenantId),
            clientName: String(data.clientName),
            consoleUrl: String(data.consoleUrl),
            passcode: String(data.passcode || ''),
            profileId: (data.profileId as string | null) ?? null,
            quoteId: (data.quoteId as string | null) ?? null,
            mailtoUrl: typeof data.mailtoUrl === 'string' ? data.mailtoUrl : undefined,
            message: String(data.message || 'Agency Ops tenant provisioned.'),
            created: Boolean(data.created),
          });
        } else if (data?.status === 'error') {
          clearTimeout(timeout);
          unsub();
          reject(new Error(String(data.error || 'Agency Ops provisioning failed')));
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

async function enqueueProvisionRequest(input: AgencyOpsProvisionInput): Promise<string> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required before provisioning Agency Ops tenants.');

  const requestId = newRequestId();
  const ref = provisionRequestRef(requestId);
  const payload = {
    status: 'pending' as const,
    clientName: input.clientName.trim(),
    tenantId: input.tenantId?.trim() || null,
    profileId: input.profileId?.trim() || null,
    repEmail: input.repEmail?.trim() || null,
    passcode: input.passcode?.trim() || null,
    throwIfExists: Boolean(input.throwIfExists),
    requestedAt: Date.now(),
    requestedBy: uid,
  };

  await setDoc(ref, payload);
  return requestId;
}

/** Provision Agency Ops tenant — direct Firestore first (fast), Cloud Function trigger as fallback */
export async function provisionAgencyOpsViaFirestore(
  input: AgencyOpsProvisionInput,
  options?: { timeoutMs?: number; preferTrigger?: boolean },
): Promise<AgencyOpsProvisionResult> {
  if (!options?.preferTrigger) {
    try {
      return await provisionAgencyOpsDirect(input);
    } catch (directErr) {
      const message = directErr instanceof Error ? directErr.message : String(directErr);
      if (!message.includes('permission-denied') && !message.includes('Missing or insufficient permissions')) {
        throw directErr;
      }
    }
  }

  const requestId = await enqueueProvisionRequest(input);
  return waitForProvision(requestId, options?.timeoutMs ?? TRIGGER_TIMEOUT_MS);
}

/** Retry a failed request by bumping requestedAt */
export async function retryProvisionRequest(requestId: string, input: AgencyOpsProvisionInput): Promise<AgencyOpsProvisionResult> {
  try {
    return await provisionAgencyOpsDirect(input);
  } catch {
    /* fall through to trigger retry */
  }

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
    repEmail: input.repEmail?.trim() || null,
    passcode: input.passcode?.trim() || null,
    throwIfExists: Boolean(input.throwIfExists),
    requestedAt: Math.max(Date.now(), priorRequestedAt + 1),
    requestedBy: uid,
    error: null,
  });

  return waitForProvision(requestId, PROVISION_TIMEOUT_MS);
}