import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onSnapshot, collection } from 'firebase/firestore';
import { db, bootstrapAuth } from '../lib/firebase';
import { provisionAgencyOpsViaFirestore, type AgencyOpsProvisionResult } from '../lib/agency-ops-provision-firestore';
import { cancelAgencyOpsTenant } from '../lib/agency-ops-cancel';
import { deleteAgencyOpsTenant } from '../lib/agency-ops-delete';
import {
  agencyOpsProvisionUiState,
  isPro1AgencyOpsProfile,
  needsAgencyOpsTenant,
  type AgencyOpsProfileFields,
} from '../lib/agency-ops-profiles';
import { AGENCY_OPS_DEMO_TENANT, agencyOpsStatusLabel, isAgencyOpsTenantCancelled } from '../lib/agency-ops-tenant-status';
import {
  agencyOpsConsoleUrl,
  buildAgencyOpsHandoffText,
  getActiveAgencyOpsTenantId,
  setActiveAgencyOpsTenantId,
} from '../lib/agency-ops-active-tenant';
import { resetAgencyOpsPasscode } from '../lib/agency-ops-passcode-reset';

interface AgencyOpsTenant {
  tenantId: string;
  clientName: string;
  status?: string;
  consoleUrl?: string;
  profileId?: string;
  quoteId?: string;
  provisioningStatus?: string;
  provisioningMethod?: string;
  initialPasscode?: string;
  createdAt?: number;
}

interface PrepareResult extends AgencyOpsProvisionResult {}

interface WorkbookProfileOption extends AgencyOpsProfileFields {
  id: string;
  clientCompany?: string;
  quoteId?: string;
}

interface ContractRecord {
  id: string;
  profileId?: string;
  status?: string;
  agencyOpsAutoProvisionError?: string;
}

interface ActionProfile extends WorkbookProfileOption {
  uiState: 'failed' | 'provisioning' | 'awaiting';
  contractError?: string;
}

function slugifyAgencyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `agency-${slug}` : '';
}

