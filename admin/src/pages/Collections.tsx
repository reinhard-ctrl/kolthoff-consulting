import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc } from '../lib/firebase';
import { formatCurrency } from '../lib/financials';
import { getClientDisplayName } from '../lib/engagement-config';
import {
  applyPaymentUpdate,
  computeEffectiveStatus,
  invoicesToCsv,
  isDueWithinDays,
  isOverdue,
  outstandingAmount,
  withholding2307ToCsv,
  registration2303ToCsv,
  formatBillingPeriodLabel,
  type InvoiceRecord,
  type Withholding2307Record,
  type Registration2303Record,
} from '../lib/invoices';
import {
  buildProMonthlyInvoiceDraft,
  buildProSetupInvoiceDraft,
  buildProSubscriptionRows,
  PRO_1_SKU_LABEL,
} from '../lib/subscription-billing';
import { syncPortalBillingForAccessCode } from '../lib/portal-billing-sync';
import { useProduct } from '../lib/product-context';
import { isAgencyOpsStarter } from '../lib/product-config';

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientTin?: string;
  quoteId?: string;
  engagementType?: string;
  productId?: string;
  includeTax?: boolean;
  subscriptionMonths?: number;
  milestoneSplit?: string;
  tasks?: unknown[];
  links?: { portalClientId?: string; crmDealId?: string };
  subscriptionBilling?: { contractSignedAt?: string; enabled?: boolean };
  agencyOpsTenantId?: string;
}

interface ContractRecord {
  id: string;
  profileId: string;
  status: string;
  signedAt?: string;
}

type TabId = 'collections' | 'subscriptions' | '2307' | '2303';

