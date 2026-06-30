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
const DEFAULT_PORTAL_URL = 'https://kolthoff-portal.web.app/apps/public/portal.html';
const ADMIN_TENANT = 'kolthoff-admin-app';

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

function derivePortalAccessCode(clientName: string, tenantId: string, requested?: string): string {
  if (requested?.trim()) {
    return requested.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  }
  const fromName = clientName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (fromName) return fromName;
  return tenantId.replace('client-', '').toUpperCase().slice(0, 24);
}

function validateClientTenantId(tenantId: string) {
  if (!/^client-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new HttpsError(
      'invalid-argument',
      'Tenant ID must look like client-acme-corp (lowercase letters, numbers, hyphens).',
    );
  }
  if (tenantId === ADMIN_TENANT) {
    throw new HttpsError('invalid-argument', 'Reserved tenant ID');
  }
}

async function ensureClientWorkspace(
  clientName: string,
  requestedTenantId: string | undefined,
  createdBy: string | null,
  options?: { throwIfExists?: boolean },
): Promise<{ tenantId: string; workspaceUrl: string; created: boolean; clientName: string }> {
  const tenantId = requestedTenantId
    ? normalizeTenantId(requestedTenantId)
    : `client-${slugifyClientName(clientName)}`;
  validateClientTenantId(tenantId);

  const configRef = db.doc(`artifacts/${tenantId}/public/data/tenant_settings/config`);
  const registryRef = db.doc(`artifacts/${ADMIN_TENANT}/public/data/core_workspaces/${tenantId}`);
  const [configSnap, registrySnap] = await Promise.all([configRef.get(), registryRef.get()]);
  const workspaceUrl = workspaceContinueUrl(tenantId);

  if (configSnap.exists || registrySnap.exists) {
    if (options?.throwIfExists) {
      throw new HttpsError('already-exists', `Workspace "${tenantId}" already exists`);
    }
    await registryRef.set({
      clientName,
      workspaceUrl,
      updatedAt: Date.now(),
    }, { merge: true });
    return { tenantId, workspaceUrl, created: false, clientName };
  }

  const now = Date.now();
  const batch = db.batch();
  batch.set(configRef, {
    id: 'config',
    clientName,
    features: DEFAULT_CLIENT_FEATURES,
    createdAt: now,
    createdBy,
  });
  batch.set(registryRef, {
    id: tenantId,
    tenantId,
    clientName,
    status: 'active',
    features: DEFAULT_CLIENT_FEATURES,
    workspaceUrl,
    createdAt: now,
    createdBy,
  });
  await batch.commit();
  return { tenantId, workspaceUrl, created: true, clientName };
}

async function upsertClientPortalDelivery(params: {
  portalAccessCode: string;
  clientName: string;
  repName?: string;
  workspaceUrl: string;
  workspaceTenantId: string;
}) {
  const ref = db.doc(`artifacts/${ADMIN_TENANT}/public/data/clients/${params.portalAccessCode}`);
  const existing = await ref.get();
  const existingData = existing.data() || {};

  const workspaceAction = {
    id: Date.now(),
    title: 'Open Core Workspace',
    desc: 'Sign in with your organizational email. Choose "Forgot password or first-time setup" to create your password.',
    type: 'link',
    link: params.workspaceUrl,
    status: 'pending',
  };

  const actionItems = Array.isArray(existingData.actionItems) ? [...existingData.actionItems] : [];
  const filteredActions = actionItems.filter((item: { link?: string; title?: string }) => {
    const title = item.title || '';
    const link = item.link || '';
    return !(link.includes('/workspace/') || title.toLowerCase().includes('core workspace'));
  });

  await ref.set({
    companyName: params.clientName,
    repName: params.repName || existingData.repName || 'Client Representative',
    sowReference: params.portalAccessCode,
    workspaceUrl: params.workspaceUrl,
    workspaceTenantId: params.workspaceTenantId,
    portalAccessCode: params.portalAccessCode,
    currentPhase: existingData.currentPhase || 'MOD 1: Core Workspace Provisioning',
    progressPercentage: existingData.progressPercentage ?? 5,
    metrics: existingData.metrics || {
      annualLeakageIdentified: 0,
      chaosTaxEliminated: 0,
      saasSavingsIdentified: 0,
    },
    actionItems: [workspaceAction, ...filteredActions],
    roadmap: existingData.roadmap || [],
    assets: existingData.assets || [],
    contracts: existingData.contracts || [],
    workspacePreparedAt: Date.now(),
  }, { merge: true });
}

