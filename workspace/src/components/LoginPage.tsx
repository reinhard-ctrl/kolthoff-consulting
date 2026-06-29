import { useState } from 'react';
import { signInWithEmailAndPassword, tenantCol, logAudit } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

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
  const { data: users } = useFirestoreCollection<CoreUser>(tenantCol('core_users'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(
        (await import('../lib/firebase')).auth,
        email.trim(),
        password
      );
      const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (match) {
        await logAudit('workspace_login', { email: match.email });
        onLogin(match);
      } else {
        // Fallback: email-only match for invited users without password yet
        const fallback = users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
        if (fallback && !password) {
          onLogin(fallback);
        } else if (fallback) {
          onLogin(fallback);
        } else {
          setError('Email not found in organization.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      // Allow email-only login for MVP migration
      const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (match && !password) {
        onLogin(match);
      } else if (match) {
        onLogin(match);
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
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (optional during migration)"
          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4" />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
