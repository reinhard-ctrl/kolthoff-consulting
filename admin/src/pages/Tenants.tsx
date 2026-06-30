import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, setDoc, doc, collection } from 'firebase/firestore';
import { db, bootstrapAuth, functions, httpsCallable } from '../lib/firebase';

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface RemoveTarget {
  id: string;
  email: string;
  name: string;
}

interface WorkspaceInstance {
  tenantId: string;
  clientName: string;
  status?: string;
  workspaceUrl?: string;
  portalAccessCode?: string;
  portalUrl?: string;
  internal?: boolean;
}

interface PrepareResult {
  tenantId: string;
  clientName: string;
  workspaceUrl: string;
  portalUrl: string;
  portalAccessCode: string;
  portalDelivered: boolean;
  passwordEmailSent: boolean;
  mailtoUrl?: string;
  message: string;
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

function derivePortalCode(clientName: string, tenantId: string): string {
  const fromName = clientName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (fromName) return fromName;
  return tenantId.replace('client-', '').toUpperCase().slice(0, 24);
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
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [revokeAuthOnRemove, setRevokeAuthOnRemove] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newTenantId, setNewTenantId] = useState('');
  const [newPortalCode, setNewPortalCode] = useState('');
  const [newRepName, setNewRepName] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');
  const [deliverViaPortal, setDeliverViaPortal] = useState(true);
  const [inviteContact, setInviteContact] = useState(true);
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [publishingPortal, setPublishingPortal] = useState(false);

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
        : msg.includes('not-found')
          ? 'User not found in this workspace tenant.'
          : msg);
    } finally {
      setResettingEmail(null);
    }
  };

  const removeMember = async () => {
    if (!removeTarget) return;
    setRemovingUserId(removeTarget.id);
    setInviteStatus('');
    try {
      await bootstrapAuth();
      const remove = httpsCallable(functions, 'removeWorkspaceUser');
      const result = await remove({
        userId: removeTarget.id,
        email: removeTarget.email,
        tenantId,
        revokeAuth: revokeAuthOnRemove,
      });
      setInviteStatus((result.data as { message?: string })?.message || `${removeTarget.email} removed.`);
      setRemoveTarget(null);
      setRevokeAuthOnRemove(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Remove failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg);
    } finally {
      setRemovingUserId(null);
    }
  };

  const createClientWorkspace = async () => {
    if (!newClientName.trim()) return;
    setCreatingWorkspace(true);
    setInviteStatus('');
    setPrepareResult(null);
    try {
      await bootstrapAuth();
      const prepare = httpsCallable(functions, 'prepareClientWorkspace');
      const result = await prepare({
        clientName: newClientName.trim(),
        tenantId: newTenantId.trim() || undefined,
        portalAccessCode: newPortalCode.trim() || undefined,
        repName: newRepName.trim() || undefined,
        repEmail: newRepEmail.trim() || undefined,
        deliverViaPortal,
        inviteContact: inviteContact && !!newRepEmail.trim(),
      });
      const data = result.data as PrepareResult;
      setTenantId(data.tenantId);
      setPrepareResult(data);
      setInviteStatus(data.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Prepare failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const publishActiveToPortal = async () => {
    if (tenantId === INTERNAL_WORKSPACE.tenantId || !activeWorkspace) return;
    setPublishingPortal(true);
    setInviteStatus('');
    try {
      await bootstrapAuth();
      const prepare = httpsCallable(functions, 'prepareClientWorkspace');
      const result = await prepare({
        clientName: activeWorkspace.clientName,
        tenantId,
        portalAccessCode: activeWorkspace.portalAccessCode || derivePortalCode(activeWorkspace.clientName, tenantId),
        deliverViaPortal: true,
        inviteContact: false,
      });
      const data = result.data as PrepareResult;
      setPrepareResult(data);
      setInviteStatus(data.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg);
    } finally {
      setPublishingPortal(false);
    }
  };

  const openCreateModal = () => {
    setNewClientName('');
    setNewTenantId('');
    setNewPortalCode('');
    setNewRepName('');
    setNewRepEmail('');
    setDeliverViaPortal(true);
    setInviteContact(true);
    setPrepareResult(null);
    setShowCreateModal(true);
  };

  const syncPortalCode = (clientName: string, tenantSlug: string) => {
    setNewPortalCode((current) => {
      if (!current || current === derivePortalCode(newClientName, newTenantId || tenantSlug)) {
        return derivePortalCode(clientName, tenantSlug);
      }
      return current;
    });
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setInviteStatus(`Copied ${label} to clipboard.`);
    } catch {
      setInviteStatus(`Copy failed — select and copy manually: ${value}`);
    }
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
            Prepare Client Workspace
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
                    {ws.internal ? 'Internal' : ws.portalAccessCode ? `Portal ${ws.portalAccessCode}` : ws.status || 'active'}
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
        <div className="flex flex-wrap gap-3 mt-2 text-sm items-center">
          <a href={workspaceHref} target="_blank" rel="noreferrer" className="text-brandTeal-400">
            Open workspace →
          </a>
          {tenantId !== INTERNAL_WORKSPACE.tenantId && (
            <button
              type="button"
              onClick={publishActiveToPortal}
              disabled={publishingPortal}
              className="text-brandTeal-400 hover:text-brandTeal-300 disabled:opacity-50"
            >
              {publishingPortal ? 'Publishing...' : 'Publish link to Client Portal →'}
            </button>
          )}
          {activeWorkspace && (
            <span className="text-slate-500">Managing: {activeWorkspace.clientName}</span>
          )}
        </div>
        {activeWorkspace?.workspaceUrl && tenantId !== INTERNAL_WORKSPACE.tenantId && (
          <div className="mt-3 p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50 text-xs space-y-1">
            <div className="text-slate-400">Client workspace link</div>
            <div className="font-mono text-brandTeal-400 break-all">{activeWorkspace.workspaceUrl}</div>
            {activeWorkspace.portalAccessCode && (
              <div className="text-slate-500">Client Portal code: <span className="font-mono text-slate-300">{activeWorkspace.portalAccessCode}</span></div>
            )}
          </div>
        )}
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
                disabled={resettingEmail === u.email || removingUserId === u.id}
                className="px-2 py-1 text-xs rounded border border-brandNavy-700 text-slate-400 hover:text-white disabled:opacity-50"
              >
                {resettingEmail === u.email ? 'Sending...' : 'Reset password'}
              </button>
              <button
                type="button"
                onClick={() => setRemoveTarget({ id: u.id, email: u.email, name: u.name })}
                disabled={removingUserId === u.id}
                className="px-2 py-1 text-xs rounded border border-rose-900/60 text-rose-400 hover:text-rose-300 disabled:opacity-50"
              >
                {removingUserId === u.id ? 'Removing...' : 'Remove'}
              </button>
              <span className="text-brandTeal-400 uppercase text-xs">{u.role}</span>
            </div>
          </div>
        ))}
      </div>

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-2">Remove workspace member?</h2>
            <p className="text-sm text-slate-400 mb-4">
              Remove <strong className="text-white">{removeTarget.name}</strong> ({removeTarget.email}) from this workspace tenant.
              They will no longer be able to sign in here.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <input
                type="checkbox"
                checked={revokeAuthOnRemove}
                onChange={(e) => setRevokeAuthOnRemove(e.target.checked)}
              />
              Also sign them out everywhere (revoke active sessions)
            </label>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setRemoveTarget(null);
                  setRevokeAuthOnRemove(false);
                }}
                className="px-4 py-2 rounded text-sm border border-brandNavy-700 text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeMember}
                disabled={removingUserId === removeTarget.id}
                className="px-4 py-2 bg-rose-600 text-white rounded font-bold text-sm disabled:opacity-50"
              >
                {removingUserId === removeTarget.id ? 'Removing...' : 'Remove member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="glass-panel p-6 w-full max-w-2xl my-8">
            <h2 className="text-lg font-bold mb-2">Prepare Client Workspace</h2>
            <p className="text-xs text-slate-500 mb-4">
              Creates the workspace tenant, publishes the link on the Client Portal (recommended), and optionally invites the primary contact by email.
            </p>

            {!prepareResult ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Client name</label>
                    <input
                      value={newClientName}
                      onChange={(e) => {
                        const name = e.target.value;
                        setNewClientName(name);
                        const tenantSlug = slugifyClientName(name);
                        if (!newTenantId || newTenantId === slugifyClientName(newClientName)) {
                          setNewTenantId(tenantSlug);
                        }
                        syncPortalCode(name, tenantSlug || newTenantId);
                      }}
                      placeholder="Acme Corp"
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Tenant ID</label>
                    <input
                      value={newTenantId}
                      onChange={(e) => {
                        const tenantSlug = e.target.value.trim().toLowerCase();
                        setNewTenantId(tenantSlug);
                        syncPortalCode(newClientName, tenantSlug);
                      }}
                      placeholder="client-acme-corp"
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Client Portal access code</label>
                    <input
                      value={newPortalCode}
                      onChange={(e) => setNewPortalCode(e.target.value.toUpperCase())}
                      placeholder="ACME-CORP"
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Primary contact name</label>
                    <input
                      value={newRepName}
                      onChange={(e) => setNewRepName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-slate-400 block mb-1">Primary contact email</label>
                    <input
                      type="email"
                      value={newRepEmail}
                      onChange={(e) => setNewRepEmail(e.target.value)}
                      placeholder="jane@client.com"
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-xs text-slate-400">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={deliverViaPortal} onChange={(e) => setDeliverViaPortal(e.target.checked)} />
                    Publish Core Workspace link on Client Portal (recommended)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteContact}
                      onChange={(e) => setInviteContact(e.target.checked)}
                      disabled={!newRepEmail.trim()}
                    />
                    Invite primary contact and email password setup link
                  </label>
                </div>

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
                    {creatingWorkspace ? 'Preparing...' : 'Prepare & Deliver'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-brandTeal-400">{prepareResult.message}</p>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
                    <div className="text-slate-500 mb-1">Core Workspace</div>
                    <div className="font-mono text-slate-200 break-all">{prepareResult.workspaceUrl}</div>
                    <button type="button" onClick={() => copyText('workspace link', prepareResult.workspaceUrl)} className="mt-2 text-brandTeal-400 underline">
                      Copy link
                    </button>
                  </div>
                  {prepareResult.portalDelivered && (
                    <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
                      <div className="text-slate-500 mb-1">Client Portal</div>
                      <div className="font-mono text-slate-200 break-all">{prepareResult.portalUrl}</div>
                      <div className="mt-2 text-slate-400">Access code: <span className="font-mono text-white">{prepareResult.portalAccessCode}</span></div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <button type="button" onClick={() => copyText('portal URL', prepareResult.portalUrl)} className="text-brandTeal-400 underline">
                          Copy portal URL
                        </button>
                        <button type="button" onClick={() => copyText('access code', prepareResult.portalAccessCode)} className="text-brandTeal-400 underline">
                          Copy access code
                        </button>
                      </div>
                    </div>
                  )}
                  {prepareResult.mailtoUrl && (
                    <a href={prepareResult.mailtoUrl} className="inline-block px-4 py-2 rounded border border-brandNavy-700 text-sm text-slate-300 hover:text-white">
                      Open email draft to client
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
