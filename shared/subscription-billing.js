/**
 * PRO 1 subscription billing rhythm — setup milestones + monthly platform fee.
 * Used by Kolthoff OS Collections and contract-sign automation.
 */
import {
  buildInvoiceRecord,
  computeInvoiceAmounts,
  resolveMilestoneLabel,
  suggestRetainerMonthlySuffix,
} from './invoices.js';
import { getBillingSchedule, getFinancials } from './financials.js';

export const PRO_1_SKU_LABEL = 'PRO 1 · Agency Ops';

export function isPro1Profile(profile) {
  if (!profile) return false;
  if (profile.productId === 'pro1') return true;
  if (profile.selectedPackageId === 'pro1-agency-ops-starter') return true;
  if (profile.engagementType === 'product') {
    return !profile.productId || profile.productId === 'pro1';
  }
  return false;
}

export function profileInvoices(invoices, profileId) {
  return (invoices || []).filter((inv) => inv.profileId === profileId);
}

export function getMonthlyInvoices(invoices, profileId) {
  return profileInvoices(invoices, profileId).filter((inv) => inv.milestoneKey === 'retainer_monthly');
}

export function getBilledPeriods(invoices, profileId) {
  return getMonthlyInvoices(invoices, profileId)
    .map((inv) => inv.billingPeriod)
    .filter(Boolean);
}

