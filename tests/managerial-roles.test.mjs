/**
 * Manager Governance & Authority Charter policy helpers.
 * Run: node tests/managerial-roles.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/managerial-roles.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const MR = win.ManagerialRoles;
assert.ok(MR);

assert.equal(
  MR.DEFAULT_MANAGERIAL_ROLES.title,
  'Manager Governance & Authority Charter',
);
assert.equal(MR.DEFAULT_MANAGERIAL_ROLES.documentRef, 'HR-JD-2026-001');
assert.ok(MR.DEFAULT_MANAGERIAL_ROLES.divisions.length >= 6);
assert.equal(MR.DEFAULT_MANAGERIAL_ROLES.divisions[0].title, 'Executive Office');
assert.equal(MR.DEFAULT_MANAGERIAL_ROLES.divisions[0].roles[0].title, 'Chief Executive Officer (CEO)');
assert.match(MR.DEFAULT_MANAGERIAL_ROLES.divisions[2].title, /Operations/i);
assert.ok(MR.DEFAULT_MANAGERIAL_ROLES.divisions[2].roles.length >= 7);

const role = MR.createEmptyRole({ title: 'Controller', reportsTo: 'CFO' });
assert.equal(role.title, 'Controller');
assert.equal(role.reportsTo, 'CFO');
assert.equal(role.summary, '');

const div = MR.createEmptyDivision({ title: 'Strategy', number: '7', roles: [{ title: 'Strategy Lead' }] });
assert.equal(div.title, 'Strategy');
assert.equal(div.roles[0].title, 'Strategy Lead');

const merged = MR.mergeManagerialRoles(MR.DEFAULT_MANAGERIAL_ROLES, {
  title: 'Custom Managerial Roles',
  divisions: [
    {
      id: 'd1',
      number: '1',
      title: 'Leadership',
      roles: [{ id: 'r1', number: '1.1', title: 'Managing Director', incumbent: 'TBH', summary: 'Leads the firm.' }],
    },
  ],
});
assert.equal(merged.title, 'Custom Managerial Roles');
assert.equal(merged.divisions.length, 1);
assert.equal(merged.divisions[0].roles[0].title, 'Managing Director');

const fromEmpty = MR.mergeManagerialRoles(MR.DEFAULT_MANAGERIAL_ROLES, {});
assert.ok(fromEmpty.divisions.length >= 6);

const renamed = MR.mergeManagerialRoles(MR.DEFAULT_MANAGERIAL_ROLES, {
  title: 'Managerial Role Descriptions & Executive Specifications',
  divisions: [{ id: 'd1', number: '1', title: 'Leadership', roles: [{ title: 'MD' }] }],
});
assert.equal(renamed.title, 'Manager Governance & Authority Charter');
assert.equal(MR.resolvePolicyTitle('Managerial Role Descriptions'), 'Manager Governance & Authority Charter');
assert.equal(MR.resolvePolicyTitle('Client Custom Charter'), 'Client Custom Charter');

const md = MR.compileManagerialRolesMarkdown(merged);
assert.match(md, /^# Custom Managerial Roles/m);
assert.match(md, /## Role Index/);
assert.match(md, /## 1\. Leadership/);
assert.match(md, /### 1\.1 Managing Director/);
assert.match(md, /Role Summary/);
assert.match(md, /Leads the firm/);

const items = MR.splitFieldItems('Alpha; Beta; Gamma');
assert.equal(items.join('|'), 'Alpha|Beta|Gamma');
assert.match(MR.formatItemsAsMarkdownList('Alpha; Beta'), /- Alpha\n- Beta/);
assert.match(MR.formatNumberedMarkdownList('1. First\n2. Second'), /1\. First\n2\. Second/);

const index = MR.buildRoleIndex(merged);
assert.equal(index.length, 1);
assert.equal(index[0].roleTitle, 'Managing Director');

const defaultMd = MR.compileManagerialRolesMarkdown(MR.DEFAULT_MANAGERIAL_ROLES);
assert.match(defaultMd, /HR-JD-2026-001/);
assert.match(defaultMd, /## Role Index/);
assert.match(defaultMd, /Chief Executive Officer \(CEO\)/);
assert.match(defaultMd, /Head of Legal, Regulatory & Compliance/);
assert.match(defaultMd, /Finance Manager/);
assert.match(defaultMd, /Marketing Manager/);
assert.match(defaultMd, /#### Governance Rights \(RACI\)/);
assert.match(defaultMd, /- Corporate Strategy/);

console.log('managerial-roles.test.mjs: all assertions passed');
