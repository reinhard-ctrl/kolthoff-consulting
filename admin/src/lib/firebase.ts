import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: 'AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI',
  authDomain: 'kolthoff-portal.firebaseapp.com',
  projectId: 'kolthoff-portal',
  storageBucket: 'kolthoff-portal.firebasestorage.app',
  messagingSenderId: '413958125034',
  appId: '1:413958125034:web:7d9d6d5f0b11a2c73b2e93',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-southeast1');
export const adminAppId = 'kolthoff-admin-app';

const STAFF_DOMAIN = '@kolthoff-consulting.com';

function isKolthoffStaffEmail(email: string | null | undefined): boolean {
  return !!email?.toLowerCase().endsWith(STAFF_DOMAIN);
}

/** Collection ref — must use collection(), not doc(), or Firestore throws on listeners. */
export function adminCol(name: string) {
  return collection(db, 'artifacts', adminAppId, 'public', 'data', name);
}

/** Document ref within an admin collection. */
export function adminDoc(col: string, id: string) {
  return doc(db, 'artifacts', adminAppId, 'public', 'data', col, id);
}

export async function bootstrapAuth() {
  const token = (window as unknown as { __initial_auth_token?: string }).__initial_auth_token;
  if (token) {
    const { signInWithCustomToken } = await import('firebase/auth');
    await signInWithCustomToken(auth, token);
  } else if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn('Anonymous auth unavailable:', err);
      throw err;
    }
  }
}

/** Verify passcode via Firestore — works when org policy blocks public Cloud Functions */
export async function verifyAdminPasscode(code: string) {
  await bootstrapAuth();
  const trimmed = code.trim();
  if (!trimmed) return { valid: false as const };

  const variants = [...new Set([trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()])];
  let matchedCode: string | undefined;
  let role = 'kolthoff_admin';

  for (const candidate of variants) {
    const credRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'admin_credentials', candidate);
    const snap = await getDoc(credRef);
    if (snap.exists()) {
      matchedCode = candidate;
      role = (snap.data()?.role as string) || 'kolthoff_admin';
      break;
    }
  }

  if (!matchedCode) return { valid: false as const };

  const uid = auth.currentUser!.uid;
  await setDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'admin_sessions', uid), {
    passcodeVerified: matchedCode,
    role: 'kolthoff_admin',
    verifiedAt: Date.now(),
  });

  return { valid: true as const, role };
}

export async function hasAdminSession(): Promise<boolean> {
  try {
    if (!auth.currentUser) {
      await bootstrapAuth();
    }
    const user = auth.currentUser;
    if (!user) return false;

    const token = await user.getIdTokenResult();
    if (token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin') {
      return true;
    }

    if (isKolthoffStaffEmail(user.email) && user.providerData.some((p) => p.providerId === 'google.com')) {
      return token.claims.tenantId === adminAppId;
    }

    const sessionRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'admin_sessions', user.uid);
    const snap = await getDoc(sessionRef);
    return snap.exists();
  } catch {
    return false;
  }
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

export { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, doc, onSnapshot, getDocs, httpsCallable };
