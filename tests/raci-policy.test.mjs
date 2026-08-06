/**
 * RACI policy helpers.
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
assert.ok(RP.DEFAULT_RACI_POLICY.matrix.length >= 1);

const row = RP.createEmptyRaciRow({ activity: 'Approvals', accountable: 'Ops Lead' });
assert.equal(row.activity, 'Approvals');
assert.equal(row.accountable, 'Ops Lead');
assert.equal(row.responsible, '');

const merged = RP.mergeRaciPolicy(RP.DEFAULT_RACI_POLICY, {
  title: 'Custom RACI',
  matrix: [{ id: 'rx', activity: 'Escalations', responsible: 'Owner', accountable: 'Lead' }],
});
assert.equal(merged.title, 'Custom RACI');
assert.equal(merged.matrix.length, 1);
assert.equal(merged.matrix[0].consulted, '');

const fromLegacy = RP.mergeRaciPolicy(RP.DEFAULT_RACI_POLICY, {
  raciMatrix: [{ id: 'legacy', activity: 'Legacy row', responsible: 'R', accountable: 'A' }],
});
assert.equal(fromLegacy.matrix[0].activity, 'Legacy row');

const md = RP.compileRaciPolicyMarkdown(merged);
assert.match(md, /^# Custom RACI/m);
assert.match(md, /## RACI Matrix/);
assert.match(md, /Escalations/);
assert.match(md, /Responsible \(R\)/);

console.log('raci-policy.test.mjs: all assertions passed');