async function inviteWorkspaceMember(params: {
  email: string;
  name: string;
  tenantId: string;
  role?: string;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  const displayName = (params.name || normalizedEmail).trim();

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    if (displayName && userRecord.displayName !== displayName) {
      userRecord = await admin.auth().updateUser(userRecord.uid, { displayName });
    }
  } catch {
    userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      displayName,
      emailVerified: false,
    });
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    tenantId: params.tenantId,
    role: params.role || 'user',
  });

  const existingDoc = await findCoreUserDoc(params.tenantId, normalizedEmail);
  const userId = existingDoc?.id ?? `u_${userRecord.uid.slice(0, 8)}`;
  await db.doc(`artifacts/${params.tenantId}/public/data/core_users/${userId}`).set({
    id: userId,
    email: normalizedEmail,
    name: displayName,
    role: params.role || 'user',
    departmentId: null,
    firebaseUid: userRecord.uid,
    updatedAt: Date.now(),
  }, { merge: true });

  let passwordEmailSent = false;
  try {
    await sendPasswordResetEmail(normalizedEmail, workspaceContinueUrl(params.tenantId));
    passwordEmailSent = true;
  } catch (err) {
    console.warn('inviteWorkspaceMember: password email failed', err);
  }

  return { userId, firebaseUid: userRecord.uid, passwordEmailSent, email: normalizedEmail };
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

async function findCoreUserDoc(tenantId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  const snap = await db
    .collection(`artifacts/${tenantId}/public/data/core_users`)
    .where('email', '==', normalized)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function countCoreUserMemberships(email: string, excludeTenantId?: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const snap = await db.collectionGroup('core_users').where('email', '==', normalized).get();
  return snap.docs.filter((doc) => {
    const parts = doc.ref.path.split('/');
    const tenantId = parts[1];
    return tenantId !== excludeTenantId;
  }).length;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

  const result = await inviteWorkspaceMember({ email, name, tenantId, role });
  if (departmentId) {
    await db.doc(`artifacts/${tenantId}/public/data/core_users/${result.userId}`).set(
      { departmentId },
      { merge: true },
    );
  }
  return result;
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

  const email = normalizeEmail((request.data?.email as string) || '');
  const tenantId = (request.data?.tenantId as string)?.trim() || 'kolthoff-admin-app';
  if (!email) throw new HttpsError('invalid-argument', 'Email required');

  const exists = await coreUserExists(tenantId, email);
  if (!exists) {
    throw new HttpsError('not-found', 'User not found in this workspace tenant.');
  }

  try {
    await sendPasswordResetEmail(email, workspaceContinueUrl(tenantId));
  } catch (err) {
    console.error('sendWorkspacePasswordReset failed', err);
    throw new HttpsError('internal', 'Could not send password email.');
  }

  return { sent: true, message: `Password reset email sent to ${email}.` };
});

/** Remove a workspace member from a tenant */
export const removeWorkspaceUser = onCall(async (request) => {
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const tenantId = (request.data?.tenantId as string)?.trim() || 'kolthoff-admin-app';
  const userId = (request.data?.userId as string)?.trim();
  const email = normalizeEmail((request.data?.email as string) || '');
  const revokeAuth = request.data?.revokeAuth === true;

  if (!userId && !email) {
    throw new HttpsError('invalid-argument', 'userId or email required');
  }

  type MemberDoc = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;
  let userDoc: MemberDoc | null = null;

  if (userId) {
    const snap = await db.doc(`artifacts/${tenantId}/public/data/core_users/${userId}`).get();
    if (snap.exists) userDoc = snap;
  }
  if (!userDoc && email) {
    userDoc = await findCoreUserDoc(tenantId, email);
  }
  if (!userDoc || !userDoc.exists) {
    throw new HttpsError('not-found', 'Workspace member not found.');
  }

  const data = userDoc.data() as {
    email?: string;
    firebaseUid?: string;
    name?: string;
  };
  const memberEmail = normalizeEmail(data.email || email);
  const firebaseUid = data.firebaseUid;
  const removedUserId = userDoc.id;

  await userDoc.ref.delete();

  let authRevoked = false;
  if (firebaseUid) {
    const remainingMemberships = await countCoreUserMemberships(memberEmail, tenantId);
    if (remainingMemberships === 0) {
      try {
        const user = await admin.auth().getUser(firebaseUid);
        const claims = { ...(user.customClaims || {}) };
        if (claims.tenantId === tenantId) {
          delete claims.tenantId;
          delete claims.role;
          await admin.auth().setCustomUserClaims(firebaseUid, claims);
        }
        if (revokeAuth) {
          await admin.auth().revokeRefreshTokens(firebaseUid);
          authRevoked = true;
        }
      } catch (err) {
        console.warn('removeWorkspaceUser: auth cleanup failed', err);
      }
    }
  }

  return {
    removed: true,
    userId: removedUserId,
    email: memberEmail,
    authRevoked,
    message: authRevoked
      ? `${memberEmail} removed from workspace and signed out everywhere.`
      : `${memberEmail} removed from this workspace.`,
  };
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

  const result = await ensureClientWorkspace(
    clientName,
    requestedTenantId || undefined,
    request.auth?.uid || null,
    { throwIfExists: true },
  );

  return {
    tenantId: result.tenantId,
    clientName: result.clientName,
    workspaceUrl: result.workspaceUrl,
    features: DEFAULT_CLIENT_FEATURES,
  };
});

