/**
 * Staff auth gate for internal Kolthoff OS HTML apps.
 * Redirects to /admin/ when no valid staff session exists.
 * Public apps (marketing, portal, intake) must NOT import this module.
 */
import { auth, db, initialAuthToken, bootstrapAuth } from './firebase-init.js?v=20250702-firebase-v2';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const ADMIN_APP = 'kolthoff-admin-app';
const LOGIN_PATH = '/admin/';

function adminSessionRef(uid) {
  return doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'admin_sessions', uid);
}

function revealPage() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('kolthoff-auth-pending');
}

/** Skip gate for offline Policy Studio bundles */
function isStandalonePolicyStudio() {
  return typeof window !== 'undefined' && typeof window.STANDALONE_POLICIES !== 'undefined';
}

/** Client-facing contract signing link (?contract=...) */
function isClientContractLedgerView() {
  if (typeof window === 'undefined') return false;
  return (
    (window.location.pathname.includes('contract_ledger') ||
      window.location.pathname.includes('contract_sign')) &&
    new URLSearchParams(window.location.search).has('contract')
  );
}

/** External read-only CRM pipeline share link (?token=...) */
function isCrmPipelineShareView() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.includes('crm_pipeline_view') &&
    new URLSearchParams(window.location.search).has('token')
  );
}

/** Embedded in admin console iframe — never redirect to /admin/ (it blocks framing). */
function isEmbeddedView() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('embed')) return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function hasStaffAccess(user) {
  if (!user) return false;

  if (initialAuthToken) return true;

  try {
    const { claims } = await user.getIdTokenResult();
    if (claims.role === 'kolthoff_admin' || claims.role === 'admin') return true;
    if (claims.tenantId && claims.role !== 'portal_client') return true;
  } catch {
    /* continue */
  }

  const email = user.email?.toLowerCase();
  const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
  if (isGoogle && email?.endsWith('@kolthoff-consulting.com')) {
    try {
      const { claims } = await user.getIdTokenResult();
      if (claims.role === 'kolthoff_admin' || claims.tenantId) return true;
    } catch {
      /* continue */
    }
    return false;
  }

  const session = await getDoc(adminSessionRef(user.uid));
  return session.exists();
}

async function resolveAuthUser() {
  await auth.authStateReady();
  return bootstrapAuth();
}

async function waitForStaffAccess(maxMs = 10000) {
  await auth.authStateReady();
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await bootstrapAuth();
    } catch {
      /* anonymous auth may be blocked briefly */
    }
    const user = auth.currentUser;
    if (user && (await hasStaffAccess(user))) return user;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

function showEmbedAuthRequired() {
  revealPage();
  const url = new URL(window.location.href);
  url.searchParams.delete('embed');
  const openUrl = url.pathname + url.search + url.hash;
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:#02050e;color:#94a3b8;font-family:Montserrat,sans-serif;text-align:center;">
      <div style="max-width:22rem;">
        <p style="margin:0 0 1rem;font-size:0.875rem;line-height:1.5;">Staff session required. Ensure you are logged into the admin console, then reload this panel.</p>
        <a href="${openUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:0.625rem 1rem;background:#14B8A6;color:#02050e;border-radius:0.5rem;font-weight:700;font-size:0.75rem;text-decoration:none;">Open in new tab</a>
      </div>
    </div>
  `;
}

export async function requireStaffAuth() {
  if (isStandalonePolicyStudio()) {
    revealPage();
    return { user: null, role: 'standalone' };
  }

  if (isClientContractLedgerView()) {
    await resolveAuthUser();
    revealPage();
    return { user: auth.currentUser, role: 'client' };
  }

  if (isCrmPipelineShareView()) {
    await resolveAuthUser();
    revealPage();
    return { user: auth.currentUser, role: 'guest' };
  }

  try {
    if (isEmbeddedView()) {
      const user = await waitForStaffAccess();
      if (user) {
        revealPage();
        window.__KOLTHOFF_STAFF__ = true;
        return { user, role: 'staff' };
      }
      showEmbedAuthRequired();
      return new Promise(() => {});
    }

    const user = await resolveAuthUser();

    if (await hasStaffAccess(user)) {
      revealPage();
      window.__KOLTHOFF_STAFF__ = true;
      return { user, role: 'staff' };
    }

    revealPage();
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search + window.location.hash
    );
    window.location.replace(`${LOGIN_PATH}?return=${returnTo}`);
    return new Promise(() => {});
  } catch (err) {
    revealPage();
    throw err;
  }
}

if (typeof document !== 'undefined' && !isStandalonePolicyStudio() && !isClientContractLedgerView() && !isCrmPipelineShareView()) {
  document.documentElement.classList.add('kolthoff-auth-pending');
  if (!document.getElementById('kolthoff-auth-gate-style')) {
    const style = document.createElement('style');
    style.id = 'kolthoff-auth-gate-style';
    style.textContent = `
      html.kolthoff-auth-pending #root { visibility: hidden; }
      html.kolthoff-auth-pending::after {
        content: 'Loading…';
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #020613;
        color: #94a3b8;
        font-family: Montserrat, system-ui, sans-serif;
        font-size: 14px;
        z-index: 99999;
      }
    `;
    document.head.appendChild(style);
  }
  setTimeout(revealPage, 12000);
}

export const kolthoffStaffReady = requireStaffAuth().then((result) => {
  revealPage();
  return result;
}).catch((err) => {
  revealPage();
  throw err;
});

if (typeof window !== 'undefined') {
  window.kolthoffStaffReady = kolthoffStaffReady;
  window.hasStaffAccess = hasStaffAccess;
  window.requireStaffAuth = requireStaffAuth;
}
