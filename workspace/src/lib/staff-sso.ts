import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';
import { isEmbeddedView } from './embed-mode';
import { isKolthoffStaffEmail } from './staff-domain';
import { recordGoogleAdminSession } from './google-admin-session';
import { provisionGoogleStaffViaFirestore } from './staff-provision-firestore';

const SSO_PENDING_KEY = 'kolthoff_google_sso_pending';
const REDIRECT_RESULT_TIMEOUT_MS = 8000;
let redirectBootPromise: Promise<User | null> | null = null;

function buildGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'kolthoff-consulting.com' });
  return provider;
}

function isGoogleStaffUser(user: User | null | undefined): user is User {
  if (!user || user.isAnonymous) return false;
  return (
    isKolthoffStaffEmail(user.email) &&
    user.providerData.some((p) => p.providerId === 'google.com')
  );
}

function isReturningFromOAuthRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(SSO_PENDING_KEY) === '1') return true;
  const params = new URLSearchParams(window.location.search);
  return params.has('apiKey') || params.has('authType') || window.location.hash.includes('auth');
}

function waitForSignedInUser(maxMs: number): Promise<User | null> {
  return new Promise((resolve) => {
    void auth.authStateReady().then(() => {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        resolve(auth.currentUser);
        return;
      }
      const timeout = setTimeout(() => {
        unsub();
        const u = auth.currentUser;
        resolve(u && !u.isAnonymous ? u : null);
      }, maxMs);
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
          clearTimeout(timeout);
          unsub();
          resolve(user);
        }
      });
    });
  });
}

async function getRedirectResultWithTimeout() {
  return Promise.race([
    getRedirectResult(auth),
    new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('getRedirectResult timed out — continuing boot');
        resolve(null);
      }, REDIRECT_RESULT_TIMEOUT_MS);
    }),
  ]);
}

async function logBackgroundProvisionFailure(_user: User, _err: unknown): Promise<void> {
  // google_admin_sessions already grants admin access — claim sync is best-effort
}

async function finalizeGoogleStaffUser(
  user: User,
  options?: { backgroundProvision?: boolean },
): Promise<User> {
  if (!isKolthoffStaffEmail(user.email)) {
    await signOut(auth);
    throw new Error('Use your @kolthoff-consulting.com Google Workspace account.');
  }
  await recordGoogleAdminSession(user);
  const provision = provisionGoogleStaffViaFirestore(user);
  if (options?.backgroundProvision !== false) {
    provision.catch((err) => {
      void logBackgroundProvisionFailure(user, err);
    });
  } else {
    try {
      await provision;
    } catch (err) {
      console.warn('Staff claim provisioning failed; Google email staff access still applies:', err);
    }
  }
  return user;
}

async function startGoogleStaffRedirect(): Promise<never> {
  sessionStorage.setItem(SSO_PENDING_KEY, '1');
  redirectBootPromise = null;
  await signInWithRedirect(auth, buildGoogleProvider());
  throw new Error('REDIRECT_STARTED');
}

/** Redirect-first — popup breaks when COOP blocks opener ↔ popup communication */
export async function signInWithGoogleStaff(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }

  const preferPopup =
    isEmbeddedView() ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('sso') === 'popup');

  if (!preferPopup) {
    await startGoogleStaffRedirect();
  }

  const provider = buildGoogleProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    await auth.authStateReady();
    const signedIn = auth.currentUser;
    if (
      !signedIn ||
      signedIn.isAnonymous ||
      signedIn.uid !== cred.user.uid ||
      !isGoogleStaffUser(signedIn)
    ) {
      console.warn('Google popup did not persist session — falling back to redirect');
      await startGoogleStaffRedirect();
    }
    return finalizeGoogleStaffUser(signedIn, { backgroundProvision: true });
  } catch (err) {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled.');
      }
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        await startGoogleStaffRedirect();
      }
    }
    throw err;
  }
}

export function completeGoogleStaffRedirect(): Promise<User | null> {
  if (!redirectBootPromise) {
    redirectBootPromise = (async () => {
      await auth.authStateReady();
      const pendingRedirect = isReturningFromOAuthRedirect();
      const embedded = isEmbeddedView();

      if (!pendingRedirect) {
        sessionStorage.removeItem(SSO_PENDING_KEY);
        const existing = auth.currentUser;
        if (existing && isGoogleStaffUser(existing)) {
          return finalizeGoogleStaffUser(existing, { backgroundProvision: true });
        }
        return null;
      }

      if (embedded) {
        sessionStorage.removeItem(SSO_PENDING_KEY);
        const existing = auth.currentUser;
        if (existing && isGoogleStaffUser(existing)) {
          return finalizeGoogleStaffUser(existing, { backgroundProvision: true });
        }
        return null;
      }

      try {
        const result = await getRedirectResultWithTimeout();
        sessionStorage.removeItem(SSO_PENDING_KEY);
        if (result?.user) {
          return finalizeGoogleStaffUser(result.user, { backgroundProvision: true });
        }
      } catch (err) {
        redirectBootPromise = null;
        sessionStorage.removeItem(SSO_PENDING_KEY);
        throw err;
      }

      const user = await waitForSignedInUser(8000);
      sessionStorage.removeItem(SSO_PENDING_KEY);

      if (user && isGoogleStaffUser(user)) {
        return finalizeGoogleStaffUser(user, { backgroundProvision: true });
      }

      throw new Error(
        'Google sign-in did not complete. Add OAuth redirect URIs in Google Cloud Console (see docs/app-check-sso.md) or use passcode login.',
      );
    })();
  }
  return redirectBootPromise;
}

/** Boot hook — restore Google redirect sessions before auth listeners run */
export async function ensureAuthReady(): Promise<void> {
  await auth.authStateReady();
  if (isEmbeddedView()) {
    return;
  }
  try {
    await completeGoogleStaffRedirect();
  } catch (err) {
    console.warn('Google SSO redirect handling failed:', err);
  }
}

export { isGoogleStaffUser };
