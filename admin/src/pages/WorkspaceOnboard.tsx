import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { adminCol, bootstrapAuth } from '../lib/firebase';
import { provisionClientWorkspaceViaFirestore } from '../lib/client-provision-firestore';
import { getClientDisplayName } from '../lib/engagement-config';

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  coreWorkspaceTenantId?: string;
}

function slugifyClientName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `client-${slug}` : '';
}

function derivePortalCode(clientName: string, tenantId: string, quoteId?: string): string {
  if (quoteId?.trim()) return quoteId.trim().toUpperCase().slice(0, 24);
  const fromName = clientName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (fromName) return fromName;
  return tenantId.replace('client-', '').toUpperCase().slice(0, 24);
}

export default function WorkspaceOnboard() {
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [portalCode, setPortalCode] = useState('');
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [deliverViaPortal, setDeliverViaPortal] = useState(true);
  const [inviteContact, setInviteContact] = useState(true);
  const [deployTemplates, setDeployTemplates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    tenantId: string;
    workspaceUrl: string;
    portalAccessCode: string;
    message: string;
    mailtoUrl?: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return onSnapshot(adminCol('workbook_profiles'), (snap) => {
      const list: WorkbookProfile[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WorkbookProfile));
      list.sort((a, b) => getClientDisplayName(a).localeCompare(getClientDisplayName(b)));
      setProfiles(list);
    });
  }, []);

  const selected = useMemo(
    () => profiles.find((p) => p.id === profileId) || null,
    [profiles, profileId],
  );

  useEffect(() => {
    if (!selected) return;
    const name = getClientDisplayName(selected);
    const slug = slugifyClientName(name);
    setTenantId(slug);
    setPortalCode(derivePortalCode(name, slug, selected.quoteId));
    setRepName(selected.clientRep || '');
  }, [selected]);

  const provision = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      await bootstrapAuth();
      const clientName = getClientDisplayName(selected);
      const data = await provisionClientWorkspaceViaFirestore({
        clientName,
        tenantId: tenantId.trim() || undefined,
        profileId: selected.id,
        portalAccessCode: portalCode.trim() || undefined,
        repName: repName.trim() || undefined,
        repEmail: repEmail.trim() || undefined,
        deliverViaPortal,
        inviteContact: inviteContact && !!repEmail.trim(),
        deployStarterTemplates: deployTemplates,
      });
      setResult({
        tenantId: data.tenantId,
        workspaceUrl: data.workspaceUrl,
        portalAccessCode: data.portalAccessCode,
        message: data.message,
        mailtoUrl: data.mailtoUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Client Onboarding Wizard</h1>
        <p className="text-sm text-slate-400">
          Link a signed SOW profile to a new Core Workspace tenant, portal delivery, and approval templates in one step.
        </p>
      </div>

      {!result ? (
        <>
          <div className="glass-panel p-5 space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">SOW / Planner profile</label>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
              >
                <option value="">Select engagement…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getClientDisplayName(p)}
                    {p.coreWorkspaceTenantId ? ` · workspace: ${p.coreWorkspaceTenantId}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Tenant ID</label>
                  <input
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value.trim().toLowerCase())}
                    className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Portal access code</label>
                  <input
                    value={portalCode}
                    onChange={(e) => setPortalCode(e.target.value.toUpperCase())}
                    className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Primary contact name</label>
                  <input
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Primary contact email</label>
                  <input
                    type="email"
                    value={repEmail}
                    onChange={(e) => setRepEmail(e.target.value)}
                    className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 text-xs text-slate-400">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={deliverViaPortal} onChange={(e) => setDeliverViaPortal(e.target.checked)} />
                Publish Core Workspace link on Client Portal
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inviteContact}
                  onChange={(e) => setInviteContact(e.target.checked)}
                  disabled={!repEmail.trim()}
                />
                Invite primary contact by email
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={deployTemplates} onChange={(e) => setDeployTemplates(e.target.checked)} />
                Deploy starter approval templates
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={provision}
              disabled={busy || !selected || !tenantId.trim()}
              className="px-5 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm disabled:opacity-50"
            >
              {busy ? 'Provisioning…' : 'Provision client workspace'}
            </button>
            <Link to="/tenants" className="px-4 py-2 text-sm text-slate-400 border border-brandNavy-700 rounded">
              Workspace Admin
            </Link>
          </div>
        </>
      ) : (
        <div className="glass-panel p-5 space-y-4">
          <p className="text-brandTeal-400 text-sm">{result.message}</p>
          <div className="text-xs space-y-2">
            <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
              <div className="text-slate-500 mb-1">Core Workspace</div>
              <a href={result.workspaceUrl} className="text-brandTeal-400 break-all">{result.workspaceUrl}</a>
            </div>
            <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
              <div className="text-slate-500 mb-1">Client Portal code</div>
              <div className="font-mono text-white">{result.portalAccessCode}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.mailtoUrl && (
              <a href={result.mailtoUrl} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded text-sm font-bold">
                Email handoff
              </a>
            )}
            <Link to={`/tenants?tenant=${encodeURIComponent(result.tenantId)}`} className="px-4 py-2 border border-brandNavy-700 rounded text-sm text-slate-300">
              Open in Workspace Admin
            </Link>
            <button type="button" onClick={() => setResult(null)} className="px-4 py-2 text-sm text-slate-400">
              Provision another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
