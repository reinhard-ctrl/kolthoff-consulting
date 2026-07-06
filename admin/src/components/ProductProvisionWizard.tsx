import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bootstrapAuth } from '../lib/firebase';
import { prepareClientWorkspace } from '../lib/prepare-client-workspace';
import { provisionAgencyOpsViaFirestore, type AgencyOpsProvisionResult } from '../lib/agency-ops-provision-firestore';
import { getClientDisplayName } from '../lib/engagement-config';
import { isPro1AgencyOpsProfile } from '../lib/agency-ops-profiles';
import { isCoreWorkspaceProfile } from '../lib/core-workspace-profiles';
import {
  derivePortalCode,
  slugifyAgencyName,
  slugifyClientName,
} from '../lib/provision-profile-defaults';
import { buildAgencyOpsHandoffText } from '../lib/agency-ops-active-tenant';

export type ProvisionProduct = 'core-workspace' | 'agency-ops';

export interface WorkbookProfileRow {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  coreWorkspaceTenantId?: string;
  agencyOpsTenantId?: string;
  engagementType?: string;
  productId?: string;
  selectedPackageId?: string;
  provisioningStatus?: string;
  provisioningError?: string;
}

interface CoreWorkspaceResult {
  tenantId: string;
  workspaceUrl: string;
  portalAccessCode: string;
  message: string;
  mailtoUrl?: string;
}

export interface ProductProvisionWizardProps {
  product: ProvisionProduct;
  profiles: WorkbookProfileRow[];
  initialProfileId?: string;
  managePath: string;
  onProvisioned?: (tenantId: string) => void;
}

function profileMatchesProduct(profile: WorkbookProfileRow, product: ProvisionProduct): boolean {
  return product === 'agency-ops' ? isPro1AgencyOpsProfile(profile) : isCoreWorkspaceProfile(profile);
}

function provisionedTenantId(profile: WorkbookProfileRow, product: ProvisionProduct): string | undefined {
  return product === 'agency-ops' ? profile.agencyOpsTenantId : profile.coreWorkspaceTenantId;
}

