import { useState } from 'react';
import { signInWithEmailAndPassword, auth, tenantCol, logAudit, getDocs, query, where } from '../lib/firebase';
import { FirebaseError } from 'firebase/app';

interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function LoginPage({ onLogin }: { onLogin: (user: CoreUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const normalized = email.trim().toLowerCase();
    if (!password) {
      setError('Password is required. Ask your admin to provision you in Tenant Manager.');
      setLoading(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, normalized, password);
      const snap = await getDocs(query(tenantCol('core_users'), where('email', '==', normalized)));
      if (snap.empty) {
        setError('Email not found in organization. Contact your Kolthoff admin.');
        return;
      }
      const match = snap.docs[0].data() as CoreUser;
      await logAudit('workspace_login', { email: match.email });
      onLogin(match);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (err instanceof FirebaseError && err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (msg.includes('referer')) {
        setError('Firebase Auth blocked this domain. Add this site to API key HTTP referrers.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Team Portal</h1>
        <p className="text-sm text-slate-400 text-center mb-6">Sign in with your organizational email</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-3" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4" required />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-xs text-slate-500 text-center mt-4">
          Kolthoff staff with a passcode? <a href="/admin/" className="text-teal-400 underline">Sign in at Admin Console</a> first.
        </p>
      </form>
    </div>
  );
}
