import { Fragment, useEffect, useMemo, useState } from 'react';
import { deleteDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc, bootstrapAuth } from '../lib/firebase';
import { provisionAgencyOpsViaFirestore } from '../lib/agency-ops-provision-firestore';
import { isPro1AgencyOpsProfile } from '../lib/agency-ops-profiles';
import {
  formatCurrency,
  getBillingSchedule,
  getFinancials,
  milestoneSplitLabel,
  type BillingMilestone,
} from '../lib/financials';
import { getChaosTaxValue, getClientDisplayName, resolveChaosTax } from '../lib/engagement-config';

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  engagementType?: string;
  productId?: string;
  selectedPackageId?: string;
  agencyOpsTenantId?: string;
  provisioningStatus?: string;
  provisioningError?: string;
  links?: { agencyOpsConsoleUrl?: string };
  chaosTax?: { source?: string; value?: number };
  annualOperationalLeakage?: number;
  tasks?: { id?: string; selected?: boolean; estHours?: number; tier?: string; isMonthlyRetainer?: boolean; category?: string }[];
  frictionBuffer?: number;
  discountPercent?: number;
  includeTax?: boolean;
  subscriptionMonths?: number;
  milestoneSplit?: string;
  customSplit1?: number;
  customSplit2?: number;
  customSplit3?: number;
}

interface ContractRecord {
  id: string;
  profileId: string;
  status: string;
  signedAt?: string;
  signedBy?: string;
  agencyOpsAutoProvisioned?: boolean;
  agencyOpsAutoProvisionError?: string;
  agencyOpsTenantId?: string;
  auditTrail?: { action: string; timestamp: string }[];
}

interface LedgerRow {
  profileId: string;
  clientCompany: string;
  quoteId: string;
  contractStatus: string;
  contractId: string | null;
  contractData: ContractRecord | null;
}

const CLIENT_SIGN_BASE = '/apps/public/contract_sign.html';

function MilestoneSummary({ milestones, retainerMonthly, retainerMonths }: {
  milestones: BillingMilestone[];
  retainerMonthly: number;
  retainerMonths: number;
}) {
  if (milestones.length === 0 && retainerMonthly <= 0) {
    return <span className="text-slate-500 italic text-xs">No billing gates</span>;
  }

  return (
    <div className="space-y-1 text-left">
      {milestones.map((m, idx) => (
        <div key={idx} className="flex justify-between gap-3 text-xs">
          <span className="text-slate-400 truncate max-w-[180px]" title={m.label}>
            {m.label.replace(/^Gate \d+: /, 'G' + (idx + 1) + ': ').replace(/^(\d+)\. /, 'M$1: ')}
          </span>
          <span className="font-mono text-brandTeal-400 shrink-0">{formatCurrency(m.amount)}</span>
        </div>
      ))}
      {retainerMonthly > 0 && (
        <div className="flex justify-between gap-3 text-xs border-t border-brandNavy-800 pt-1 mt-1">
          <span className="text-slate-400">MOD 4 ({retainerMonths} mo)</span>
          <span className="font-mono text-brandTeal-400 shrink-0">{formatCurrency(retainerMonthly)}/mo</span>
        </div>
      )}
    </div>
  );
}

function MilestoneDetail({ profile }: { profile: WorkbookProfile }) {
  const schedule = getBillingSchedule(profile);
  const total = getFinancials(profile).total;
  const heading = schedule.milestoneSplit === 'auto'
    ? 'Stage-Gated Phased Commitment Structure'
    : 'Project Milestones';

  return (
    <div className="px-4 pb-4 pt-2 bg-brandNavy-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          {heading} · {milestoneSplitLabel(schedule.milestoneSplit)}
        </span>
        <span className="text-xs font-mono text-brandTeal-400">
          Total contract value: {formatCurrency(total)}{schedule.includeTax ? ' (inc. VAT)' : ''}
        </span>
      </div>

      {schedule.milestones.length > 0 && (
        <div
          className="grid gap-3 mb-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(schedule.milestones.length, 3)}, minmax(0, 1fr))` }}
        >
          {schedule.milestones.map((milestone, idx) => (
            <article key={idx} className="p-3 bg-brandNavy-900 rounded border border-brandNavy-800">
              <div className="font-semibold text-slate-200 text-xs leading-snug">{milestone.label}</div>
              <span className="font-mono text-brandTeal-400 font-bold text-sm mt-1 block">{formatCurrency(milestone.amount)}</span>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{milestone.desc}</p>
            </article>
          ))}
        </div>
      )}

      {schedule.retainerMonthly > 0 && (
        <article className="p-3 bg-brandNavy-900 rounded border border-brandNavy-800">
          <div className="flex justify-between items-center font-semibold text-slate-200 text-xs">
            <span>MOD 4 Care Plan ({schedule.retainerMonths} months)</span>
            <span className="text-brandTeal-400 font-mono">
              {formatCurrency(schedule.retainerMonthly)} / month
              {schedule.includeTax ? ' (inc. VAT)' : ''}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            {schedule.retainerMonths} × {formatCurrency(schedule.retainerMonthly)} ={' '}
            <strong className="text-slate-400">{formatCurrency(schedule.retainerTotal)}</strong>
            {schedule.includeTax ? ' inc. VAT' : ''} total retainer commitment.
          </p>
        </article>
      )}

      {(() => {
        const chaos = resolveChaosTax(profile);
        if (!chaos.value) return null;
        return (
          <article className="p-3 bg-brandNavy-900 rounded border border-rose-900/40 mt-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold">Operational Leakage (Chaos Tax)</span>
              <span className="font-mono text-rose-400 font-bold">{formatCurrency(chaos.value)}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Source: <span className="uppercase font-mono text-slate-400">{chaos.source}</span>
              {' · '}Read-only from workbook profile
            </p>
          </article>
        );
      })()}
    </div>
  );
}

