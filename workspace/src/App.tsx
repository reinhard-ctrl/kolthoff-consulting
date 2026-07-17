import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { signOut, auth, logAudit, hasAdminStaffSession, waitForAdminStaffSession, getWorkspaceTenantId } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { useTenantFeatures } from './hooks/useTenant';
import { useWorkspaceBadges } from './hooks/useWorkspaceBadges';
import { useWorkspaceBranding } from './hooks/useWorkspaceBranding';
import { isEmbeddedView, initEmbedMode } from './lib/embed-mode';
import { resolveCoreUserFromAuthUser, resolveCoreUserFromCurrentAuth, type CoreUser } from './lib/core-user';
import { companyInitials } from './lib/tenant-branding';
import LoginPage from './components/LoginPage';
import EmbedAuthPrompt from './components/EmbedAuthPrompt';
import WorkspaceTenantLanding from './components/WorkspaceTenantLanding';
import { IconApprovals, IconCrm, IconHelp, IconMessenger, IconOrg, IconVault, IconWorkflow } from './components/NavIcons';
import MessengerApp from './apps/MessengerApp';
import ApprovalsApp from './apps/ApprovalsApp';
import VaultApp from './apps/VaultApp';
import CRMApp from './apps/CRMApp';
import HelpDeskApp from './apps/HelpDeskApp';
import OrgChartApp from './apps/OrgChartApp';
import WorkflowBuilderApp from './apps/WorkflowBuilderApp';

type ModuleKey = 'messenger' | 'approvals' | 'workflows' | 'org' | 'vault' | 'crm' | 'help';

const NAV: {
  key: ModuleKey;
  label: string;
  feature?: 'messenger' | 'approvals' | 'vault' | 'crm';
  /** Show when approvals feature is on (workflow builder / org for routing) */
  requireApprovals?: boolean;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { key: 'messenger', label: 'Messenger', feature: 'messenger', Icon: IconMessenger },
  { key: 'approvals', label: 'Approvals', feature: 'approvals', Icon: IconApprovals },
  { key: 'workflows', label: 'Workflows', requireApprovals: true, Icon: IconWorkflow },
  { key: 'org', label: 'Organization', requireApprovals: true, Icon: IconOrg },
  { key: 'vault', label: 'Policies', feature: 'vault', Icon: IconVault },
  { key: 'crm', label: 'CRM', feature: 'crm', Icon: IconCrm },
  { key: 'help', label: 'Help', Icon: IconHelp },
];

function readModuleFromUrl(fallback: ModuleKey): ModuleKey {
  const raw = new URLSearchParams(window.location.search).get('module')?.trim().toLowerCase();
  if (
    raw === 'messenger' || raw === 'approvals' || raw === 'workflows' || raw === 'org'
    || raw === 'vault' || raw === 'crm' || raw === 'help'
  ) {
    return raw;
  }
  return fallback;
}

function setModuleInUrl(module: ModuleKey) {
  const url = new URL(window.location.href);
  url.searchParams.set('module', module);
  window.history.replaceState({}, '', url.toString());
}

