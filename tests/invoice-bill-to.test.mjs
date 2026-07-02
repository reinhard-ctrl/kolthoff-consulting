/**
 * Invoice bill-to resolution tests.
 * Run: node tests/invoice-bill-to.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'apps/delivery/project_planner_helpers.js'), 'utf8');
const win = { window: {} };
vm.runInNewContext(code, win);
const { resolveInvoiceBillTo } = win.window.PlannerHelpers;

const contract = {
  clientCompany: 'Contract Client Inc.',
  clientRep: 'Jane Contract',
  clientAddress: '123 Contract St',
  clientTin: '111-111-111-111',
};

const defaultBillTo = resolveInvoiceBillTo({ ...contract, useCustomInvoiceBillTo: false });
assert.equal(defaultBillTo.company, 'Contract Client Inc.');
assert.equal(defaultBillTo.rep, 'Jane Contract');
assert.equal(defaultBillTo.address, '123 Contract St');
assert.equal(defaultBillTo.tin, '111-111-111-111');

const customBillTo = resolveInvoiceBillTo({
  ...contract,
  useCustomInvoiceBillTo: true,
  invoiceBillToCompany: 'Billing Corp.',
  invoiceBillToRep: 'John Billing',
  invoiceBillToAddress: '456 Invoice Ave',
  invoiceBillToTin: '222-222-222-222',
});
assert.equal(customBillTo.company, 'Billing Corp.');
assert.equal(customBillTo.rep, 'John Billing');
assert.equal(customBillTo.address, '456 Invoice Ave');
assert.equal(customBillTo.tin, '222-222-222-222');

console.log('invoice-bill-to.test.mjs: all assertions passed');