export default function ProductProvisionWizard({
  product,
  profiles,
  initialProfileId = '',
  managePath,
  onProvisioned,
}: ProductProvisionWizardProps) {
  const [profileId, setProfileId] = useState(initialProfileId);
  const [tenantId, setTenantId] = useState('');
  const [portalCode, setPortalCode] = useState('');
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [customPasscode, setCustomPasscode] = useState('');
  const [deliverViaPortal, setDeliverViaPortal] = useState(true);
  const [inviteContact, setInviteContact] = useState(true);
  const [deployTemplates, setDeployTemplates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [coreResult, setCoreResult] = useState<CoreWorkspaceResult | null>(null);
  const [agencyResult, setAgencyResult] = useState<AgencyOpsProvisionResult | null>(null);

  const eligibleProfiles = useMemo(
    () =>
      profiles
        .filter((p) => profileMatchesProduct(p, product))
        .sort((a, b) => getClientDisplayName(a).localeCompare(getClientDisplayName(b))),
    [profiles, product],
  );

  const selected = useMemo(
    () => eligibleProfiles.find((p) => p.id === profileId) || null,
    [eligibleProfiles, profileId],
  );

  useEffect(() => {
    setProfileId(initialProfileId);
  }, [initialProfileId]);

  useEffect(() => {
    if (!selected) return;
    const name = getClientDisplayName(selected);
    if (product === 'core-workspace') {
      const slug = slugifyClientName(name);
      setTenantId(slug);
      setPortalCode(derivePortalCode(name, slug, selected.quoteId));
      setRepName(selected.clientRep || '');
    } else {
      setTenantId(slugifyAgencyName(name));
    }
  }, [selected, product]);

  const provision = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setProgress('');
    setCoreResult(null);
    setAgencyResult(null);
    try {
      await bootstrapAuth();
      const clientName = getClientDisplayName(selected);
      if (product === 'core-workspace') {
        const data = await prepareClientWorkspace({
          clientName,
          tenantId: tenantId.trim() || undefined,
          profileId: selected.id,
          portalAccessCode: portalCode.trim() || undefined,
          repName: repName.trim() || undefined,
          repEmail: repEmail.trim() || undefined,
          deliverViaPortal,
          inviteContact: inviteContact && !!repEmail.trim(),
          deployStarterTemplates: deployTemplates,
        }, { onProgress: setProgress });
        setCoreResult({
          tenantId: data.tenantId,
          workspaceUrl: data.workspaceUrl,
          portalAccessCode: data.portalAccessCode,
          message: data.message,
          mailtoUrl: data.mailtoUrl,
        });
        onProvisioned?.(data.tenantId);
      } else {
        const data = await provisionAgencyOpsViaFirestore({
          clientName,
          tenantId: tenantId.trim() || undefined,
          profileId: selected.id,
          repEmail: repEmail.trim() || undefined,
          passcode: customPasscode.trim() || undefined,
        });
        setAgencyResult(data);
        onProvisioned?.(data.tenantId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCoreResult(null);
    setAgencyResult(null);
    setError('');
  };

  const title = product === 'core-workspace' ? 'Core Workspace onboarding' : 'Agency Ops onboarding';
  const description =
    product === 'core-workspace'
      ? 'Link a signed SOW profile to a Core Workspace tenant, portal delivery, and approval templates.'
      : 'Link a signed PRO 1 profile to a white-label Agency Ops tenant and passcode.';

  if (coreResult) {
    return (
      <div className="glass-panel p-5 space-y-4 max-w-3xl">
        <p className="text-brandTeal-400 text-sm">{coreResult.message}</p>
        <div className="text-xs space-y-2">
          <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
            <div className="text-slate-500 mb-1">Core Workspace</div>
            <a href={coreResult.workspaceUrl} className="text-brandTeal-400 break-all">{coreResult.workspaceUrl}</a>
          </div>
          <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
            <div className="text-slate-500 mb-1">Client Portal code</div>
            <div className="font-mono text-white">{coreResult.portalAccessCode}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {coreResult.mailtoUrl && (
            <a href={coreResult.mailtoUrl} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded text-sm font-bold">
              Email handoff
            </a>
          )}
          <Link
            to={`${managePath}?tenant=${encodeURIComponent(coreResult.tenantId)}`}
            className="px-4 py-2 border border-brandNavy-700 rounded text-sm text-slate-300"
          >
            Manage tenant
          </Link>
          <button type="button" onClick={reset} className="px-4 py-2 text-sm text-slate-400">
            Provision another
          </button>
        </div>
      </div>
    );
  }

  if (agencyResult) {
    return (
      <div className="glass-panel p-5 space-y-4 max-w-3xl">
        <p className="text-brandTeal-400 text-sm">{agencyResult.message}</p>
        <div className="p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50 text-xs space-y-1">
          <div className="text-slate-500">Console URL</div>
          <div className="font-mono text-brandTeal-400 break-all">{agencyResult.consoleUrl}</div>
          <div className="text-slate-500 mt-2">Passcode (shown once)</div>
          <div className="font-mono text-brandAmber-300 text-lg">{agencyResult.passcode}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(buildAgencyOpsHandoffText(agencyResult.consoleUrl, agencyResult.passcode))}
            className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded text-sm font-bold"
          >
            Copy handoff
          </button>
          <Link to={managePath} className="px-4 py-2 border border-brandNavy-700 rounded text-sm text-slate-300">
            View in registry
          </Link>
          <button type="button" onClick={reset} className="px-4 py-2 text-sm text-slate-400">
            Provision another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-bold mb-1">{title}</h2>
        <p className="text-sm text-slate-400">{description}</p>
      </div>

      <div className="glass-panel p-5 space-y-4">
        <div>
          <label className="text-sm text-slate-400 block mb-1">SOW / Planner profile</label>
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
          >
            <option value="">Select engagement…</option>
            {eligibleProfiles.map((p) => {
              const existing = provisionedTenantId(p, product);
              return (
                <option key={p.id} value={p.id}>
                  {getClientDisplayName(p)}
                  {existing ? ` · tenant: ${existing}` : ''}
                </option>
              );
            })}
          </select>
          {eligibleProfiles.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">No eligible profiles for this product lane.</p>
          )}
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
            {product === 'core-workspace' ? (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Portal access code</label>
                <input
                  value={portalCode}
                  onChange={(e) => setPortalCode(e.target.value.toUpperCase())}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Custom passcode (optional)</label>
                <input
                  value={customPasscode}
                  onChange={(e) => setCustomPasscode(e.target.value)}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                  placeholder="Auto-generated if blank"
                />
              </div>
            )}
            {product === 'core-workspace' && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Primary contact name</label>
                <input
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
                />
              </div>
            )}
            <div className={product === 'agency-ops' ? 'md:col-span-2' : ''}>
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

        {product === 'core-workspace' && (
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
        )}
      </div>

      {busy && progress && !error && <p className="text-sm text-brandTeal-300">{progress}</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <button
        type="button"
        onClick={provision}
        disabled={busy || !selected || !tenantId.trim()}
        className="px-5 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm disabled:opacity-50"
      >
        {busy ? 'Provisioning…' : product === 'core-workspace' ? 'Provision client workspace' : 'Provision Agency Ops tenant'}
      </button>
    </div>
  );
}
