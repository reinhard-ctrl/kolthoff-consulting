import { useEffect, useMemo, useState } from 'react';
import { deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc } from '../lib/firebase';
import { formatCurrency, getFinancials } from '../lib/financials';

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  quoteId?: string;
  tasks?: { selected?: boolean; estHours?: number; tier?: string; isMonthlyRetainer?: boolean; category?: string }[];
  frictionBuffer?: number;
  discountPercent?: number;
  includeTax?: boolean;
  applyCreditBack?: boolean;
  subscriptionMonths?: number;
}

interface ContractRecord {
  id: string;
  profileId: string;
  status: string;
  signedAt?: string;
  signedBy?: string;
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

export default function ContractLedger() {
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resetTarget, setResetTarget] = useState<LedgerRow | null>(null);

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

  const ledgerData = useMemo<LedgerRow[]>(() => {
    return profiles.map((profile) => {
      const contract = contracts.find((c) => c.profileId === profile.id);
      return {
        profileId: profile.id,
        clientCompany: profile.clientCompany || 'Unknown Client',
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

  const clientSignUrl = (profileId: string) =>
    `${window.location.origin}${CLIENT_SIGN_BASE}?contract=${profileId}`;

  const copyLink = (profileId: string) => {
    navigator.clipboard.writeText(clientSignUrl(profileId));
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

      <h1 className="text-2xl font-bold mb-2">Contract Ledger</h1>
      <p className="text-sm text-slate-400 mb-6">E-signature tracking for SOW agreements. Client links open at {CLIENT_SIGN_BASE}.</p>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Client</th>
              <th className="p-4">SOW Ref</th>
              <th className="p-4 text-center">Value</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brandNavy-800">
            {ledgerData.map((item) => {
              const profile = profiles.find((p) => p.id === item.profileId);
              const estValue = getFinancials(profile).total;
              return (
                <tr key={item.profileId} className="hover:bg-brandNavy-800/30">
                  <td className="p-4 font-bold">{item.clientCompany}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">{item.quoteId}</td>
                  <td className="p-4 text-center font-mono text-brandTeal-400">{formatCurrency(estValue)}</td>
                  <td className="p-4 text-center">{statusBadge(item.contractStatus)}</td>
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
                        <a href={`${clientSignUrl(item.profileId)}&view=audit`} target="_blank" rel="noreferrer" className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                          Audit Trail
                        </a>
                        <button onClick={() => setResetTarget(item)} className="px-2 py-1 text-red-400 text-xs">Reset</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ledgerData.length === 0 && <p className="p-6 text-slate-500 italic">No SOW profiles found.</p>}
      </div>
    </div>
  );
}
