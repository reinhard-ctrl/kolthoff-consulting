import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { signOut, auth, logAudit, hasAdminStaffSession, waitForAdminStaffSession } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { useTenantFeatures } from './hooks/useTenant';
import { useWorkspaceBadges } from './hooks/useWorkspaceBadges';
import { isEmbeddedView, initEmbedMode } from './lib/embed-mode';
import { resolveCoreUserFromAuthUser, resolveCoreUserFromCurrentAuth, type CoreUser } from './lib/core-user';
import LoginPage from './components/LoginPage';
import EmbedAuthPrompt from './components/EmbedAuthPrompt';
import MessengerApp from './apps/MessengerApp';
import ApprovalsApp from './apps/ApprovalsApp';
import VaultApp from './apps/VaultApp';
import CRMApp from './apps/CRMApp';

const NAV = [
  { key: 'messenger', label: 'Messenger', icon: '💬', feature: 'messenger' as const },
  { key: 'approvals', label: 'Approvals', icon: '✅', feature: 'approvals' as const },
  { key: 'vault', label: 'Policies', icon: '📋', feature: 'vault' as const },
  { key: 'crm', label: 'CRM', icon: '👥', feature: 'crm' as const },
];

function Shell({ user, onLogout }: { user: CoreUser; onLogout: () => void }) {
  const features = useTenantFeatures();
  const { pendingApprovals, unreadMessages } = useWorkspaceBadges(user.id);
  const [active, setActive] = useState('messenger');
  const enabledNav = NAV.filter((n) => features[n.feature]);

  const badgeFor = (key: string) => {
    if (key === 'approvals' && pendingApprovals > 0) return pendingApprovals;
    if (key === 'messenger' && unreadMessages > 0) return unreadMessages;
    return 0;
  };

  const renderApp = () => {
    switch (active) {
      case 'messenger': return <MessengerApp currentUserId={user.id} />;
      case 'approvals': return <ApprovalsApp currentUserId={user.id} />;
      case 'vault': return <VaultApp />;
      case 'crm': return <CRMApp currentUserId={user.id} />;
      default: return <div className="p-6 text-slate-400">Module not enabled</div>;
    }
  };

  return (
    <div className="flex h-screen">
      <aside data-workspace-sidebar className="w-16 md:w-56 bg-slate-900 flex flex-col items-center md:items-stretch py-4 shrink-0">
        <div className="hidden md:block px-4 mb-6">
          <div className="text-white font-bold text-sm">Workspace</div>
          <div className="text-slate-400 text-xs truncate">{user.name}</div>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {enabledNav.map((n) => {
            const badge = badgeFor(n.key);
            return (
            <button key={n.key} onClick={() => setActive(n.key)}
              className={`w-full flex items-center gap-2 p-2 md:px-3 rounded-xl text-sm transition-colors ${active === n.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span>{n.icon}</span>
              <span className="hidden md:inline flex-1 text-left">{n.label}</span>
              {badge > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full min-w-[1.1rem] text-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
            );
          })}
        </nav>
        <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white px-2 py-2">Sign out</button>
      </aside>
      <main className="flex-1 overflow-hidden bg-slate-50">
        {enabledNav.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">No modules enabled. Contact your administrator.</div>
        ) : renderApp()}
      </main>
    </div>
  );
}

export default function App() {
  const embedded = isEmbeddedView();
  const { user: authUser, loading } = useAuth();
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
  }, [embedded]);

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

  if (loading || checkingStaff || restoringSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Connecting to workspace...</div>
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
          ? <Shell user={user} onLogout={logout} />
          : <LoginPage onLogin={setUser} googleSsoError={googleSsoError} embedded={embedded} />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
