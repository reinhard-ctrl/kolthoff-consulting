/**
 * Kolthoff OS — invoice / collections helpers (AR layer, not full accounting).
 * Used by Project Planner, admin Collections, and portal billing sync.
 */

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'partial', 'overdue'];

export function formatInvoiceNumber(quoteId, suffix) {
  const base = String(quoteId || 'KC0000').replace(/^KC/i, 'INV');
  const cleanSuffix = String(suffix || '01').trim() || '01';
  return `${base}${cleanSuffix}`;
}

export function buildInvoiceDocId(profileId, invoiceNumberSuffix) {
  const suffix = String(invoiceNumberSuffix || '01').trim().replace(/[^\w-]/g, '') || '01';
  return `inv-${profileId}-${suffix}`;
}

export function parseDueDate(value) {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

export function formatBillingPeriodLabel(period) {
  if (!period || typeof period !== 'string') return '';
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return period;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function currentBillingPeriod() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function suggestRetainerMonthlySuffix(period) {
  const clean = String(period || '').replace(/[^\d]/g, '');
  if (clean.length >= 6) return `M${clean.slice(0, 6)}`;
  return 'M01';
}

export function resolveMilestoneLabel(invoiceMilestone, billingMilestones, options = {}) {
  const prefix = options.isAddendum ? 'Addendum — ' : '';
  if (invoiceMilestone === 'full') {
    return options.isAddendum
      ? `${prefix}${options.addendumTitle || 'Full payment'}`
      : 'Full project payment';
  }
  if (invoiceMilestone === 'retainer') {
    if (options.isProEngagement) {
      const label = options.proLabel || 'PRO Subscription';
      const months = options.subscriptionMonths;
      return months ? `${label} — Full Subscription (${months} mo)` : `${label} — Full Subscription`;
    }
    return 'MOD 4 Care Plan — full subscription';
  }
  if (invoiceMilestone === 'retainer_monthly') {
    const periodLabel = formatBillingPeriodLabel(options.billingPeriod);
    const productLabel = options.isProEngagement
      ? (options.proLabel || 'PRO Subscription')
      : 'MOD 4 Care Plan';
    return periodLabel
      ? `${productLabel} — ${periodLabel}`
      : `${productLabel} — monthly retainer`;
  }
  if (invoiceMilestone === 'custom') {
    return options.isAddendum ? `${prefix}Custom amount` : 'Custom milestone';
  }
  if (typeof invoiceMilestone === 'string' && invoiceMilestone.startsWith('milestone_')) {
    const idx = parseInt(invoiceMilestone.split('_')[1], 10);
    if (billingMilestones?.[idx]?.label) {
      const label = billingMilestones[idx].label;
      return options.isAddendum ? `${prefix}${label}` : label;
    }
  }
  return options.isAddendum ? `${prefix}Payment` : 'Milestone payment';
}

/**
 * Mirror Project Planner computedInvoiceCost — amounts from profile + milestone selection.
 */
export function computeInvoiceAmounts(ctx) {
  const {
    invoiceMilestone = 'full',
    customInvoiceAmount = 0,
    billingMilestones = [],
    finalProjectCostBase = 0,
    retainerCostBase = 0,
    retainerCostTotalBase = 0,
    includeTax = false,
  } = ctx;

  let baseAmount = 0;
  if (invoiceMilestone === 'full') {
    baseAmount = finalProjectCostBase + retainerCostTotalBase;
  } else if (typeof invoiceMilestone === 'string' && invoiceMilestone.startsWith('milestone_')) {
    const idx = parseInt(invoiceMilestone.split('_')[1], 10);
    if (billingMilestones[idx]) {
      baseAmount = includeTax
        ? Math.round(billingMilestones[idx].amount / 1.12)
        : billingMilestones[idx].amount;
    }
  } else if (invoiceMilestone === 'retainer_monthly') {
    baseAmount = retainerCostBase;
  } else if (invoiceMilestone === 'retainer') {
    baseAmount = retainerCostTotalBase;
  } else if (invoiceMilestone === 'custom') {
    baseAmount = Number(customInvoiceAmount) || 0;
  }

  const vatAmount = includeTax ? Math.round(baseAmount * 0.12) : 0;
  return {
    subtotal: baseAmount,
    vat: vatAmount,
    total: baseAmount + vatAmount,
  };
}

export function computeEffectiveStatus(invoice, asOf = new Date()) {
  const total = Number(invoice?.total) || 0;
  const paid = Number(invoice?.amountPaid) || 0;
  const stored = invoice?.status || 'draft';

  if (stored === 'paid' || (total > 0 && paid >= total)) return 'paid';
  if (paid > 0 && paid < total) return 'partial';
  if (stored === 'draft') return 'draft';

  const due = parseDueDate(invoice?.dueDate);
  if (due && startOfDay(due) < startOfDay(asOf) && paid < total) return 'overdue';
  return stored === 'sent' ? 'sent' : stored;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function portalStatusLabel(effectiveStatus) {
  const map = {
    paid: 'Paid',
    partial: 'Partial',
    overdue: 'Overdue',
    sent: 'Pending',
    draft: 'Draft',
  };
  return map[effectiveStatus] || 'Pending';
}

export function buildInvoiceRecord(input) {
  const {
    profileId,
    profile,
    invoiceMilestone,
    invoiceNumberSuffix,
    invoiceDueDate,
    issueDate,
    amounts,
    milestoneLabel,
    portalAccessCode,
    status = 'sent',
    billingPeriod = null,
    addendumId = null,
    addendumRef = null,
  } = input;

  const quoteId = profile?.quoteId || '';
  const invoiceNumber = formatInvoiceNumber(quoteId, invoiceNumberSuffix);
  const id = buildInvoiceDocId(profileId, invoiceNumberSuffix);
  const now = new Date().toISOString();
  const resolvedLabel = milestoneLabel || resolveMilestoneLabel(invoiceMilestone, [], {
    billingPeriod,
    isAddendum: Boolean(addendumId),
    addendumTitle: addendumRef || null,
  });

  return {
    id,
    profileId,
    quoteId,
    invoiceNumber,
    clientCompany: profile?.clientCompany || profile?.clientName || 'Client',
    portalAccessCode: portalAccessCode || null,
    milestoneKey: invoiceMilestone,
    milestoneLabel: resolvedLabel,
    billingPeriod: billingPeriod || null,
    addendumId: addendumId || null,
    addendumRef: addendumRef || null,
    documentType: addendumId ? 'addendum' : 'milestone',
    subtotal: amounts.subtotal,
    vat: amounts.vat,
    total: amounts.total,
    includeTax: profile?.includeTax || false,
    amountPaid: 0,
    status,
    issueDate: issueDate || now.slice(0, 10),
    dueDate: invoiceDueDate || '',
    sentAt: status === 'sent' ? now : null,
    paidAt: null,
    paymentReference: null,
    notes: addendumRef ? `Addendum ${addendumRef}` : null,
    documentLink: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    auditTrail: [{ action: status === 'sent' ? 'Invoice issued' : 'Invoice created', timestamp: now }],
  };
}

export function applyPaymentUpdate(invoice, update) {
  const now = new Date().toISOString();
  const total = Number(invoice.total) || 0;
  let amountPaid = Number(update.amountPaid);
  if (!Number.isFinite(amountPaid)) {
    amountPaid = update.markFullyPaid ? total : Number(invoice.amountPaid) || 0;
  }
  amountPaid = Math.max(0, Math.min(amountPaid, total));

  const next = {
    ...invoice,
    amountPaid,
    paymentReference: update.paymentReference ?? invoice.paymentReference ?? null,
    paidAt: update.paidAt ?? (amountPaid >= total && total > 0 ? now : invoice.paidAt),
    notes: update.notes ?? invoice.notes ?? null,
    updatedAt: Date.now(),
    auditTrail: [...(invoice.auditTrail || [])],
  };

  if (update.status) {
    next.status = update.status;
  } else {
    next.status = amountPaid >= total && total > 0 ? 'paid' : amountPaid > 0 ? 'partial' : invoice.status;
  }

  const action = update.markFullyPaid || amountPaid >= total
    ? 'Marked paid'
    : amountPaid > 0
      ? `Partial payment recorded (${amountPaid})`
      : update.status === 'sent'
        ? 'Marked sent'
        : 'Invoice updated';

  next.auditTrail.push({ action, timestamp: now, detail: update.paymentReference || undefined });
  return next;
}

export function mapInvoiceToPortalContract(invoice, asOf = new Date()) {
  const effective = computeEffectiveStatus(invoice, asOf);
  if (effective === 'draft') return null;

  return {
    id: invoice.id,
    invoiceId: invoice.id,
    title: `${invoice.invoiceNumber} — ${invoice.milestoneLabel}`,
    date: invoice.issueDate || (invoice.sentAt ? invoice.sentAt.slice(0, 10) : ''),
    dueDate: invoice.dueDate || '',
    amount: invoice.total,
    status: portalStatusLabel(effective),
    link: invoice.documentLink || '',
  };
}

export function mergePortalContractsFromInvoices(existingContracts, invoices, asOf = new Date()) {
  const manual = (existingContracts || []).filter((c) => !c.invoiceId);
  const fromInvoices = (invoices || [])
    .map((inv) => mapInvoiceToPortalContract(inv, asOf))
    .filter(Boolean);

  const byInvoiceId = new Map();
  fromInvoices.forEach((row) => {
    if (row.invoiceId) byInvoiceId.set(row.invoiceId, row);
  });

  return [...manual, ...Array.from(byInvoiceId.values())];
}

export function isDueWithinDays(invoice, days, asOf = new Date()) {
  const effective = computeEffectiveStatus(invoice, asOf);
  if (effective === 'paid' || effective === 'draft') return false;
  const due = parseDueDate(invoice.dueDate);
  if (!due) return false;
  const end = startOfDay(asOf);
  end.setDate(end.getDate() + days);
  const dueDay = startOfDay(due);
  return dueDay >= startOfDay(asOf) && dueDay <= end;
}

export function isOverdue(invoice, asOf = new Date()) {
  return computeEffectiveStatus(invoice, asOf) === 'overdue';
}

export function outstandingAmount(invoice) {
  const total = Number(invoice.total) || 0;
  const paid = Number(invoice.amountPaid) || 0;
  return Math.max(0, total - paid);
}

export function invoicesToCsv(invoices, formatCurrencyFn) {
  const fmt = formatCurrencyFn || ((n) => String(n));
  const header = [
    'Invoice Number',
    'Client',
    'SOW Ref',
    'Milestone',
    'Issue Date',
    'Due Date',
    'Subtotal',
    'VAT',
    'Total',
    'Amount Paid',
    'Outstanding',
    'Status',
    'Payment Reference',
    'Paid At',
  ];

  const rows = (invoices || []).map((inv) => {
    const effective = computeEffectiveStatus(inv);
    return [
      inv.invoiceNumber,
      inv.clientCompany,
      inv.quoteId,
      inv.milestoneLabel,
      inv.issueDate,
      inv.dueDate,
      inv.subtotal,
      inv.vat,
      inv.total,
      inv.amountPaid || 0,
      outstandingAmount(inv),
      effective,
      inv.paymentReference || '',
      inv.paidAt || '',
    ];
  });

  const escape = (val) => {
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

export function withholding2307ToCsv(records) {
  const header = ['Client', 'Period', 'Amount (PHP)', 'Received Date', 'Certificate Ref', 'Notes'];
  const rows = (records || []).map((r) => [
    r.clientCompany,
    r.period,
    r.amount,
    r.receivedDate,
    r.certificateRef || '',
    r.notes || '',
  ]);
  const escape = (val) => {
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}
