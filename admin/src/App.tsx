import { Component, useState, useEffect, type ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { verifyAdminPasscode, hasAdminSession, adminCol } from './lib/firebase';
import { onSnapshot } from 'firebase/firestore';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import IntakeCenter from './pages/IntakeCenter';
import PortalManager from './pages/PortalManager';
import ContractLedger from './pages/ContractLedger';
import MasterAdmin from './pages/MasterAdmin';

const ADMIN_TOOLS = [
  { to: '/portals', label: 'Portal Manager' },
  { to: '/contracts', label: 'Contract Ledger' },
  { to: '/master', label: 'Master Admin' },
];

const SUITE_LINKS = [
  { href: '/apps/delivery/project_planner.html', label: 'Project Planner' },
  { href: '/apps/delivery/diagnoses_report.html', label: 'Diagnosis Reports' },
  { href: '/apps/operations/crm_pipeline.html', label: 'CRM Pipeline' },
  { href: '/apps/operations/policy_studio.html', label: 'Policy Studio' },
  { href: '/apps/operations/workflow_builder.html', label: 'Workflow Builder' },
  { href: '/apps/analytics/firm_analytics_dashboard.html', label: 'Firm Analytics' },
  { href: '/apps/analytics/resource_capacity_manager.html', label: 'Resource Capacity' },
  { href: '/apps/analytics/time_tracking_variance_analyzer.html', label: 'Time Variance' },
  { href: '/workspace/', label: 'Core Workspace' },
  { href: '/apps/public/portal.html', label: 'Client Portal' },
  { href: '/apps/public/client_intake.html', label: 'Client Intake Form' },
  { href: '/', label: 'Marketing Site' },
];

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
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="glass-panel p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-brandTeal-400 mb-4">Kolthoff Admin Console</h1>
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
    <div className="min-h-screen flex">
      <aside className="w-64 bg-brandNavy-900 border-r border-brandNavy-800 p-4 flex flex-col shrink-0">
        <h1 className="font-bold text-brandTeal-400 mb-1">Kolthoff OS</h1>
        <p className="text-xs text-slate-500 mb-6">Unified Admin Console</p>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          <Link to="/" className="block p-2 rounded hover:bg-brandNavy-800 text-sm">Dashboard</Link>
          <Link to="/tenants" className="block p-2 rounded hover:bg-brandNavy-800 text-sm">Tenant Manager</Link>
          <Link to="/intake" className="block p-2 rounded hover:bg-brandNavy-800 text-sm">Intake Center</Link>
          <div className="pt-4 text-xs text-slate-500 uppercase">Admin Tools</div>
          {ADMIN_TOOLS.map((t) => (
            <Link key={t.to} to={t.to} className="block p-2 rounded hover:bg-brandNavy-800 text-sm text-slate-400">{t.label}</Link>
          ))}
          <div className="pt-4 text-xs text-slate-500 uppercase">Delivery Suite</div>
          {SUITE_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="block p-2 rounded hover:bg-brandNavy-800 text-sm text-slate-400">{l.label}</a>
          ))}
        </nav>
        <div className="text-xs text-slate-600 pt-4 border-t border-brandNavy-800">
          {metrics.clients} clients · {metrics.profiles} SOWs · {metrics.deals} deals
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
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
