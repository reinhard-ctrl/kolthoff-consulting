import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { signOut, auth, logAudit, hasAdminStaffSession } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { useTenantFeatures } from './hooks/useTenant';
import LoginPage from './components/LoginPage';
import MessengerApp from './apps/MessengerApp';
import ApprovalsApp from './apps/ApprovalsApp';
import VaultApp from './apps/VaultApp';
import CRMApp from './apps/CRMApp';

interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const NAV = [
  { key: 'messenger', label: 'Messenger', icon: '💬', feature: 'messenger' as const },
  { key: 'approvals', label: 'Approvals', icon: '✅', feature: 'approvals' as const },
  { key: 'vault', label: 'Policies', icon: '📋', feature: 'vault' as const },
  { key: 'crm', label: 'CRM', icon: '👥', feature: 'crm' as const },
];

function Shell({ user, onLogout }: { user: CoreUser; onLogout: () => void }) {
  const features = useTenantFeatures();
  const [active, setActive] = useState('messenger');
  const enabledNav = NAV.filter((n) => features[n.feature]);

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
      <aside className="w-16 md:w-56 bg-slate-900 flex flex-col items-center md:items-stretch py-4 shrink-0">
        <div className="hidden md:block px-4 mb-6">
          <div className="text-white font-bold text-sm">Workspace</div>
          <div className="text-slate-400 text-xs truncate">{user.name}</div>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {enabledNav.map((n) => (
            <button key={n.key} onClick={() => setActive(n.key)}
              className={`w-full flex items-center gap-2 p-2 md:px-3 rounded-xl text-sm transition-colors ${active === n.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span>{n.icon}</span>
              <span className="hidden md:inline">{n.label}</span>
            </button>
          ))}
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
  const { loading } = useAuth();
  const [user, setUser] = useState<CoreUser | null>(null);
  const [checkingStaff, setCheckingStaff] = useState(true);

  useEffect(() => {
    hasAdminStaffSession().then((ok) => {
      if (ok && auth.currentUser) {
        setUser({
          id: auth.currentUser.uid,
          email: 'staff@kolthoff-consulting.com',
          name: 'Kolthoff Staff',
          role: 'kolthoff_admin',
        });
      }
      setCheckingStaff(false);
    });
  }, []);

  const logout = async () => {
    await logAudit('workspace_logout', { email: user?.email });
    await signOut(auth);
    setUser(null);
  };

  if (loading || checkingStaff) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Connecting to workspace...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        user ? <Shell user={user} onLogout={logout} /> : <LoginPage onLogin={setUser} />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
