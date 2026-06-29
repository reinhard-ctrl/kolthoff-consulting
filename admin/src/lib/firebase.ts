import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, getDocs } from 'firebase/firestore';
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

export function adminCol(name: string) {
  return collection(db, 'artifacts', adminAppId, 'public', 'data', name);
}

export async function bootstrapAuth() {
  const token = (window as unknown as { __initial_auth_token?: string }).__initial_auth_token;
  if (token) await signInWithCustomToken(auth, token);
  else if (!auth.currentUser) await signInAnonymously(auth);
}

export async function verifyAdminPasscode(code: string) {
  const fn = httpsCallable(functions, 'verifyAdminPasscode');
  const result = await fn({ code });
  return result.data as { valid: boolean };
}

export function initAppCheck() {
  const siteKey = (window as unknown as { __RECAPTCHA_SITE_KEY__?: string }).__RECAPTCHA_SITE_KEY__;
  if (siteKey) {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  }
}

export { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, doc, onSnapshot, getDocs };
