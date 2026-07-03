import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, bootstrapAuth } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) {
        try {
          await bootstrapAuth();
        } catch (err) {
          console.warn('Auth bootstrap failed:', err);
        }
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
