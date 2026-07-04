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

async function finalizeGoogleStaffUser(
  user: User,
  options?: { backgroundProvision?: boolean },
): Promise<User> {
  if (!isKolthoffStaffEmail(user.email)) {
    await signOut(auth);
    throw new Error('Use your @kolthoff-consulting.com Google Workspace account.');
  }
  await recordGoogleAdminSession(user);
  const provision = provisionGoogleStaffViaFirestore(user, {
    timeoutMs: options?.backgroundProvision ? 8000 : undefined,
  });
  if (options?.backgroundProvision) {
    provision.catch((err) => {
      console.warn('Background staff provisioning failed:', err);
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

export async function signInWithGoogleStaff(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }

  const provider = buildGoogleProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return finalizeGoogleStaffUser(cred.user);
  } catch (err) {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled.');
      }
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        sessionStorage.setItem(SSO_PENDING_KEY, '1');
        redirectBootPromise = null;
        await signInWithRedirect(auth, provider);
        throw new Error('REDIRECT_STARTED');
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

      if (!pendingRedirect) {
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
          return finalizeGoogleStaffUser(result.user);
        }
      } catch (err) {
        redirectBootPromise = null;
        sessionStorage.removeItem(SSO_PENDING_KEY);
        throw err;
      }

      const user = await waitForSignedInUser(8000);
      sessionStorage.removeItem(SSO_PENDING_KEY);

      if (user && isGoogleStaffUser(user)) {
        return finalizeGoogleStaffUser(user);
      }

      throw new Error(
        'Google sign-in did not complete. Add OAuth redirect URIs in Google Cloud Console (see docs/app-check-sso.md) or use passcode login.',
      );
    })();
  }
  return redirectBootPromise;
}

export { isGoogleStaffUser };
