import { Component, useState, useEffect, type ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { verifyAdminPasscode, hasAdminSession, adminCol, auth } from './lib/firebase';
import { onSnapshot } from 'firebase/firestore';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import OrgChart from './pages/OrgChart';
import PortalManager from './pages/PortalManager';
import ContractLedger from './pages/ContractLedger';
import Collections from './pages/Collections';
import EmbedApp from './pages/EmbedApp';
import BrandHeader from './components/BrandHeader';
import SidebarNav from './components/SidebarNav';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-brandNavy-955">
          <div className="glass-panel p-8 max-w-lg w-full">
            <h1 className="text-xl font-bold text-red-400 mb-3">Admin Console Error</h1>
            <p className="text-slate-300 text-sm mb-4">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getReturnUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('return');
  if (!raw) return null;
  try {
    const path = decodeURIComponent(raw);
    if (path.startsWith('/') && !path.startsWith('//')) return path;
  } catch {
    return null;
  }
  return null;
}

function LoginGate({ onAuth, initialError = '' }: { onAuth: () => void; initialError?: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await verifyAdminPasscode(code);
      if (!result.valid) {
        setError(
          'Invalid passcode. Create a Firestore document at ' +
          'artifacts/kolthoff-admin-app/public/data/admin_credentials/YOUR_CODE ' +
          'with field role = kolthoff_admin (see docs/admin-login.md).'
        );
        return;
      }
      const returnUrl = getReturnUrl();
      if (returnUrl) {
        window.location.href = returnUrl;
      } else {
        onAuth();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auth failed';
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/requests-from-referer-blocked' || msg.includes('referer')) {
          setError('Firebase Auth blocked this domain. Add kolthoff-portal.web.app and kolthoff-consulting.com to API key HTTP referrers in Google Cloud Console.');
        } else if (err.code === 'permission-denied') {
          setError('Firestore denied passcode check. Ensure Anonymous auth is enabled and rules are deployed.');
        } else {
          setError(`${err.code}: ${msg}`);
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { startGoogleStaffSignIn } = await import('./lib/staff-sso');
      await startGoogleStaffSignIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(msg);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandNavy-955 p-4">
      <form onSubmit={submit} className="glass-panel p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <BrandHeader />
        </div>
        <p className="text-sm text-slate-400 text-center mb-5">
          Sign in with Google Workspace or use the break-glass passcode.
        </p>
        <button
          type="button"
          onClick={signInGoogle}
          disabled={googleLoading || loading}
          className="w-full py-2.5 mb-4 bg-white text-slate-800 rounded font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 disabled:opacity-50"
        >
          {googleLoading ? 'Signing in…' : 'Sign in with Google'}
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-brandNavy-700" />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">or passcode</span>
          <div className="flex-1 h-px bg-brandNavy-700" />
        </div>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Admin passcode"
          className="w-full p-3 rounded bg-brandNavy-800 border border-brandNavy-700 mb-4" />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button disabled={loading} className="w-full py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold">
          {loading ? 'Verifying...' : 'Enter Console'}
        </button>
      </form>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isEmbed = location.pathname.startsWith('/app/');
  const [metrics, setMetrics] = useState({ clients: 0, profiles: 0, deals: 0 });

  useEffect(() => {
    const unsubs = ['clients', 'workbook_profiles', 'crm_deals'].map((col) =>
      onSnapshot(
        adminCol(col),
        (snap) => {
          setMetrics((m) => ({ ...m, [col === 'clients' ? 'clients' : col === 'workbook_profiles' ? 'profiles' : 'deals']: snap.size }));
        },
        (err) => console.warn(`Sidebar metrics listener failed (${col}):`, err.message)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <div className="h-screen flex bg-brandNavy-955 overflow-hidden">
      <aside className="admin-sidebar w-[clamp(14rem,17vw,18rem)] bg-brandNavy-900 border-r border-brandNavy-800 flex flex-col shrink-0 overflow-hidden min-h-0 pl-0 pr-2 py-2">
        <div className="px-2 pb-2 border-b border-brandNavy-800 shrink-0">
          <BrandHeader compact />
        </div>
        <SidebarNav />
        <div className="sidebar-nav-hint text-slate-600 px-2 pt-2 border-t border-brandNavy-800 font-mono shrink-0 truncate">
          {metrics.clients} clients · {metrics.profiles} SOWs · {metrics.deals} deals
        </div>
      </aside>
      <main
        className={`flex-1 min-w-0 min-h-0 ${isEmbed ? 'overflow-hidden' : 'p-4 sm:p-6 overflow-auto'}`}
      >
        {children}
      </main>
    </div>
  );
}

function EmbedAppRoute() {
  const { appId } = useParams();
  return <EmbedApp appId={appId ?? ''} />;
}

function AppRoutes() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [bootError, setBootError] = useState('');
  const [googleSsoError, setGoogleSsoError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { completeGoogleStaffRedirect } = await import('./lib/staff-sso');
        const user = await completeGoogleStaffRedirect();
        if (user) {
          const returnUrl = getReturnUrl();
          if (returnUrl) {
            window.location.href = returnUrl;
            return;
          }
          setAuthed(true);
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Google sign-in failed';
        console.error('Google SSO boot failed:', err);
        setGoogleSsoError(msg);
      }

      try {
        const ok = await hasAdminSession();
        if (!ok && auth.currentUser && !auth.currentUser.isAnonymous) {
          console.warn('Signed-in user lacks admin session:', auth.currentUser.email);
        }
        const returnUrl = getReturnUrl();
        if (ok && returnUrl) {
          window.location.href = returnUrl;
          return;
        }
        setAuthed(ok);
      } catch (err) {
        console.warn('Admin session check failed:', err);
        setBootError(err instanceof Error ? err.message : 'Could not verify admin session.');
        setAuthed(false);
      }
    })();
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300 bg-brandNavy-955">
        <p className="animate-pulse">Loading admin console…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <>
        {bootError && (
          <div className="fixed top-0 inset-x-0 z-50 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-sm text-center">
            {bootError}
          </div>
        )}
        <LoginGate onAuth={() => setAuthed(true)} initialError={googleSsoError} />
      </>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/org-chart" element={<OrgChart />} />
        <Route path="/intake" element={<Navigate to="/org-chart" replace />} />
        <Route path="/portals" element={<PortalManager />} />
        <Route path="/contracts" element={<ContractLedger />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/master" element={<Navigate to="/tenants?tab=support" replace />} />
        <Route path="/app/:appId" element={<EmbedAppRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}
