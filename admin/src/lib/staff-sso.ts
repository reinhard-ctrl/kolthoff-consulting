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

async function finalizeGoogleStaffUser(user: User): Promise<User> {
  if (!isKolthoffStaffEmail(user.email)) {
    await signOut(auth);
    throw new Error('Use your @kolthoff-consulting.com Google Workspace account.');
  }
  await recordGoogleAdminSession(user);
  try {
    await provisionGoogleStaffViaFirestore(user);
  } catch (err) {
    console.warn('Staff claim provisioning failed; Google email staff access still applies:', err);
  }
  return user;
}

/** Popup first (reliable in Incognito); redirect only when popup is blocked */
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

/** @deprecated use signInWithGoogleStaff */
export async function startGoogleStaffSignIn(): Promise<void> {
  try {
    await signInWithGoogleStaff();
  } catch (err) {
    if (err instanceof Error && err.message === 'REDIRECT_STARTED') return;
    throw err;
  }
}

/** Call once on app boot — handles redirect return */
export function completeGoogleStaffRedirect(): Promise<User | null> {
  if (!redirectBootPromise) {
    redirectBootPromise = (async () => {
      await auth.authStateReady();
      const pendingRedirect = sessionStorage.getItem(SSO_PENDING_KEY) === '1';

      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          sessionStorage.removeItem(SSO_PENDING_KEY);
          return finalizeGoogleStaffUser(result.user);
        }
      } catch (err) {
        redirectBootPromise = null;
        sessionStorage.removeItem(SSO_PENDING_KEY);
        throw err;
      }

      const user = await waitForSignedInUser(pendingRedirect ? 12000 : 4000);
      sessionStorage.removeItem(SSO_PENDING_KEY);

      if (user && isGoogleStaffUser(user)) {
        return finalizeGoogleStaffUser(user);
      }

      if (pendingRedirect) {
        throw new Error(
          'Google sign-in did not complete after redirect. Use a regular browser window (not Incognito), try https://kolthoff-consulting.com/admin/, or use passcode login.',
        );
      }

      return null;
    })();
  }
  return redirectBootPromise;
}

export async function hasGoogleStaffClaims(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return false;
  const token = await user.getIdTokenResult();
  return token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin';
}

export { isGoogleStaffUser };
