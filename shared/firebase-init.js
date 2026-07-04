/**
 * Unified Firebase bootstrap for all Kolthoff OS apps.
 * Supports Firebase Studio injection via __firebase_config, __app_id, __initial_auth_token.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getAuth, signInAnonymously, signInWithCustomToken,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc,
  onSnapshot, collection, addDoc, updateDoc, query, where, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';
import { writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { FIREBASE_CONFIG, DEFAULT_APP_ID, FUNCTIONS_REGION } from './firebase-config.js';
import { getTenantId } from './product-config.js';

const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__
    ? window.__FIREBASE_CONFIG__
    : FIREBASE_CONFIG);

export const appId = typeof __app_id !== 'undefined' ? __app_id : getTenantId(DEFAULT_APP_ID);
export const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

/** When true, HTML apps must not auto-write demo data into empty Firestore collections */
export const disableClientSeed = true;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);

/** Initialize App Check when site key is configured */
export function initAppCheck() {
  const siteKey = typeof window !== 'undefined' && window.__RECAPTCHA_SITE_KEY__;
  if (typeof window !== 'undefined' && window.FIREBASE_APPCHECK_DEBUG_TOKEN !== undefined) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = window.FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

initAppCheck();

/** Firestore tenant path helpers */
export function tenantCollection(collectionName) {
  return collection(db, 'artifacts', appId, 'public', 'data', collectionName);
}

export function tenantDoc(collectionName, docId) {
  return doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId);
}

export function storagePath(clientId, filename) {
  return `artifacts/${appId}/files/${clientId}/${filename}`;
}

/** Standard auth bootstrap — anonymous or custom token */
export async function bootstrapAuth() {
  if (initialAuthToken) {
    await signInWithCustomToken(auth, initialAuthToken);
  } else if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}

/** Verify passcode via Firestore — works when org policy blocks public Cloud Functions */
export async function verifyAdminPasscode(code) {
  await bootstrapAuth();
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };

  const variants = [...new Set([trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()])];
  let matchedCode;
  let role = 'kolthoff_admin';

  for (const candidate of variants) {
    const credRef = doc(db, 'artifacts', appId, 'public', 'data', 'admin_credentials', candidate);
    const snap = await getDoc(credRef);
    if (snap.exists()) {
      matchedCode = candidate;
      role = snap.data()?.role || 'kolthoff_admin';
      break;
    }
  }

  if (!matchedCode) return { valid: false };

  const uid = auth.currentUser.uid;
  await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_sessions', uid), {
    passcodeVerified: matchedCode,
    role: 'kolthoff_admin',
    verifiedAt: Date.now(),
  });

  return { valid: true, role };
}

/** Check if current user has an active admin session */
export async function hasAdminSession() {
  try {
    await bootstrapAuth();
  } catch {
    return false;
  }
  if (!auth.currentUser) return false;
  const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'admin_sessions', auth.currentUser.uid);
  const snap = await getDoc(sessionRef);
  return snap.exists();
}

/** Exchange portal access code for client session (Firestore-direct; no Cloud Functions required) */
export async function exchangePortalToken(accessCode) {
  const normalized = accessCode.trim().toUpperCase();
  if (!normalized) {
    const err = new Error('Access code required');
    err.code = 'invalid-argument';
    throw err;
  }

  await bootstrapAuth();
  const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', normalized);
  try {
    const snap = await getDoc(clientRef);
    if (snap.exists()) {
      return { token: null, client: snap.data(), accessCode: normalized };
    }
    const err = new Error('Invalid access code');
    err.code = 'not-found';
    throw err;
  } catch (directErr) {
    if (directErr?.code === 'not-found' || directErr?.code === 'invalid-argument') throw directErr;
    if (directErr?.code !== 'permission-denied') {
      console.warn('Portal Firestore auth failed, trying cloud functions:', directErr);
    }
  }

  /** Legacy fallback when Firestore rules are not yet deployed */
  if (typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/generatePortalToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: normalized }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.token) return payload;
      if (res.status === 404 || payload?.code === 'not-found') {
        const err = new Error(payload?.error || 'Invalid access code');
        err.code = 'not-found';
        throw err;
      }
    } catch (fetchErr) {
      if (fetchErr?.code === 'not-found') throw fetchErr;
      console.warn('Portal token HTTP path failed, trying callable:', fetchErr);
    }
  }

  const fn = httpsCallable(functions, 'generatePortalToken');
  const result = await fn({ accessCode: normalized });
  return result.data;
}

/** Audit log helper */
export async function logAudit(action, details = {}) {
  try {
    await addDoc(tenantCollection('core_audit_log'), {
      action,
      details,
      userId: auth.currentUser?.uid || 'anonymous',
      timestamp: Date.now(),
    });
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
}

// Expose to legacy Babel/HTML apps via window
if (typeof window !== 'undefined') {
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  window.firebaseStorage = storage;
  window.firebaseFunctions = functions;
  window.appId = appId;
  window.initialAuthToken = initialAuthToken;
  window.KOLTHOFF_DISABLE_CLIENT_SEED = disableClientSeed;
  window.signInAnonymously = signInAnonymously;
  window.signInWithCustomToken = signInWithCustomToken;
  window.signInWithEmailAndPassword = signInWithEmailAndPassword;
  window.signOut = signOut;
  window.onAuthStateChanged = onAuthStateChanged;
  window.GoogleAuthProvider = GoogleAuthProvider;
  window.signInWithPopup = signInWithPopup;
  window.doc = doc;
  window.setDoc = setDoc;
  /** Aliases — inline Babel scripts must not use names like `doc`/`setDoc` (var hoisting clobbers window.doc). */
  window.firestoreDoc = doc;
  window.firestoreSetDoc = setDoc;
  window.getDoc = getDoc;
  window.getDocs = getDocs;
  window.deleteDoc = deleteDoc;
  window.firestoreDeleteDoc = deleteDoc;
  window.onSnapshot = onSnapshot;
  window.collection = collection;
  window.addDoc = addDoc;
  window.updateDoc = updateDoc;
  window.query = query;
  window.where = where;
  window.orderBy = orderBy;
  window.limit = limit;
  window.storageRef = ref;
  window.uploadBytes = uploadBytes;
  window.getDownloadURL = getDownloadURL;
  window.deleteObject = deleteObject;
  window.listAll = listAll;
  window.bootstrapAuth = bootstrapAuth;
  window.verifyAdminPasscode = verifyAdminPasscode;
  window.hasAdminSession = hasAdminSession;
  window.logAudit = logAudit;
  window.tenantCollection = tenantCollection;
  window.tenantDoc = tenantDoc;
  window.initAppCheck = initAppCheck;
  window.exchangePortalToken = exchangePortalToken;
  window.httpsCallable = httpsCallable;
  window.writeBatch = writeBatch;
}

export {
  signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, collection, addDoc, updateDoc,
  query, where, orderBy, limit,
  ref, uploadBytes, getDownloadURL, deleteObject, listAll,
  httpsCallable, writeBatch,
};