export function parseBillingPeriod(period) {
  const match = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function formatBillingPeriod(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function addMonthsToPeriod(period, delta) {
  const parsed = parseBillingPeriod(period);
  if (!parsed) return period;
  let { year, month } = parsed;
  month += delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return formatBillingPeriod(year, month);
}

export function contractStartPeriod(signedAt) {
  const d = signedAt ? new Date(signedAt) : new Date();
  if (Number.isNaN(d.getTime())) return formatBillingPeriod(new Date().getFullYear(), new Date().getMonth() + 1);
  return formatBillingPeriod(d.getFullYear(), d.getMonth() + 1);
}

export function suggestNextBillingPeriod(billedPeriods, startPeriod) {
  const sorted = [...new Set(billedPeriods || [])].sort();
  if (sorted.length === 0) return startPeriod;
  return addMonthsToPeriod(sorted[sorted.length - 1], 1);
}

export function hasInvoiceForPeriod(invoices, profileId, period) {
  return getMonthlyInvoices(invoices, profileId).some((inv) => inv.billingPeriod === period);
}

export function hasSetupInvoice(invoices, profileId, milestoneIndex) {
  const key = `milestone_${milestoneIndex}`;
  return profileInvoices(invoices, profileId).some((inv) => inv.milestoneKey === key);
}

export function dueDateForBillingPeriod(period) {
  const parsed = parseBillingPeriod(period);
  if (!parsed) return '';
  let dueMonth = parsed.month + 1;
  let dueYear = parsed.year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  const d = new Date(dueYear, dueMonth - 1, 15);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function retainerCostBaseFromProfile(profile) {
  const fin = getFinancials(profile);
  const months = fin.subscriptionMonths || 12;
  if (fin.retainerCostTotalBase <= 0) return 0;
  return Math.round(fin.retainerCostTotalBase / months);
}

export function buildProMonthlyInvoiceDraft(input) {
  const { profile, profileId, period, retainerCostBase, includeTax } = input;
  const amounts = computeInvoiceAmounts({
    invoiceMilestone: 'retainer_monthly',
    retainerCostBase,
    includeTax,
  });
  const milestoneLabel = resolveMilestoneLabel('retainer_monthly', [], {
    billingPeriod: period,
    isProEngagement: true,
    proLabel: PRO_1_SKU_LABEL,
  });
  const suffix = suggestRetainerMonthlySuffix(period);
  const quoteId = profile.quoteId || '';
  const portalAccessCode = profile.links?.portalClientId || profile.links?.crmDealId || quoteId || null;

  return buildInvoiceRecord({
    profileId,
    profile,
    invoiceMilestone: 'retainer_monthly',
    invoiceNumberSuffix: suffix,
    invoiceDueDate: dueDateForBillingPeriod(period),
    issueDate: new Date().toISOString().slice(0, 10),
    amounts,
    milestoneLabel,
    portalAccessCode,
    status: 'sent',
    billingPeriod: period,
  });
}

export function buildProSetupInvoiceDraft(input) {
  const {
    profile,
    profileId,
    milestoneIndex,
    billingMilestones,
    finalProjectCostBase,
    includeTax,
  } = input;
  const milestoneKey = `milestone_${milestoneIndex}`;
  const amounts = computeInvoiceAmounts({
    invoiceMilestone: milestoneKey,
    billingMilestones,
    finalProjectCostBase,
    includeTax,
  });
  const milestoneLabel = resolveMilestoneLabel(milestoneKey, billingMilestones, {
    isProEngagement: true,
    proLabel: PRO_1_SKU_LABEL,
  });
  const suffix = String(milestoneIndex + 1).padStart(2, '0');
  const quoteId = profile.quoteId || '';
  const portalAccessCode = profile.links?.portalClientId || profile.links?.crmDealId || quoteId || null;

  return buildInvoiceRecord({
    profileId,
    profile,
    invoiceMilestone: milestoneKey,
    invoiceNumberSuffix: suffix,
    invoiceDueDate: dueDateForBillingPeriod(contractStartPeriod(profile.subscriptionBilling?.contractSignedAt)),
    issueDate: new Date().toISOString().slice(0, 10),
    amounts,
    milestoneLabel,
    portalAccessCode,
    status: 'sent',
  });
}

/**
 * @returns {Array<object>} Active PRO 1 subscription rows for Collections UI
 */
export function buildProSubscriptionRows({ profiles, contracts, invoices }) {
  const signedByProfile = new Map(
    (contracts || [])
      .filter((c) => c.status === 'signed' && c.profileId)
      .map((c) => [c.profileId, c]),
  );

  return (profiles || [])
    .filter(isPro1Profile)
    .filter((p) => signedByProfile.has(p.id))
    .map((profile) => {
      const contract = signedByProfile.get(profile.id);
      const schedule = getBillingSchedule(profile);
      const financials = getFinancials(profile);
      const billedPeriods = getBilledPeriods(invoices, profile.id);
      const startPeriod = contractStartPeriod(
        profile.subscriptionBilling?.contractSignedAt || contract.signedAt,
      );
      const nextPeriod = suggestNextBillingPeriod(billedPeriods, startPeriod);
      const retainerCostBase = retainerCostBaseFromProfile(profile);
      const setupStatus = schedule.milestones.map((milestone, idx) => ({
        milestone,
        index: idx,
        invoiced: hasSetupInvoice(invoices, profile.id, idx),
      }));

      const monthsBilled = billedPeriods.length;
      const subscriptionMonths = financials.subscriptionMonths || schedule.retainerMonths || 12;

      return {
        profile,
        profileId: profile.id,
        clientCompany: profile.clientCompany || profile.clientName || profile.id,
        quoteId: profile.quoteId || '',
        contractSignedAt: contract.signedAt,
        monthlyAmount: schedule.retainerMonthly,
        retainerCostBase,
        subscriptionMonths,
        monthsBilled,
        monthsRemaining: Math.max(0, subscriptionMonths - monthsBilled),
        billedPeriods,
        nextPeriod,
        nextPeriodAlreadyInvoiced: hasInvoiceForPeriod(invoices, profile.id, nextPeriod),
        setupStatus,
        includeTax: profile.includeTax || false,
        schedule,
        financials,
        agencyOpsTenantId: profile.agencyOpsTenantId,
      };
    })
    .sort((a, b) => (b.contractSignedAt || '').localeCompare(a.contractSignedAt || ''));
}
