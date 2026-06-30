import { useState } from 'react';
import { signInWithEmailAndPassword, auth, tenantCol, logAudit, getDocs, query, where, functions, httpsCallable, appId } from '../lib/firebase';
import { FirebaseError } from 'firebase/app';

interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

type ViewMode = 'login' | 'reset';

export default function LoginPage({ onLogin }: { onLogin: (user: CoreUser) => void }) {
  const [view, setView] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const normalized = email.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
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

  const handlePasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    if (!normalized) {
      setError('Enter your organizational email.');
      setLoading(false);
      return;
    }
    try {
      const requestReset = httpsCallable(functions, 'requestWorkspacePasswordReset');
      const result = await requestReset({ email: normalized, tenantId: appId });
      const message = (result.data as { message?: string })?.message;
      setInfo(message || 'If that email is registered, a reset link has been sent.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg.includes('internal')
        ? 'Could not send reset email. Contact your Kolthoff admin.'
        : msg);
    } finally {
      setLoading(false);
    }
  };

  const switchView = (next: ViewMode) => {
    setView(next);
    setError('');
    setInfo('');
    setPassword('');
  };

  if (view === 'reset') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <form onSubmit={handlePasswordRequest} className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
          <h1 className="text-2xl font-bold text-white text-center mb-2">Set or reset password</h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            New team member or forgot your password? We&apos;ll email you a secure link to set one.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Organizational email"
            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4"
            required
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          {info && <p className="text-teal-400 text-sm mb-3">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send password link'}
          </button>
          <button
            type="button"
            onClick={() => switchView('login')}
            className="w-full mt-3 py-2 text-sm text-slate-400 hover:text-white"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Team Portal</h1>
        <p className="text-sm text-slate-400 text-center mb-6">Sign in with your organizational email</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-3"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-2"
          required
        />
        <div className="text-right mb-4">
          <button
            type="button"
            onClick={() => switchView('reset')}
            className="text-xs text-teal-400 hover:text-teal-300 underline"
          >
            Forgot password or first-time setup
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-xs text-slate-500 text-center mt-4">
          Kolthoff staff with a passcode? <a href="/admin/" className="text-teal-400 underline">Sign in at Admin Console</a> first.
        </p>
      </form>
    </div>
  );
}