function Shell({
  user,
  onLogout,
  branding,
}: {
  user: CoreUser;
  onLogout: () => void;
  branding: ReturnType<typeof useWorkspaceBranding>['branding'];
}) {
  const features = useTenantFeatures();
  const { pendingApprovals, unreadMessages } = useWorkspaceBadges(user.id);
  const enabledNav = useMemo(
    () => NAV.filter((n) => {
      if (n.requireApprovals && !features.approvals) return false;
      if (n.feature && !features[n.feature]) return false;
      return true;
    }),
    [features],
  );
  const canEditOrg = user.role === 'admin' || user.role === 'kolthoff_admin';
  const defaultModule = (enabledNav[0]?.key || 'help') as ModuleKey;
  const [active, setActive] = useState<ModuleKey>(() => readModuleFromUrl(defaultModule));

  useEffect(() => {
    if (!enabledNav.some((n) => n.key === active)) {
      setActive(defaultModule);
      setModuleInUrl(defaultModule);
    }
  }, [enabledNav, active, defaultModule]);

  useEffect(() => {
    const onPop = () => setActive(readModuleFromUrl(defaultModule));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [defaultModule]);

  const selectModule = (key: ModuleKey) => {
    setActive(key);
    setModuleInUrl(key);
  };

  const badgeFor = (key: string) => {
    if (key === 'approvals' && pendingApprovals > 0) return pendingApprovals;
    if (key === 'messenger' && unreadMessages > 0) return unreadMessages;
    return 0;
  };

  const renderApp = () => {
    switch (active) {
      case 'messenger': return <MessengerApp currentUserId={user.id} />;
      case 'approvals': return <ApprovalsApp currentUserId={user.id} />;
      case 'workflows': return <WorkflowBuilderApp canEdit={canEditOrg} />;
      case 'org': return <OrgChartApp currentUserId={user.id} canEdit={canEditOrg} />;
      case 'vault': return <VaultApp />;
      case 'crm': return <CRMApp currentUserId={user.id} />;
      case 'help': return <HelpDeskApp currentUserId={user.id} currentUserName={user.name || user.email || user.id} />;
      default: return <div className="p-6 text-slate-400">Module not enabled</div>;
    }
  };

  return (
    <div className="flex h-screen">
      <aside data-workspace-sidebar className="w-16 md:w-60 bg-brandNavy-950 flex flex-col items-center md:items-stretch py-4 shrink-0 border-r border-brandNavy-800">
        <div className="px-2 md:px-4 mb-6 w-full flex flex-col items-center md:items-start gap-2">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-9 w-9 md:h-10 md:w-auto md:max-w-[9rem] object-contain rounded-lg bg-white/5"
            />
          ) : (
            <div
              className="h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center text-xs font-extrabold text-slate-950"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {companyInitials(branding.companyName)}
            </div>
          )}
          <div className="hidden md:block min-w-0 w-full">
            <div className="text-white font-bold text-sm truncate">{branding.companyName}</div>
            {branding.tagline && (
              <div className="text-slate-400 text-[11px] truncate">{branding.tagline}</div>
            )}
            <div className="text-slate-500 text-[11px] truncate mt-1">{user.name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2 w-full">
          {enabledNav.map((n) => {
            const badge = badgeFor(n.key);
            const Icon = n.Icon;
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => selectModule(n.key)}
                className={`w-full flex items-center gap-2.5 p-2 md:px-3 rounded-xl text-sm transition-colors ${
                  active === n.key
                    ? 'ws-nav-active'
                    : 'text-slate-400 hover:bg-brandNavy-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden md:inline flex-1 text-left">{n.label}</span>
                {badge > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full min-w-[1.1rem] text-center font-bold ${
                    active === n.key ? 'bg-slate-950 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <button type="button" onClick={onLogout} className="text-xs text-slate-500 hover:text-white px-3 py-2">
          Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-hidden">
        {enabledNav.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">No modules enabled. Contact your administrator.</div>
        ) : renderApp()}
      </main>
    </div>
  );
}

export default function App() {
  const embedded = isEmbeddedView();
  const workspaceTenantId = getWorkspaceTenantId();
  const { user: authUser, loading } = useAuth();
  const { branding } = useWorkspaceBranding();
  const [user, setUser] = useState<CoreUser | null>(null);
  const [checkingStaff, setCheckingStaff] = useState(true);
  const [restoringSession, setRestoringSession] = useState(true);
  const [googleSsoError, setGoogleSsoError] = useState('');
  const [embedAuthRequired, setEmbedAuthRequired] = useState(false);

  useEffect(() => {
    initEmbedMode();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!workspaceTenantId) {
          setCheckingStaff(false);
          setRestoringSession(false);
          return;
        }

        if (!embedded) {
          const { completeGoogleStaffRedirect } = await import('./lib/staff-sso');
          const googleUser = await completeGoogleStaffRedirect();
          if (cancelled) return;
          if (googleUser?.email) {
            const match = await resolveCoreUserFromAuthUser(googleUser);
            await logAudit('workspace_login', { email: match.email, provider: 'google' });
            setUser(match);
            setCheckingStaff(false);
            setRestoringSession(false);
            return;
          }
        }

        const staffOk = embedded
          ? await waitForAdminStaffSession(10000)
          : await hasAdminStaffSession();

        if (cancelled) return;

        if (staffOk && auth.currentUser) {
          const match = await resolveCoreUserFromCurrentAuth();
          if (match) {
            setUser(match);
            setCheckingStaff(false);
            setRestoringSession(false);
            return;
          }
        }

        if (embedded && !staffOk) {
          setEmbedAuthRequired(true);
        }
      } catch (err) {
        if (cancelled) return;
        setGoogleSsoError(err instanceof Error ? err.message : 'Google sign-in failed');
      } finally {
        if (!cancelled) setCheckingStaff(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embedded, workspaceTenantId]);

  useEffect(() => {
    if (loading || checkingStaff || user) {
      setRestoringSession(false);
      return;
    }

    const restoreWorkspaceSession = async () => {
      try {
        const match = await resolveCoreUserFromCurrentAuth();
        if (match) {
          setUser(match);
        }
      } catch (err) {
        console.warn('Workspace session restore failed:', err);
      } finally {
        setRestoringSession(false);
      }
    };

    restoreWorkspaceSession();
  }, [loading, checkingStaff, user, authUser]);

  const logout = async () => {
    await logAudit('workspace_logout', { email: user?.email });
    await signOut(auth);
    setUser(null);
    if (embedded) setEmbedAuthRequired(true);
  };

  if (!embedded && !workspaceTenantId) {
    return <WorkspaceTenantLanding />;
  }

  if (loading || checkingStaff || restoringSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-brandNavy-950 text-white">
        <div className="animate-pulse font-medium ws-brand-text">Connecting to workspace...</div>
      </div>
    );
  }

  if (embedded && embedAuthRequired && !user) {
    return <EmbedAuthPrompt />;
  }

  return (
    <Routes>
      <Route path="/" element={
        user
          ? <Shell user={user} onLogout={logout} branding={branding} />
          : (
            <LoginPage
              onLogin={setUser}
              googleSsoError={googleSsoError}
              embedded={embedded}
              branding={branding}
            />
          )
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
