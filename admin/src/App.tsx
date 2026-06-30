import { Component, useState, useEffect, type ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { verifyAdminPasscode, hasAdminSession, adminCol } from './lib/firebase';
import { onSnapshot } from 'firebase/firestore';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import IntakeCenter from './pages/IntakeCenter';
import PortalManager from './pages/PortalManager';
import ContractLedger from './pages/ContractLedger';
import MasterAdmin from './pages/MasterAdmin';
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

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandNavy-955 p-4">
      <form onSubmit={submit} className="glass-panel p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <BrandHeader />
        </div>
        <p className="text-sm text-slate-400 text-center mb-5">
          Enter your admin passcode to access the Operations Suite.
        </p>
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
    <div className="min-h-screen flex flex-col bg-brandNavy-955">
      <header className="border-b border-brandNavy-700/50 bg-brandNavy-950/95 sticky top-0 z-50 backdrop-blur-md shrink-0">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          <BrandHeader />
          <span className="hidden sm:inline px-2.5 py-1 rounded font-mono text-[9px] uppercase font-bold border border-brandTeal-500/30 bg-brandTeal-500/10 text-brandTeal-400 tracking-wider">
            Internal
          </span>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="admin-sidebar w-[clamp(15rem,18vw,20rem)] bg-brandNavy-900 border-r border-brandNavy-800 p-3 sm:p-4 flex flex-col shrink-0 overflow-hidden">
          <SidebarNav />
          <div className="sidebar-nav-hint text-slate-600 pt-3 border-t border-brandNavy-800 font-mono shrink-0">
            {metrics.clients} clients · {metrics.profiles} SOWs · {metrics.deals} deals
          </div>
        </aside>
        <main className="flex-1 p-4 sm:p-6 overflow-auto min-w-0">{children}</main>
      </div>
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

  useEffect(() => {
    hasAdminSession()
      .then((ok) => {
        const returnUrl = getReturnUrl();
        if (ok && returnUrl) {
          window.location.href = returnUrl;
          return;
        }
        setAuthed(ok);
      })
      .catch((err) => {
        console.warn('Admin session check failed:', err);
        setBootError(err instanceof Error ? err.message : 'Could not verify admin session.');
        setAuthed(false);
      });
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
        <LoginGate onAuth={() => setAuthed(true)} />
      </>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/intake" element={<IntakeCenter />} />
        <Route path="/portals" element={<PortalManager />} />
        <Route path="/contracts" element={<ContractLedger />} />
        <Route path="/master" element={<MasterAdmin />} />
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
