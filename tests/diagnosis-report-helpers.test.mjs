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

  it('getTop5Fixes dedupes by root cause and caps at five', () => {
    const items = [
      { id: '1', text: 'Zoom seats', effort: 2, impact: 4, source: 'saas', sourceDetail: 'Zoom — 5 seats', expectedSavings: 5000, owner: 'Ops', targetWeek: 'Week 1–2' },
      { id: '2', text: 'Zoom review', effort: 2, impact: 3, source: 'saas', sourceDetail: 'Zoom — 3 seats', expectedSavings: 3000, owner: 'Ops', targetWeek: 'Week 1–2' },
      { id: '3', text: 'High', effort: 2, impact: 5, source: 'workflow', sourceDetail: 'Sales, Step: Approve', expectedSavings: 8000, owner: 'Maria', targetWeek: 'Week 3–4' },
    ];
    const top = DRH.getTop5Fixes(items);
    assert.equal(top.length, 2);
    assert.equal(top[0].text, 'High');
  });

  it('generateMatrixFromDiagnosis pre-fills owner from RACI accountable role', () => {
    const tabs = [{ id: 'a', name: 'Sales', present: {} }];
    const saas = [];
    const items = DRH.generateMatrixFromDiagnosis(tabs, saas, [], mockDiagramEditor, {
      raciAssignments: { s1: { l1: 'A' } },
    });
    const workflowItem = items.find((i) => i.source === 'workflow');
    assert.equal(workflowItem?.owner, 'Maria');
    assert.ok(workflowItem?.sourceDetail?.includes('Sales'));
  });

  it('validateTop5Readiness blocks when owner or week missing', () => {
    const result = DRH.validateTop5Readiness({
      synthesis: {
        matrix: {
          items: [{ id: '1', text: 'Fix approvals', effort: 2, impact: 4, expectedSavings: 5000 }],
        },
      },
    });
    assert.equal(result.ready, false);
    assert.ok(result.errors.some((e) => e.includes('owner')));
    assert.ok(result.errors.some((e) => e.includes('target week')));
  });

  it('computeRecaptureSummary sums Top 5 annual savings', () => {
    const top5 = [
      { expectedSavings: 10000 },
      { expectedSavings: 5000 },
    ];
    const recapture = DRH.computeRecaptureSummary(top5, 240000);
    assert.equal(recapture.annual, 180000);
    assert.equal(recapture.pctOfTotalLeakage, 75);
  });

  it('formatMatrixEvidence shows workflow source detail', () => {
    const line = DRH.formatMatrixEvidence({
      source: 'workflow',
      sourceDetail: 'Sales, Step: Approve order',
    });
    assert.match(line, /Sales, Step: Approve order/);
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
      synthesis: { matrix: { items: [{ id: '1', text: 'Fix', effort: 2, impact: 4, owner: 'Maria', targetWeek: 'Week 1–2', expectedSavings: 5000 }] } },
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
        matrix: {
          items: [{
            id: '1', text: 'Fix', effort: 2, impact: 4,
            owner: 'Maria', targetWeek: 'Week 1–2', expectedSavings: 5000,
          }],
        },
        clientDeliverableUrl: 'https://drive.google.com/file/d/abc/view',
        loomWalkthroughUrl: 'https://www.loom.com/share/abc',
        staffFeedbackThemes: ['Slow approvals'],
      },
    });
    assert.equal(ready.ready, true);
  });

  it('normalizeStaffDirectoryRows filters empty names', () => {
    const rows = DRH.normalizeStaffDirectoryRows([
      { name: 'Jane', role: 'CEO', department: 'Exec', reportsTo: '' },
      { label: '', role: 'Ghost' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Jane');
    assert.equal(rows[0].title, 'CEO');
  });

  it('buildFeedbackFormQrUrl encodes form link', () => {
    const qr = DRH.buildFeedbackFormQrUrl('https://forms.example/test');
    assert.match(qr, /qrserver\.com/);
    assert.match(qr, /forms\.example/);
  });

  it('buildFeedbackFormViewUrl normalizes edit and view URLs', () => {
    const view = DRH.buildFeedbackFormViewUrl('https://docs.google.com/forms/d/abc123xyz/edit');
    assert.equal(view, 'https://docs.google.com/forms/d/abc123xyz/viewform');
    const fromPublished = DRH.buildFeedbackFormViewUrl('https://docs.google.com/forms/d/e/1FAIpQLS-demo/viewform');
    assert.equal(fromPublished, 'https://docs.google.com/forms/d/1FAIpQLS-demo/viewform');
  });

  it('getM102FeedbackFormTemplate exposes anonymous survey questions', () => {
    const template = DRH.getM102FeedbackFormTemplate();
    assert.equal(template.taskId, 'm1-02');
    assert.ok(template.questions.length >= 5);
    assert.equal(template.settings.collectEmail, false);
    assert.match(template.description, /anonymous/i);
  });

  it('normalizeReportDiagramSvg removes fixed dimensions for responsive print scaling', () => {
    const raw = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#fff"/></svg>');
    const normalized = DRH.normalizeReportDiagramSvg(raw);
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    assert.match(svgText, /^<svg[^>]*width="100%"/);
    assert.match(svgText, /height="100%"/);
    assert.match(svgText, /viewBox="0 0 1600 900"/);
    assert.doesNotMatch(svgText, /^<svg[^>]*width="1600"/);
  });

  it('normalizeReportDiagramSvg boosts connector strokes and arrow markers for PDF preview', () => {
    const raw =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">' +
          '<defs><marker id="arrow" markerWidth="6" markerHeight="6" orient="auto">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="#000000"/></marker></defs>' +
          '<rect x="50" y="150" width="120" height="60" fill="#dae8fc" stroke="#6c8ebf" stroke-width="1"/>' +
          '<path d="M 170 180 L 300 180" fill="none" stroke="#cccccc" stroke-width="1" marker-end="url(#arrow)"/>' +
          '</svg>'
      );
    const normalized = DRH.normalizeReportDiagramSvg(raw);
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    assert.match(svgText, /stroke-width="2\.25"/);
    assert.match(svgText, /vector-effect="non-scaling-stroke"/);
    assert.match(svgText, /markerWidth="14"/);
    assert.match(svgText, /stroke="#1e293b"/);
    assert.match(svgText, /<style[\s>]/i);
    assert.doesNotMatch(svgText, /stroke="#cccccc"/);
    assert.doesNotMatch(svgText, /marker-end="url\(#arrow\)"\/ vector-effect/);
  });

  it('buildMod1DeliverableStatus tracks in-scope deliverables', () => {
    const items = DRH.buildMod1DeliverableStatus({
      tasks: [
        { id: 'm1-01', selected: true },
        { id: 'm1-05', selected: true },
      ],
      orgChartMembers: [{ name: 'Jane', role: 'CEO' }],
      orgChartSvg: 'data:image/svg+xml,abc',
      tabs: [{ id: 'a', name: 'Sales', present: {} }],
      subSaaS: [],
      synthesis: {
        matrix: { items: [{ id: '1', text: 'Fix', effort: 2, impact: 4, owner: 'Jane', targetWeek: 'Week 1–2', expectedSavings: 5000 }] },
        clientDeliverableUrl: 'https://drive.google.com/file/d/x',
        loomWalkthroughUrl: 'https://loom.com/share/x',
      },
      DiagramEditor: mockDiagramEditor,
    });
    assert.ok(items.some((i) => i.id === 'm1-01' && i.status === 'complete'));
    assert.ok(items.some((i) => i.id === 'm1-05'));
  });

  it('buildDefaultExecutiveLetter summarizes leakage and top process', () => {
    const letter = DRH.buildDefaultExecutiveLetter({
      tabs: [{ id: 'a', name: 'Sales', present: {} }],
      subSaaS: [{ tool: 'Slack', billing: 100, users: 5 }],
      synthesis: { matrix: { items: [{ id: '1', text: 'Fix', effort: 2, impact: 5, expectedSavings: 10000, owner: 'A', targetWeek: 'Week 1–2' }] } },
      orgChartMembers: [{ name: 'Jane' }],
      formatCurrency: (v) => `P${v}`,
      DiagramEditor: mockDiagramEditor,
    });
    assert.match(letter, /Sales/);
    assert.match(letter, /team member/);
  });

  it('getBriefingWorkflowTabs returns only top-leak tab', () => {
    const tabs = [
      { id: 'a', name: 'Sales', present: {} },
      { id: 'b', name: 'Ops', present: {} },
    ];
    const filtered = DRH.getBriefingWorkflowTabs(tabs, mockDiagramEditor);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'a');
  });
});
