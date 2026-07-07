/**
 * Unit tests for shared/diagnosis-report-helpers.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DRH = require('../shared/diagnosis-report-helpers.js');

const mockDiagramEditor = {
  getWorkflowViewModel: (present) => ({
    tasks: [
      { id: 's1', type: 'task', label: 'Approve order', delayMinutes: 30, affectedStaff: 2, hourlyRate: 500 },
      { id: 'g1', type: 'gateway', label: 'Gate' },
    ],
    lanes: [{ id: 'l1', label: 'Ops', owner: 'Maria' }],
    svgCache: '',
  }),
  computeTabChaosTax: (tasks) => {
    let annual = 0;
    tasks.forEach((t) => {
      if (t.type === 'gateway') return;
      const daily = ((t.delayMinutes || 0) * (t.affectedStaff || 1)) / 60;
      annual += daily * (t.hourlyRate || 0) * 22 * 12;
    });
    return { annual: Math.round(annual) };
  },
};

describe('diagnosis-report-helpers', () => {
  it('computeCoiForecast includes SaaS and growth', () => {
    const coi = DRH.computeCoiForecast(120000, 24000, 5);
    assert.ok(coi > 120000 * 3);
  });

  it('getTop5Fixes caps at five and prefers high impact/effort', () => {
    const items = [
      { id: '1', text: 'Low', effort: 4, impact: 2 },
      { id: '2', text: 'High', effort: 2, impact: 5 },
      { id: '3', text: 'Mid', effort: 3, impact: 3 },
    ];
    const top = DRH.getTop5Fixes(items);
    assert.equal(top[0].text, 'High');
    assert.ok(top.length <= 5);
  });

  it('buildProcessRankings sorts by annual leakage', () => {
    const tabs = [
      { id: 'a', name: 'Sales', present: {} },
      { id: 'b', name: 'Ops', present: {} },
    ];
    const rankings = DRH.buildProcessRankings(tabs, mockDiagramEditor);
    assert.equal(rankings.length, 2);
    assert.ok(rankings[0].annual >= 0);
  });

  it('generateMatrixFromDiagnosis adds workflow and saas items', () => {
    const tabs = [{ id: 'a', name: 'Sales', present: {} }];
    const saas = [{ id: 1, tool: 'Slack', billing: 500, users: 10, reason: 'Cut idle seats' }];
    const items = DRH.generateMatrixFromDiagnosis(tabs, saas, [], mockDiagramEditor);
    assert.ok(items.length >= 2);
  });

  it('buildModulePitch uses canonical module titles', () => {
    const modules = [
      { key: 'MOD 2', title: 'How Your Business Runs' },
      { key: 'MOD 3', title: 'Your Team Workspace' },
    ];
    const pitch = DRH.buildModulePitch('MOD 2', 100000, (v) => `P${v}`, modules);
    assert.match(pitch, /How Your Business Runs/);
  });

  it('validateReportReadiness returns errors when matrix is empty', () => {
    const result = DRH.validateReportReadiness({
      tabs: [{ id: 'a', name: 'Sales', present: {} }],
      subSaaS: [{ id: 1, tool: 'X', billing: 100, users: 1 }],
      synthesis: { matrix: { items: [{ id: '1', text: 'Fix', effort: 2, impact: 4 }] } },
      DiagramEditor: mockDiagramEditor,
    });
    assert.equal(result.errors.length, 0);
    assert.ok(result.warnings.length > 0);
  });

  it('validateMod1Handoff requires deliverable link and Loom URL', () => {
    const baseCtx = {
      tabs: [{ id: 'a', name: 'Sales', present: {} }],
      subSaaS: [{ id: 1, tool: 'X', billing: 100, users: 1 }],
      synthesis: {
        matrix: { items: [{ id: '1', text: 'Fix', effort: 2, impact: 4 }] },
        clientDeliverableUrl: '',
        loomWalkthroughUrl: '',
      },
      DiagramEditor: mockDiagramEditor,
      tasks: [{ id: 'm1-02', selected: true }],
    };
    const blocked = DRH.validateMod1Handoff(baseCtx);
    assert.equal(blocked.ready, false);
    assert.ok(blocked.errors.some((e) => e.includes('deliverable link')));
    assert.ok(blocked.errors.some((e) => e.includes('Loom')));

    const ready = DRH.validateMod1Handoff({
      ...baseCtx,
      synthesis: {
        ...baseCtx.synthesis,
        clientDeliverableUrl: 'https://drive.google.com/file/d/abc/view',
        loomWalkthroughUrl: 'https://www.loom.com/share/abc',
        staffFeedbackThemes: ['Slow approvals'],
      },
    });
    assert.equal(ready.ready, true);
  });
});
