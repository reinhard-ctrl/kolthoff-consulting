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

function buildGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'kolthoff-consulting.com' });
  return provider;
}

async function finalizeGoogleStaffUser(user: User): Promise<User> {
  if (!isKolthoffStaffEmail(user.email)) {
    await signOut(auth);
    throw new Error('Use your @kolthoff-consulting.com Google Workspace account.');
  }
  await provisionGoogleStaffViaFirestore(user);
  return user;
}

export async function startGoogleStaffSignIn(): Promise<void> {
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }
  await signInWithRedirect(auth, buildGoogleProvider());
}

export async function completeGoogleStaffRedirect(): Promise<User | null> {
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  return finalizeGoogleStaffUser(result.user);
}
