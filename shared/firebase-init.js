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

const DEFAULT_CONFIG = {
  apiKey: 'AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI',
  authDomain: 'kolthoff-portal.firebaseapp.com',
  databaseURL: 'https://kolthoff-portal-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'kolthoff-portal',
  storageBucket: 'kolthoff-portal.firebasestorage.app',
  messagingSenderId: '413958125034',
  appId: '1:413958125034:web:7d9d6d5f0b11a2c73b2e93',
};

const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__
    ? window.__FIREBASE_CONFIG__
    : DEFAULT_CONFIG);

export const appId = typeof __app_id !== 'undefined' ? __app_id : 'kolthoff-admin-app';
export const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

/** When true, HTML apps must not auto-write demo data into empty Firestore collections */
export const disableClientSeed = true;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-southeast1');

/** Initialize App Check when site key is configured */
export function initAppCheck() {
  const siteKey = typeof window !== 'undefined' && window.__RECAPTCHA_SITE_KEY__;
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

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

/** Exchange portal access code for scoped custom token (public callable) */
export async function exchangePortalToken(accessCode) {
  const fn = httpsCallable(functions, 'generatePortalToken');
  const result = await fn({ accessCode: accessCode.trim().toUpperCase() });
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
}

export {
  signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, collection, addDoc, updateDoc,
  query, where, orderBy, limit,
  ref, uploadBytes, getDownloadURL, deleteObject, listAll,
  exchangePortalToken, functions, httpsCallable,
};
