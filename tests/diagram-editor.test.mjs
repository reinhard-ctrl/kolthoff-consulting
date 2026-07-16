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

const verticalLayoutXml =
  '<mxfile><diagram><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="lane1" value="Ops" style="swimlane;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="40" width="200" height="420" as="geometry"/></mxCell>' +
  '<mxCell id="task3" value="Close Project" style="shape=mxgraph.bpmn.task2;" vertex="1" parent="lane1">' +
  '<mxGeometry x="80" y="300" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="task1" value="Submit Request" style="shape=mxgraph.bpmn.task2;" vertex="1" parent="lane1">' +
  '<mxGeometry x="80" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="task2" value="Process Payment" style="rounded=1;" vertex="1" parent="lane1">' +
  '<mxGeometry x="80" y="180" width="120" height="60" as="geometry"/></mxCell>' +
  '</root></mxGraphModel></diagram></mxfile>';

const verticalOrder = DE.getWorkflowViewModel({ drawioXml: verticalLayoutXml });
assert.equal(verticalOrder.tasks.filter((t) => t.type === 'task').map((t) => t.label).join('|'), 'Submit Request|Process Payment|Close Project');

const bpmnUrl = DE.getDrawioEmbedUrl({ libs: 'bpmn' });
assert.ok(bpmnUrl.includes('libs=bpmn'));
assert.ok(bpmnUrl.includes('libraries=1'));
const bpmnPreset = DE.getPreset('bpmn');
assert.equal(bpmnPreset.embedLibs, 'bpmn');
assert.ok(bpmnPreset.configure.defaultLibraries.includes('bpmn'));

const membersXml = DE.membersToDrawioXml([
  { id: '1', name: 'Ada', role: 'CEO' },
  { id: '2', name: 'Bob', role: 'Ops', managerId: '1' },
]);
const membersRoster = DE.parseRosterFromDrawioXml(membersXml);
assert.equal(membersRoster.length, 2);
assert.equal(membersRoster.find((r) => r.name === 'Ada')?.title, 'CEO');
assert.equal(membersRoster.find((r) => r.name === 'Bob')?.reportsTo, 'Ada');

const objectLabelXml =
  '<mxfile><diagram><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<object label="Ada&#xa;CEO" id="2">' +
  '<mxCell style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="40" width="180" height="70" as="geometry"/></mxCell></object>' +
  '<object label="Bob&#xa;Ops" id="3">' +
  '<mxCell style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="180" width="180" height="70" as="geometry"/></mxCell></object>' +
  '<mxCell id="4" edge="1" parent="1" source="2" target="3">' +
  '<mxGeometry relative="1" as="geometry"/></mxCell>' +
  '</root></mxGraphModel></diagram></mxfile>';
const objectRoster = DE.parseRosterFromDrawioXml(objectLabelXml);
assert.equal(objectRoster.length, 2);
assert.equal(objectRoster.find((r) => r.name === 'Ada')?.title, 'CEO');
assert.equal(objectRoster.find((r) => r.name === 'Bob')?.reportsTo, 'Ada');

const htmlDivLabelXml =
  '<mxfile><diagram><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="&lt;div&gt;Ada Lovelace&lt;/div&gt;&lt;div&gt;CEO&lt;/div&gt;&lt;div&gt;Engineering&lt;/div&gt;" ' +
  'style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="40" width="180" height="70" as="geometry"/></mxCell>' +
  '</root></mxGraphModel></diagram></mxfile>';
const htmlDivRoster = DE.parseRosterFromDrawioXml(htmlDivLabelXml);
assert.equal(htmlDivRoster.length, 1);
assert.equal(htmlDivRoster[0].name, 'Ada Lovelace');
assert.equal(htmlDivRoster[0].title, 'CEO');
assert.equal(htmlDivRoster[0].department, 'Engineering');

const objectHtmlLabelXml =
  '<mxfile><diagram><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<object label="&lt;p style=&quot;margin:0px;text-align:center;&quot;&gt;&lt;b&gt;Ada Lovelace&lt;/b&gt;&lt;/p&gt;' +
  '&lt;p style=&quot;margin:0px;text-align:center;&quot;&gt;CEO&lt;/p&gt;' +
  '&lt;p style=&quot;margin:0px;text-align:center;&quot;&gt;Engineering&lt;/p&gt;" id="2">' +
  '<mxCell style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="40" width="180" height="70" as="geometry"/></mxCell></object>' +
  '</root></mxGraphModel></diagram></mxfile>';
const objectHtmlRoster = DE.parseRosterFromDrawioXml(objectHtmlLabelXml);
assert.equal(objectHtmlRoster[0].name, 'Ada Lovelace');
assert.equal(objectHtmlRoster[0].title, 'CEO');
assert.equal(objectHtmlRoster[0].department, 'Engineering');

const fallback = [{ id: 'x', name: 'Kept', title: 'Lead', department: '', reportsTo: '' }];
assert.deepEqual(DE.resolveOrgChartMembers('', fallback), fallback);
assert.equal(DE.resolveOrgChartMembers(objectLabelXml, fallback).length, 2);

console.log('diagram-editor.test.mjs: all assertions passed');