/** Prepare workspace + client portal delivery + optional contact invite */
export const prepareClientWorkspace = onCall(async (request) => {
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const clientName = (request.data?.clientName as string)?.trim();
  const requestedTenantId = (request.data?.tenantId as string)?.trim();
  const portalAccessCodeInput = (request.data?.portalAccessCode as string)?.trim();
  const repName = (request.data?.repName as string)?.trim();
  const repEmail = normalizeEmail((request.data?.repEmail as string) || '');
  const deliverViaPortal = request.data?.deliverViaPortal !== false;
  const inviteContact = request.data?.inviteContact !== false;

  if (!clientName) throw new HttpsError('invalid-argument', 'Client name required');

  const workspace = await ensureClientWorkspace(
    clientName,
    requestedTenantId || undefined,
    request.auth?.uid || null,
  );
  const portalAccessCode = derivePortalAccessCode(clientName, workspace.tenantId, portalAccessCodeInput);

  if (deliverViaPortal) {
    await upsertClientPortalDelivery({
      portalAccessCode,
      clientName,
      repName,
      workspaceUrl: workspace.workspaceUrl,
      workspaceTenantId: workspace.tenantId,
    });
  }

  await db.doc(`artifacts/${ADMIN_TENANT}/public/data/core_workspaces/${workspace.tenantId}`).set({
    portalAccessCode,
    portalUrl: DEFAULT_PORTAL_URL,
    updatedAt: Date.now(),
  }, { merge: true });

  let passwordEmailSent = false;
  let invitedUserId: string | undefined;
  if (inviteContact && repEmail) {
    const invite = await inviteWorkspaceMember({
      email: repEmail,
      name: repName || repEmail,
      tenantId: workspace.tenantId,
      role: 'user',
    });
    passwordEmailSent = invite.passwordEmailSent;
    invitedUserId = invite.userId;
  }

  const portalInstructions =
    `Your Core Workspace is ready.\n\n` +
    `1. Open the Client Portal: ${DEFAULT_PORTAL_URL}\n` +
    `2. Enter access code: ${portalAccessCode}\n` +
    `3. Click "Open Core Workspace" on your dashboard\n` +
    `   Direct link: ${workspace.workspaceUrl}\n\n` +
    (repEmail
      ? `Sign in with ${repEmail} and use "Forgot password or first-time setup" if this is your first visit.`
      : 'Ask your Kolthoff contact to invite your team email.');

  const mailtoUrl =
    repEmail
      ? `mailto:${encodeURIComponent(repEmail)}?subject=${encodeURIComponent(`${clientName} — Core Workspace Access`)}&body=${encodeURIComponent(portalInstructions)}`
      : undefined;

  const deliveryParts = [
    deliverViaPortal ? `Client Portal (code ${portalAccessCode})` : null,
    inviteContact && repEmail
      ? (passwordEmailSent ? `password setup email sent to ${repEmail}` : `invite created for ${repEmail} (email failed — use Reset password)`)
      : null,
  ].filter(Boolean);

  return {
    tenantId: workspace.tenantId,
    clientName,
    workspaceUrl: workspace.workspaceUrl,
    portalUrl: DEFAULT_PORTAL_URL,
    portalAccessCode,
    portalDelivered: deliverViaPortal,
    passwordEmailSent,
    invitedUserId,
    mailtoUrl,
    workspaceCreated: workspace.created,
    message: deliveryParts.length
      ? `Prepared ${clientName}. Delivered via ${deliveryParts.join(' + ')}.`
      : `Prepared ${clientName}. Copy the workspace link below to share manually.`,
  };
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
