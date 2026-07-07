/**
 * Workflow tab merge tests.
 * Run: node tests/workflow-tabs.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/workflow-tabs.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win });
const WT = win.WorkflowTabs;

const tabA = { id: 'a', name: 'A', present: { nodes: [] } };
const tabB = { id: 'b', name: 'B', present: { nodes: [1] } };
const tabBUpdated = { id: 'b', name: 'B', present: { nodes: [1, 2] } };

assert.equal(WT.mergeTabsById([tabA], [tabBUpdated]).map((t) => t.id).join(','), 'b,a');
assert.equal(WT.mergeTabsById([tabA], [tabBUpdated]).find((t) => t.id === 'b').present.nodes.length, 2);

const profile = {
  diagnosisWorkflow: { tabs: [tabA], activeTabId: 'a', updatedAt: 1 },
  workflowBuilder: { tabs: [tabB], activeTabId: 'b', updatedAt: 2 },
};
assert.equal(WT.resolveWorkflowTabs(profile, 'diagnosis').tabs.length, 1);
assert.equal(WT.resolveWorkflowTabs(profile, 'workflow').activeTabId, 'b');
assert.equal(WT.resolveWorkflowTabs({ tabs: [tabA] }, 'diagnosis').source, 'tabs');

const payload = WT.buildWorkflowTabsPayload('diagnosis', [tabA, tabBUpdated], 'b', profile);
assert.ok(payload.diagnosisWorkflow);
assert.equal(payload.tabs.length, 2);
assert.equal(payload.activeTabId, 'b');

const dxOnly = WT.getDiagnosisTabs({
  workflowBuilder: { tabs: [tabB], activeTabId: 'b', updatedAt: 2 },
});
assert.equal(dxOnly.tabs.length, 1);
assert.equal(dxOnly.tabs[0].id, 'b');
assert.ok(String(dxOnly.source).includes('legacy'));

const dxPrimary = WT.getDiagnosisTabs(profile);
assert.equal(dxPrimary.tabs[0].id, 'a');
assert.equal(dxPrimary.source, 'diagnosisWorkflow');

assert.equal(WT.parseWorkflowAppFromSearch('?slice=diagnosis'), 'diagnosis');
assert.equal(WT.parseWorkflowAppFromSearch('?slice=workflow'), 'workflow');
assert.equal(WT.getWorkflowTabs(profile).activeTabId, 'b');

console.log('workflow-tabs.test.mjs: all assertions passed');
