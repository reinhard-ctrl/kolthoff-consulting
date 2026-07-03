import { doc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, adminAppId } from './firebase';

/** Client-side Google admin session — same pattern as passcode admin_sessions */
export async function recordGoogleAdminSession(user: User): Promise<void> {
  await setDoc(
    doc(db, 'artifacts', adminAppId, 'public', 'data', 'google_admin_sessions', user.uid),
    {
      email: user.email?.trim().toLowerCase() || '',
      role: 'kolthoff_admin',
      signedInAt: Date.now(),
    },
    { merge: true },
  );
}
