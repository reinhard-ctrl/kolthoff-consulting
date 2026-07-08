/**
 * diagram-editor BPMN parser tests.
 * Run: node tests/diagram-editor.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/diagram-editor.js'), 'utf8');
const win = { URLSearchParams };
vm.runInNewContext(code, { window: win, URLSearchParams });
const DE = win.DiagramEditor;

const sampleBpmnXml =
  '<mxfile><diagram><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="lane1" value="Sales" style="swimlane;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="40" width="400" height="120" as="geometry"/></mxCell>' +
  '<mxCell id="task1" value="Qualify Lead" style="shape=mxgraph.bpmn.task2;" vertex="1" parent="lane1">' +
  '<mxGeometry x="80" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="task2" value="Send Proposal" style="rounded=1;" vertex="1" parent="lane1">' +
  '<mxGeometry x="240" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '</root></mxGraphModel></diagram></mxfile>';

const vmResult = DE.getWorkflowViewModel({ drawioXml: sampleBpmnXml, cellMeta: { task1: { delayMinutes: 30, affectedStaff: 2 } } });
assert.equal(vmResult.format, 'bpmn');
assert.equal(vmResult.tasks.length, 2);
assert.equal(vmResult.tasks[0].label, 'Qualify Lead');
assert.equal(vmResult.tasks[0].delayMinutes, 30);
assert.equal(vmResult.tasks[0].affectedStaff, 2);
assert.equal(vmResult.lanes.length, 1);

const legacy = DE.getWorkflowViewModel({
  nodes: [{ id: 'n1', type: 'process', label: 'Step', x: 10, delayMinutes: 15, affectedStaff: 1, hourlyRate: 100, roleId: 'l1' }],
  lanes: [{ id: 'l1', label: 'Ops', owner: 'Lead', y: 0 }],
});
assert.equal(legacy.format, 'legacy');
assert.equal(legacy.tasks[0].delayMinutes, 15);

const tax = DE.computeTabChaosTax(vmResult.tasks);
assert.ok(tax.annual > 0);

const reversedFlowXml =
  '<mxfile><diagram><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="lane1" value="Sales" style="swimlane;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="40" width="400" height="120" as="geometry"/></mxCell>' +
  '<mxCell id="task1" value="Send Proposal" style="shape=mxgraph.bpmn.task2;" vertex="1" parent="lane1">' +
  '<mxGeometry x="240" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="task2" value="Qualify Lead" style="rounded=1;" vertex="1" parent="lane1">' +
  '<mxGeometry x="80" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="flow1" edge="1" parent="1" source="task2" target="task1">' +
  '<mxGeometry relative="1" as="geometry"/></mxCell>' +
  '</root></mxGraphModel></diagram></mxfile>';

const flowOrder = DE.getWorkflowViewModel({ drawioXml: reversedFlowXml });
assert.equal(flowOrder.tasks[0].label, 'Qualify Lead');
assert.equal(flowOrder.tasks[1].label, 'Send Proposal');

const bpmnUrl = DE.getDrawioEmbedUrl({ libs: 'bpmn' });
assert.ok(bpmnUrl.includes('libs=bpmn'));
assert.ok(bpmnUrl.includes('libraries=1'));
const bpmnPreset = DE.getPreset('bpmn');
assert.equal(bpmnPreset.embedLibs, 'bpmn');
assert.ok(bpmnPreset.configure.defaultLibraries.includes('bpmn'));

console.log('diagram-editor.test.mjs: all assertions passed');
