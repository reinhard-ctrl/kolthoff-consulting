import * as admin from 'firebase-admin';
import type { Request, Response } from 'express';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-southeast1' });
admin.initializeApp();

const db = admin.firestore();

async function callerIsAdmin(uid: string | undefined, tokenRole: unknown): Promise<boolean> {
  if (!uid) return false;
  if (tokenRole === 'kolthoff_admin' || tokenRole === 'admin') return true;
  const session = await db.doc(`artifacts/kolthoff-admin-app/public/data/admin_sessions/${uid}`).get();
  return session.exists;
}

async function verifyPasscode(code: string) {
  const clean = code?.trim()?.toUpperCase();
  if (!clean) return { valid: false as const };

  const snap = await db
    .doc(`artifacts/kolthoff-admin-app/public/data/admin_credentials/${clean}`)
    .get();

  if (!snap.exists) return { valid: false as const };

  const role = (snap.data()?.role as string) || 'admin';
  const uid = `admin_${clean.toLowerCase()}`;

  let token: string | undefined;
  try {
    token = await admin.auth().createCustomToken(uid, {
      role: role === 'admin' ? 'kolthoff_admin' : role,
      tenantId: 'kolthoff-admin-app',
    });
  } catch (err) {
    console.error('createCustomToken failed', err);
  }

  return { valid: true as const, role, token };
}

/** Hosting rewrite endpoint — private invoker; Hosting grants invoke access automatically */
export const verifyAdminPasscodeHttp = onRequest({ invoker: 'private' }, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as { code?: string } | string | undefined;
  let code: string | undefined;
  if (body && typeof body === 'object' && 'code' in body) {
    code = body.code;
  } else if (typeof body === 'string') {
    try { code = JSON.parse(body).code; } catch { /* ignore */ }
  }
  if (!code) {
    res.status(400).json({ error: 'Passcode required' });
    return;
  }

  try {
    const result = await verifyPasscode(code);
    res.json(result);
  } catch (err) {
    console.error('verifyAdminPasscodeHttp failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/** Verify admin passcode — callable (requires public invoker; blocked by some org policies) */
export const verifyAdminPasscode = onCall({ invoker: 'public' }, async (request) => {
  const code = (request.data?.code as string)?.trim()?.toUpperCase();
  if (!code) throw new HttpsError('invalid-argument', 'Passcode required');
  return verifyPasscode(code);
});

/** Generate portal access token from client access code */
export const generatePortalToken = onCall({ invoker: 'public' }, async (request) => {
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
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
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
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Kolthoff admin only');
  }

  const { uid, claims } = request.data as { uid: string; claims: Record<string, unknown> };
  if (!uid || !claims) throw new HttpsError('invalid-argument', 'uid and claims required');

  await admin.auth().setCustomUserClaims(uid, claims);
  return { success: true };
});

/** Validate workbook_profiles on write (Firestore trigger) */
export const onWorkbookProfileWritten = onDocumentWritten(
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
