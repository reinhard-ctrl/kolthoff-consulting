import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, adminAppId } from './firebase';

const PROVISION_TIMEOUT_MS = 45000;

function staffSsoRequestRef(uid: string) {
  return doc(db, 'artifacts', adminAppId, 'public', 'data', 'staff_sso_requests', uid);
}

async function waitForStaffProvision(uid: string, timeoutMs: number): Promise<void> {
  const ref = staffSsoRequestRef(uid);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('Staff provisioning timed out. Try again or use passcode login.'));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (data?.status === 'complete') {
          clearTimeout(timeout);
          unsub();
          resolve();
        } else if (data?.status === 'error') {
          clearTimeout(timeout);
          unsub();
          reject(new Error(String(data.error || 'Staff provisioning failed')));
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

async function enqueueStaffProvisionRequest(user: User): Promise<void> {
  const ref = staffSsoRequestRef(user.uid);
  const payload = {
    status: 'pending' as const,
    email: user.email?.trim().toLowerCase() || null,
    displayName: user.displayName || null,
    requestedAt: Date.now(),
  };

  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, payload);
    return;
  }

  const priorRequestedAt =
    typeof existing.data()?.requestedAt === 'number' ? existing.data()!.requestedAt : 0;
  await updateDoc(ref, {
    ...payload,
    requestedAt: Math.max(payload.requestedAt, priorRequestedAt + 1),
  });
}

/** Provision staff claims via Firestore — works when Cloud Functions are not publicly invokable */
export async function provisionGoogleStaffViaFirestore(
  user: User,
  options?: { timeoutMs?: number },
): Promise<void> {
  const provisionTimeout = options?.timeoutMs ?? PROVISION_TIMEOUT_MS;
  const token = await user.getIdTokenResult();
  if (
    (token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin') &&
    token.claims.tenantId === adminAppId
  ) {
    return;
  }

  const ref = staffSsoRequestRef(user.uid);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.status === 'complete') {
    await user.getIdToken(true);
    const refreshed = await user.getIdTokenResult();
    if (refreshed.claims.tenantId === adminAppId) return;
  }

  await enqueueStaffProvisionRequest(user);
  await waitForStaffProvision(user.uid, provisionTimeout);
  await user.getIdToken(true);
}
