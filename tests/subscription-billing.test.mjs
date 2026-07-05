/**
 * Subscription billing rhythm tests.
 * Run: node tests/subscription-billing.test.mjs
 */
import assert from 'node:assert/strict';
import {
  isPro1Profile,
  buildProSubscriptionRows,
  buildProMonthlyInvoiceDraft,
  suggestNextBillingPeriod,
  contractStartPeriod,
  dueDateForBillingPeriod,
  hasInvoiceForPeriod,
} from '../shared/subscription-billing.js';
import { resolveMilestoneLabel } from '../shared/invoices.js';

assert.equal(isPro1Profile({ productId: 'pro1' }), true);
assert.equal(isPro1Profile({ engagementType: 'product', productId: 'pro2' }), false);
assert.equal(isPro1Profile({ engagementType: 'service' }), false);

const proLabel = resolveMilestoneLabel('retainer_monthly', [], {
  billingPeriod: '2026-07',
  isProEngagement: true,
  proLabel: 'PRO 1 · Agency Ops',
});
assert.equal(proLabel, 'PRO 1 · Agency Ops — July 2026');

assert.equal(suggestNextBillingPeriod(['2026-05', '2026-06'], '2026-05'), '2026-07');
assert.equal(suggestNextBillingPeriod([], '2026-08'), '2026-08');
assert.equal(contractStartPeriod('2026-03-15T10:00:00.000Z'), '2026-03');
assert.ok(dueDateForBillingPeriod('2026-07').includes('2026'));

const profile = {
  id: 'client-pro-1',
  clientCompany: 'Pixel Wave Agency',
  quoteId: 'Q-2026-PIXEL',
  engagementType: 'product',
  productId: 'pro1',
  includeTax: true,
  subscriptionMonths: 12,
  milestoneSplit: '50-50',
  frictionBuffer: 0,
  discountPercent: 0,
  tasks: [
    { id: 'pro1-01', selected: true, estHours: 4, tier: 'senior', isMonthlyRetainer: false, category: 'PRO 1 - Agency Ops Platform' },
    { id: 'pro1-02', selected: true, estHours: 2, tier: 'senior', isMonthlyRetainer: false, category: 'PRO 1 - Agency Ops Platform' },
    { id: 'pro1-03', selected: true, estHours: 2, tier: 'partner', isMonthlyRetainer: true, category: 'PRO 1 - Agency Ops Platform' },
  ],
  subscriptionBilling: { contractSignedAt: '2026-06-01T00:00:00.000Z' },
};

const rows = buildProSubscriptionRows({
  profiles: [profile],
  contracts: [{ profileId: 'client-pro-1', status: 'signed', signedAt: '2026-06-01T00:00:00.000Z' }],
  invoices: [],
});
assert.equal(rows.length, 1);
assert.equal(rows[0].setupStatus.length, 2);
assert.ok(rows[0].monthlyAmount > 0);
assert.equal(rows[0].nextPeriod, '2026-06');

const monthly = buildProMonthlyInvoiceDraft({
  profile,
  profileId: profile.id,
  period: '2026-07',
  retainerCostBase: rows[0].retainerCostBase,
  includeTax: true,
});
assert.equal(monthly.milestoneKey, 'retainer_monthly');
assert.equal(monthly.billingPeriod, '2026-07');
assert.ok(monthly.invoiceNumber.includes('M202607'));

assert.equal(hasInvoiceForPeriod([monthly], profile.id, '2026-07'), true);
assert.equal(hasInvoiceForPeriod([], profile.id, '2026-07'), false);

console.log('subscription-billing.test.mjs: all assertions passed');
