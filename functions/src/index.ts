import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-southeast1' });
admin.initializeApp();

const db = admin.firestore();

/** Verify admin passcode — replaces client-side ADMIN fallback */
export const verifyAdminPasscode = onCall(async (request) => {
  const code = (request.data?.code as string)?.trim()?.toUpperCase();
  if (!code) throw new HttpsError('invalid-argument', 'Passcode required');

  const snap = await db
    .doc(`artifacts/kolthoff-admin-app/public/data/admin_credentials/${code}`)
    .get();

  if (!snap.exists) {
    return { valid: false };
  }

  return { valid: true, role: snap.data()?.role || 'admin' };
});

/** Generate portal access token from client access code */
export const generatePortalToken = onCall(async (request) => {
  const accessCode = (request.data?.accessCode as string)?.trim()?.toUpperCase();
  if (!accessCode) throw new HttpsError('invalid-argument', 'Access code required');

  const clientSnap = await db
    .doc(`artifacts/kolthoff-admin-app/public/data/clients/${accessCode}`)
    .get();

  if (!clientSnap.exists) {
    throw new HttpsError('not-found', 'Invalid access code');
  }

  const uid = `portal_${accessCode.toLowerCase()}`;
  const token = await admin.auth().createCustomToken(uid, {
    role: 'portal_client',
    accessCode,
    tenantId: 'kolthoff-admin-app',
  });

  return { token, client: clientSnap.data() };
});

/** Invite workspace user — creates Firebase Auth user + core_users doc */
export const inviteWorkspaceUser = onCall(async (request) => {
  if (!request.auth?.token?.role || !['kolthoff_admin', 'admin'].includes(request.auth.token.role as string)) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const { email, name, tenantId, role, departmentId } = request.data as {
    email: string; name: string; tenantId: string; role?: string; departmentId?: string;
  };

  if (!email || !tenantId) throw new HttpsError('invalid-argument', 'email and tenantId required');

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    userRecord = await admin.auth().createUser({ email, displayName: name, emailVerified: false });
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    tenantId,
    role: role || 'user',
  });

  const userId = `u_${userRecord.uid.slice(0, 8)}`;
  await db.doc(`artifacts/${tenantId}/public/data/core_users/${userId}`).set({
    id: userId,
    email,
    name: name || email,
    role: role || 'user',
    departmentId: departmentId || null,
    firebaseUid: userRecord.uid,
    updatedAt: Date.now(),
  }, { merge: true });

  return { userId, firebaseUid: userRecord.uid };
});

/** Set custom claims — kolthoff admin only */
export const setUserClaims = onCall(async (request) => {
  if (request.auth?.token?.role !== 'kolthoff_admin') {
    throw new HttpsError('permission-denied', 'Kolthoff admin only');
  }

  const { uid, claims } = request.data as { uid: string; claims: Record<string, unknown> };
  if (!uid || !claims) throw new HttpsError('invalid-argument', 'uid and claims required');

  await admin.auth().setCustomUserClaims(uid, claims);
  return { success: true };
});

/** Validate workbook_profiles on write */
export const validateWorkbookProfile = onDocumentWritten(
  'artifacts/{tenantId}/public/data/workbook_profiles/{profileId}',
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    if (!after.clientName || !Array.isArray(after.tasks)) {
      console.warn('Invalid workbook profile:', event.params.profileId);
    }

    // Optionally compute and cache financials server-side
    const tasks = (after.tasks || []).filter((t: { selected?: boolean }) => t.selected);
    const totalHours = tasks.reduce((acc: number, t: { estHours?: number }) => acc + (t.estHours || 0), 0);

    if (totalHours > 0 && after.clientName) {
      await event.data!.after!.ref.set({ _meta: { totalHours, validatedAt: Date.now() } }, { merge: true });
    }
  }
);
