import { useState } from 'react';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail as firebaseSendPasswordResetEmail, auth, tenantCol, logAudit, getDocs, query, where, functions, httpsCallable, getWorkspaceTenantId } from '../lib/firebase';
import { FirebaseError } from 'firebase/app';
import EmbedAuthPrompt from './EmbedAuthPrompt';
import { companyInitials, type WorkspaceBranding } from '../lib/tenant-branding';

interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

type ViewMode = 'login' | 'reset';

export default function LoginPage({
  onLogin,
  googleSsoError = '',
  embedded = false,
  branding,
}: {
  onLogin: (user: CoreUser) => void;
  googleSsoError?: string;
  embedded?: boolean;
  branding: WorkspaceBranding;
}) {
  const [view, setView] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(googleSsoError);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const normalized = email.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    if (!password) {
      setError('Password is required. Ask your administrator to invite you.');
      setLoading(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, normalized, password);
      const snap = await getDocs(query(tenantCol('core_users'), where('email', '==', normalized)));
      if (snap.empty) {
        await signOut(auth);
        setError('Email not found in this organization. Contact your administrator.');
        return;
      }
      const match = snap.docs[0].data() as CoreUser;
      await logAudit('workspace_login', { email: match.email });
      onLogin(match);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (err instanceof FirebaseError && err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err instanceof FirebaseError && err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Wait a few minutes or use "Forgot password" to reset.');
      } else if (msg.includes('referer')) {
        setError('Firebase Auth blocked this domain. Add this site to API key HTTP referrers.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const tenantId = getWorkspaceTenantId() ?? '';

  const workspaceResetUrl = () => (
    `${window.location.origin}/workspace/?tenant=${encodeURIComponent(tenantId)}`
  );

  const handlePasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    if (!normalized) {
      setError('Enter your work email.');
      setLoading(false);
      return;
    }
    try {
      const requestReset = httpsCallable(functions, 'requestWorkspacePasswordReset');
      const result = await requestReset({ email: normalized, tenantId });
      const message = (result.data as { message?: string })?.message;
      setInfo(message || 'If that email is registered, a reset link has been sent.');
    } catch (err: unknown) {
      const code = err instanceof FirebaseError ? err.code : '';
      const msg = err instanceof Error ? err.message : 'Request failed';

      const tryClientFallback = code === 'functions/internal'
        || code === 'functions/unavailable'
        || code === 'functions/not-found'
        || code === 'functions/permission-denied'
        || msg.includes('internal');

      if (tryClientFallback) {
        try {
          await firebaseSendPasswordResetEmail(auth, normalized, { url: workspaceResetUrl() });
          setInfo('Password reset link sent. Check your inbox (and spam folder), then return here to sign in.');
          return;
        } catch (fallbackErr: unknown) {
          const fbCode = fallbackErr instanceof FirebaseError ? fallbackErr.code : '';
          if (fbCode === 'auth/user-not-found') {
            setError('This email is not provisioned yet. Ask your administrator to invite you.');
            return;
          }
          if (fbCode === 'auth/too-many-requests') {
            setError('Too many attempts. Wait a few minutes and try again.');
            return;
          }
        }
      }

      if (code === 'functions/resource-exhausted' || msg.includes('Too many attempts')) {
        setError('Too many attempts. Wait a few minutes and try again.');
      } else if (code === 'functions/internal' || msg.includes('internal')) {
        setError('Could not send reset email. Confirm you were invited, or contact your administrator.');
      } else {
        setError(msg);
      }
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

  const brandMark = branding.logoUrl ? (
    <img src={branding.logoUrl} alt="" className="h-12 mx-auto mb-4 object-contain" />
  ) : (
    <div
      className="h-12 w-12 mx-auto mb-4 rounded-xl flex items-center justify-center text-sm font-extrabold text-slate-950"
      style={{ backgroundColor: branding.primaryColor }}
    >
      {companyInitials(branding.companyName)}
    </div>
  );

  if (embedded) {
    return <EmbedAuthPrompt />;
  }

  if (view === 'reset') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <form onSubmit={handlePasswordRequest} className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
          {brandMark}
          <h1 className="text-2xl font-bold text-white text-center mb-2">Set or reset password</h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            We&apos;ll email you a secure link to set a password for {branding.companyName}.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4"
            required
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          {info && <p className="text-sm mb-3 ws-brand-text">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-slate-950 disabled:opacity-50"
            style={{ backgroundColor: branding.primaryColor }}
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
        {brandMark}
        <h1 className="text-2xl font-bold text-white text-center mb-1">{branding.companyName}</h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          {branding.tagline || 'Sign in with your work email'}
        </p>
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
            className="text-xs underline ws-brand-text"
          >
            Forgot password or first-time setup
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-slate-950 disabled:opacity-50"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
