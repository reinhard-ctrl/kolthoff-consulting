import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, bootstrapAuth } from './firebase';
import { isKolthoffStaffEmail } from './staff-domain';
import { provisionGoogleStaffViaFirestore } from './staff-provision-firestore';

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

async function finalizeGoogleStaffUser(user: User): Promise<User> {
  if (!isKolthoffStaffEmail(user.email)) {
    await signOut(auth);
    throw new Error('Use your @kolthoff-consulting.com Google Workspace account.');
  }
  try {
    await provisionGoogleStaffViaFirestore(user);
  } catch (err) {
    console.warn('Staff claim provisioning failed; Google email staff access still applies:', err);
  }
  return user;
}

export async function startGoogleStaffSignIn(): Promise<void> {
  await auth.authStateReady();
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }
  redirectBootPromise = null;
  await signInWithRedirect(auth, buildGoogleProvider());
}

/** Must run before any anonymous/custom-token sign-in on app boot. */
export function completeGoogleStaffRedirect(): Promise<User | null> {
  if (!redirectBootPromise) {
    redirectBootPromise = (async () => {
      await auth.authStateReady();
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          return finalizeGoogleStaffUser(result.user);
        }
      } catch (err) {
        redirectBootPromise = null;
        throw err;
      }

      const existing = auth.currentUser;
      if (isGoogleStaffUser(existing)) {
        return finalizeGoogleStaffUser(existing);
      }

      return null;
    })();
  }
  return redirectBootPromise;
}

/** Single boot entry: Google redirect first, anonymous bootstrap only after. */
export async function ensureAuthReady(): Promise<User | null> {
  const googleUser = await completeGoogleStaffRedirect();
  if (googleUser) return googleUser;

  await auth.authStateReady();
  if (!auth.currentUser) {
    await bootstrapAuth();
  }
  return auth.currentUser;
}

export { isGoogleStaffUser };
