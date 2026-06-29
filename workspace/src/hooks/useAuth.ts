import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, bootstrapAuth } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapAuth().then(() => {
      return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
