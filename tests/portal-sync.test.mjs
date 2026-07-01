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

const EC = loadEngagementConfig();

function resolvePortalAccessCode(profile) {
  return profile.quoteId || profile.links?.portalClientId || null;
}

function computeSaasAnnualWaste(subSaaS) {
  if (!subSaaS?.length) return 0;
  return Math.round(subSaaS.reduce((acc, row) => acc + (Number(row.billing) || 0) * (Number(row.users) || 1), 0) * 12);
}

function buildPortalPatchFromProfile(profile, existing, options) {
  const saasWaste = computeSaasAnnualWaste(profile.subSaaS);
  return {
    companyName: EC.getClientDisplayName(profile),
    metrics: {
      annualLeakageIdentified: EC.getChaosTaxValue(profile),
      chaosTaxEliminated: existing?.metrics?.chaosTaxEliminated ?? 0,
      saasSavingsIdentified: saasWaste || existing?.metrics?.saasSavingsIdentified || 0,
    },
    ...(options?.syncIntakeAssets && profile.subSaaS?.length
      ? { assets: profile.subSaaS.map((row, i) => ({ id: i, title: row.tool })) }
      : {}),
  };
}

assert.equal(resolvePortalAccessCode({ quoteId: 'KC-123' }), 'KC-123');
assert.equal(computeSaasAnnualWaste([{ billing: 100, users: 2 }]), 2400);

const profile = {
  clientCompany: 'Acme',
  quoteId: 'KC-ACME',
  chaosTax: { source: 'diagnosis', value: 500000 },
  subSaaS: [{ tool: 'Zoom', billing: 50, users: 10 }],
};
const patch = buildPortalPatchFromProfile(profile, null, { syncIntakeAssets: true });
assert.equal(patch.companyName, 'Acme');
assert.equal(patch.metrics.annualLeakageIdentified, 500000);
assert.equal(patch.metrics.saasSavingsIdentified, 6000);
assert.equal(patch.assets.length, 1);

// workflow-tabs getReportTabs
const wtCode = readFileSync(join(root, 'shared/workflow-tabs.js'), 'utf8');
const win = {};
vm.runInNewContext(wtCode, { window: win });
const merged = win.WorkflowTabs.getReportTabs({
  diagnosisWorkflow: { tabs: [{ id: 'a', name: 'A', present: {} }] },
  workflowBuilder: { tabs: [{ id: 'b', name: 'B', present: {} }] },
});
assert.equal(merged.length, 2);

console.log('portal-sync.test.mjs: all assertions passed');
