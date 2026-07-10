/**
 * Document party resolution tests.
 * Run: node tests/document-party.test.mjs
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
const { resolveDocumentParty } = win.window.PlannerHelpers;

const contract = {
  clientCompany: 'Contract Client Inc.',
  clientRep: 'Jane Contract',
  clientAddress: '123 Contract St',
  clientTin: '111-111-111-111',
};

const defaultParty = resolveDocumentParty({ ...contract, useCustomDocumentParty: false });
assert.equal(defaultParty.company, 'Contract Client Inc.');
assert.equal(defaultParty.rep, 'Jane Contract');
assert.equal(defaultParty.address, '123 Contract St');
assert.equal(defaultParty.tin, '111-111-111-111');

const customParty = resolveDocumentParty({
  ...contract,
  useCustomDocumentParty: true,
  documentPartyCompany: 'Document Corp.',
  documentPartyRep: 'John Document',
  documentPartyAddress: '789 Docs Blvd',
  documentPartyTin: '333-333-333-333',
});
assert.equal(customParty.company, 'Document Corp.');
assert.equal(customParty.rep, 'John Document');
assert.equal(customParty.address, '789 Docs Blvd');
assert.equal(customParty.tin, '333-333-333-333');

console.log('document-party.test.mjs: all assertions passed');
