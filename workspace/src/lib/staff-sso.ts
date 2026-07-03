import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { isKolthoffStaffEmail } from './staff-domain';
import { provisionGoogleStaffViaFirestore } from './staff-provision-firestore';

export async function signInWithGoogleStaff(): Promise<User> {
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth);
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'kolthoff-consulting.com' });

  const cred = await signInWithPopup(auth, provider);
  const email = cred.user.email;

  if (!isKolthoffStaffEmail(email)) {
    await signOut(auth);
    throw new Error('Use your @kolthoff-consulting.com Google Workspace account.');
  }

  await provisionGoogleStaffViaFirestore(cred.user);
  return cred.user;
}