function statusBadge(status: string) {
  if (status === 'paid') return <span className="text-emerald-400 text-xs uppercase font-bold">Paid</span>;
  if (status === 'partial') return <span className="text-amber-400 text-xs uppercase font-bold">Partial</span>;
  if (status === 'overdue') return <span className="text-rose-400 text-xs uppercase font-bold">Overdue</span>;
  if (status === 'sent') return <span className="text-sky-400 text-xs uppercase font-bold">Sent</span>;
  return <span className="text-slate-500 text-xs uppercase">{status}</span>;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Collections() {
  const product = useProduct();
  const agencyOps = isAgencyOpsStarter(product.id);
  const invoicingLabel = product.moduleLabels.invoicing;
  const quotesLabel = product.moduleLabels.quotes;
  const [tab, setTab] = useState<TabId>('collections');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [withholding, setWithholding] = useState<Withholding2307Record[]>([]);
  const [registrations, setRegistrations] = useState<Registration2303Record[]>([]);
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_soon' | 'open'>('all');
  const [paymentTarget, setPaymentTarget] = useState<InvoiceRecord | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [markFullPaid, setMarkFullPaid] = useState(true);
  const [w2307Form, setW2307Form] = useState({
    clientCompany: '',
    period: '',
    amount: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    certificateRef: '',
    notes: '',
  });
  const [w2303Form, setW2303Form] = useState({
    profileId: '',
    clientCompany: '',
    tin: '',
    corNumber: '',
    issueDate: '',
    rdo: '',
    taxType: '',
    verifiedDate: new Date().toISOString().slice(0, 10),
    certificateRef: '',
    notes: '',
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(adminCol('invoices'), (snap) => {
        const list: InvoiceRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as InvoiceRecord));
        setInvoices(list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
      }),
      onSnapshot(adminCol('withholding_2307'), (snap) => {
        const list: Withholding2307Record[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Withholding2307Record));
        setWithholding(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      }),
      onSnapshot(adminCol('registration_2303'), (snap) => {
        const list: Registration2303Record[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Registration2303Record));
        setRegistrations(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      }),
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

  const enriched = useMemo(() => {
    return invoices.map((inv) => ({
      ...inv,
      effectiveStatus: computeEffectiveStatus(inv),
      outstanding: outstandingAmount(inv),
    }));
  }, [invoices]);

  const summary = useMemo(() => {
    const now = new Date();
    let overdueCount = 0;
    let dueSoonCount = 0;
    let openTotal = 0;

    enriched.forEach((inv) => {
      if (inv.effectiveStatus === 'paid' || inv.effectiveStatus === 'draft') return;
      openTotal += inv.outstanding;
      if (isOverdue(inv, now)) overdueCount += 1;
      else if (isDueWithinDays(inv, 7, now)) dueSoonCount += 1;
    });

    return { overdueCount, dueSoonCount, openTotal, totalInvoices: invoices.length };
  }, [enriched, invoices.length]);

  const filtered = useMemo(() => {
    const now = new Date();
    return enriched.filter((inv) => {
      if (filter === 'overdue') return inv.effectiveStatus === 'overdue';
      if (filter === 'due_soon') return isDueWithinDays(inv, 7, now) && inv.effectiveStatus !== 'paid';
      if (filter === 'open') return inv.effectiveStatus !== 'paid' && inv.effectiveStatus !== 'draft';
      return true;
    });
  }, [enriched, filter]);

  const proSubscriptions = useMemo(
    () => (agencyOps ? [] : buildProSubscriptionRows({ profiles, contracts, invoices })),
    [agencyOps, profiles, contracts, invoices],
  );

  const persistInvoice = async (invoice: InvoiceRecord) => {
    await setDoc(adminDoc('invoices', invoice.id), invoice);
    if (invoice.portalAccessCode) {
      const merged = invoices.some((i) => i.id === invoice.id)
        ? invoices.map((i) => (i.id === invoice.id ? invoice : i))
        : [...invoices, invoice];
      await syncPortalBillingForAccessCode(invoice.portalAccessCode, merged);
    }
  };

  const markSent = async (invoice: InvoiceRecord) => {
    setProcessing(true);
    try {
      const now = new Date().toISOString();
      const next = applyPaymentUpdate({ ...invoice, status: 'sent' }, { status: 'sent' });
      next.sentAt = next.sentAt || now;
      await persistInvoice(next);
      showToast(`${invoice.invoiceNumber} marked sent.`);
    } finally {
      setProcessing(false);
    }
  };

  const openPaymentModal = (invoice: InvoiceRecord) => {
    setPaymentTarget(invoice);
    setPaymentRef(invoice.paymentReference || '');
    setPaymentAmount(String(outstandingAmount(invoice)));
    setMarkFullPaid(true);
  };

  const submitPayment = async () => {
    if (!paymentTarget) return;
    setProcessing(true);
    try {
      const total = paymentTarget.total;
      const amountPaid = markFullPaid
        ? total
        : Math.min(total, Math.max(0, Number(paymentAmount) || 0));

      const next = applyPaymentUpdate(paymentTarget, {
        amountPaid,
        paymentReference: paymentRef.trim() || null,
        markFullyPaid: markFullPaid,
      });
      await persistInvoice(next);
      setPaymentTarget(null);
      showToast(`${paymentTarget.invoiceNumber} updated.`);
    } finally {
      setProcessing(false);
    }
  };

  const exportInvoicesCsv = () => {
    downloadCsv(`kolthoff-invoices-${new Date().toISOString().slice(0, 10)}.csv`, invoicesToCsv(invoices, formatCurrency));
    showToast('Invoice register exported.');
  };

  const add2307 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!w2307Form.clientCompany.trim() || !w2307Form.period.trim()) return;
    setProcessing(true);
    try {
      const id = `w2307-${Date.now()}`;
      const record: Withholding2307Record = {
        id,
        clientCompany: w2307Form.clientCompany.trim(),
        period: w2307Form.period.trim(),
        amount: Number(w2307Form.amount) || 0,
        receivedDate: w2307Form.receivedDate,
        certificateRef: w2307Form.certificateRef.trim() || undefined,
        notes: w2307Form.notes.trim() || undefined,
        createdAt: Date.now(),
      };
      await setDoc(adminDoc('withholding_2307', id), record);
      setW2307Form({
        clientCompany: '',
        period: '',
        amount: '',
        receivedDate: new Date().toISOString().slice(0, 10),
        certificateRef: '',
        notes: '',
      });
      showToast('Form 2307 certificate logged.');
    } finally {
      setProcessing(false);
    }
  };

  const select2303Profile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    setW2303Form((prev) => ({
      ...prev,
      profileId,
      clientCompany: profile ? getClientDisplayName(profile) : prev.clientCompany,
      tin: profile?.clientTin || prev.tin,
    }));
  };

  const add2303 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!w2303Form.clientCompany.trim() || !w2303Form.tin.trim()) return;
    setProcessing(true);
    try {
      const id = `w2303-${Date.now()}`;
      const record: Registration2303Record = {
        id,
        clientCompany: w2303Form.clientCompany.trim(),
        profileId: w2303Form.profileId || undefined,
        tin: w2303Form.tin.trim(),
        corNumber: w2303Form.corNumber.trim() || undefined,
        issueDate: w2303Form.issueDate || undefined,
        rdo: w2303Form.rdo.trim() || undefined,
        taxType: w2303Form.taxType.trim() || undefined,
        verifiedDate: w2303Form.verifiedDate,
        certificateRef: w2303Form.certificateRef.trim() || undefined,
        notes: w2303Form.notes.trim() || undefined,
        createdAt: Date.now(),
      };
      await setDoc(adminDoc('registration_2303', id), record);
      setW2303Form({
        profileId: '',
        clientCompany: '',
        tin: '',
        corNumber: '',
        issueDate: '',
        rdo: '',
        taxType: '',
        verifiedDate: new Date().toISOString().slice(0, 10),
        certificateRef: '',
        notes: '',
      });
      showToast('Form 2303 COR logged.');
    } finally {
      setProcessing(false);
    }
  };

  const profileLabel = (profileId: string) => {
    const p = profiles.find((x) => x.id === profileId);
    return p ? getClientDisplayName(p) : profileId;
  };

  const issueProMonthlyInvoice = async (row: ReturnType<typeof buildProSubscriptionRows>[number]) => {
    if (row.nextPeriodAlreadyInvoiced) {
      showToast(`Invoice for ${formatBillingPeriodLabel(row.nextPeriod)} already exists.`);
      return;
    }
    setProcessing(true);
    try {
      const invoice = buildProMonthlyInvoiceDraft({
        profile: row.profile,
        profileId: row.profileId,
        period: row.nextPeriod,
        retainerCostBase: row.retainerCostBase,
        includeTax: row.includeTax,
      });
      await persistInvoice(invoice);
      showToast(`Issued ${invoice.invoiceNumber} for ${formatBillingPeriodLabel(row.nextPeriod)}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to issue subscription invoice.');
    } finally {
      setProcessing(false);
    }
  };

  const issueProSetupInvoice = async (
    row: ReturnType<typeof buildProSubscriptionRows>[number],
    milestoneIndex: number,
  ) => {
    setProcessing(true);
    try {
      const invoice = buildProSetupInvoiceDraft({
        profile: row.profile,
        profileId: row.profileId,
        milestoneIndex,
        billingMilestones: row.schedule.milestones,
        finalProjectCostBase: row.financials.finalProjectCostBase,
        includeTax: row.includeTax,
      });
      await persistInvoice(invoice);
      showToast(`Issued setup invoice ${invoice.invoiceNumber}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to issue setup invoice.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      {paymentTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full">
            <h3 className="font-bold mb-1">Record payment</h3>
            <p className="text-xs text-slate-400 mb-4">{paymentTarget.invoiceNumber} · {formatCurrency(paymentTarget.total)}</p>
            <label className="flex items-center gap-2 text-xs text-slate-300 mb-3">
              <input type="checkbox" checked={markFullPaid} onChange={(e) => setMarkFullPaid(e.target.checked)} />
              Mark fully paid
            </label>
            {!markFullPaid && (
              <div className="mb-3">
                <label className="text-[10px] uppercase text-slate-500 block mb-1">Amount received (PHP)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                />
              </div>
            )}
            <div className="mb-4">
              <label className="text-[10px] uppercase text-slate-500 block mb-1">
                {agencyOps ? 'Payment transfer reference' : 'BDO transfer reference'}
              </label>
              <input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder={agencyOps ? 'e.g. bank ref or client name' : 'e.g. BDO ref or client name'}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPaymentTarget(null)} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Cancel</button>
              <button onClick={submitPayment} disabled={processing} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded text-sm font-bold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">{invoicingLabel}</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            {agencyOps
              ? `Track invoices issued from ${quotesLabel}, record payments, and export for your bookkeeper. Issue new invoices from the ${quotesLabel} invoice tab.`
              : 'Track invoices issued from Project Planner, record BDO payments, and export for your bookkeeper. Issue new invoices from the Planner invoice tab.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportInvoicesCsv}
            className="px-4 py-2 bg-brandNavy-800 hover:bg-brandNavy-750 border border-brandNavy-700 rounded-lg text-xs font-bold uppercase"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase text-slate-500">Open balance</div>
          <div className="text-xl font-bold text-brandTeal-400 font-mono mt-1">{formatCurrency(summary.openTotal)}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase text-slate-500">Overdue</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{summary.overdueCount}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase text-slate-500">Due this week</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{summary.dueSoonCount}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase text-slate-500">Invoices</div>
          <div className="text-xl font-bold text-slate-200 mt-1">{summary.totalInvoices}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('collections')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${tab === 'collections' ? 'bg-brandTeal-500 text-brandNavy-955' : 'bg-brandNavy-800 text-slate-400'}`}
        >
          Invoices
        </button>
        {!agencyOps && (
          <button
            type="button"
            onClick={() => setTab('subscriptions')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${tab === 'subscriptions' ? 'bg-brandTeal-500 text-brandNavy-955' : 'bg-brandNavy-800 text-slate-400'}`}
          >
            PRO Subscriptions
            {proSubscriptions.length > 0 && (
              <span className="ml-1.5 text-[10px] opacity-80">({proSubscriptions.length})</span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('2307')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${tab === '2307' ? 'bg-brandTeal-500 text-brandNavy-955' : 'bg-brandNavy-800 text-slate-400'}`}
        >
          Form 2307
        </button>
        <button
          type="button"
          onClick={() => setTab('2303')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${tab === '2303' ? 'bg-brandTeal-500 text-brandNavy-955' : 'bg-brandNavy-800 text-slate-400'}`}
        >
          Form 2303
        </button>
      </div>

      {tab === 'collections' && (
        <div className="glass-panel overflow-hidden">
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-brandNavy-800 bg-brandNavy-950">
            {(['all', 'open', 'overdue', 'due_soon'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${filter === f ? 'bg-brandTeal-500/20 text-brandTeal-400 border border-brandTeal-500/40' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">Invoice</th>
                <th className="p-4">Client</th>
                <th className="p-4">Milestone</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-right">Outstanding</th>
                <th className="p-4">Due</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandNavy-800">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-brandNavy-800/30">
                  <td className="p-4 font-mono text-xs text-brandTeal-400">{inv.invoiceNumber}</td>
                  <td className="p-4 font-bold">{inv.clientCompany || profileLabel(inv.profileId)}</td>
                  <td className="p-4 text-xs text-slate-400 max-w-[200px] truncate" title={inv.milestoneLabel}>{inv.milestoneLabel}</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(inv.total)}</td>
                  <td className="p-4 text-right font-mono text-amber-400">{formatCurrency(inv.outstanding)}</td>
                  <td className="p-4 text-xs text-slate-500 font-mono">{inv.dueDate || '—'}</td>
                  <td className="p-4 text-center">{statusBadge(inv.effectiveStatus)}</td>
                  <td className="p-4 text-right space-x-2">
                    {inv.effectiveStatus === 'draft' && (
                      <button onClick={() => markSent(inv)} disabled={processing} className="px-2 py-1 bg-brandNavy-800 rounded text-xs">Mark sent</button>
                    )}
                    {inv.effectiveStatus !== 'paid' && inv.effectiveStatus !== 'draft' && (
                      <button onClick={() => openPaymentModal(inv)} disabled={processing} className="px-2 py-1 bg-brandTeal-500/20 text-brandTeal-400 rounded text-xs font-bold">
                        Record payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-6 text-slate-500 italic">
              {agencyOps
                ? `No invoices yet. Open ${quotesLabel} → Invoice tab → Issue Invoice to create one.`
                : 'No invoices yet. Open Project Planner → Invoice tab → Issue Invoice to create one.'}
            </p>
          )}
        </div>
      )}

      {tab === 'subscriptions' && !agencyOps && (
        <div className="space-y-4">
          <div className="glass-panel p-4 border border-brandAmber-500/20">
            <h2 className="text-xs font-mono uppercase tracking-wider text-brandAmber-400 font-bold mb-1">
              {PRO_1_SKU_LABEL} billing rhythm
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              Signed PRO contracts appear here. Issue setup milestone invoices (typically 50/50), then monthly platform
              subscription invoices each billing period. Invoices are saved to the register and appear on the Invoices tab.
            </p>
          </div>
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-4">Client</th>
                  <th className="p-4">Signed</th>
                  <th className="p-4 text-right">Monthly</th>
                  <th className="p-4">Setup milestones</th>
                  <th className="p-4">Subscription</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandNavy-800">
                {proSubscriptions.map((row) => (
                  <tr key={row.profileId} className="hover:bg-brandNavy-800/30 align-top">
                    <td className="p-4">
                      <div className="font-bold">{row.clientCompany}</div>
                      <div className="font-mono text-[10px] text-slate-500 mt-0.5">{row.quoteId}</div>
                      {row.agencyOpsTenantId && (
                        <div className="text-[10px] text-emerald-400 mt-1 font-mono">{row.agencyOpsTenantId}</div>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500 font-mono">
                      {row.contractSignedAt ? row.contractSignedAt.slice(0, 10) : '—'}
                    </td>
                    <td className="p-4 text-right font-mono text-brandTeal-400">
                      {formatCurrency(row.monthlyAmount)}
                      <span className="text-slate-500 text-[10px]">/mo</span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1.5">
                        {row.setupStatus.map(({ milestone, index, invoiced }) => (
                          <div key={index} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className={`truncate max-w-[220px] ${invoiced ? 'text-slate-500 line-through' : 'text-slate-300'}`} title={milestone.label}>
                              {milestone.label}
                            </span>
                            {invoiced ? (
                              <span className="text-emerald-400 text-[10px] uppercase font-bold shrink-0">Invoiced</span>
                            ) : (
                              <button
                                type="button"
                                disabled={processing}
                                onClick={() => issueProSetupInvoice(row, index)}
                                className="px-2 py-0.5 bg-brandNavy-800 hover:bg-brandNavy-750 border border-brandNavy-700 rounded text-[10px] font-bold shrink-0"
                              >
                                Issue
                              </button>
                            )}
                          </div>
                        ))}
                        {row.setupStatus.length === 0 && (
                          <span className="text-slate-600 text-xs italic">No setup gates</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="text-slate-300">
                        {row.monthsBilled} / {row.subscriptionMonths} months billed
                      </div>
                      <div className="text-slate-500 mt-1">
                        Next: <span className="font-mono text-brandAmber-300">{formatBillingPeriodLabel(row.nextPeriod)}</span>
                      </div>
                      {row.nextPeriodAlreadyInvoiced && (
                        <span className="text-emerald-400 text-[10px] uppercase font-bold block mt-1">Next period invoiced</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        disabled={processing || row.nextPeriodAlreadyInvoiced || row.monthlyAmount <= 0}
                        onClick={() => issueProMonthlyInvoice(row)}
                        className="px-3 py-1 bg-brandAmber-500/20 text-brandAmber-300 rounded text-xs font-bold disabled:opacity-40"
                      >
                        Issue {formatBillingPeriodLabel(row.nextPeriod)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proSubscriptions.length === 0 && (
              <p className="p-6 text-slate-500 italic">
                No signed PRO 1 contracts yet. Close a deal in CRM, sign the contract, then return here to run setup and subscription billing.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === '2307' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={add2307} className="glass-panel p-5 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-slate-300">Log certificate received</h2>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Client</label>
              <input required value={w2307Form.clientCompany} onChange={(e) => setW2307Form({ ...w2307Form, clientCompany: e.target.value })} className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">Period</label>
                <input required placeholder="2026-Q1" value={w2307Form.period} onChange={(e) => setW2307Form({ ...w2307Form, period: e.target.value })} className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700" />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">Amount (PHP)</label>
                <input type="number" value={w2307Form.amount} onChange={(e) => setW2307Form({ ...w2307Form, amount: e.target.value })} className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Received date</label>
              <input type="date" value={w2307Form.receivedDate} onChange={(e) => setW2307Form({ ...w2307Form, receivedDate: e.target.value })} className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Certificate reference</label>
              <input value={w2307Form.certificateRef} onChange={(e) => setW2307Form({ ...w2307Form, certificateRef: e.target.value })} className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Notes</label>
              <textarea value={w2307Form.notes} onChange={(e) => setW2307Form({ ...w2307Form, notes: e.target.value })} rows={2} className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 resize-none" />
            </div>
            <button type="submit" disabled={processing} className="w-full py-2 bg-brandTeal-500 text-brandNavy-955 font-bold rounded-lg text-xs uppercase">
              Add 2307 record
            </button>
          </form>

          <div className="glass-panel overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-brandNavy-800">
              <span className="text-[10px] font-mono uppercase text-slate-500">Withholding certificates</span>
              <button
                type="button"
                onClick={() => downloadCsv(`kolthoff-2307-${new Date().toISOString().slice(0, 10)}.csv`, withholding2307ToCsv(withholding))}
                className="text-[10px] font-bold uppercase text-brandTeal-400"
              >
                Export CSV
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-3">Client</th>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandNavy-800">
                {withholding.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3 font-bold">{row.clientCompany}</td>
                    <td className="p-3 font-mono text-xs">{row.period}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(row.amount)}</td>
                    <td className="p-3 text-xs text-slate-500">{row.receivedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {withholding.length === 0 && <p className="p-4 text-slate-500 italic text-sm">No Form 2307 certificates logged yet.</p>}
          </div>
        </div>
      )}

      {tab === '2303' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={add2303} className="glass-panel p-5 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-slate-300">Log Certificate of Registration</h2>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              BIR Form 2303 (COR) confirms a client&apos;s tax registration. Verify before first invoice or contract signing.
            </p>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Link to planner profile</label>
              <select
                value={w2303Form.profileId}
                onChange={(e) => select2303Profile(e.target.value)}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
              >
                <option value="">— Manual entry —</option>
                {profiles
                  .slice()
                  .sort((a, b) => getClientDisplayName(a).localeCompare(getClientDisplayName(b)))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {getClientDisplayName(p)}{p.quoteId ? ` · ${p.quoteId}` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Registered name</label>
              <input
                required
                value={w2303Form.clientCompany}
                onChange={(e) => setW2303Form({ ...w2303Form, clientCompany: e.target.value })}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">TIN</label>
                <input
                  required
                  placeholder="000-000-000-000"
                  value={w2303Form.tin}
                  onChange={(e) => setW2303Form({ ...w2303Form, tin: e.target.value })}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">COR number</label>
                <input
                  value={w2303Form.corNumber}
                  onChange={(e) => setW2303Form({ ...w2303Form, corNumber: e.target.value })}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">Issue date</label>
                <input
                  type="date"
                  value={w2303Form.issueDate}
                  onChange={(e) => setW2303Form({ ...w2303Form, issueDate: e.target.value })}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">Verified date</label>
                <input
                  type="date"
                  value={w2303Form.verifiedDate}
                  onChange={(e) => setW2303Form({ ...w2303Form, verifiedDate: e.target.value })}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">RDO</label>
                <input
                  placeholder="e.g. 39 South QC"
                  value={w2303Form.rdo}
                  onChange={(e) => setW2303Form({ ...w2303Form, rdo: e.target.value })}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-500 block mb-1">Tax type</label>
                <select
                  value={w2303Form.taxType}
                  onChange={(e) => setW2303Form({ ...w2303Form, taxType: e.target.value })}
                  className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
                >
                  <option value="">— Select —</option>
                  <option value="VAT">VAT</option>
                  <option value="NON-VAT">Non-VAT</option>
                  <option value="PERCENTAGE">Percentage Tax</option>
                  <option value="EXEMPT">Tax Exempt</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Certificate reference</label>
              <input
                placeholder="Scan filename or Drive link"
                value={w2303Form.certificateRef}
                onChange={(e) => setW2303Form({ ...w2303Form, certificateRef: e.target.value })}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Notes</label>
              <textarea
                value={w2303Form.notes}
                onChange={(e) => setW2303Form({ ...w2303Form, notes: e.target.value })}
                rows={2}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 resize-none"
              />
            </div>
            <button type="submit" disabled={processing} className="w-full py-2 bg-brandTeal-500 text-brandNavy-955 font-bold rounded-lg text-xs uppercase">
              Add 2303 record
            </button>
          </form>

          <div className="glass-panel overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-brandNavy-800">
              <span className="text-[10px] font-mono uppercase text-slate-500">Certificates of registration</span>
              <button
                type="button"
                onClick={() => downloadCsv(`kolthoff-2303-${new Date().toISOString().slice(0, 10)}.csv`, registration2303ToCsv(registrations))}
                className="text-[10px] font-bold uppercase text-brandTeal-400"
              >
                Export CSV
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-3">Client</th>
                  <th className="p-3">TIN</th>
                  <th className="p-3">Tax type</th>
                  <th className="p-3">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandNavy-800">
                {registrations.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3">
                      <div className="font-bold">{row.clientCompany}</div>
                      {row.corNumber && <div className="text-[10px] font-mono text-slate-500 mt-0.5">COR {row.corNumber}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs">{row.tin}</td>
                    <td className="p-3 text-xs text-slate-400">{row.taxType || '—'}</td>
                    <td className="p-3 text-xs text-slate-500">{row.verifiedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registrations.length === 0 && (
              <p className="p-4 text-slate-500 italic text-sm">No Form 2303 certificates logged yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
