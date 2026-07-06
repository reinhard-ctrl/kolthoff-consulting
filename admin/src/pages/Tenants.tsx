import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { onSnapshot, setDoc, doc, collection, deleteDoc, getDocs } from 'firebase/firestore';
import { db, bootstrapAuth, functions, httpsCallable, adminAppId } from '../lib/firebase';
import { cancelWorkspaceTenant } from '../lib/workspace-cancel';
import { deleteWorkspaceTenant } from '../lib/workspace-delete';
import {
  INTERNAL_WORKSPACE_TENANT,
  isWorkspaceTenantCancelled,
  workspaceStatusLabel,
} from '../lib/workspace-tenant-status';

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
  createdAt?: number;
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

interface MasterTemplate {
  id: string;
  name?: string;
  type?: string;
  fields?: unknown[];
}

interface ItTicket {
  id: string;
  tenantId?: string;
  subject?: string;
  description?: string;
  status?: string;
  timestamp?: number;
  requesterName?: string;
}

type WorkspaceTab = 'instances' | 'access' | 'support' | 'blueprints';

const INTERNAL_WORKSPACE: WorkspaceInstance = {
  tenantId: INTERNAL_WORKSPACE_TENANT,
  clientName: 'Kolthoff Internal',
  status: 'active',
  internal: true,
};

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'instances', label: 'Instances' },
  { id: 'access', label: 'Users & Flags' },
  { id: 'support', label: 'IT Support' },
  { id: 'blueprints', label: 'Blueprints' },
];

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

function parseTab(value: string | null): WorkspaceTab {
  if (value === 'access' || value === 'support' || value === 'blueprints') return value;
  return 'instances';
}

