import { doc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

const ADMIN_APP = 'kolthoff-admin-app';

export async function recordGoogleAdminSession(user: User): Promise<void> {
  await setDoc(
    doc(db, 'artifacts', ADMIN_APP, 'public', 'data', 'google_admin_sessions', user.uid),
    {
      email: user.email?.trim().toLowerCase() || '',
      role: 'kolthoff_admin',
      signedInAt: Date.now(),
    },
    { merge: true },
  );
}
