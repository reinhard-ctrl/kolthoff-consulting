/**
 * Job role profile structure helpers.
 * Run: node tests/job-role-profile.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/job-role-profile.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win });
const JR = win.JobRoleProfile;

assert.ok(JR);

const legacy = JR.migrateJobRoleFromContent({
  id: 'jd-old',
  title: 'Ops Lead',
  content:
    'Owns daily delivery and coaching.\nReports to: Operations Director\nMust-dos: run huddle; clear escalations; track SLA\nSkills: planning, leadership, WMS',
});
assert.equal(legacy.id, 'jd-old');
assert.equal(legacy.title, 'Ops Lead');
assert.equal(legacy.reportsTo, 'Operations Director');
assert.match(legacy.purpose, /Owns daily delivery/);
assert.match(legacy.responsibilities, /run huddle/);
assert.match(legacy.skillsTools, /planning/);

const structured = JR.migrateJobRoleFromContent({
  id: 'jd-1',
  title: 'CSM',
  department: 'Client Success',
  reportsTo: 'CS Lead',
  purpose: 'Protect retention.',
  responsibilities: '• Own QBRs',
  successMeasures: '• Renewals on target',
  skillsTools: '• CRM',
  content: 'ignored when structured present',
});
assert.equal(structured.purpose, 'Protect retention.');
assert.equal(structured.department, 'Client Success');

const md = JR.compileJobRoleMarkdown(structured);
assert.match(md, /^# CSM/m);
assert.match(md, /Client Success · Reports to: CS Lead/);
assert.match(md, /## Purpose/);
assert.match(md, /## Key responsibilities/);
assert.match(md, /## Success measures/);
assert.match(md, /## Skills & tools/);
assert.doesNotMatch(md, /ignored when structured/);

const empty = JR.createEmptyJobRole({ title: 'Blank Role' });
assert.equal(empty.title, 'Blank Role');
assert.equal(empty.purpose, '');
assert.equal(empty.responsibilities, '');

console.log('job-role-profile.test.mjs: all assertions passed');
