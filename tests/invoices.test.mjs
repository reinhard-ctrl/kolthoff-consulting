/**
 * Invoice / collections helper tests.
 * Run: node tests/invoices.test.mjs
 */
import assert from 'node:assert/strict';
import {
  buildInvoiceDocId,
  buildInvoiceRecord,
  computeEffectiveStatus,
  computeInvoiceAmounts,
  formatInvoiceNumber,
  invoicesToCsv,
  registration2303ToCsv,
  mergePortalContractsFromInvoices,
  outstandingAmount,
  portalStatusLabel,
  resolveMilestoneLabel,
  suggestRetainerMonthlySuffix,
} from '../shared/invoices.js';

assert.equal(formatInvoiceNumber('KC2026-001', '02'), 'INV2026-00102');
assert.equal(buildInvoiceDocId('profile-abc', '01'), 'inv-profile-abc-01');

const amounts = computeInvoiceAmounts({
  invoiceMilestone: 'full',
  finalProjectCostBase: 100000,
  retainerCostTotalBase: 0,
  includeTax: true,
});
assert.equal(amounts.subtotal, 100000);
assert.equal(amounts.vat, 12000);
assert.equal(amounts.total, 112000);

const monthlyAmounts = computeInvoiceAmounts({
  invoiceMilestone: 'retainer_monthly',
  retainerCostBase: 25000,
  includeTax: true,
});
assert.equal(monthlyAmounts.subtotal, 25000);
assert.equal(monthlyAmounts.total, 28000);

const monthlyLabel = resolveMilestoneLabel('retainer_monthly', [], { billingPeriod: '2026-07' });
assert.equal(monthlyLabel, 'MOD 4 Care Plan — July 2026');

assert.equal(suggestRetainerMonthlySuffix('2026-07'), 'M202607');

const label = resolveMilestoneLabel('milestone_0', [{ label: 'Gate 1: Module 1 Commitment' }]);
assert.equal(label, 'Gate 1: Module 1 Commitment');

const invoice = buildInvoiceRecord({
  profileId: 'p1',
  profile: { quoteId: 'KC2026-001', clientCompany: 'Acme Corp', includeTax: true },
  invoiceMilestone: 'full',
  invoiceNumberSuffix: '01',
  invoiceDueDate: 'July 15, 2026',
  issueDate: '2026-07-01',
  amounts,
  milestoneLabel: 'Full project payment',
  portalAccessCode: 'KC2026-001',
  status: 'sent',
});

assert.equal(invoice.invoiceNumber, 'INV2026-00101');
assert.equal(invoice.status, 'sent');
assert.equal(invoice.total, 112000);

const overdue = {
  ...invoice,
  status: 'sent',
  amountPaid: 0,
  dueDate: 'January 1, 2020',
};
assert.equal(computeEffectiveStatus(overdue, new Date('2026-07-02')), 'overdue');
assert.equal(portalStatusLabel('overdue'), 'Overdue');

const paid = { ...invoice, amountPaid: 112000, status: 'sent' };
assert.equal(computeEffectiveStatus(paid), 'paid');
assert.equal(outstandingAmount(paid), 0);
assert.equal(outstandingAmount({ ...invoice, amountPaid: 50000 }), 62000);

const merged = mergePortalContractsFromInvoices(
  [{ title: 'Manual SOW PDF', date: '2026-01-01', status: 'Active', link: 'https://drive.google.com/x' }],
  [invoice],
);
assert.equal(merged.length, 2);
assert.equal(merged[1].invoiceId, invoice.id);
assert.equal(merged[1].status, 'Pending');

const csv = invoicesToCsv([invoice]);
assert.ok(csv.includes('Invoice Number'));
assert.ok(csv.includes('INV2026-00101'));

const addendumLabel = resolveMilestoneLabel('full', [], { isAddendum: true, addendumTitle: 'Training Day Add-On' });
assert.equal(addendumLabel, 'Addendum — Training Day Add-On');

const addendumInvoice = buildInvoiceRecord({
  profileId: 'p1',
  profile: { quoteId: 'KC-2026-APARRI', clientCompany: 'Acme Corp', includeTax: true },
  invoiceMilestone: 'full',
  invoiceNumberSuffix: 'A1',
  invoiceDueDate: 'August 1, 2026',
  issueDate: '2026-07-01',
  amounts,
  milestoneLabel: addendumLabel,
  portalAccessCode: 'KC-2026-APARRI',
  status: 'sent',
  addendumId: 'addendum-1',
  addendumRef: 'KC-2026-APARRI-A1',
});
assert.equal(addendumInvoice.invoiceNumber, 'INV-2026-APARRIA1');
assert.equal(addendumInvoice.documentType, 'addendum');
assert.equal(addendumInvoice.addendumRef, 'KC-2026-APARRI-A1');
assert.equal(addendumInvoice.id, 'inv-p1-A1');

const corCsv = registration2303ToCsv([
  {
    clientCompany: 'Acme Corp',
    tin: '123-456-789-000',
    corNumber: 'COR-2024-001',
    issueDate: '2024-01-15',
    rdo: '39 South QC',
    taxType: 'VAT',
    verifiedDate: '2026-07-01',
    certificateRef: 'drive-link',
    notes: 'Verified on onboarding',
  },
]);
assert.ok(corCsv.includes('TIN'));
assert.ok(corCsv.includes('123-456-789-000'));
assert.ok(corCsv.includes('COR-2024-001'));

console.log('invoices.test.mjs: all assertions passed');
