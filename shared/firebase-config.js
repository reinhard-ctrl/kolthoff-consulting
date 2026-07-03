/**
 * Single source for Kolthoff Firebase web client config.
 * Imported by shared/firebase-init.js (HTML apps). Keep admin/workspace firebase.ts in sync.
 */
import { resolveAuthDomain } from './auth-domain.js';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI',
  authDomain: 'kolthoff-portal.web.app',
  databaseURL: 'https://kolthoff-portal-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'kolthoff-portal',
  storageBucket: 'kolthoff-portal.firebasestorage.app',
  messagingSenderId: '413958125034',
  appId: '1:413958125034:web:7d9d6d5f0b11a2c73b2e93',
};

/** Runtime config — authDomain must match window.location host (Chrome bounce-tracking). */
export function getFirebaseConfig() {
  return { ...FIREBASE_CONFIG, authDomain: resolveAuthDomain() };
}

export const DEFAULT_APP_ID = 'kolthoff-admin-app';
export const FUNCTIONS_REGION = 'asia-southeast1';
