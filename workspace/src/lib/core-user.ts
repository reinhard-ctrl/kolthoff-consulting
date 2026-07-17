import type { User } from 'firebase/auth';
import { auth, getDocs, query, where, tenantCol } from './firebase';
import { isGoogleStaffUser } from './staff-sso';

export interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function resolveCoreUserFromAuthUser(firebaseUser: User): Promise<CoreUser> {
  const email = firebaseUser.email?.trim().toLowerCase();
  if (email) {
    const byEmail = await getDocs(query(tenantCol('core_users'), where('email', '==', email)));
    if (!byEmail.empty) {
      return byEmail.docs[0].data() as CoreUser;
    }
  }

  if (isGoogleStaffUser(firebaseUser) && email) {
    return {
      id: firebaseUser.uid,
      email,
      name: firebaseUser.displayName || email.split('@')[0],
      role: 'kolthoff_admin',
    };
  }

  const adminSnap = await getDocs(query(tenantCol('core_users'), where('role', '==', 'kolthoff_admin')));
  if (!adminSnap.empty) {
    return adminSnap.docs[0].data() as CoreUser;
  }

  return {
    id: firebaseUser.uid,
    email: email || 'admin@kolthoff-consulting.com',
    name: firebaseUser.displayName || 'Administrator',
    role: 'kolthoff_admin',
  };
}

export async function resolveCoreUserFromCurrentAuth(): Promise<CoreUser | null> {
  await auth.authStateReady();
  const current = auth.currentUser;
  if (!current) return null;
  return resolveCoreUserFromAuthUser(current);
}
