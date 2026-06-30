import * as admin from 'firebase-admin';
import type { Request, Response } from 'express';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-southeast1' });
admin.initializeApp();

const db = admin.firestore();

const WEB_API_KEY = 'AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI';
const DEFAULT_WORKSPACE_URL = 'https://kolthoff-portal.web.app/workspace/';

const DEFAULT_CLIENT_FEATURES = {
  messenger: true,
  approvals: true,
  vault: true,
  crm: false,
};

function workspaceContinueUrl(tenantId: string): string {
  if (tenantId && tenantId !== 'kolthoff-admin-app') {
    return `${DEFAULT_WORKSPACE_URL}?tenant=${encodeURIComponent(tenantId)}`;
  }
  return DEFAULT_WORKSPACE_URL;
}

function slugifyClientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeTenantId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith('client-') ? trimmed : `client-${trimmed}`;
}

async function coreUserExists(tenantId: string, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const snap = await db
    .collection(`artifacts/${tenantId}/public/data/core_users`)
    .where('email', '==', normalized)
    .limit(1)
    .get();
  return !snap.empty;
}

async function sendPasswordResetEmail(email: string, continueUrl: string): Promise<void> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: email.trim().toLowerCase(),
        continueUrl,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('sendOobCode failed', err);
    throw new Error('sendOobCode failed');
  }
}

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

  let passwordEmailSent = false;
  try {
    await sendPasswordResetEmail(email, workspaceContinueUrl(tenantId));
    passwordEmailSent = true;
  } catch (err) {
    console.warn('inviteWorkspaceUser: password email failed', err);
  }

  return { userId, firebaseUid: userRecord.uid, passwordEmailSent };
});

/** Request password reset — public; validates email against core_users server-side */
export const requestWorkspacePasswordReset = onCall({ invoker: 'public' }, async (request) => {
  const email = (request.data?.email as string)?.trim()?.toLowerCase();
  const tenantId = (request.data?.tenantId as string)?.trim() || 'kolthoff-admin-app';
  if (!email) throw new HttpsError('invalid-argument', 'Email required');

  const genericMessage =
    'If that email is registered with your organization, a password reset link has been sent.';

  const exists = await coreUserExists(tenantId, email);
  if (!exists) {
    return { sent: true, message: genericMessage };
  }

  try {
    await sendPasswordResetEmail(email, workspaceContinueUrl(tenantId));
  } catch (err) {
    console.error('requestWorkspacePasswordReset failed', err);
    throw new HttpsError('internal', 'Could not send password email. Try again or contact your admin.');
  }

  return {
    sent: true,
    message: 'Password reset link sent. Check your inbox (and spam folder), then return here to sign in.',
  };
});

/** Admin-triggered password reset for a workspace user */
export const sendWorkspacePasswordReset = onCall(async (request) => {
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const email = (request.data?.email as string)?.trim()?.toLowerCase();
  const tenantId = (request.data?.tenantId as string)?.trim() || 'kolthoff-admin-app';
  if (!email) throw new HttpsError('invalid-argument', 'Email required');

  try {
    await sendPasswordResetEmail(email, workspaceContinueUrl(tenantId));
  } catch (err) {
    console.error('sendWorkspacePasswordReset failed', err);
    throw new HttpsError('internal', 'Could not send password email.');
  }

  return { sent: true, message: `Password reset email sent to ${email}.` };
});

/** Provision an isolated Core Workspace tenant for a client */
export const createClientWorkspace = onCall(async (request) => {
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const clientName = (request.data?.clientName as string)?.trim();
  const requestedTenantId = (request.data?.tenantId as string)?.trim();
  if (!clientName) throw new HttpsError('invalid-argument', 'Client name required');

  const tenantId = requestedTenantId
    ? normalizeTenantId(requestedTenantId)
    : `client-${slugifyClientName(clientName)}`;

  if (!/^client-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new HttpsError(
      'invalid-argument',
      'Tenant ID must look like client-acme-corp (lowercase letters, numbers, hyphens).',
    );
  }
  if (tenantId === 'kolthoff-admin-app') {
    throw new HttpsError('invalid-argument', 'Reserved tenant ID');
  }

  const configRef = db.doc(`artifacts/${tenantId}/public/data/tenant_settings/config`);
  const registryRef = db.doc(`artifacts/kolthoff-admin-app/public/data/core_workspaces/${tenantId}`);
  const [configSnap, registrySnap] = await Promise.all([configRef.get(), registryRef.get()]);
  if (configSnap.exists || registrySnap.exists) {
    throw new HttpsError('already-exists', `Workspace "${tenantId}" already exists`);
  }

  const now = Date.now();
  const workspaceUrl = workspaceContinueUrl(tenantId);
  const batch = db.batch();
  batch.set(configRef, {
    id: 'config',
    clientName,
    features: DEFAULT_CLIENT_FEATURES,
    createdAt: now,
    createdBy: request.auth?.uid || null,
  });
  batch.set(registryRef, {
    id: tenantId,
    tenantId,
    clientName,
    status: 'active',
    features: DEFAULT_CLIENT_FEATURES,
    workspaceUrl,
    createdAt: now,
    createdBy: request.auth?.uid || null,
  });
  await batch.commit();

  return { tenantId, clientName, workspaceUrl, features: DEFAULT_CLIENT_FEATURES };
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
