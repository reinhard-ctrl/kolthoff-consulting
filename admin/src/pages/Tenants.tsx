import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, setDoc, doc, collection } from 'firebase/firestore';
import { db, bootstrapAuth, functions, httpsCallable } from '../lib/firebase';

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface WorkspaceInstance {
  tenantId: string;
  clientName: string;
  status?: string;
  workspaceUrl?: string;
  internal?: boolean;
}

const INTERNAL_WORKSPACE: WorkspaceInstance = {
  tenantId: 'kolthoff-admin-app',
  clientName: 'Kolthoff Internal',
  status: 'active',
  internal: true,
};

function slugifyClientName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `client-${slug}` : '';
}

export default function Tenants() {
  const [tenantId, setTenantId] = useState('kolthoff-admin-app');
  const [workspaces, setWorkspaces] = useState<WorkspaceInstance[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [features, setFeatures] = useState({ messenger: true, approvals: true, vault: false, crm: false });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviting, setInviting] = useState(false);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newTenantId, setNewTenantId] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  useEffect(() => {
    const registryRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'core_workspaces');
    return onSnapshot(registryRef, (snap) => {
      const list: WorkspaceInstance[] = [];
      snap.forEach((d) => {
        const data = d.data() as WorkspaceInstance;
        list.push({ ...data, tenantId: data.tenantId || d.id });
      });
      list.sort((a, b) => a.clientName.localeCompare(b.clientName));
      setWorkspaces(list);
    });
  }, []);

  useEffect(() => {
    const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
    const usersRef = collection(db, 'artifacts', tenantId, 'public', 'data', 'core_users');

    const u1 = onSnapshot(configRef, (snap) => {
      if (snap.exists() && snap.data().features) setFeatures(snap.data().features);
    });
    const u2 = onSnapshot(usersRef, (snap) => {
      const list: TenantUser[] = [];
      snap.forEach((d) => list.push(d.data() as TenantUser));
      setUsers(list);
    });
    return () => { u1(); u2(); };
  }, [tenantId]);

  const allWorkspaces = useMemo(
    () => [INTERNAL_WORKSPACE, ...workspaces.filter((w) => w.tenantId !== INTERNAL_WORKSPACE.tenantId)],
    [workspaces],
  );

  const activeWorkspace = allWorkspaces.find((w) => w.tenantId === tenantId);

  const toggleFeature = async (key: keyof typeof features) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    await setDoc(doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config'), { features: updated }, { merge: true });
  };

  const provisionUser = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteStatus('');
    try {
      await bootstrapAuth();
      const invite = httpsCallable(functions, 'inviteWorkspaceUser');
      const result = await invite({
        email: inviteEmail.trim(),
        name: inviteName || inviteEmail.trim(),
        tenantId,
        role: 'user',
      });
      const sent = (result.data as { passwordEmailSent?: boolean })?.passwordEmailSent;
      setInviteStatus(
        sent
          ? `Invited ${inviteEmail}. A password setup link was emailed to them.`
          : `Invited ${inviteEmail}. Could not email password link — use Reset password below or ask them to use "Forgot password" at /workspace/.`,
      );
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invite failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg);
    } finally {
      setInviting(false);
    }
  };

  const sendPasswordReset = async (userEmail: string) => {
    setResettingEmail(userEmail);
    setInviteStatus('');
    try {
      await bootstrapAuth();
      const reset = httpsCallable(functions, 'sendWorkspacePasswordReset');
      const result = await reset({ email: userEmail, tenantId });
      setInviteStatus((result.data as { message?: string })?.message || `Password reset sent to ${userEmail}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg);
    } finally {
      setResettingEmail(null);
    }
  };

  const createClientWorkspace = async () => {
    if (!newClientName.trim()) return;
    setCreatingWorkspace(true);
    setInviteStatus('');
    try {
      await bootstrapAuth();
      const create = httpsCallable(functions, 'createClientWorkspace');
      const result = await create({
        clientName: newClientName.trim(),
        tenantId: newTenantId.trim() || undefined,
      });
      const data = result.data as { tenantId: string; clientName: string; workspaceUrl?: string };
      setTenantId(data.tenantId);
      setInviteStatus(`Created workspace for ${data.clientName}. Open it below to invite users and configure modules.`);
      setShowCreateModal(false);
      setNewClientName('');
      setNewTenantId('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg.includes('already-exists')
          ? 'That tenant ID already exists. Choose a different slug.'
          : msg);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const openCreateModal = () => {
    setNewClientName('');
    setNewTenantId('');
    setShowCreateModal(true);
  };

  const workspaceHref = tenantId === 'kolthoff-admin-app'
    ? '/workspace/'
    : `/workspace/?tenant=${encodeURIComponent(tenantId)}`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tenant Manager</h1>

      <div className="glass-panel p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold">Core Workspace Instances</h2>
            <p className="text-xs text-slate-500 mt-1">Each client gets an isolated workspace tenant with its own users and feature flags.</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm"
          >
            Create Client Workspace
          </button>
        </div>
        <div className="space-y-2">
          {allWorkspaces.map((ws) => {
            const active = ws.tenantId === tenantId;
            return (
              <button
                key={ws.tenantId}
                type="button"
                onClick={() => setTenantId(ws.tenantId)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  active
                    ? 'border-brandTeal-500/60 bg-brandTeal-500/10'
                    : 'border-brandNavy-700 bg-brandNavy-900/40 hover:border-brandNavy-600'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{ws.clientName}</div>
                    <div className="font-mono text-xs text-slate-500">{ws.tenantId}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {ws.internal ? 'Internal' : ws.status || 'active'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <label className="text-sm text-slate-400">Active Tenant App ID</label>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-full mt-1 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
        />
        <div className="flex flex-wrap gap-3 mt-2 text-sm">
          <a href={workspaceHref} target="_blank" rel="noreferrer" className="text-brandTeal-400">
            Open workspace →
          </a>
          {activeWorkspace && (
            <span className="text-slate-500">Managing: {activeWorkspace.clientName}</span>
          )}
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <h2 className="font-bold mb-3">Feature Flags</h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(features) as (keyof typeof features)[]).map((key) => (
            <button key={key} onClick={() => toggleFeature(key)}
              className={`px-3 py-1 rounded text-sm capitalize ${features[key] ? 'bg-brandTeal-500/20 text-brandTeal-400 border border-brandTeal-500/50' : 'bg-brandNavy-800 text-slate-500'}`}>
              {key}: {features[key] ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <h2 className="font-bold mb-3">Invite Workspace User</h2>
        <p className="text-xs text-slate-500 mb-3">Creates Firebase Auth user + core_users doc and emails a password setup link. Requires Email/Password sign-in enabled.</p>
        <div className="flex gap-2 flex-wrap">
          <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Name" className="p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm" />
          <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className="p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm" />
          <button onClick={provisionUser} disabled={inviting} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm disabled:opacity-50">
            {inviting ? 'Inviting...' : 'Invite User'}
          </button>
        </div>
        {inviteStatus && <p className="text-xs mt-2 text-slate-400">{inviteStatus}</p>}
      </div>

      <div className="glass-panel p-4">
        <h2 className="font-bold mb-3">Users ({users.length})</h2>
        {users.length === 0 && (
          <p className="text-sm text-slate-500 mb-3">No users yet. Invite the client team after creating their workspace.</p>
        )}
        {users.map((u) => (
          <div key={u.id} className="flex justify-between items-center gap-3 py-2 border-b border-brandNavy-800 text-sm">
            <span>{u.name} <span className="text-slate-500">({u.email})</span></span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => sendPasswordReset(u.email)}
                disabled={resettingEmail === u.email}
                className="px-2 py-1 text-xs rounded border border-brandNavy-700 text-slate-400 hover:text-white disabled:opacity-50"
              >
                {resettingEmail === u.email ? 'Sending...' : 'Reset password'}
              </button>
              <span className="text-brandTeal-400 uppercase text-xs">{u.role}</span>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-2">Create Client Workspace</h2>
            <p className="text-xs text-slate-500 mb-4">
              Provisions a new isolated Core Workspace instance with default modules enabled (Messenger, Approvals, Policies).
            </p>
            <label className="text-sm text-slate-400 block mb-1">Client name</label>
            <input
              value={newClientName}
              onChange={(e) => {
                setNewClientName(e.target.value);
                if (!newTenantId || newTenantId === slugifyClientName(newClientName)) {
                  setNewTenantId(slugifyClientName(e.target.value));
                }
              }}
              placeholder="Acme Corp"
              className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm mb-3"
            />
            <label className="text-sm text-slate-400 block mb-1">Tenant ID</label>
            <input
              value={newTenantId}
              onChange={(e) => setNewTenantId(e.target.value.trim().toLowerCase())}
              placeholder="client-acme-corp"
              className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm mb-4"
            />
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded text-sm border border-brandNavy-700 text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createClientWorkspace}
                disabled={creatingWorkspace || !newClientName.trim() || !newTenantId.trim()}
                className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm disabled:opacity-50"
              >
                {creatingWorkspace ? 'Creating...' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
