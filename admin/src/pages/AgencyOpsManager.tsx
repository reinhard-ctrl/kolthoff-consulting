import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db, bootstrapAuth, functions, httpsCallable } from '../lib/firebase';

interface AgencyOpsTenant {
  tenantId: string;
  clientName: string;
  status?: string;
  consoleUrl?: string;
  profileId?: string;
  quoteId?: string;
  provisioningStatus?: string;
  createdAt?: number;
}

interface PrepareResult {
  tenantId: string;
  clientName: string;
  consoleUrl: string;
  passcode: string;
  profileId?: string | null;
  quoteId?: string | null;
  mailtoUrl?: string;
  message: string;
  created: boolean;
}

interface WorkbookProfileOption {
  id: string;
  clientCompany?: string;
  quoteId?: string;
  engagementType?: string;
  productId?: string;
  agencyOpsTenantId?: string;
  provisioningStatus?: string;
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
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [customPasscode, setCustomPasscode] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<PrepareResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const registryRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'agency_ops_tenants');
    const profilesRef = collection(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'workbook_profiles');
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
    return () => { u1(); u2(); };
  }, []);

  const proProfiles = useMemo(
    () => profiles.filter((p) =>
      (p.engagementType === 'product' || p.productId === 'pro1') && !p.agencyOpsTenantId
    ),
    [profiles],
  );

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

  const runProvision = async () => {
    if (!clientName.trim()) return;
    setPreparing(true);
    try {
      await bootstrapAuth();
      const fn = httpsCallable(functions, 'prepareAgencyOpsTenant');
      const response = await fn({
        clientName: clientName.trim(),
        tenantId: tenantId.trim() || undefined,
        profileId: profileId.trim() || undefined,
        repEmail: repEmail.trim() || undefined,
        passcode: customPasscode.trim() || undefined,
      });
      setResult(response.data as PrepareResult);
      showToast('Agency Ops tenant provisioned.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setPreparing(false);
    }
  };

  const copyHandoff = () => {
    if (!result) return;
    const text =
      `Agency Ops Console: ${result.consoleUrl}\nPasscode: ${result.passcode}\n\n` +
      'Open the URL, enter the passcode, and complete branding under Settings.';
    navigator.clipboard.writeText(text);
    showToast('Handoff copied to clipboard.');
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
            Each tenant gets a dedicated console URL and passcode login.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openProvision()}
          className="px-4 py-2 bg-brandAmber-500 hover:bg-brandAmber-400 text-brandNavy-955 rounded-lg text-xs font-bold uppercase"
        >
          Provision Tenant
        </button>
      </div>

      {proProfiles.length > 0 && (
        <div className="glass-panel p-4 mb-6 border border-brandAmber-500/20">
          <h2 className="text-xs font-mono uppercase tracking-wider text-brandAmber-400 font-bold mb-2">
            PRO deals awaiting provisioning
          </h2>
          <div className="space-y-2">
            {proProfiles.slice(0, 8).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-semibold text-white">{p.clientCompany || p.id}</span>
                  {p.quoteId && <span className="text-slate-500 font-mono text-xs ml-2">{p.quoteId}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => openProvision(p)}
                  className="px-3 py-1 bg-brandNavy-800 hover:bg-brandNavy-750 border border-brandNavy-700 rounded text-xs font-bold"
                >
                  Provision
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Client</th>
              <th className="p-4">Tenant ID</th>
              <th className="p-4">SOW Ref</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Console</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brandNavy-800">
            {tenants.map((t) => (
              <tr key={t.tenantId} className="hover:bg-brandNavy-800/30">
                <td className="p-4 font-bold">{t.clientName}</td>
                <td className="p-4 font-mono text-xs text-slate-400">{t.tenantId}</td>
                <td className="p-4 font-mono text-xs text-slate-500">{t.quoteId || '—'}</td>
                <td className="p-4">
                  <span className="text-emerald-400 text-xs uppercase font-bold">{t.provisioningStatus || t.status || 'active'}</span>
                </td>
                <td className="p-4 text-right">
                  {t.consoleUrl && (
                    <a href={t.consoleUrl} target="_blank" rel="noreferrer" className="text-brandTeal-400 text-xs font-bold hover:underline">
                      Open console
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <p className="p-6 text-slate-500 italic">No Agency Ops tenants provisioned yet.</p>
        )}
      </div>

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
                    className="px-4 py-2 bg-brandAmber-500 text-brandNavy-955 rounded text-sm font-bold disabled:opacity-50"
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
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-brandAmber-500 text-brandNavy-955 rounded text-sm font-bold">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
