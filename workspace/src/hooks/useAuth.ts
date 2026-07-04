import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ensureAuthReady } from '../lib/staff-sso';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        await ensureAuthReady();
      } catch (err) {
        console.warn('Auth bootstrap failed:', err);
      }
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
