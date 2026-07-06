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

type OobApiError = { error?: { message?: string } };

async function sendOobCode(email: string, continueUrl?: string): Promise<void> {
  const body: Record<string, string> = {
    requestType: 'PASSWORD_RESET',
    email: normalizeEmail(email),
  };
  if (continueUrl) body.continueUrl = continueUrl;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (res.ok) return;

  const err = (await res.json().catch(() => ({}))) as OobApiError;
  const message = err?.error?.message || 'sendOobCode failed';
  console.error('sendOobCode failed', err);
  throw new Error(message);
}

/** Ensure Firebase Auth account exists for a core_users member before sending reset email. */
async function ensureAuthUserForCoreMember(tenantId: string, email: string) {
  const doc = await findCoreUserDoc(tenantId, email);
  if (!doc) return null;

  const data = doc.data() as { name?: string; role?: string };
  const normalizedEmail = normalizeEmail(email);
  const displayName = (data.name || normalizedEmail).trim();

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
    tenantId,
    role: data.role || 'user',
  });

  await doc.ref.set({
    firebaseUid: userRecord.uid,
    updatedAt: Date.now(),
  }, { merge: true });

  return userRecord;
}

async function sendPasswordResetEmail(email: string, continueUrl: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const urlCandidates = [...new Set([
    continueUrl,
    DEFAULT_WORKSPACE_URL,
    'https://kolthoff-portal.firebaseapp.com/workspace/',
  ].filter(Boolean))];

  let lastError: Error | undefined;
  for (const url of urlCandidates) {
    try {
      await sendOobCode(normalized, url);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      if (msg.includes('INVALID_CONTINUE_URI') || msg.includes('UNAUTHORIZED_DOMAIN')) {
        continue;
      }
      throw lastError;
    }
  }

  try {
    await sendOobCode(normalized);
    return;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  throw lastError || new Error('sendOobCode failed');
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

async function createPortalTokenForAccessCode(accessCodeRaw: string) {
  const accessCode = accessCodeRaw.trim().toUpperCase();
  if (!accessCode) throw new HttpsError('invalid-argument', 'Access code required');

  const clientSnap = await db
    .doc(`artifacts/${ADMIN_TENANT}/public/data/clients/${accessCode}`)
    .get();

  if (!clientSnap.exists) {
    throw new HttpsError('not-found', 'Invalid access code');
  }

  const uid = `portal_${accessCode.toLowerCase()}`;
  let token: string;
  try {
    token = await admin.auth().createCustomToken(uid, {
      role: 'portal_client',
      accessCode,
      tenantId: ADMIN_TENANT,
    });
  } catch (err) {
    console.error('createPortalTokenForAccessCode failed', err);
    throw new HttpsError('internal', 'Could not create portal session. Contact Kolthoff support.');
  }

  return { token, client: clientSnap.data() };
}

/** Generate portal access token from client access code */
export const generatePortalToken = onCall({ invoker: 'public' }, async (request) => {
  const accessCode = (request.data?.accessCode as string) || '';
  return createPortalTokenForAccessCode(accessCode);
});

/** Hosting rewrite endpoint — private invoker; Firebase Hosting grants invoke via rewrite (public IAM blocked by org policy) */
export const generatePortalTokenHttp = onRequest({ invoker: 'private', cors: true }, async (req: Request, res: Response) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as { accessCode?: string } | string | undefined;
  let accessCode: string | undefined;
  if (body && typeof body === 'object' && 'accessCode' in body) {
    accessCode = body.accessCode;
  } else if (typeof body === 'string') {
    try { accessCode = JSON.parse(body).accessCode; } catch { /* ignore */ }
  }
  if (!accessCode) {
    res.status(400).json({ error: 'Access code required', code: 'invalid-argument' });
    return;
  }

  try {
    const result = await createPortalTokenForAccessCode(accessCode);
    res.json(result);
  } catch (err) {
    if (err instanceof HttpsError) {
      const status = err.code === 'not-found' ? 404
        : err.code === 'invalid-argument' ? 400
          : 500;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    console.error('generatePortalTokenHttp failed', err);
    res.status(500).json({ error: 'Internal error', code: 'internal' });
  }
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
    await ensureAuthUserForCoreMember(tenantId, email);
    await sendPasswordResetEmail(email, workspaceContinueUrl(tenantId));
  } catch (err) {
    console.error('requestWorkspacePasswordReset failed', err);
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('TOO_MANY_ATTEMPTS')) {
      throw new HttpsError('resource-exhausted', 'Too many attempts. Wait a few minutes and try again.');
    }
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
    await ensureAuthUserForCoreMember(tenantId, email);
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

const STARTER_APPROVAL_TEMPLATES = [
  {
    id: 'tpl-leave',
    name: 'Leave Request',
    type: 'approval',
    fields: [
      { id: 'startDate', label: 'Start date', type: 'date', required: true },
      { id: 'endDate', label: 'End date', type: 'date', required: true },
      { id: 'leaveType', label: 'Leave type', type: 'select', required: true, options: ['Vacation', 'Sick', 'Personal', 'Other'] },
      { id: 'reason', label: 'Reason', type: 'textarea', required: true },
    ],
    flowSteps: [{ id: 'mgr', type: 'approval', label: 'Manager approval', assigneeType: 'any_admin' }],
  },
  {
    id: 'tpl-expense',
    name: 'Expense Reimbursement',
    type: 'approval',
    fields: [
      { id: 'amount', label: 'Amount (PHP)', type: 'number', required: true },
      { id: 'category', label: 'Category', type: 'select', required: true, options: ['Travel', 'Meals', 'Supplies', 'Software', 'Other'] },
      { id: 'description', label: 'Description', type: 'textarea', required: true },
      { id: 'receiptDate', label: 'Receipt date', type: 'date', required: true },
    ],
    flowSteps: [{ id: 'finance', type: 'approval', label: 'Finance approval', assigneeType: 'any_admin' }],
  },
  {
    id: 'tpl-access',
    name: 'Access / Tool Request',
    type: 'approval',
    fields: [
      { id: 'tool', label: 'Tool or system', type: 'text', required: true },
      { id: 'accessLevel', label: 'Access level', type: 'select', required: true, options: ['Read', 'Edit', 'Admin'] },
      { id: 'justification', label: 'Business justification', type: 'textarea', required: true },
    ],
    flowSteps: [{ id: 'it', type: 'approval', label: 'IT / Admin approval', assigneeType: 'any_admin' }],
  },
  {
    id: 'tpl-document',
    name: 'Document Approval',
    type: 'approval',
    fields: [
      { id: 'documentTitle', label: 'Document title', type: 'text', required: true },
      { id: 'documentType', label: 'Type', type: 'select', required: true, options: ['Policy', 'Contract', 'SOP', 'Other'] },
      { id: 'summary', label: 'Summary', type: 'textarea', required: true },
    ],
    flowSteps: [
      { id: 'review', type: 'approval', label: 'Reviewer approval', assigneeType: 'any_admin' },
      { id: 'final', type: 'approval', label: 'Final sign-off', assigneeType: 'role', role: 'admin' },
    ],
  },
];

async function deployStarterApprovalTemplates(tenantId: string): Promise<number> {
  const batch = db.batch();
  const now = Date.now();
  for (const tmpl of STARTER_APPROVAL_TEMPLATES) {
    batch.set(
      db.doc(`artifacts/${tenantId}/public/data/core_templates/${tmpl.id}`),
      { ...tmpl, deployedAt: now },
      { merge: true },
    );
  }
  await batch.commit();
  return STARTER_APPROVAL_TEMPLATES.length;
}

interface PrepareClientWorkspaceResult {
  tenantId: string;
  clientName: string;
  workspaceUrl: string;
  portalUrl: string;
  portalAccessCode: string;
  portalDelivered: boolean;
  passwordEmailSent: boolean;
  invitedUserId?: string;
  mailtoUrl?: string;
  workspaceCreated: boolean;
  message: string;
}

async function prepareClientWorkspaceInternal(params: {
  clientName: string;
  requestedTenantId?: string;
  portalAccessCodeInput?: string;
  repName?: string;
  repEmail?: string;
  deliverViaPortal?: boolean;
  inviteContact?: boolean;
  deployStarterTemplates?: boolean;
  profileId?: string;
  createdBy?: string | null;
}): Promise<PrepareClientWorkspaceResult> {
  const clientName = params.clientName.trim();
  const repName = params.repName?.trim();
  const repEmail = normalizeEmail(params.repEmail || '');
  const deliverViaPortal = params.deliverViaPortal !== false;
  const inviteContact = params.inviteContact !== false;

  const workspace = await ensureClientWorkspace(
    clientName,
    params.requestedTenantId || undefined,
    params.createdBy ?? null,
  );
  const portalAccessCode = derivePortalAccessCode(clientName, workspace.tenantId, params.portalAccessCodeInput);

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

  if (params.profileId?.trim()) {
    await db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${params.profileId.trim()}`).set({
      coreWorkspaceTenantId: workspace.tenantId,
      updatedAt: Date.now(),
    }, { merge: true });
  }

  if (params.deployStarterTemplates !== false) {
    await deployStarterApprovalTemplates(workspace.tenantId);
  }

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
    params.deployStarterTemplates !== false ? 'approval templates deployed' : null,
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
}

/** Prepare workspace + client portal delivery + optional contact invite */
export const prepareClientWorkspace = onCall(async (request) => {
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const clientName = (request.data?.clientName as string)?.trim();
  if (!clientName) throw new HttpsError('invalid-argument', 'Client name required');

  return prepareClientWorkspaceInternal({
    clientName,
    requestedTenantId: (request.data?.tenantId as string)?.trim(),
    portalAccessCodeInput: (request.data?.portalAccessCode as string)?.trim(),
    repName: (request.data?.repName as string)?.trim(),
    repEmail: (request.data?.repEmail as string)?.trim(),
    deliverViaPortal: request.data?.deliverViaPortal !== false,
    inviteContact: request.data?.inviteContact !== false,
    deployStarterTemplates: request.data?.deployStarterTemplates !== false,
    profileId: (request.data?.profileId as string)?.trim(),
    createdBy: request.auth?.uid || null,
  });
});

/** Firestore path when org policy blocks public Cloud Function invoke */
export const processClientProvisionRequest = onDocumentWritten(
  `artifacts/${ADMIN_TENANT}/public/data/client_provision_requests/{requestId}`,
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const data = afterSnap.data();
    if (!data || data.status !== 'pending') return;

    const before = event.data?.before?.exists ? event.data.before.data() : undefined;
    if (before?.status === 'pending' && before.requestedAt === data.requestedAt) return;

    const requestId = event.params.requestId;
    const ref = afterSnap.ref;

    try {
      const result = await prepareClientWorkspaceInternal({
        clientName: String(data.clientName || '').trim(),
        requestedTenantId: typeof data.tenantId === 'string' ? data.tenantId.trim() : undefined,
        portalAccessCodeInput: typeof data.portalAccessCode === 'string' ? data.portalAccessCode.trim() : undefined,
        repName: typeof data.repName === 'string' ? data.repName.trim() : undefined,
        repEmail: typeof data.repEmail === 'string' ? data.repEmail.trim() : undefined,
        deliverViaPortal: data.deliverViaPortal !== false,
        inviteContact: data.inviteContact !== false,
        deployStarterTemplates: data.deployStarterTemplates !== false,
        profileId: typeof data.profileId === 'string' ? data.profileId.trim() : undefined,
        createdBy: typeof data.requestedBy === 'string' ? data.requestedBy : null,
      });

      await ref.update({
        status: 'complete',
        ...result,
        completedAt: Date.now(),
      });
      console.log('processClientProvisionRequest complete', requestId, result.tenantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      console.error('processClientProvisionRequest failed', requestId, err);
      await ref.update({
        status: 'error',
        error: message,
        failedAt: Date.now(),
      });
    }
  },
);

const KOLTHOFF_STAFF_DOMAIN = '@kolthoff-consulting.com';

async function provisionKolthoffGoogleStaffUser(
  uid: string,
  email: string,
  displayName?: string,
): Promise<{ role: string; tenantId: string; userId: string; email: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized.endsWith(KOLTHOFF_STAFF_DOMAIN)) {
    throw new HttpsError('permission-denied', 'Google SSO requires a @kolthoff-consulting.com account');
  }

  const authUser = await admin.auth().getUser(uid);
  const hasGoogle = authUser.providerData.some((p) => p.providerId === 'google.com');
  if (!hasGoogle) {
    throw new HttpsError('failed-precondition', 'Use Google sign-in');
  }

  const authEmail = normalizeEmail(authUser.email || '');
  if (authEmail !== normalized) {
    throw new HttpsError('permission-denied', 'Email mismatch');
  }

  const existing = await findCoreUserDoc(ADMIN_TENANT, normalized);
  const existingRole = (existing?.data()?.role as string) || 'kolthoff_admin';
  const role = existingRole === 'admin' ? 'kolthoff_admin' : existingRole;
  const name = displayName || authUser.displayName || normalized.split('@')[0];
  const userId = existing?.id ?? `u_${uid.slice(0, 8)}`;

  await admin.auth().setCustomUserClaims(uid, {
    role,
    tenantId: ADMIN_TENANT,
  });

  await db.doc(`artifacts/${ADMIN_TENANT}/public/data/core_users/${userId}`).set({
    id: userId,
    email: normalized,
    name,
    role,
    firebaseUid: uid,
    updatedAt: Date.now(),
  }, { merge: true });

  return { role, tenantId: ADMIN_TENANT, userId, email: normalized };
}

/** Google Workspace SSO — provision @kolthoff-consulting.com staff claims + core_users */
export const provisionGoogleStaff = onCall({ invoker: 'public', cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const email = normalizeEmail(String(request.auth.token.email || ''));
  const provider = (request.auth.token.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (provider !== 'google.com') {
    throw new HttpsError('failed-precondition', 'Use Google sign-in');
  }

  const displayName = (request.auth.token.name as string) || undefined;
  return provisionKolthoffGoogleStaffUser(request.auth.uid, email, displayName);
});

/** Firestore path for Google SSO when org policy blocks public Cloud Function invoke */
export const onStaffSsoProvisionRequest = onDocumentWritten(
  'artifacts/kolthoff-admin-app/public/data/staff_sso_requests/{uid}',
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const data = afterSnap.data();
    if (!data || data.status !== 'pending') return;

    const before = event.data?.before?.exists ? event.data.before.data() : undefined;
    if (before?.status === 'pending' && before.requestedAt === data.requestedAt) return;

    const uid = event.params.uid;
    const ref = afterSnap.ref;
    try {
      const result = await provisionKolthoffGoogleStaffUser(
        uid,
        String(data.email || ''),
        typeof data.displayName === 'string' ? data.displayName : undefined,
      );
      await ref.update({
        status: 'complete',
        role: result.role,
        tenantId: result.tenantId,
        userId: result.userId,
        completedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      console.error('onStaffSsoProvisionRequest failed', uid, err);
      await ref.update({
        status: 'error',
        error: message,
        failedAt: Date.now(),
      });
    }
  },
);

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
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;

    const clientLabel = (after.clientCompany as string)?.trim() || (after.clientName as string)?.trim();
    if (!clientLabel || !Array.isArray(after.tasks)) {
      console.warn('Invalid workbook profile:', event.params.profileId);
    }

    if (after.chaosTax != null) {
      const ct = after.chaosTax as { value?: unknown; source?: unknown };
      if (typeof ct.value !== 'number' || Number.isNaN(ct.value)) {
        console.warn('Invalid chaosTax.value on profile:', event.params.profileId);
      }
    }

    if (after.links != null && typeof after.links !== 'object') {
      console.warn('Invalid links object on profile:', event.params.profileId);
    }

    // Optionally compute and cache financials server-side
    const tasks = (after.tasks || []).filter((t: { selected?: boolean }) => t.selected);
    const totalHours = tasks.reduce((acc: number, t: { estHours?: number }) => acc + (t.estHours || 0), 0);

    if (totalHours > 0 && clientLabel) {
      const existingMeta = (before?._meta as Record<string, unknown>) || {};
      const incomingMeta = (after._meta as Record<string, unknown>) || {};
      await event.data!.after!.ref.set(
        {
          _meta: {
            ...existingMeta,
            ...incomingMeta,
            schemaVersion: 2,
            totalHours,
            validatedAt: Date.now(),
          },
        },
        { merge: true },
      );
    }
  },
);

const DEFAULT_AGENCY_OPS_URL = 'https://kolthoff-consulting.com/agency-ops/';
const AGENCY_OPS_DEMO_TENANT = 'agency-ops-demo';

function slugifyAgencyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeAgencyTenantId(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return trimmed.startsWith('agency-') ? trimmed : `agency-${trimmed}`;
}

function validateAgencyTenantId(tenantId: string) {
  if (!/^agency-[a-z0-9-]{2,48}$/.test(tenantId)) {
    throw new HttpsError(
      'invalid-argument',
      'Tenant ID must look like agency-pixel-wave (lowercase letters, numbers, hyphens).',
    );
  }
  if (tenantId === AGENCY_OPS_DEMO_TENANT) {
    throw new HttpsError('invalid-argument', 'agency-ops-demo is reserved for the sales demo');
  }
}

function generateAgencyPasscode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function agencyOpsConsoleUrl(tenantId: string): string {
  return `${DEFAULT_AGENCY_OPS_URL}?tenant=${encodeURIComponent(tenantId)}`;
}

interface AgencyBrandingInput {
  companyName?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;
}

async function ensureAgencyOpsTenant(params: {
  clientName: string;
  requestedTenantId?: string;
  createdBy: string | null;
  branding?: AgencyBrandingInput;
  passcode?: string;
  throwIfExists?: boolean;
}): Promise<{
  tenantId: string;
  clientName: string;
  consoleUrl: string;
  passcode: string;
  created: boolean;
}> {
  const clientName = params.clientName.trim();
  if (!clientName) throw new HttpsError('invalid-argument', 'Client name required');

  const tenantId = params.requestedTenantId
    ? normalizeAgencyTenantId(params.requestedTenantId)
    : `agency-${slugifyAgencyName(clientName)}`;
  validateAgencyTenantId(tenantId);

  const configRef = db.doc(`artifacts/${tenantId}/public/data/tenant_settings/config`);
  const registryRef = db.doc(`artifacts/${ADMIN_TENANT}/public/data/agency_ops_tenants/${tenantId}`);
  const [configSnap, registrySnap] = await Promise.all([configRef.get(), registryRef.get()]);
  const consoleUrl = agencyOpsConsoleUrl(tenantId);
  const passcode = (params.passcode || generateAgencyPasscode()).trim().toLowerCase();

  if (configSnap.exists || registrySnap.exists) {
    if (params.throwIfExists) {
      throw new HttpsError('already-exists', `Agency Ops tenant "${tenantId}" already exists`);
    }
    return { tenantId, clientName, consoleUrl, passcode, created: false };
  }

  const now = Date.now();
  const branding = {
    companyName: params.branding?.companyName?.trim() || clientName,
    tagline: params.branding?.tagline?.trim() || 'Creative & Digital Services',
    primaryColor: params.branding?.primaryColor?.trim() || '#4f46e5',
    logoUrl: params.branding?.logoUrl?.trim() || '',
  };

  const batch = db.batch();
  batch.set(configRef, {
    id: 'config',
    productId: 'agency-ops-starter',
    clientName,
    features: { messenger: false, approvals: false, vault: false, crm: false },
    branding,
    activeBrandingPresetId: 'default',
    brandingPresets: {
      default: {
        id: 'default',
        name: branding.companyName,
        ...branding,
        updatedAt: now,
      },
    },
    createdAt: now,
    createdBy: params.createdBy,
    provisionedBy: 'prepareAgencyOpsTenant',
  });
  batch.set(db.doc(`artifacts/${tenantId}/public/data/admin_credentials/${passcode}`), {
    role: 'kolthoff_admin',
    note: `Agency Ops tenant ${tenantId}`,
    createdAt: now,
  });
  batch.set(registryRef, {
    id: tenantId,
    tenantId,
    clientName,
    productId: 'agency-ops-starter',
    status: 'active',
    consoleUrl,
    provisioningStatus: 'ready',
    createdAt: now,
    createdBy: params.createdBy,
  });
  await batch.commit();

  return { tenantId, clientName, consoleUrl, passcode, created: true };
}

function isPro1AgencyOpsProfile(profile: Record<string, unknown>): boolean {
  if (profile.productId === 'pro1') return true;
  if (profile.selectedPackageId === 'pro1-agency-ops-starter') return true;
  if (profile.engagementType === 'product') {
    return !profile.productId || profile.productId === 'pro1';
  }
  return false;
}

function extractAgencyBranding(profile: Record<string, unknown>): AgencyBrandingInput | undefined {
  const profileBranding = profile.branding as Record<string, string> | undefined;
  if (!profileBranding) return undefined;
  return {
    companyName: profileBranding.companyName,
    tagline: profileBranding.tagline,
    primaryColor: profileBranding.primaryColor,
    logoUrl: profileBranding.logoUrl,
  };
}

async function syncCrmDealWonForProfile(
  profile: Record<string, unknown>,
  profileId: string,
  signedAt?: string,
): Promise<string | null> {
  const links = (profile.links as Record<string, unknown> | undefined) || {};
  const dealId = (links.crmDealId as string) || (profile.quoteId as string);
  if (!dealId) return null;

  const dealRef = db.doc(`artifacts/${ADMIN_TENANT}/public/data/crm_deals/${dealId}`);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) return null;

  const deal = dealSnap.data() || {};
  const now = Date.now();
  const signedIso = signedAt || new Date().toISOString();

  if (deal.status !== 'Won') {
    await dealRef.set({
      status: 'Won',
      pipelineStatus: 'Closed Won/Lost',
      nextAction: 'Contract Executed',
      contractSignedAt: signedIso,
      updatedAt: now,
    }, { merge: true });
  }

  const profileRef = db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${profileId}`);
  await profileRef.set({
    links: {
      ...links,
      crmDealId: dealId,
      crmStatus: 'Won',
      crmPipelineStatus: 'Closed Won/Lost',
      crmSyncedAt: now,
      contractSignedAt: signedIso,
    },
    updatedAt: now,
  }, { merge: true });

  return dealId;
}

async function provisionAgencyOpsForProfile(options: {
  profileId?: string;
  profile?: Record<string, unknown>;
  clientName?: string;
  requestedTenantId?: string;
  createdBy: string | null;
  passcode?: string;
  throwIfExists?: boolean;
  autoProvisioned?: boolean;
}): Promise<{
  tenantId: string;
  clientName: string;
  consoleUrl: string;
  passcode: string;
  created: boolean;
  profileId: string | null;
  quoteId: string | null;
}> {
  let profileId = options.profileId?.trim() || undefined;
  let profile = options.profile;
  let clientName = options.clientName?.trim();
  let requestedTenantId = options.requestedTenantId?.trim();
  let quoteId: string | undefined;
  let branding: AgencyBrandingInput | undefined;

  if (profileId && !profile) {
    const profileSnap = await db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${profileId}`).get();
    if (!profileSnap.exists) {
      throw new HttpsError('not-found', `Workbook profile "${profileId}" not found`);
    }
    profile = profileSnap.data() || {};
  }

  if (profile) {
    clientName = clientName || (profile.clientCompany as string) || (profile.clientName as string);
    quoteId = (profile.quoteId as string) || undefined;
    if (profile.engagementType === 'product' && profile.productId && profile.productId !== 'pro1') {
      throw new HttpsError('failed-precondition', 'Only PRO 1 Agency Ops is supported for provisioning');
    }
    branding = extractAgencyBranding(profile);
    if (!requestedTenantId && clientName) {
      requestedTenantId = `agency-${slugifyAgencyName(clientName)}`;
    }
    if (profile.agencyOpsTenantId) {
      const tenantId = profile.agencyOpsTenantId as string;
      const registrySnap = await db.doc(`artifacts/${ADMIN_TENANT}/public/data/agency_ops_tenants/${tenantId}`).get();
      const initialPasscode = (registrySnap.data()?.initialPasscode as string) || '';
      return {
        tenantId,
        clientName: clientName || tenantId,
        consoleUrl: agencyOpsConsoleUrl(tenantId),
        passcode: initialPasscode,
        created: false,
        profileId: profileId || null,
        quoteId: quoteId || null,
      };
    }
  }

  if (!clientName) throw new HttpsError('invalid-argument', 'Client name required');

  const result = await ensureAgencyOpsTenant({
    clientName,
    requestedTenantId: requestedTenantId || undefined,
    createdBy: options.createdBy,
    branding,
    passcode: options.passcode || undefined,
    throwIfExists: options.throwIfExists,
  });

  const now = Date.now();
  const registryPatch: Record<string, unknown> = {
    profileId: profileId || null,
    quoteId: quoteId || null,
    updatedAt: now,
    provisioningStatus: 'ready',
  };
  if (result.created) {
    registryPatch.initialPasscode = result.passcode;
    registryPatch.provisioningMethod = options.autoProvisioned ? 'auto' : 'manual';
    registryPatch.initialPasscodeSetAt = now;
  }
  await db.doc(`artifacts/${ADMIN_TENANT}/public/data/agency_ops_tenants/${result.tenantId}`).set(registryPatch, { merge: true });

  if (profileId) {
    await db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${profileId}`).set({
      agencyOpsTenantId: result.tenantId,
      provisioningStatus: 'ready',
      provisioningError: admin.firestore.FieldValue.delete(),
      links: {
        agencyOpsConsoleUrl: result.consoleUrl,
      },
      updatedAt: now,
    }, { merge: true });
  }

  return {
    ...result,
    profileId: profileId || null,
    quoteId: quoteId || null,
  };
}

function buildAgencyOpsProvisionResponse(
  result: Awaited<ReturnType<typeof provisionAgencyOpsForProfile>>,
  repEmail?: string,
): {
  tenantId: string;
  clientName: string;
  consoleUrl: string;
  passcode: string;
  profileId: string | null;
  quoteId: string | null;
  mailtoUrl?: string;
  created: boolean;
  message: string;
} {
  const handoff =
    `Your Agency Ops workspace is ready.\n\n` +
    `1. Open: ${result.consoleUrl}\n` +
    `2. Sign in with passcode: ${result.passcode}\n\n` +
    `Save this passcode securely — it is shown once during provisioning.`;

  const normalizedRepEmail = normalizeEmail(repEmail || '');
  const mailtoUrl = normalizedRepEmail
    ? `mailto:${encodeURIComponent(normalizedRepEmail)}?subject=${encodeURIComponent(`${result.clientName} — Agency Ops Access`)}&body=${encodeURIComponent(handoff)}`
    : undefined;

  return {
    tenantId: result.tenantId,
    clientName: result.clientName,
    consoleUrl: result.consoleUrl,
    passcode: result.passcode,
    profileId: result.profileId,
    quoteId: result.quoteId,
    mailtoUrl,
    created: result.created,
    message: result.created
      ? `Provisioned Agency Ops for ${result.clientName}. Share the console URL and passcode with the client.`
      : `Agency Ops tenant ${result.tenantId} already exists — credentials refreshed in response.`,
  };
}

/** Provision white-label Agency Ops tenant after PRO 1 contract sign */
export const prepareAgencyOpsTenant = onCall({ invoker: 'public', cors: true }, async (request) => {
  const isAdmin = await callerIsAdmin(request.auth?.uid, request.auth?.token?.role);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const profileId = (request.data?.profileId as string)?.trim();
  const clientName = (request.data?.clientName as string)?.trim();
  const requestedTenantId = (request.data?.tenantId as string)?.trim();
  const passcodeInput = (request.data?.passcode as string)?.trim();

  const result = await provisionAgencyOpsForProfile({
    profileId: profileId || undefined,
    clientName,
    requestedTenantId: requestedTenantId || undefined,
    createdBy: request.auth?.uid || null,
    passcode: passcodeInput || undefined,
    throwIfExists: Boolean(request.data?.throwIfExists),
    autoProvisioned: false,
  });

  return buildAgencyOpsProvisionResponse(result, (request.data?.repEmail as string) || undefined);
});

/** Firestore path when org policy blocks public Cloud Function invoke (same as staff SSO) */
export const processAgencyOpsProvisionRequest = onDocumentWritten(
  `artifacts/${ADMIN_TENANT}/public/data/agency_ops_provision_requests/{requestId}`,
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const data = afterSnap.data();
    if (!data || data.status !== 'pending') return;

    const before = event.data?.before?.exists ? event.data.before.data() : undefined;
    if (before?.status === 'pending' && before.requestedAt === data.requestedAt) return;

    const requestId = event.params.requestId;
    const ref = afterSnap.ref;

    try {
      const autoProvisioned = Boolean(data.autoProvisioned);
      const profileId = typeof data.profileId === 'string' ? data.profileId.trim() : undefined;
      const result = await provisionAgencyOpsForProfile({
        profileId,
        clientName: String(data.clientName || '').trim(),
        requestedTenantId: typeof data.tenantId === 'string' ? data.tenantId.trim() : undefined,
        createdBy: typeof data.requestedBy === 'string' ? data.requestedBy : null,
        passcode: typeof data.passcode === 'string' ? data.passcode.trim() : undefined,
        throwIfExists: Boolean(data.throwIfExists),
        autoProvisioned,
      });

      const response = buildAgencyOpsProvisionResponse(
        result,
        typeof data.repEmail === 'string' ? data.repEmail : undefined,
      );

      await ref.update({
        status: 'complete',
        ...response,
        completedAt: Date.now(),
      });

      if (autoProvisioned && profileId) {
        const contractId = `contract-${profileId}`;
        await db.doc(`artifacts/${ADMIN_TENANT}/public/data/contracts_ledger/${contractId}`).set({
          agencyOpsAutoProvisioned: true,
          agencyOpsTenantId: response.tenantId,
          agencyOpsProvisionedAt: Date.now(),
          agencyOpsAutoProvisionError: admin.firestore.FieldValue.delete(),
        }, { merge: true });
      }

      console.log('processAgencyOpsProvisionRequest complete', requestId, response.tenantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      console.error('processAgencyOpsProvisionRequest failed', requestId, err);
      await ref.update({
        status: 'error',
        error: message,
        failedAt: Date.now(),
      });

      const profileId = typeof data.profileId === 'string' ? data.profileId.trim() : undefined;
      if (profileId) {
        await db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${profileId}`).set({
          provisioningStatus: 'failed',
          provisioningError: message,
          updatedAt: Date.now(),
        }, { merge: true });
        const contractId = `contract-${profileId}`;
        await db.doc(`artifacts/${ADMIN_TENANT}/public/data/contracts_ledger/${contractId}`).set({
          agencyOpsAutoProvisionError: message,
          agencyOpsAutoProvisionFailedAt: Date.now(),
        }, { merge: true });
      }
    }
  },
);

/** On contract sign: CRM Won sync + auto-provision PRO 1 Agency Ops */
export const onContractLedgerWritten = onDocumentWritten(
  `artifacts/${ADMIN_TENANT}/public/data/contracts_ledger/{contractId}`,
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;

    const wasSigned = before?.status === 'signed';
    const isSigned = after.status === 'signed';
    if (!isSigned || wasSigned) return;

    const profileId = (after.profileId as string)?.trim();
    if (!profileId) return;

    const profileRef = db.doc(`artifacts/${ADMIN_TENANT}/public/data/workbook_profiles/${profileId}`);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      console.warn('Contract signed but profile missing:', profileId);
      return;
    }
    const profile = profileSnap.data() || {};
    const signedAt = (after.signedAt as string) || new Date().toISOString();

    try {
      await syncCrmDealWonForProfile(profile, profileId, signedAt);
    } catch (err) {
      console.error('CRM Won sync failed for profile', profileId, err);
    }

    if (isPro1AgencyOpsProfile(profile)) {
      await profileRef.set({
        subscriptionBilling: {
          enabled: true,
          contractSignedAt: signedAt,
          subscriptionMonths: (profile.subscriptionMonths as number) || 12,
          initializedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }, { merge: true });
    }

    if (!isPro1AgencyOpsProfile(profile)) return;
    if (profile.agencyOpsTenantId) {
      await event.data!.after!.ref.set({
        agencyOpsAutoProvisioned: true,
        agencyOpsTenantId: profile.agencyOpsTenantId,
        agencyOpsProvisionedAt: Date.now(),
      }, { merge: true });
      return;
    }

    try {
      const clientName =
        (profile.clientCompany as string) ||
        (profile.clientName as string) ||
        profileId;
      const requestId = `auto-${profileId}-${Date.now()}`;
      await profileRef.set({ provisioningStatus: 'provisioning', updatedAt: Date.now() }, { merge: true });
      await db.doc(`artifacts/${ADMIN_TENANT}/public/data/agency_ops_provision_requests/${requestId}`).set({
        status: 'pending',
        profileId,
        clientName,
        autoProvisioned: true,
        requestedAt: Date.now(),
        requestedBy: 'system-contract-sign',
      });
      console.log('Queued Agency Ops auto-provision', requestId, 'for profile', profileId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      console.error('Auto-provision queue failed for profile', profileId, err);
      await profileRef.set({
        provisioningStatus: 'failed',
        provisioningError: message,
        updatedAt: Date.now(),
      }, { merge: true });
      await event.data!.after!.ref.set({
        agencyOpsAutoProvisionError: message,
        agencyOpsAutoProvisionFailedAt: Date.now(),
      }, { merge: true });
    }
  },
);

