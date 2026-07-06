import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, adminAppId, functions, httpsCallable } from './firebase';

const PROVISION_TIMEOUT_MS = 45000;
const RETRY_WAIT_MS = 30000;

function staffSsoRequestRef(uid: string) {
  return doc(db, 'artifacts', adminAppId, 'public', 'data', 'staff_sso_requests', uid);
}

async function hasStaffClaims(user: User): Promise<boolean> {
  const token = await user.getIdTokenResult();
  return (
    (token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin') &&
    token.claims.tenantId === adminAppId
  );
}

async function isProvisionDocComplete(uid: string): Promise<boolean> {
  const snap = await getDoc(staffSsoRequestRef(uid));
  return snap.exists() && snap.data()?.status === 'complete';
}

async function waitForStaffProvision(uid: string, timeoutMs: number): Promise<void> {
  if (await isProvisionDocComplete(uid)) return;

  const ref = staffSsoRequestRef(uid);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsub();
      action();
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Staff provisioning timed out. Try again or use passcode login.')));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (data?.status === 'complete') {
          finish(resolve);
        } else if (data?.status === 'error') {
          finish(() => reject(new Error(String(data.error || 'Staff provisioning failed'))));
        }
      },
      (err) => {
        finish(() => reject(err));
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

async function retryStaffProvisionRequest(user: User): Promise<void> {
  const ref = staffSsoRequestRef(user.uid);
  const existing = await getDoc(ref);
  const priorRequestedAt =
    typeof existing.data()?.requestedAt === 'number' ? existing.data()!.requestedAt : 0;

  await updateDoc(ref, {
    status: 'pending',
    email: user.email?.trim().toLowerCase() || null,
    displayName: user.displayName || null,
    requestedAt: Math.max(Date.now(), priorRequestedAt + 1),
    error: null,
  });
}

async function provisionGoogleStaffViaCallable(user: User): Promise<void> {
  const provision = httpsCallable(functions, 'provisionGoogleStaff');
  await provision({});
  await user.getIdToken(true);
}

/** Provision staff claims via Firestore — works when Cloud Functions are not publicly invokable */
export async function provisionGoogleStaffViaFirestore(
  user: User,
  options?: { timeoutMs?: number },
): Promise<void> {
  const provisionTimeout = options?.timeoutMs ?? PROVISION_TIMEOUT_MS;
  if (await hasStaffClaims(user)) return;

  const ref = staffSsoRequestRef(user.uid);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.status === 'complete') {
    await user.getIdToken(true);
    if (await hasStaffClaims(user)) return;
  }

  await enqueueStaffProvisionRequest(user);
  if (await isProvisionDocComplete(user.uid)) {
    await user.getIdToken(true);
    return;
  }

  try {
    await waitForStaffProvision(user.uid, provisionTimeout);
  } catch (err) {
    const timedOut =
      err instanceof Error && err.message.includes('Staff provisioning timed out');
    if (!timedOut) throw err;

    await retryStaffProvisionRequest(user);
    if (await isProvisionDocComplete(user.uid)) {
      await user.getIdToken(true);
      return;
    }

    try {
      await waitForStaffProvision(user.uid, RETRY_WAIT_MS);
    } catch (retryErr) {
      try {
        await provisionGoogleStaffViaCallable(user);
        if (await hasStaffClaims(user)) return;
      } catch {
        /* Firestore trigger path preferred; callable may be blocked by org policy */
      }
      throw retryErr;
    }
  }

  await user.getIdToken(true);
}
