import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { resolveAuthDomain } from './auth-domain';

const firebaseConfig = {
  apiKey: 'AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI',
  authDomain: resolveAuthDomain(),
  projectId: 'kolthoff-portal',
  storageBucket: 'kolthoff-portal.firebasestorage.app',
  messagingSenderId: '413958125034',
  appId: '1:413958125034:web:7d9d6d5f0b11a2c73b2e93',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-southeast1');

export const INTERNAL_WORKSPACE_TENANT = 'kolthoff-admin-app';

export function getWorkspaceTenantId(): string | null {
  const raw = new URLSearchParams(window.location.search).get('tenant')?.trim();
  if (!raw || raw === INTERNAL_WORKSPACE_TENANT) return null;
  return raw;
}

function requireWorkspaceTenantId(): string {
  const tenantId = getWorkspaceTenantId();
  if (!tenantId) {
    throw new Error('Workspace tenant ID is required in the URL (?tenant=client-...).');
  }
  return tenantId;
}

export function tenantCol(name: string) {
  return collection(db, 'artifacts', requireWorkspaceTenantId(), 'public', 'data', name);
}

export function tenantDoc(name: string, id: string) {
  return doc(db, 'artifacts', requireWorkspaceTenantId(), 'public', 'data', name, id);
}

export async function bootstrapAuth() {
  await auth.authStateReady();
  const token = (window as unknown as { __initial_auth_token?: string }).__initial_auth_token;
  if (token) await signInWithCustomToken(auth, token);
  else if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn('Anonymous auth unavailable:', err);
    }
  }
}

export async function logAudit(action: string, details: Record<string, unknown> = {}) {
  try {
    await addDoc(tenantCol('core_audit_log'), {
      action, details, userId: auth.currentUser?.uid || 'anonymous', timestamp: Date.now(),
    });
  } catch (e) { console.warn('Audit log failed', e); }
}

export { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, setDoc, getDoc, onSnapshot, addDoc, query, orderBy, where, getDocs, ref, uploadBytes, getDownloadURL, httpsCallable };

const ADMIN_APP = 'kolthoff-admin-app';

export async function hasAdminStaffSession(): Promise<boolean> {
  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return false;

    if (user.isAnonymous) {
      const sessionRef = doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'admin_sessions', user.uid);
      const snap = await getDoc(sessionRef);
      return snap.exists();
    }

    const token = await user.getIdTokenResult();
    if (token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin') {
      return true;
    }

    if (
      user.email?.toLowerCase().endsWith('@kolthoff-consulting.com') &&
      user.providerData.some((p) => p.providerId === 'google.com')
    ) {
      return true;
    }

    const googleSessionRef = doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'google_admin_sessions', user.uid);
    const googleSnap = await getDoc(googleSessionRef);
    if (googleSnap.exists()) return true;

    const sessionRef = doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'admin_sessions', user.uid);
    const snap = await getDoc(sessionRef);
    return snap.exists();
  } catch (err) {
    console.warn('hasAdminStaffSession failed:', err);
    return false;
  }
}

/** Poll until admin console auth is visible inside an iframe (shared IndexedDB). */
export async function waitForAdminStaffSession(maxMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await hasAdminStaffSession()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return hasAdminStaffSession();
}

export function initAppCheck() {
  const win = window as unknown as {
    __RECAPTCHA_SITE_KEY__?: string;
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  };
  if (win.FIREBASE_APPCHECK_DEBUG_TOKEN !== undefined) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      win.FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
  const siteKey = win.__RECAPTCHA_SITE_KEY__ || import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  }
}
