import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { isKolthoffStaffEmail } from './staff-domain';
import { provisionGoogleStaffViaFirestore } from './staff-provision-firestore';

let redirectResultConsumed = false;

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

/** Full-page redirect — avoids Cross-Origin-Opener-Policy popup issues */
export async function startGoogleStaffSignIn(): Promise<void> {
  await auth.authStateReady();
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }
  redirectResultConsumed = false;
  await signInWithRedirect(auth, buildGoogleProvider());
}

/** Call once on app boot after returning from Google — must run before anonymous bootstrap */
export async function completeGoogleStaffRedirect(): Promise<User | null> {
  await auth.authStateReady();

  if (!redirectResultConsumed) {
    redirectResultConsumed = true;
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        return finalizeGoogleStaffUser(result.user);
      }
    } catch (err) {
      redirectResultConsumed = false;
      throw err;
    }
  }

  const existing = auth.currentUser;
  if (isGoogleStaffUser(existing)) {
    return finalizeGoogleStaffUser(existing);
  }

  return null;
}

export async function hasGoogleStaffClaims(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return false;
  const token = await user.getIdTokenResult();
  return token.claims.role === 'kolthoff_admin' || token.claims.role === 'admin';
}

export { isGoogleStaffUser };
