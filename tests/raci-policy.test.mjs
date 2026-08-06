/**
 * RACI policy helpers (DOA + topic matrices).
 * Run: node tests/raci-policy.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/raci-policy.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const RP = win.RaciPolicy;
assert.ok(RP);

assert.equal(RP.DEFAULT_RACI_POLICY.title, 'RACI & Decision Authority');
assert.ok(RP.DEFAULT_RACI_POLICY.matrices.length >= 2);
assert.equal(RP.DEFAULT_RACI_POLICY.matrices[0].title, 'People & HR');
assert.ok(RP.DEFAULT_RACI_POLICY.matrix.length >= 1);
assert.ok(RP.DEFAULT_RACI_POLICY.doa);
assert.ok(RP.DEFAULT_RACI_POLICY.doa.rows.length >= 6);
assert.equal(RP.DEFAULT_RACI_POLICY.doa.rows[0].role, 'Chief Executive Officer (CEO)');
assert.match(RP.DEFAULT_RACI_POLICY.doa.rows[0].opexLimit, /5,000,000/);
assert.match(RP.DEFAULT_DOA.note, /Board of Directors/);

const doaRow = RP.createEmptyDoaRow({ role: 'Controller', opexLimit: 'Up to ₱100,000' });
assert.equal(doaRow.role, 'Controller');
assert.equal(doaRow.opexLimit, 'Up to ₱100,000');
assert.equal(doaRow.capexLimit, '');

const row = RP.createEmptyRaciRow({ activity: 'Approvals', accountable: 'Ops Lead' });
assert.equal(row.activity, 'Approvals');
assert.equal(row.accountable, 'Ops Lead');
assert.equal(row.responsible, '');

const mx = RP.createEmptyRaciMatrix({ title: 'Security', rows: [{ activity: 'Access reviews', accountable: 'IT' }] });
assert.equal(mx.title, 'Security');
assert.equal(mx.rows[0].activity, 'Access reviews');

const merged = RP.mergeRaciPolicy(RP.DEFAULT_RACI_POLICY, {
  title: 'Custom RACI',
  matrices: [
    { id: 'm1', title: 'Delivery', rows: [{ id: 'rx', activity: 'Escalations', responsible: 'Owner', accountable: 'Lead' }] },
  ],
});
assert.equal(merged.title, 'Custom RACI');
assert.equal(merged.matrices.length, 1);
assert.equal(merged.matrices[0].title, 'Delivery');
assert.equal(merged.matrix.length, 1);
assert.equal(merged.matrix[0].activity, 'Escalations');
// DOA defaults when omitted from loaded doc
assert.ok(merged.doa.rows.length >= 6);
assert.equal(merged.doa.rows[0].role, 'Chief Executive Officer (CEO)');

const customDoa = RP.mergeRaciPolicy(RP.DEFAULT_RACI_POLICY, {
  doa: {
    intro: 'Custom intro',
    note: 'Board note',
    rows: [{ id: 'd1', role: 'CEO', opexLimit: '₱1', capexLimit: '₱2', contractLimit: 'Annual' }],
  },
  matrices: [{ id: 'm1', title: 'Ops', rows: [{ activity: 'X', responsible: 'R', accountable: 'A' }] }],
});
assert.equal(customDoa.doa.intro, 'Custom intro');
assert.equal(customDoa.doa.rows.length, 1);
assert.equal(customDoa.doa.rows[0].role, 'CEO');

const fromFlat = RP.mergeRaciPolicy(RP.DEFAULT_RACI_POLICY, {
  matrix: [{ id: 'legacy', activity: 'Legacy row', responsible: 'R', accountable: 'A' }],
});
assert.equal(fromFlat.matrices.length, 1);
assert.equal(fromFlat.matrices[0].title, 'General');
assert.equal(fromFlat.matrices[0].rows[0].activity, 'Legacy row');
assert.ok(fromFlat.doa.rows.length >= 1);

const fromOrgLegacy = RP.mergeRaciPolicy(RP.DEFAULT_RACI_POLICY, {
  raciMatrix: [{ id: 'org', activity: 'Org legacy', responsible: 'R', accountable: 'A' }],
});
assert.equal(fromOrgLegacy.matrices[0].rows[0].activity, 'Org legacy');

const md = RP.compileRaciPolicyMarkdown(merged);
assert.match(md, /^# Custom RACI/m);
assert.match(md, /## 1\. Financial Delegation of Authority \(DOA\) Limits/);
assert.match(md, /\| Role \/ Title \|/);
assert.match(md, /Chief Executive Officer \(CEO\)/);
assert.match(md, /\*\*Note:\*\*.*Board of Directors/);
assert.match(md, /## 2\. Authorization and Decision Matrix \(RACI\)/);
assert.match(md, /### 2\.1 Delivery/);
assert.match(md, /Escalations/);
assert.match(md, /Responsible \(R\)/);

console.log('raci-policy.test.mjs: all assertions passed');
