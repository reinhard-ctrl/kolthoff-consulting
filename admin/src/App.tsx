import { Component, useState, useEffect, type ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { verifyAdminPasscode, hasAdminSession, adminCol, auth } from './lib/firebase';
import { onSnapshot } from 'firebase/firestore';
import Dashboard from './pages/Dashboard';
import AgencyOpsDashboard from './pages/AgencyOpsDashboard';
import Tenants from './pages/Tenants';
import WorkspaceOnboard from './pages/WorkspaceOnboard';
import OrgChart from './pages/OrgChart';
import PortalManager from './pages/PortalManager';
import ContractLedger from './pages/ContractLedger';
import AgencyOpsManager from './pages/AgencyOpsManager';
import Collections from './pages/Collections';
import BrandingSettings from './pages/BrandingSettings';
import EmbedApp from './pages/EmbedApp';
import BrandHeader from './components/BrandHeader';
import SidebarNav from './components/SidebarNav';
import { useProduct } from './lib/product-context';
import { isAgencyOpsStarter, syncAgencyTenantUrl } from './lib/product-config';
import { getAgencyOpsTenantAccessBlockReason } from './lib/agency-ops-tenant-access';
import { useDemoAppearance } from './lib/demo-appearance-context';
import DemoAppearanceToggle from './components/DemoAppearanceToggle';

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
  const product = useProduct();
  const { isLight: light } = useDemoAppearance();
  const agencyOpsShell = isAgencyOpsStarter();
  const showGoogleStaffLogin = !agencyOpsShell && !product.isDemo;
  const [code, setCode] = useState(product.isDemo ? (product.demoPasscode ?? '') : '');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await verifyAdminPasscode(code);
      if (!result.valid) {
        const credPath = `artifacts/${product.tenantId}/public/data/admin_credentials/YOUR_CODE`;
        if (product.isDemo) {
          setError(
            `Invalid passcode for Agency Ops demo. Use demostart2026 at /agency-ops/ (not /admin/). ` +
            `Credential path: ${credPath.replace('YOUR_CODE', 'demostart2026')}`
          );
        } else {
          setError(
            `Invalid passcode. Create a Firestore document at ${credPath} with field role = kolthoff_admin (see docs/admin-login.md).`
          );
        }
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
    let redirectStarted = false;
    try {
      const { signInWithGoogleStaff } = await import('./lib/staff-sso');
      await signInWithGoogleStaff();
      const returnUrl = getReturnUrl();
      if (returnUrl) {
        window.location.href = returnUrl;
      } else {
        onAuth();
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'REDIRECT_STARTED') {
        redirectStarted = true;
        setError('');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(msg);
    } finally {
      if (!redirectStarted) setGoogleLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${light ? 'ops-login bg-brandNavy-955' : 'bg-brandNavy-955'}`}>
      <form onSubmit={submit} className={`${light ? 'ops-login-card' : 'glass-panel'} p-8 w-full max-w-[22rem]`}>
        <div className={`flex mb-6 ${light ? 'justify-start' : 'justify-center'}`}>
          <BrandHeader />
        </div>
        <p className="text-sm text-slate-400 mb-5 leading-relaxed">
          {product.isDemo
            ? 'Log in as the demo admin to explore Sales, Quotes, and Invoicing.'
            : agencyOpsShell
              ? 'Enter the passcode from your Agency Ops welcome email to open Sales, Quotes, and Invoicing.'
              : 'Sign in with Google Workspace or use the break-glass passcode.'}
        </p>
        {showGoogleStaffLogin && (
        <button
          type="button"
          onClick={signInGoogle}
          disabled={googleLoading || loading}
          className="w-full py-2.5 mb-4 bg-white text-slate-800 rounded font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 disabled:opacity-50"
        >
          {googleLoading ? 'Redirecting to Google…' : 'Sign in with Google'}
        </button>
        )}
        {showGoogleStaffLogin && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-brandNavy-700" />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">or passcode</span>
          <div className="flex-1 h-px bg-brandNavy-700" />
        </div>
        )}
        {product.demoPasscodeHint && (
          <p className="text-xs text-slate-500 mb-3">{product.demoPasscodeHint}</p>
        )}
        <label htmlFor="admin-passcode" className="sr-only">Passcode</label>
        <input
          id="admin-passcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          autoComplete="off"
          className={`w-full p-3 rounded mb-4 ${light ? '' : 'bg-brandNavy-800 border border-brandNavy-700'}`}
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button disabled={loading} className="w-full py-2.5 brand-primary-bg rounded-lg font-semibold text-white">
          {loading ? 'Signing in…' : product.isDemo || agencyOpsShell ? 'Continue with passcode' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const product = useProduct();
  const { isLight: light } = useDemoAppearance();
  const location = useLocation();
  const isEmbed = location.pathname.startsWith('/app/');
  const [metrics, setMetrics] = useState({ clients: 0, profiles: 0, deals: 0 });

  useEffect(() => {
    if (isAgencyOpsStarter(product.id)) {
      syncAgencyTenantUrl();
    }
  }, [location.pathname, location.search, product.id]);

  useEffect(() => {
    const cols = isAgencyOpsStarter(product.id)
      ? (['workbook_profiles', 'crm_deals'] as const)
      : (['clients', 'workbook_profiles', 'crm_deals'] as const);
    const unsubs = cols.map((col) =>
      onSnapshot(
        adminCol(col),
        (snap) => {
          setMetrics((m) => ({
            ...m,
            [col === 'workbook_profiles' ? 'profiles' : col === 'crm_deals' ? 'deals' : 'clients']: snap.size,
          }));
        },
        (err) => console.warn(`Sidebar metrics listener failed (${col}):`, err.message)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [product.id]);

  return (
    <div className={`h-screen flex overflow-hidden ops-shell ${light ? 'bg-brandNavy-955' : 'bg-brandNavy-955'}`}>
      <aside className={`admin-sidebar w-[clamp(14rem,17vw,18rem)] flex flex-col shrink-0 overflow-hidden min-h-0 pl-0 pr-2 py-3 ops-sidebar ${light ? 'bg-brandNavy-900 border-r border-brandNavy-800' : 'bg-brandNavy-900 border-r border-brandNavy-800'}`}>
        <div className={`px-3 pb-3 shrink-0 ops-sidebar-header ${light ? 'border-b border-brandNavy-800' : 'px-2 pb-2 border-b border-brandNavy-800'}`}>
          <BrandHeader compact />
        </div>
        <SidebarNav />
        <div className={`sidebar-nav-hint px-3 pt-2 pb-2 shrink-0 space-y-2 ${light ? 'ops-sidebar-footer border-t border-brandNavy-800 text-slate-600' : 'text-slate-600 px-2 border-t border-brandNavy-800 font-mono'}`}>
          {isAgencyOpsStarter(product.id) && product.isDemo && (
            <DemoAppearanceToggle />
          )}
          <div className="truncate">
            {isAgencyOpsStarter(product.id)
              ? `${metrics.deals} deals · ${metrics.profiles} estimates`
              : `${metrics.clients} clients · ${metrics.profiles} SOWs · ${metrics.deals} deals`}
          </div>
        </div>
      </aside>
      <main
        className={`ops-main flex-1 min-w-0 min-h-0 ${isEmbed ? `overflow-hidden ops-embed-frame ${light ? 'bg-[#e3e6eb]' : 'bg-[#1a1d21]'}` : 'p-5 sm:p-8 overflow-auto ops-main-inner'}`}
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
  const [accountBlockReason, setAccountBlockReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) {
        setBootError('Loading timed out. Refresh the page or use passcode login below.');
        setAuthed(false);
      }
    }, 12000);

    (async () => {
      try {
        const { completeGoogleStaffRedirect } = await import('./lib/staff-sso');
        const user = await completeGoogleStaffRedirect();
        if (cancelled) return;
        if (user) {
          window.clearTimeout(safetyTimer);
          const blockReason = await getAgencyOpsTenantAccessBlockReason();
          if (blockReason) {
            setAccountBlockReason(blockReason);
            setAuthed(false);
            return;
          }
          const returnUrl = getReturnUrl();
          if (returnUrl) {
            window.location.href = returnUrl;
            return;
          }
          setAuthed(true);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Google sign-in failed';
        console.error('Google SSO boot failed:', err);
        setGoogleSsoError(msg);
      }

      try {
        const blockReason = await getAgencyOpsTenantAccessBlockReason();
        if (cancelled) return;
        if (blockReason) {
          window.clearTimeout(safetyTimer);
          setAccountBlockReason(blockReason);
          setAuthed(false);
          return;
        }

        const ok = await hasAdminSession();
        if (cancelled) return;
        window.clearTimeout(safetyTimer);
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
        if (cancelled) return;
        window.clearTimeout(safetyTimer);
        console.warn('Admin session check failed:', err);
        setBootError(err instanceof Error ? err.message : 'Could not verify admin session.');
        setAuthed(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (!authed || !isAgencyOpsStarter()) return;

    let cancelled = false;
    const interval = window.setInterval(() => {
      void getAgencyOpsTenantAccessBlockReason().then((reason) => {
        if (cancelled || !reason) return;
        setAccountBlockReason(reason);
        setAuthed(false);
      });
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [authed]);

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
        {accountBlockReason ? (
          <div className="min-h-screen flex items-center justify-center p-4 bg-brandNavy-955">
            <div className="glass-panel p-8 w-full max-w-md text-center">
              <h1 className="text-xl font-bold text-rose-300 mb-3">Account cancelled</h1>
              <p className="text-slate-300 text-sm leading-relaxed">{accountBlockReason}</p>
            </div>
          </div>
        ) : (
          <LoginGate onAuth={() => setAuthed(true)} initialError={googleSsoError} />
        )}
      </>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={isAgencyOpsStarter() ? <AgencyOpsDashboard /> : <Dashboard />} />
        {!isAgencyOpsStarter() && <Route path="/tenants" element={<Tenants />} />}
        {!isAgencyOpsStarter() && <Route path="/onboard" element={<WorkspaceOnboard />} />}
        {!isAgencyOpsStarter() && <Route path="/org-chart" element={<OrgChart />} />}
        {!isAgencyOpsStarter() && <Route path="/intake" element={<Navigate to="/org-chart" replace />} />}
        {!isAgencyOpsStarter() && <Route path="/portals" element={<PortalManager />} />}
        {!isAgencyOpsStarter() && <Route path="/contracts" element={<ContractLedger />} />}
        {!isAgencyOpsStarter() && <Route path="/agency-ops-manager" element={<AgencyOpsManager />} />}
        <Route path="/collections" element={<Collections />} />
        {isAgencyOpsStarter() && <Route path="/settings/branding" element={<BrandingSettings />} />}
        {!isAgencyOpsStarter() && <Route path="/master" element={<Navigate to="/tenants?tab=support" replace />} />}
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
