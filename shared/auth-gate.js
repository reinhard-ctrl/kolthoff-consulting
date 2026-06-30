/**
 * Staff auth gate for internal Kolthoff OS HTML apps.
 * Redirects to /admin/ when no valid staff session exists.
 * Public apps (marketing, portal, intake) must NOT import this module.
 */
import { auth, db, initialAuthToken } from './firebase-init.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { signInWithCustomToken, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

const ADMIN_APP = 'kolthoff-admin-app';
const LOGIN_PATH = '/admin/';

function adminSessionRef(uid) {
  return doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'admin_sessions', uid);
}

/** Skip gate for offline Policy Studio bundles */
function isStandalonePolicyStudio() {
  return typeof window !== 'undefined' && typeof window.STANDALONE_POLICIES !== 'undefined';
}

/** Client-facing contract ledger link (?contract=...) */
function isClientContractLedgerView() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.includes('contract_ledger') &&
    new URLSearchParams(window.location.search).has('contract')
  );
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

  const provider = user.providerData?.[0]?.providerId;
  if (provider && provider !== 'anonymous') return true;

  const session = await getDoc(adminSessionRef(user.uid));
  return session.exists();
}

export async function requireStaffAuth() {
  if (isStandalonePolicyStudio()) {
    return { user: null, role: 'standalone' };
  }

  if (isClientContractLedgerView()) {
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return { user: auth.currentUser, role: 'client' };
  }

  if (initialAuthToken) {
    await signInWithCustomToken(auth, initialAuthToken);
  }

  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (await hasStaffAccess(user)) {
    return { user, role: 'staff' };
  }

  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search + window.location.hash
  );
  window.location.replace(`${LOGIN_PATH}?return=${returnTo}`);
  return new Promise(() => {});
}

if (typeof document !== 'undefined' && !isStandalonePolicyStudio() && !isClientContractLedgerView()) {
  document.documentElement.classList.add('kolthoff-auth-pending');
  if (!document.getElementById('kolthoff-auth-gate-style')) {
    const style = document.createElement('style');
    style.id = 'kolthoff-auth-gate-style';
    style.textContent = 'html.kolthoff-auth-pending body { visibility: hidden; }';
    document.head.appendChild(style);
  }
}

export const kolthoffStaffReady = (isStandalonePolicyStudio() || isClientContractLedgerView())
  ? requireStaffAuth().then((result) => {
      document.documentElement.classList.remove('kolthoff-auth-pending');
      return result;
    })
  : requireStaffAuth().then((result) => {
      document.documentElement.classList.remove('kolthoff-auth-pending');
      window.__KOLTHOFF_STAFF__ = true;
      return result;
    });

if (typeof window !== 'undefined') {
  window.kolthoffStaffReady = kolthoffStaffReady;
  window.hasStaffAccess = hasStaffAccess;
  window.requireStaffAuth = requireStaffAuth;
}