export default function AgencyOpsManager() {
  const [tenants, setTenants] = useState<AgencyOpsTenant[]>([]);
  const [profiles, setProfiles] = useState<WorkbookProfileOption[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [customPasscode, setCustomPasscode] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<PrepareResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AgencyOpsTenant | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgencyOpsTenant | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantIdState] = useState(() => getActiveAgencyOpsTenantId() || '');
  const [resetPasscodeTarget, setResetPasscodeTarget] = useState<AgencyOpsTenant | null>(null);
  const [resettingPasscodeId, setResettingPasscodeId] = useState<string | null>(null);
  const [registrySearch, setRegistrySearch] = useState('');

  useEffect(() => {
    const registryRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'agency_ops_tenants');
    const profilesRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'workbook_profiles');
    const contractsRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'contracts_ledger');
    const u1 = onSnapshot(registryRef, (snap) => {
      const list: AgencyOpsTenant[] = [];
      snap.forEach((d) => {
        const data = d.data() as AgencyOpsTenant;
        list.push({ ...data, tenantId: data.tenantId || d.id });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTenants(list);
    });
    const u2 = onSnapshot(profilesRef, (snap) => {
      const list: WorkbookProfileOption[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WorkbookProfileOption));
      setProfiles(list);
    });
    const u3 = onSnapshot(contractsRef, (snap) => {
      const list: ContractRecord[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ContractRecord));
      setContracts(list);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const signedContractErrors = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contracts) {
      if (c.status !== 'signed' || !c.profileId) continue;
      if (c.agencyOpsAutoProvisionError) map.set(c.profileId, c.agencyOpsAutoProvisionError);
    }
    return map;
  }, [contracts]);

  const actionRequiredProfiles = useMemo(() => {
    const byId = new Map<string, ActionProfile>();

    for (const p of profiles) {
      if (!needsAgencyOpsTenant(p)) continue;
      const uiState = agencyOpsProvisionUiState(p) || 'awaiting';
      byId.set(p.id, {
        ...p,
        uiState: signedContractErrors.has(p.id) ? 'failed' : uiState,
        contractError: signedContractErrors.get(p.id),
      });
    }

    for (const c of contracts) {
      if (c.status !== 'signed' || !c.profileId || byId.has(c.profileId)) continue;
      const p = profiles.find((x) => x.id === c.profileId);
      if (!p || !isPro1AgencyOpsProfile(p) || p.agencyOpsTenantId) continue;
      byId.set(c.profileId, {
        ...p,
        uiState: c.agencyOpsAutoProvisionError ? 'failed' : 'awaiting',
        contractError: c.agencyOpsAutoProvisionError,
      });
    }

    return [...byId.values()].sort((a, b) => {
      const rank = { failed: 0, provisioning: 1, awaiting: 2 };
      return rank[a.uiState] - rank[b.uiState];
    });
  }, [profiles, contracts, signedContractErrors]);

  const activeTenants = useMemo(
    () => tenants.filter((t) => !isAgencyOpsTenantCancelled(t)),
    [tenants],
  );

  const filteredTenants = useMemo(() => {
    const q = registrySearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const haystack = [
        t.clientName,
        t.tenantId,
        t.quoteId,
        t.profileId,
        t.provisioningStatus,
        t.status,
        agencyOpsStatusLabel(t),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tenants, registrySearch]);

  const activeTenant = useMemo(
    () => activeTenants.find((t) => t.tenantId === activeTenantId) || null,
    [activeTenants, activeTenantId],
  );

  useEffect(() => {
    if (!activeTenantId && activeTenants.length > 0) {
      const stored = getActiveAgencyOpsTenantId();
      const next = stored && activeTenants.some((t) => t.tenantId === stored)
        ? stored
        : activeTenants[0].tenantId;
      setActiveTenantIdState(next);
      try {
        setActiveAgencyOpsTenantId(next);
      } catch {
        /* ignore invalid stored id */
      }
      return;
    }
    if (activeTenantId && !activeTenants.some((t) => t.tenantId === activeTenantId)) {
      const next = activeTenants[0]?.tenantId || '';
      setActiveTenantIdState(next);
      if (next) {
        try {
          setActiveAgencyOpsTenantId(next);
        } catch {
          /* ignore */
        }
      }
    }
  }, [activeTenantId, activeTenants]);

  const selectActiveTenant = (tenantId: string) => {
    setActiveTenantIdState(tenantId);
    try {
      setActiveAgencyOpsTenantId(tenantId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not select tenant.');
    }
  };

  const rememberProvisionedTenant = (tenantId: string) => {
    setActiveTenantIdState(tenantId);
    try {
      setActiveAgencyOpsTenantId(tenantId);
    } catch {
      /* ignore */
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const openProvision = (prefill?: WorkbookProfileOption) => {
    setResult(null);
    setClientName(prefill?.clientCompany || '');
    setTenantId(prefill ? slugifyAgencyName(prefill.clientCompany || prefill.id) : '');
    setProfileId(prefill?.id || '');
    setRepEmail('');
    setCustomPasscode('');
    setShowModal(true);
  };

  const runProvisionForProfile = async (profile: WorkbookProfileOption) => {
    if (!profile.clientCompany && !profile.id) return;
    setRetryingId(profile.id);
    try {
      await bootstrapAuth();
      const data = await provisionAgencyOpsViaFirestore({
        profileId: profile.id,
        clientName: (profile.clientCompany || profile.id).trim(),
        tenantId: slugifyAgencyName(profile.clientCompany || profile.id) || undefined,
      });
      setResult(data);
      rememberProvisionedTenant(data.tenantId);
      showToast(`Tenant ${data.tenantId} provisioned.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setRetryingId(null);
    }
  };

  const runProvision = async () => {
    if (!clientName.trim()) return;
    setPreparing(true);
    try {
      await bootstrapAuth();
      const data = await provisionAgencyOpsViaFirestore({
        clientName: clientName.trim(),
        tenantId: tenantId.trim() || undefined,
        profileId: profileId.trim() || undefined,
        repEmail: repEmail.trim() || undefined,
        passcode: customPasscode.trim() || undefined,
      });
      setResult(data);
      rememberProvisionedTenant(data.tenantId);
      showToast('Agency Ops tenant provisioned.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setPreparing(false);
    }
  };

  const copyHandoff = () => {
    if (!result) return;
    navigator.clipboard.writeText(buildAgencyOpsHandoffText(result.consoleUrl, result.passcode));
    showToast('Handoff copied to clipboard.');
  };

  const copyTenantHandoff = (tenant: AgencyOpsTenant) => {
    const consoleUrl = tenant.consoleUrl || agencyOpsConsoleUrl(tenant.tenantId);
    const passcode = tenant.initialPasscode;
    if (!passcode) {
      showToast('No passcode on file for this tenant.');
      return;
    }
    navigator.clipboard.writeText(buildAgencyOpsHandoffText(consoleUrl, passcode));
    showToast('Handoff copied to clipboard.');
  };

  const runResetPasscode = async () => {
    if (!resetPasscodeTarget) return;
    setResettingPasscodeId(resetPasscodeTarget.tenantId);
    try {
      await bootstrapAuth();
      const data = await resetAgencyOpsPasscode(resetPasscodeTarget.tenantId);
      setResetPasscodeTarget(null);
      setResult({
        tenantId: data.tenantId,
        clientName: data.clientName,
        consoleUrl: data.consoleUrl,
        passcode: data.passcode,
        message: data.message,
        created: false,
      });
      setShowModal(true);
      showToast(data.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Passcode reset failed');
    } finally {
      setResettingPasscodeId(null);
    }
  };

  const runCancelTenant = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.tenantId);
    try {
      await bootstrapAuth();
      const data = await cancelAgencyOpsTenant({ tenantId: cancelTarget.tenantId });
      setCancelTarget(null);
      showToast(data.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancellingId(null);
    }
  };

  const openDeleteTenant = (tenant: AgencyOpsTenant) => {
    setDeleteConfirmText('');
    setDeleteTarget(tenant);
  };

  const runDeleteTenant = async () => {
    if (!deleteTarget || deleteConfirmText.trim() !== deleteTarget.tenantId) return;
    setDeletingId(deleteTarget.tenantId);
    try {
      await bootstrapAuth();
      const data = await deleteAgencyOpsTenant({ tenantId: deleteTarget.tenantId });
      setDeleteTarget(null);
      setDeleteConfirmText('');
      showToast(data.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeletingId(null);
    }
  };

  const tenantStatusClass = (tenant: AgencyOpsTenant) => {
    const label = agencyOpsStatusLabel(tenant);
    if (label === 'cancelled') return 'text-rose-400';
    if (label === 'ready' || label === 'active') return 'text-emerald-400';
    return 'text-brandAmber-300';
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Agency Ops Manager</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Provision white-label Agency Ops tenants after PRO 1 contracts are signed.
            PRO 1 contracts auto-provision on e-sign; use this page to retry failures or provision manually.
            Console warnings about staff SSO timeout are harmless — your Google admin session still works.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openProvision()}
          className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded-lg text-xs font-bold uppercase shadow-sm"
        >
          Provision Tenant
        </button>
      </div>

      <div className="glass-panel p-4 mb-6">
        <label className="text-sm text-slate-400">Active Agency Ops tenant</label>
        {activeTenants.length > 0 ? (
          <>
            <select
              value={activeTenantId}
              onChange={(e) => selectActiveTenant(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
            >
              {activeTenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.clientName} ({t.tenantId})
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-3 mt-2 text-sm items-center">
              {activeTenant && (
                <>
                  <a
                    href={activeTenant.consoleUrl || agencyOpsConsoleUrl(activeTenant.tenantId)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => selectActiveTenant(activeTenant.tenantId)}
                    className="text-brandTeal-400 hover:text-brandTeal-300"
                  >
                    Open Agency Ops console →
                  </a>
                  <button
                    type="button"
                    onClick={() => copyTenantHandoff(activeTenant)}
                    className="text-brandTeal-400 hover:text-brandTeal-300"
                  >
                    Copy handoff
                  </button>
                  <span className="text-slate-500">
                    Managing: {activeTenant.clientName}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Use <strong className="text-slate-400">Open Agency Ops console</strong> above to support the selected client.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500 mt-2">
            No active tenants yet. Provision a client to enable console access and handoff.
          </p>
        )}
      </div>

      {actionRequiredProfiles.length > 0 && (
        <div className="glass-panel p-4 mb-6 border border-brandAmber-500/30">
          <h2 className="text-xs font-mono uppercase tracking-wider text-brandAmber-400 font-bold mb-2">
            Action required — provision Agency Ops tenant
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Signed PRO 1 deals without a tenant appear here. Provision is instant (no Cloud Function wait).
          </p>
          <div className="space-y-3">
            {actionRequiredProfiles.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 text-sm border border-brandNavy-800 rounded-lg p-3 bg-brandNavy-950/50">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-white">{p.clientCompany || p.id}</span>
                  {p.quoteId && <span className="text-slate-500 font-mono text-xs ml-2">{p.quoteId}</span>}
                  {p.uiState === 'provisioning' && (
                    <span className="block text-amber-400 text-xs uppercase font-bold mt-1 animate-pulse">Provisioning in progress…</span>
                  )}
                  {p.uiState === 'failed' && (
                    <span className="block text-rose-300/90 text-xs mt-1 max-w-xl">
                      {p.provisioningError || p.contractError || 'Auto-provision did not complete — retry manually.'}
                    </span>
                  )}
                  {p.uiState === 'awaiting' && (
                    <span className="block text-slate-500 text-xs mt-1">Signed contract — tenant not created yet</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => runProvisionForProfile(p)}
                  disabled={retryingId === p.id}
                  className="shrink-0 px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded text-xs font-bold uppercase tracking-wide shadow-sm disabled:opacity-50"
                >
                  {retryingId === p.id
                    ? 'Provisioning…'
                    : p.uiState === 'failed' || p.uiState === 'provisioning'
                      ? 'Retry provision'
                      : 'Provision now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 p-4 border-b border-brandNavy-800">
          <div className="min-w-[12rem] flex-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
              Search tenants
            </label>
            <input
              type="search"
              value={registrySearch}
              onChange={(e) => setRegistrySearch(e.target.value)}
              placeholder="Client, tenant ID, quote, status…"
              className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
            />
          </div>
          <p className="text-xs text-slate-500 shrink-0">
            {filteredTenants.length === tenants.length
              ? `${tenants.length} tenant${tenants.length === 1 ? '' : 's'}`
              : `${filteredTenants.length} of ${tenants.length} tenants`}
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Client</th>
              <th className="p-4">Tenant ID</th>
              <th className="p-4">SOW Ref</th>
              <th className="p-4">Status</th>
              <th className="p-4">Passcode</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brandNavy-800">
            {filteredTenants.map((t) => (
              <tr key={t.tenantId} className="hover:bg-brandNavy-800/30">
                <td className="p-4 font-bold">{t.clientName}</td>
                <td className="p-4 font-mono text-xs text-slate-400">{t.tenantId}</td>
                <td className="p-4 font-mono text-xs text-slate-500">
                  {t.profileId ? (
                    <Link
                      to={`/app/project-planner?profile=${encodeURIComponent(t.profileId)}`}
                      className="text-brandTeal-400 hover:underline"
                      title="Open SOW in Project Planner"
                    >
                      {t.quoteId || t.profileId}
                    </Link>
                  ) : (
                    t.quoteId || '—'
                  )}
                </td>
                <td className="p-4">
                  <span className={`${tenantStatusClass(t)} text-xs uppercase font-bold`}>
                    {agencyOpsStatusLabel(t)}
                  </span>
                  {t.provisioningMethod === 'auto' && !isAgencyOpsTenantCancelled(t) && (
                    <span className="block text-[10px] text-slate-500 mt-0.5">Auto on sign</span>
                  )}
                </td>
                <td className="p-4 font-mono text-xs">
                  {t.initialPasscode && !isAgencyOpsTenantCancelled(t) ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(t.initialPasscode!);
                        showToast('Passcode copied.');
                      }}
                      className="text-brandAmber-300 hover:underline"
                      title="Copy passcode"
                    >
                      {t.initialPasscode}
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {t.consoleUrl && !isAgencyOpsTenantCancelled(t) && (
                      <a
                        href={t.consoleUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => selectActiveTenant(t.tenantId)}
                        className="text-brandTeal-400 text-xs font-bold hover:underline"
                      >
                        Open console
                      </a>
                    )}
                    {t.tenantId !== AGENCY_OPS_DEMO_TENANT && !isAgencyOpsTenantCancelled(t) && (
                      <button
                        type="button"
                        onClick={() => setResetPasscodeTarget(t)}
                        className="text-brandAmber-300 hover:text-brandAmber-200 text-xs font-bold uppercase tracking-wide"
                      >
                        Reset passcode
                      </button>
                    )}
                    {t.tenantId !== AGENCY_OPS_DEMO_TENANT && !isAgencyOpsTenantCancelled(t) && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(t)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wide"
                      >
                        Cancel account
                      </button>
                    )}
                    {t.tenantId !== AGENCY_OPS_DEMO_TENANT && (
                      <button
                        type="button"
                        onClick={() => openDeleteTenant(t)}
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
        {tenants.length === 0 && actionRequiredProfiles.length === 0 && (
          <p className="p-6 text-slate-500 italic">
            No Agency Ops tenants yet. After a PRO 1 contract is signed, use the action panel above or
            {' '}<button type="button" onClick={() => openProvision()} className="text-brandTeal-400 underline">Provision Tenant</button>.
          </p>
        )}
        {tenants.length > 0 && filteredTenants.length === 0 && (
          <p className="p-6 text-slate-500 italic">No tenants match your search.</p>
        )}
        {tenants.length === 0 && actionRequiredProfiles.length > 0 && (
          <p className="p-6 text-slate-500 italic">Tenant registry empty — use Provision / Retry in the panel above.</p>
        )}
      </div>

      {resetPasscodeTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full">
            <h3 className="font-bold text-lg mb-2 text-brandAmber-300">Reset Agency Ops passcode</h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Generate a new passcode for <strong className="text-white">{resetPasscodeTarget.clientName}</strong> ({resetPasscodeTarget.tenantId}).
              The previous passcode stops working immediately.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setResetPasscodeTarget(null)}
                disabled={resettingPasscodeId === resetPasscodeTarget.tenantId}
                className="px-4 py-2 bg-brandNavy-800 rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runResetPasscode}
                disabled={resettingPasscodeId === resetPasscodeTarget.tenantId}
                className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded text-sm font-bold disabled:opacity-50"
              >
                {resettingPasscodeId === resetPasscodeTarget.tenantId ? 'Resetting…' : 'Reset passcode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full">
            <h3 className="font-bold text-lg mb-2 text-rose-300">Cancel Agency Ops account</h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Cancel <strong className="text-white">{cancelTarget.clientName}</strong> ({cancelTarget.tenantId})?
              Console access and the passcode will be disabled. Tenant data is retained so you can re-provision later.
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
                onClick={runCancelTenant}
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
            <h3 className="font-bold text-lg mb-2 text-rose-300">Delete Agency Ops account</h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Permanently delete <strong className="text-white">{deleteTarget.clientName}</strong> ({deleteTarget.tenantId})?
              This removes the tenant from Agency Ops Manager and clears its passcode. Use this for test accounts.
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
                onClick={runDeleteTenant}
                disabled={deletingId === deleteTarget.tenantId || deleteConfirmText.trim() !== deleteTarget.tenantId}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-sm font-bold disabled:opacity-50"
              >
                {deletingId === deleteTarget.tenantId ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-1">{result ? 'Tenant ready' : 'Provision Agency Ops tenant'}</h3>
            {!result ? (
              <>
                <p className="text-xs text-slate-400 mb-4">
                  Creates tenant settings, admin passcode, and registry entry. Passcode is shown once after provisioning.
                </p>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Client name *</label>
                    <input
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (!profileId) setTenantId(slugifyAgencyName(e.target.value));
                      }}
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Tenant ID</label>
                    <input
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="agency-pixel-wave"
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Linked SOW profile</label>
                    <select
                      value={profileId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setProfileId(id);
                        const p = profiles.find((x) => x.id === id);
                        if (p?.clientCompany) {
                          setClientName(p.clientCompany);
                          setTenantId(slugifyAgencyName(p.clientCompany));
                        }
                      }}
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    >
                      <option value="">— Optional —</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.clientCompany || p.id} {p.quoteId ? `(${p.quoteId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Client contact email</label>
                    <input
                      type="email"
                      value={repEmail}
                      onChange={(e) => setRepEmail(e.target.value)}
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Custom passcode (optional)</label>
                    <input
                      value={customPasscode}
                      onChange={(e) => setCustomPasscode(e.target.value)}
                      className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Cancel</button>
                  <button
                    type="button"
                    onClick={runProvision}
                    disabled={preparing || !clientName.trim()}
                    className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded text-sm font-bold disabled:opacity-50 shadow-sm"
                  >
                    {preparing ? 'Provisioning…' : 'Provision'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-emerald-400 mb-4">{result.message}</p>
                <div className="space-y-2 text-xs bg-brandNavy-950 p-4 rounded border border-brandNavy-800 font-mono">
                  <div><span className="text-slate-500">Tenant:</span> {result.tenantId}</div>
                  <div><span className="text-slate-500">URL:</span> {result.consoleUrl}</div>
                  <div><span className="text-slate-500">Passcode:</span> <strong className="text-brandAmber-300">{result.passcode}</strong></div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end mt-6">
                  <button type="button" onClick={copyHandoff} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Copy handoff</button>
                  {result.mailtoUrl && (
                    <a href={result.mailtoUrl} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded text-sm font-bold">Email client</a>
                  )}
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded text-sm font-bold shadow-sm">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