export default function ContractLedger() {
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resetTarget, setResetTarget] = useState<LedgerRow | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isPulling, setIsPulling] = useState(false);
  const [provisionTarget, setProvisionTarget] = useState<WorkbookProfile | null>(null);
  const [provisionResult, setProvisionResult] = useState<{ consoleUrl: string; passcode: string; message: string } | null>(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(adminCol('workbook_profiles'), (snap) => {
        const list: WorkbookProfile[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WorkbookProfile));
        setProfiles(list);
      }),
      onSnapshot(adminCol('contracts_ledger'), (snap) => {
        const list: ContractRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ContractRecord));
        setContracts(list);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleRow = (profileId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };

  const ledgerData = useMemo<LedgerRow[]>(() => {
    return profiles.map((profile) => {
      const contract = contracts.find((c) => c.profileId === profile.id);
      return {
        profileId: profile.id,
        clientCompany: getClientDisplayName(profile),
        quoteId: profile.quoteId || 'N/A',
        contractStatus: contract?.status || 'draft',
        contractId: contract?.id || null,
        contractData: contract || null,
      };
    }).sort((a, b) => {
      const weight: Record<string, number> = { signed: 1, sent: 2, draft: 3 };
      return (weight[a.contractStatus] || 9) - (weight[b.contractStatus] || 9);
    });
  }, [profiles, contracts]);

  const clientSignUrl = (profileId: string, options?: { view?: string; staffPreview?: boolean }) => {
    const params = new URLSearchParams({ contract: profileId });
    if (options?.view) params.set('view', options.view);
    if (options?.staffPreview !== false) params.set('staff', '1');
    return `${window.location.origin}${CLIENT_SIGN_BASE}?${params.toString()}`;
  };

  const copyLink = (profileId: string) => {
    const params = new URLSearchParams({ contract: profileId });
    navigator.clipboard.writeText(`${window.location.origin}${CLIENT_SIGN_BASE}?${params.toString()}`);
    showToast('Client signing link copied!');
  };

  const generateSigningLink = async (profileId: string) => {
    setProcessing(true);
    try {
      const contractId = `contract-${profileId}`;
      await setDoc(adminDoc('contracts_ledger', contractId), {
        id: contractId,
        profileId,
        status: 'sent',
        generatedAt: new Date().toISOString(),
        auditTrail: [{ action: 'Document Generated & Link Sent', timestamp: new Date().toISOString() }],
      });
      copyLink(profileId);
    } finally {
      setProcessing(false);
    }
  };

  const resetContract = async (contractId: string) => {
    setProcessing(true);
    try {
      await deleteDoc(adminDoc('contracts_ledger', contractId));
      showToast('Contract reset to draft.');
    } finally {
      setResetTarget(null);
      setProcessing(false);
    }
  };

  const isProProfile = (profile?: WorkbookProfile) => isPro1AgencyOpsProfile(profile);

  const provisioningBadge = (profile?: WorkbookProfile, contract?: ContractRecord | null) => {
    if (!profile || !isProProfile(profile)) return null;
    if (profile.provisioningStatus === 'provisioning') {
      return <span className="text-amber-400 text-[10px] uppercase font-bold ml-2">Provisioning…</span>;
    }
    if (profile.provisioningStatus === 'failed' || contract?.agencyOpsAutoProvisionError) {
      return (
        <span className="text-rose-400 text-[10px] uppercase font-bold ml-2" title={profile.provisioningError || contract?.agencyOpsAutoProvisionError}>
          Provision failed
        </span>
      );
    }
    if (profile.agencyOpsTenantId) {
      return <span className="text-emerald-400 text-[10px] uppercase font-bold ml-2">Ops ready</span>;
    }
    return null;
  };

  const provisionAgencyOps = async (profile: WorkbookProfile) => {
    setProcessing(true);
    setProvisionResult(null);
    try {
      await bootstrapAuth();
      const data = await provisionAgencyOpsViaFirestore({
        profileId: profile.id,
        clientName: getClientDisplayName(profile),
        repEmail: '',
      });
      setProvisionResult(data);
      showToast('Agency Ops tenant provisioned.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setProcessing(false);
    }
  };

  const pullFromCloud = async () => {
    setIsPulling(true);
    try {
      const [profilesSnap, contractsSnap] = await Promise.all([
        getDocs(adminCol('workbook_profiles')),
        getDocs(adminCol('contracts_ledger')),
      ]);
      const profileList: WorkbookProfile[] = [];
      profilesSnap.forEach((d) => profileList.push({ id: d.id, ...d.data() } as WorkbookProfile));
      const contractList: ContractRecord[] = [];
      contractsSnap.forEach((d) => contractList.push({ id: d.id, ...d.data() } as ContractRecord));
      setProfiles(profileList);
      setContracts(contractList);
      showToast(`Pulled ${profileList.length} SOW profile(s) from cloud.`);
    } catch {
      showToast('Pull failed — check connection.');
    } finally {
      setIsPulling(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'draft') return <span className="text-slate-400 text-xs uppercase">Draft</span>;
    if (status === 'sent') return <span className="text-amber-400 text-xs uppercase">Sent</span>;
    if (status === 'signed') return <span className="text-emerald-400 text-xs uppercase">Executed</span>;
    return <span className="text-slate-500 text-xs">{status}</span>;
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      {resetTarget?.contractId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md text-center">
            <h3 className="font-bold mb-2">Reset contract?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Revoke signing link for <strong>{resetTarget.clientCompany}</strong>
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => resetContract(resetTarget.contractId!)} disabled={processing} className="px-4 py-2 bg-rose-600 rounded text-sm font-bold">
                Reset to Draft
              </button>
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {provisionTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full">
            {!provisionResult ? (
              <>
                <h3 className="font-bold mb-2">Provision Agency Ops tenant?</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Creates a white-label console for <strong>{getClientDisplayName(provisionTarget)}</strong> after contract execution.
                </p>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setProvisionTarget(null)} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Cancel</button>
                  <button
                    type="button"
                    onClick={() => provisionAgencyOps(provisionTarget)}
                    disabled={processing}
                    className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded text-sm font-bold disabled:opacity-50 shadow-sm"
                  >
                    {processing ? 'Provisioning…' : 'Provision'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold mb-2 text-emerald-400">Tenant ready</h3>
                <p className="text-xs text-slate-400 mb-3">{provisionResult.message}</p>
                <div className="text-xs font-mono bg-brandNavy-950 p-3 rounded border border-brandNavy-800 space-y-1 mb-4">
                  <div>URL: {provisionResult.consoleUrl}</div>
                  <div>Passcode: <strong className="text-brandAmber-300">{provisionResult.passcode}</strong></div>
                </div>
                <button
                  type="button"
                  onClick={() => { setProvisionTarget(null); setProvisionResult(null); }}
                  className="w-full px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded text-sm font-bold"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Contract Ledger</h1>
        <p className="text-sm text-slate-400">
          E-signature tracking for SOW agreements with billing milestone schedules from Project Planner.
          Client links open at {CLIENT_SIGN_BASE}.
        </p>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-brandNavy-950 border-b border-brandNavy-800">
          <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
            {ledgerData.length} SOW profile{ledgerData.length === 1 ? '' : 's'} · Firestore sync
          </span>
          <button
            type="button"
            onClick={pullFromCloud}
            disabled={isPulling}
            title="Reload latest SOW profiles and contract records from Firebase"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brandTeal-600 hover:bg-brandTeal-500 text-brandNavy-955 border border-brandTeal-500 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 17l4 4 4-4" /><path d="M12 12v9" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /><path d="M16 16l-4-4-4 4" />
            </svg>
            {isPulling ? 'Pulling…' : 'Pull from Cloud'}
          </button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4 w-8" />
              <th className="p-4">Client</th>
              <th className="p-4">SOW Ref</th>
              <th className="p-4 text-center">Total Value</th>
              <th className="p-4 text-center">Chaos Tax</th>
              <th className="p-4">Billing Milestones</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brandNavy-800">
            {ledgerData.map((item) => {
              const profile = profiles.find((p) => p.id === item.profileId);
              const estValue = getFinancials(profile).total;
              const chaosValue = getChaosTaxValue(profile);
              const chaosSource = resolveChaosTax(profile).source;
              const schedule = getBillingSchedule(profile);
              const isExpanded = expandedRows.has(item.profileId);
              const gateCount = schedule.milestones.length;

              return (
                <Fragment key={item.profileId}>
                  <tr className="hover:bg-brandNavy-800/30">
                    <td className="p-4 pl-3">
                      <button
                        onClick={() => toggleRow(item.profileId)}
                        className="text-slate-500 hover:text-brandTeal-400 text-xs w-5 h-5 flex items-center justify-center"
                        aria-label={isExpanded ? 'Collapse billing details' : 'Expand billing details'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td className="p-4 font-bold">{item.clientCompany}</td>
                    <td className="p-4 font-mono text-xs text-slate-400">{item.quoteId}</td>
                    <td className="p-4 text-center font-mono text-brandTeal-400">{formatCurrency(estValue)}</td>
                    <td className="p-4 text-center">
                      {chaosValue > 0 ? (
                        <div>
                          <span className="font-mono text-rose-400 text-xs">{formatCurrency(chaosValue)}</span>
                          <div className="text-[9px] uppercase text-slate-500 font-mono mt-0.5">{chaosSource}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4 min-w-[220px]">
                      <div className="flex items-start justify-between gap-2">
                        <MilestoneSummary
                          milestones={schedule.milestones}
                          retainerMonthly={schedule.retainerMonthly}
                          retainerMonths={schedule.retainerMonths}
                        />
                        {gateCount > 0 && (
                          <span className="text-[10px] font-mono uppercase text-slate-500 shrink-0 mt-0.5">
                            {milestoneSplitLabel(schedule.milestoneSplit)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {statusBadge(item.contractStatus)}
                      {provisioningBadge(profile, item.contractData)}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {item.contractStatus === 'draft' && (
                        <button
                          onClick={() => generateSigningLink(item.profileId)}
                          disabled={processing}
                          className="px-3 py-1 bg-brandTeal-500 text-brandNavy-955 rounded text-xs font-bold"
                        >
                          Generate Link
                        </button>
                      )}
                      {item.contractStatus === 'sent' && (
                        <>
                          <a href={clientSignUrl(item.profileId)} target="_blank" rel="noreferrer" className="px-3 py-1 bg-brandNavy-800 rounded text-xs inline-block">
                            Preview
                          </a>
                          <button onClick={() => copyLink(item.profileId)} className="px-3 py-1 bg-brandNavy-800 rounded text-xs">Copy Link</button>
                          <button onClick={() => setResetTarget(item)} className="px-2 py-1 text-red-400 text-xs">Reset</button>
                        </>
                      )}
                      {item.contractStatus === 'signed' && (
                        <>
                          <a href={clientSignUrl(item.profileId, { view: 'audit' })} target="_blank" rel="noreferrer" className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                            Audit Trail
                          </a>
                          {isProProfile(profile) && !profile?.agencyOpsTenantId && (
                            <button
                              type="button"
                              onClick={() => { setProvisionResult(null); setProvisionTarget(profile || null); }}
                              disabled={processing}
                              className="px-3 py-1.5 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 rounded text-xs font-bold uppercase tracking-wide shadow-sm"
                            >
                              {profile?.provisioningStatus === 'failed' || profile?.provisioningStatus === 'provisioning'
                                ? 'Retry Provision'
                                : 'Provision Agency Ops'}
                            </button>
                          )}
                          {profile?.agencyOpsTenantId && (
                            <a
                              href={profile.links?.agencyOpsConsoleUrl || `https://kolthoff-consulting.com/agency-ops/?tenant=${encodeURIComponent(profile.agencyOpsTenantId)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1 bg-brandNavy-800 text-brandTeal-400 rounded text-xs"
                            >
                              Console
                            </a>
                          )}
                          <button onClick={() => setResetTarget(item)} className="px-2 py-1 text-red-400 text-xs">Reset</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {isExpanded && profile && (
                    <tr>
                      <td colSpan={8} className="p-0 border-t border-brandNavy-800/50">
                        <MilestoneDetail profile={profile} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {ledgerData.length === 0 && <p className="p-6 text-slate-500 italic">No SOW profiles found.</p>}
      </div>
    </div>
  );
}
