import { useState, useEffect } from 'react';
import { FirebaseError } from 'firebase/app';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { verifyAdminPasscode, adminCol, auth } from './lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import IntakeCenter from './pages/IntakeCenter';

const LEGACY_LINKS = [
  { href: '/admin/legacy/admin_console.html', label: 'Portal Manager' },
  { href: '/admin/legacy/contract_ledger.html', label: 'Contract Ledger' },
  { href: '/admin/legacy/core_master_admin.html', label: 'Master Admin' },
  { href: '/admin/legacy/intake_center.html', label: 'Intake Center (Legacy)' },
];

const SUITE_LINKS = [
  { href: '/apps/delivery/project_planner.html', label: 'Project Planner' },
  { href: '/apps/operations/crm_pipeline.html', label: 'CRM Pipeline' },
  { href: '/apps/operations/policy_studio.html', label: 'Policy Studio' },
  { href: '/apps/analytics/firm_analytics_dashboard.html', label: 'Firm Analytics' },
  { href: '/workspace/', label: 'Core Workspace' },
  { href: '/apps/public/portal.html', label: 'Client Portal' },
];

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await verifyAdminPasscode(code.trim().toUpperCase());
      if (!result.valid) {
        setError('Invalid passcode');
        return;
      }
      if (result.token) {
        await signInWithCustomToken(auth, result.token);
      }
      onAuth();
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'functions/internal' || err.code === 'functions/unavailable') {
          setError('Cloud Function unreachable. Try again after deploy, or use /api/verify-passcode via Hosting.');
        } else if (err.message.includes('Passcode check failed')) {
          setError('Could not reach passcode service. Wait for deploy (~3 min) and hard-refresh.');
        } else if (err.message.includes('referer') || err.message.includes('requests-from-referer')) {
          setError('Firebase Auth blocked this domain. Add kolthoff-portal.web.app to API key HTTP referrers in Google Cloud Console.');
        } else {
          setError(`${err.code}: ${err.message}`);
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Auth failed';
        if (msg.includes('Passcode check failed')) {
          setError('Passcode service not ready. Wait ~3 min for deploy, then hard-refresh (Ctrl+Shift+R).');
        } else if (msg.includes('referer') || msg.includes('requests-from-referer')) {
          setError('Firebase Auth blocked this domain. Add kolthoff-portal.web.app to API key HTTP referrers.');
        } else {
          setError(msg);
        }
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
    const unsubs = ['clients', 'workbook_profiles', 'core_crm_deals'].map((col) =>
      onSnapshot(adminCol(col), (snap) => {
        setMetrics((m) => ({ ...m, [col === 'clients' ? 'clients' : col === 'workbook_profiles' ? 'profiles' : 'deals']: snap.size }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-brandNavy-900 border-r border-brandNavy-800 p-4 flex flex-col shrink-0">
        <h1 className="font-bold text-brandTeal-400 mb-1">Kolthoff OS</h1>
        <p className="text-xs text-slate-500 mb-6">Unified Admin Console</p>
        <nav className="space-y-1 flex-1">
          <Link to="/" className="block p-2 rounded hover:bg-brandNavy-800 text-sm">Dashboard</Link>
          <Link to="/tenants" className="block p-2 rounded hover:bg-brandNavy-800 text-sm">Tenant Manager</Link>
          <Link to="/intake" className="block p-2 rounded hover:bg-brandNavy-800 text-sm">Intake Center</Link>
          <div className="pt-4 text-xs text-slate-500 uppercase">Delivery Suite</div>
          {SUITE_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="block p-2 rounded hover:bg-brandNavy-800 text-sm text-slate-400">{l.label}</a>
          ))}
          <div className="pt-4 text-xs text-slate-500 uppercase">Legacy Tools</div>
          {LEGACY_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="block p-2 rounded hover:bg-brandNavy-800 text-sm text-slate-500">{l.label}</a>
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

export default function App() {
  const [authed, setAuthed] = useState(false);

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/intake" element={<IntakeCenter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
