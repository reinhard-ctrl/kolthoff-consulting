/**
 * SOP sync from BPMN workflow tabs.
 * Run: node tests/sop-sync.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deCode = readFileSync(join(__dirname, '../shared/diagram-editor.js'), 'utf8');
const wtCode = readFileSync(join(__dirname, '../shared/workflow-tabs.js'), 'utf8');
const sopCode = readFileSync(join(__dirname, '../shared/sop-sync.js'), 'utf8');
const win = { URLSearchParams };
vm.runInNewContext(deCode, { window: win, URLSearchParams });
vm.runInNewContext(wtCode, { window: win, URLSearchParams });
vm.runInNewContext(sopCode, { window: win, URLSearchParams });
const SS = win.SopSync;
const WT = win.WorkflowTabs;

const tab = {
  id: 'tab-1',
  name: 'Onboarding',
  present: {
    drawioXml:
      '<mxfile><diagram><mxGraphModel><root>' +
      '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="lane1" value="HR" style="swimlane;html=1;" vertex="1" parent="1">' +
      '<mxGeometry x="40" y="40" width="400" height="120" as="geometry"/></mxCell>' +
      '<mxCell id="task1" value="Review Docs" style="shape=mxgraph.bpmn.task2;" vertex="1" parent="lane1">' +
      '<mxGeometry x="80" y="60" width="120" height="60" as="geometry"/></mxCell>' +
      '</root></mxGraphModel></diagram></mxfile>',
    svgCache: 'data:image/svg+xml;base64,abc',
  },
};

const sop = SS.buildSopFromWorkflowTab(tab, { raciAssignments: {} });
assert.ok(sop);
assert.equal(sop.title, 'Onboarding');
assert.equal(sop.steps.length, 1);
assert.equal(sop.link.workflowTabId, 'tab-1');
assert.equal(sop.link.workbookWorkflowField, 'workflowBuilder');
assert.ok(sop.diagram?.drawioXml?.includes('task1'));
assert.equal(sop.diagram?.svgCache, 'data:image/svg+xml;base64,abc');

const merged = SS.mergeSopsIntoPolicyData(
  { sops: [{ id: 'old', title: 'Onboarding', steps: [] }, { id: 'keep', title: 'Other', steps: [] }] },
  [sop],
);
assert.equal(merged.sops.length, 2);
assert.equal(merged.sops.find((s) => s.id === 'keep').title, 'Other');
assert.equal(merged.sops.find((s) => s.title === 'Onboarding').steps[0].action, 'Review Docs');

const shell = { diagram: { drawioXml: '', svgCache: '' }, link: {} };
const mergedDoc = SS.mergeSopDocument(shell, sop);
assert.equal(mergedDoc.diagram.svgCache, 'data:image/svg+xml;base64,abc');

const profile = {
  workflowBuilder: { tabs: [tab] },
};
const resolved = SS.resolveWorkflowTab(profile, { tabId: 'tab-1' });
assert.equal(resolved?.name, 'Onboarding');

const existing = { id: 'sop-custom', title: 'Onboarding', steps: [], diagram: {}, link: {} };
const synced = SS.syncSopFromWorkspace(existing, profile);
assert.equal(synced.id, 'sop-custom');
assert.equal(synced.steps.length, 1);

const refreshed = SS.refreshSopStepsFromDiagram(
  { id: 'sop-1', title: 'Onboarding', diagram: tab.present, steps: [] },
  {},
);
assert.equal(refreshed.steps[0].action, 'Review Docs');

console.log('sop-sync.test.mjs: all assertions passed');