export default function Tenants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  const [tenantId, setTenantId] = useState(INTERNAL_WORKSPACE_TENANT);
  const [workspaces, setWorkspaces] = useState<WorkspaceInstance[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [features, setFeatures] = useState({ messenger: true, approvals: true, vault: false, crm: false });
  const [templates, setTemplates] = useState<MasterTemplate[]>([]);
  const [tickets, setTickets] = useState<ItTicket[]>([]);
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
  const [nukeBusy, setNukeBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<WorkspaceInstance | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceInstance | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const setTab = (tab: WorkspaceTab) => {
    if (tab === 'instances') setSearchParams({});
    else setSearchParams({ tab });
  };

  useEffect(() => {
    const registryRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'core_workspaces');
    return onSnapshot(registryRef, (snap) => {
      const list: WorkspaceInstance[] = [];
      snap.forEach((d) => {
        const data = d.data() as WorkspaceInstance;
        list.push({ ...data, tenantId: data.tenantId || d.id });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWorkspaces(list);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'artifacts', adminAppId, 'public', 'data', 'master_templates'), (snap) => {
      const list: MasterTemplate[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MasterTemplate));
      setTemplates(list);
    });
  }, []);

  useEffect(() => {
    const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
    const usersRef = collection(db, 'artifacts', tenantId, 'public', 'data', 'core_users');
    const ticketsRef = collection(db, 'artifacts', tenantId, 'public', 'data', 'core_it_requests');

    const u1 = onSnapshot(configRef, (snap) => {
      if (snap.exists() && snap.data().features) setFeatures(snap.data().features);
    });
    const u2 = onSnapshot(usersRef, (snap) => {
      const list: TenantUser[] = [];
      snap.forEach((d) => list.push(d.data() as TenantUser));
      setUsers(list);
    });
    const u3 = onSnapshot(ticketsRef, (snap) => {
      const list: ItTicket[] = [];
      snap.forEach((d) => list.push({ id: d.id, tenantId, ...d.data() } as ItTicket));
      setTickets(list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });
    return () => { u1(); u2(); u3(); };
  }, [tenantId]);

  const allWorkspaces = useMemo(
    () => [INTERNAL_WORKSPACE, ...workspaces.filter((w) => w.tenantId !== INTERNAL_WORKSPACE.tenantId)],
    [workspaces],
  );

  const clientWorkspaces = useMemo(
    () => workspaces.filter((w) => w.tenantId !== INTERNAL_WORKSPACE.tenantId),
    [workspaces],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const workspaceStatusClass = (workspace: WorkspaceInstance) => {
    const label = workspaceStatusLabel(workspace);
    if (label === 'cancelled') return 'text-rose-400';
    if (label === 'active') return 'text-emerald-400';
    return 'text-brandAmber-300';
  };

  const workspaceHrefFor = (id: string) => (
    id === INTERNAL_WORKSPACE_TENANT
      ? '/workspace/'
      : `/workspace/?tenant=${encodeURIComponent(id)}`
  );

  const openDeleteWorkspace = (workspace: WorkspaceInstance) => {
    setDeleteConfirmText('');
    setDeleteTarget(workspace);
  };

  const runCancelWorkspace = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.tenantId);
    try {
      await bootstrapAuth();
      const data = await cancelWorkspaceTenant({ tenantId: cancelTarget.tenantId });
      setCancelTarget(null);
      showToast(data.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancellingId(null);
    }
  };

  const runDeleteWorkspace = async () => {
    if (!deleteTarget || deleteConfirmText.trim() !== deleteTarget.tenantId) return;
    setDeletingId(deleteTarget.tenantId);
    try {
      await bootstrapAuth();
      const data = await deleteWorkspaceTenant({ tenantId: deleteTarget.tenantId });
      if (tenantId === deleteTarget.tenantId) {
        setTenantId(INTERNAL_WORKSPACE_TENANT);
      }
      setDeleteTarget(null);
      setDeleteConfirmText('');
      showToast(data.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeletingId(null);
    }
  };

  const activeWorkspace = allWorkspaces.find((w) => w.tenantId === tenantId);
  const openTickets = tickets.filter((t) => t.status === 'open').length;

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
    if (tenantId === INTERNAL_WORKSPACE_TENANT || !activeWorkspace) return;
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

  const updateTicketStatus = async (ticketId: string, status: string) => {
    await setDoc(
      doc(db, 'artifacts', tenantId, 'public', 'data', 'core_it_requests', ticketId),
      { status },
      { merge: true },
    );
    setInviteStatus('Ticket updated.');
  };

  const deleteTemplate = async (id: string) => {
    await deleteDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'master_templates', id));
    setInviteStatus('Blueprint deleted.');
  };

  const nukeTenantData = async () => {
    if (!tenantId || tenantId === INTERNAL_WORKSPACE_TENANT) return;
    if (!confirm(`This permanently deletes workspace data for ${tenantId}. Continue?`)) return;
    const typed = prompt(`Type ${tenantId} to confirm deletion:`);
    if (typed !== tenantId) {
      setInviteStatus('Deletion cancelled — tenant ID did not match.');
      return;
    }
    setNukeBusy(true);
    try {
      const cols = ['core_users', 'core_departments', 'core_requests', 'core_templates', 'core_policies', 'core_it_requests'];
      for (const col of cols) {
        const snap = await getDocs(collection(db, 'artifacts', tenantId, 'public', 'data', col));
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      }
      setInviteStatus(`Workspace data cleared for ${tenantId}.`);
    } finally {
      setNukeBusy(false);
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

  const workspaceHref = workspaceHrefFor(tenantId);

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Workspace Admin</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Provision client Core Workspaces, manage portal delivery, and handle users, feature flags, IT tickets, and blueprints.
          </p>
        </div>
        {activeTab === 'instances' && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded-lg text-xs font-bold uppercase shadow-sm"
          >
            Provision Workspace
          </button>
        )}
      </div>

      {activeTab !== 'instances' && activeWorkspace && (
        <div className="glass-panel p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Managing workspace</div>
              <div className="font-semibold text-white">{activeWorkspace.clientName}</div>
              <div className="font-mono text-xs text-slate-500">{activeWorkspace.tenantId}</div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => setTab('instances')} className="text-slate-400 hover:text-white text-xs font-bold uppercase">
                ← All workspaces
              </button>
              <a href={workspaceHref} target="_blank" rel="noreferrer" className="text-brandTeal-400 text-xs font-bold hover:underline">
                Open workspace
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === tab.id
                ? 'bg-brandTeal-500 text-brandNavy-955 font-bold'
                : 'bg-brandNavy-800 text-slate-400'
            }`}
          >
            {tab.label}
            {tab.id === 'support' && openTickets > 0 ? ` (${openTickets} open)` : ''}
            {tab.id === 'blueprints' ? ` (${templates.length})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'instances' && (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">Client</th>
                <th className="p-4">Tenant ID</th>
                <th className="p-4">Portal Code</th>
                <th className="p-4">Status</th>
                <th className="p-4">Workspace</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandNavy-800">
              {allWorkspaces.map((ws) => (
                <tr key={ws.tenantId} className="hover:bg-brandNavy-800/30">
                  <td className="p-4 font-bold">
                    {ws.clientName}
                    {ws.internal && (
                      <span className="block text-[10px] text-slate-500 font-normal uppercase tracking-wide mt-0.5">Internal</span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-400">{ws.tenantId}</td>
                  <td className="p-4 font-mono text-xs">
                    {ws.portalAccessCode ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ws.portalAccessCode!);
                          showToast('Portal code copied.');
                        }}
                        className="text-brandAmber-300 hover:underline"
                        title="Copy portal code"
                      >
                        {ws.portalAccessCode}
                      </button>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`${workspaceStatusClass(ws)} text-xs uppercase font-bold`}>
                      {workspaceStatusLabel(ws)}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-500 max-w-[12rem] truncate">
                    {ws.workspaceUrl || workspaceHrefFor(ws.tenantId)}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isWorkspaceTenantCancelled(ws) && (
                        <a
                          href={workspaceHrefFor(ws.tenantId)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brandTeal-400 text-xs font-bold hover:underline"
                        >
                          Open workspace
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTenantId(ws.tenantId);
                          setTab('access');
                        }}
                        className="text-slate-400 hover:text-brandTeal-300 text-xs font-bold uppercase tracking-wide"
                      >
                        Manage
                      </button>
                      {!ws.internal && !isWorkspaceTenantCancelled(ws) && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(ws)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wide"
                        >
                          Cancel account
                        </button>
                      )}
                      {!ws.internal && (
                        <button
                          type="button"
                          onClick={() => openDeleteWorkspace(ws)}
                          className="text-slate-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wide"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientWorkspaces.length === 0 && (
            <p className="p-6 text-slate-500 italic">
              No client workspaces yet.{' '}
              <button type="button" onClick={openCreateModal} className="text-brandTeal-400 underline">Provision Workspace</button>.
            </p>
          )}
        </div>
      )}

      {activeTab === 'access' && (
        <>
          {tenantId !== INTERNAL_WORKSPACE_TENANT && activeWorkspace && (
            <div className="glass-panel p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400 space-y-1">
                  {activeWorkspace.workspaceUrl && (
                    <div className="font-mono text-brandTeal-400 break-all">{activeWorkspace.workspaceUrl}</div>
                  )}
                  {activeWorkspace.portalAccessCode && (
                    <div>Portal code: <span className="font-mono text-slate-300">{activeWorkspace.portalAccessCode}</span></div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={publishActiveToPortal}
                  disabled={publishingPortal}
                  className="px-4 py-2 bg-brandNavy-800 hover:bg-brandNavy-750 text-brandTeal-400 rounded text-xs font-bold uppercase disabled:opacity-50"
                >
                  {publishingPortal ? 'Publishing…' : 'Publish to Client Portal'}
                </button>
              </div>
            </div>
          )}

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
        </>
      )}

      {activeTab === 'support' && (
        <>
          <div className="glass-panel overflow-hidden mb-6">
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Requester</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandNavy-800">
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="p-4">
                      <div className="font-bold">{t.subject || 'Support Request'}</div>
                      <div className="text-xs text-slate-500 truncate max-w-md">{t.description}</div>
                    </td>
                    <td className="p-4 text-xs">{t.requesterName || '—'}</td>
                    <td className="p-4 text-xs uppercase">{t.status || 'open'}</td>
                    <td className="p-4 text-right space-x-2">
                      {t.status !== 'closed' && (
                        <>
                          <button type="button" onClick={() => updateTicketStatus(t.id, 'in_progress')} className="text-xs text-brandTeal-400">In Progress</button>
                          <button type="button" onClick={() => updateTicketStatus(t.id, 'closed')} className="text-xs text-emerald-400">Close</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length === 0 && (
              <p className="p-6 text-slate-500 italic">No IT tickets for {tenantId}.</p>
            )}
          </div>

          {tenantId !== INTERNAL_WORKSPACE_TENANT && (
            <div className="glass-panel p-4 border border-rose-900/30">
              <h2 className="font-bold text-rose-400 mb-2">Danger zone</h2>
              <p className="text-xs text-slate-500 mb-3">
                Deletes users, departments, requests, templates, policies, and IT tickets for the selected tenant. Portal and registry records are not removed.
              </p>
              <button
                type="button"
                onClick={nukeTenantData}
                disabled={nukeBusy}
                className="px-4 py-2 text-rose-400 border border-rose-500/30 rounded text-sm disabled:opacity-50"
              >
                {nukeBusy ? 'Clearing...' : 'Clear tenant workspace data'}
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'blueprints' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 mb-2">Global master blueprints stored on the admin tenant. Deploy-to-tenant designer is planned.</p>
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="glass-panel p-4 flex justify-between items-center">
              <div>
                <div className="font-bold">{tmpl.name || tmpl.id}</div>
                <div className="text-xs text-slate-500">{tmpl.type || 'template'} · {tmpl.fields?.length || 0} fields</div>
              </div>
              <button type="button" onClick={() => deleteTemplate(tmpl.id)} className="text-red-400 text-xs">Delete</button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-slate-500 italic">No master blueprints yet.</p>}
        </div>
      )}

      {inviteStatus && <p className="text-xs mt-4 text-slate-400">{inviteStatus}</p>}

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

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full">
            <h3 className="font-bold text-lg mb-2 text-rose-300">Cancel workspace account</h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Cancel <strong className="text-white">{cancelTarget.clientName}</strong> ({cancelTarget.tenantId})?
              Workspace and portal access will be disabled. Tenant data is retained so you can re-provision later.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancellingId === cancelTarget.tenantId}
                className="px-4 py-2 bg-brandNavy-800 rounded text-sm"
              >
                Keep active
              </button>
              <button
                type="button"
                onClick={runCancelWorkspace}
                disabled={cancellingId === cancelTarget.tenantId}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-sm font-bold disabled:opacity-50"
              >
                {cancellingId === cancelTarget.tenantId ? 'Cancelling…' : 'Cancel account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full">
            <h3 className="font-bold text-lg mb-2 text-rose-300">Delete workspace account</h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Permanently delete <strong className="text-white">{deleteTarget.clientName}</strong> ({deleteTarget.tenantId})?
              This removes the workspace from the registry and clears portal links. Use this for test accounts.
            </p>
            <label className="text-[10px] uppercase text-slate-500 block mb-1">
              Type <span className="font-mono text-slate-300">{deleteTarget.tenantId}</span> to confirm
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-xs mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                }}
                disabled={deletingId === deleteTarget.tenantId}
                className="px-4 py-2 bg-brandNavy-800 rounded text-sm"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={runDeleteWorkspace}
                disabled={deletingId === deleteTarget.tenantId || deleteConfirmText.trim() !== deleteTarget.tenantId}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-sm font-bold disabled:opacity-50"
              >
                {deletingId === deleteTarget.tenantId ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="glass-panel p-6 w-full max-w-2xl my-8">
            <h2 className="text-lg font-bold mb-2">Provision Workspace</h2>
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
                    {creatingWorkspace ? 'Provisioning…' : 'Provision'}
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
