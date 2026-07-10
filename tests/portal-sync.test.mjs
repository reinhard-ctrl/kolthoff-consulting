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

const mod1Patch = PS.buildMod1CompletePortalPatch({
  roadmap: EC.buildDefaultPortalRoadmap(),
  currentPhase: EC.MODULES[0].portalPhase,
});
assert.equal(mod1Patch.roadmap[0].status, 'completed');
assert.equal(mod1Patch.roadmap[1].status, 'active');
assert.equal(mod1Patch.currentPhase, EC.MODULES[1].portalPhase);
assert.ok(mod1Patch.mod2UnlockedAt);
assert.ok(mod1Patch.mod1CompleteNotice);

const stamped = PS.stampMod1TasksDelivered(
  [
    { id: 'm1-01', selected: true },
    { id: 'm1-02', selected: true },
    { id: 'm1-06', selected: false },
    { id: 'm2-01', selected: true },
  ],
  '2026-07-07T00:00:00.000Z',
);
assert.equal(stamped.find((t) => t.id === 'm1-01')?.deliveredAt, '2026-07-07T00:00:00.000Z');
assert.equal(stamped.find((t) => t.id === 'm1-06')?.deliveredAt, undefined);
assert.equal(stamped.find((t) => t.id === 'm2-01')?.deliveredAt, undefined);

const assetsProfile = PS.upsertMod1DeliverableAssets({
  customAssets: [{ title: 'Other Doc', category: 'MOD 1', link: 'https://example.com/other' }],
  synthesis: { clientDeliverableUrl: 'https://drive.google.com/file/d/abc/view' },
});
assert.equal(assetsProfile.length, 2);
assert.equal(assetsProfile.find((a) => a.title === PS.LEAK_SCAN_REPORT_ASSET_TITLE)?.link, 'https://drive.google.com/file/d/abc/view');

const legacyMigrated = PS.upsertMod1DeliverableAssets({
  customAssets: [{ title: PS.LEGACY_LEAK_SCAN_REPORT_ASSET_TITLE, category: 'MOD 1', link: 'https://drive.google.com/file/d/old/view' }],
  synthesis: { clientDeliverableUrl: 'https://drive.google.com/file/d/new/view' },
});
assert.equal(legacyMigrated.length, 1);
assert.equal(legacyMigrated[0].title, PS.LEAK_SCAN_REPORT_ASSET_TITLE);
assert.equal(legacyMigrated[0].link, 'https://drive.google.com/file/d/new/view');

const mod1CompletePatch = PS.buildPortalPatchFromProfile(
  {
    ...profile,
    synthesis: { clientDeliverableUrl: 'https://drive.google.com/file/d/abc/view' },
  },
  { assets: [] },
  { syncIntakeAssets: true },
);
assert.ok(mod1CompletePatch.assets.some((a) => a.title === PS.LEAK_SCAN_REPORT_ASSET_TITLE));

const multiAssets = PS.upsertMod1DeliverableAssets({
  customAssets: [],
  synthesis: {
    clientDeliverableUrl: 'https://drive.google.com/file/d/report',
    loomWalkthroughUrl: 'https://www.loom.com/share/abc123',
    staffDirectoryDeliverableUrl: 'https://drive.google.com/file/d/directory',
    feedbackFormUrl: 'https://docs.google.com/forms/d/abc/viewform',
  },
});
assert.equal(multiAssets.length, 4);
assert.equal(
  multiAssets.find((a) => a.title === PS.LOOM_WALKTHROUGH_ASSET_TITLE)?.link,
  'https://www.loom.com/share/abc123',
);

console.log('portal-sync.test.mjs: all assertions passed');
