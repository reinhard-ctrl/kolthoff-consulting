import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

const ADMIN_APP = 'kolthoff-admin-app';
const PROVISION_TIMEOUT_MS = 45000;

function staffSsoRequestRef(uid: string) {
  return doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'staff_sso_requests', uid);
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

export async function provisionGoogleStaffViaFirestore(
  user: User,
  options?: { timeoutMs?: number },
): Promise<void> {
  const provisionTimeout = options?.timeoutMs ?? PROVISION_TIMEOUT_MS;
  const token = await user.getIdTokenResult();
  if (
    (token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin') &&
    token.claims.tenantId === ADMIN_APP
  ) {
    return;
  }

  const ref = staffSsoRequestRef(user.uid);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.status === 'complete') {
    await user.getIdToken(true);
    const refreshed = await user.getIdTokenResult();
    if (refreshed.claims.tenantId === ADMIN_APP) return;
  }

  const payload = {
    status: 'pending',
    email: user.email?.trim().toLowerCase() || null,
    displayName: user.displayName || null,
    requestedAt: Date.now(),
  };

  if (!existing.exists() || existing.data()?.status === 'error') {
    await setDoc(ref, payload);
  } else if (existing.data()?.status !== 'pending') {
    await setDoc(ref, payload);
  }

  await waitForStaffProvision(user.uid, provisionTimeout);
  await user.getIdToken(true);
}
