/**
 * Portal sync tests — profile → client portal patch.
 * Run: node tests/portal-sync.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEngagementConfig() {
  const code = readFileSync(join(root, 'shared/engagement-config.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.EngagementConfig;
}

function loadPortalSync() {
  const ecCode = readFileSync(join(root, 'shared/engagement-config.js'), 'utf8');
  const psCode = readFileSync(join(root, 'shared/portal-sync.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(ecCode, sandbox);
  vm.runInNewContext(psCode, sandbox);
  return sandbox.window.PortalSync;
}

const PS = loadPortalSync();
const EC = loadEngagementConfig();

assert.equal(PS.resolvePortalAccessCode({ quoteId: 'KC-123' }), 'KC-123');
assert.equal(PS.resolvePortalAccessCode({ links: { portalClientId: 'KC-LINK' } }), 'KC-LINK');
assert.equal(PS.computeSaasAnnualWaste([{ billing: 100, users: 2 }]), 2400);

const profile = {
  clientCompany: 'Acme',
  quoteId: 'KC-ACME',
  chaosTax: { source: 'diagnosis', value: 500000 },
  subSaaS: [{ tool: 'Zoom', billing: 50, users: 10 }],
  orgChart: {
    members: [
      { id: 'm1', name: 'Jane', role: 'CEO', department: 'Executive', managerId: null },
      { id: 'm2', name: 'Bob', role: 'Ops', department: 'Operations', managerId: 'm1' },
    ],
  },
};
const patch = PS.buildPortalPatchFromProfile(profile, null, { syncIntakeAssets: true, syncOrgChart: true });
assert.equal(patch.companyName, 'Acme');
assert.equal(patch.metrics.annualLeakageIdentified, 500000);
assert.equal(patch.metrics.saasSavingsIdentified, 6000);
assert.equal(patch.assets.length, 1);
assert.equal(patch.orgChart.length, 2);
assert.equal(patch.orgChart[0].name, 'Jane');
assert.equal(patch.orgChart[1].managerId, 'm1');

const mergedAssets = PS.mergePortalAssets(
  [{ title: 'Zoom', id: 1 }],
  [{ title: 'zoom', id: 2 }, { title: 'Slack', id: 3 }],
);
assert.equal(mergedAssets.length, 2);

// workflow-tabs getReportTabs
const wtCode = readFileSync(join(root, 'shared/workflow-tabs.js'), 'utf8');
const win = {};
vm.runInNewContext(wtCode, { window: win });
const merged = win.WorkflowTabs.getReportTabs({
  diagnosisWorkflow: { tabs: [{ id: 'a', name: 'A', present: {} }] },
  workflowBuilder: { tabs: [{ id: 'b', name: 'B', present: {} }] },
});
assert.equal(merged.length, 2);

assert.equal(EC.getClientDisplayName({ clientName: 'Legacy Co' }), 'Legacy Co');

console.log('portal-sync.test.mjs: all assertions passed');
