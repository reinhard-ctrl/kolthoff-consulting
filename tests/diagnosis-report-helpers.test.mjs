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
    assert.match(svgText, /width="1600"/);
    assert.match(svgText, /height="900"/);
    assert.match(svgText, /viewBox="0 0 1600 900"/);
    assert.doesNotMatch(svgText, /width="100%"/);
  });

  it('normalizeReportDiagramSvg wraps raw svg markup in a data uri', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#fff"/></svg>';
    const normalized = DRH.normalizeReportDiagramSvg(raw);
    assert.match(normalized, /^data:image\/svg\+xml,/);
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    assert.match(svgText, /width="640"/);
    assert.match(svgText, /height="480"/);
  });

  it('extractReportDiagramSvgMarkup pulls svg from draw.io xmlsvg wrappers', () => {
    const wrapped =
      '<content xmlns="http://www.w3.org/1999/xhtml">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#fff"/></svg>' +
      '</content>';
    const extracted = DRH.extractReportDiagramSvgMarkup(wrapped);
    assert.match(extracted, /^<svg[\s>]/i);
    assert.match(extracted, /width="320"/);
    const normalized = DRH.normalizeReportDiagramSvg(wrapped);
    assert.match(normalized, /^data:image\/svg\+xml,/);
  });

  it('truncateReportLabel shortens long initiative names for matrix labels', () => {
    const long = 'Automate invoice approval workflow across finance and operations teams';
    const short = DRH.truncateReportLabel(long, 30);
    assert.equal(short.length, 30);
    assert.match(short, /…$/);
  });

  it('getMatrixQuadrantMeta classifies quick wins and money pits', () => {
    assert.equal(DRH.getMatrixQuadrantMeta(2, 4).key, 'quickWin');
    assert.equal(DRH.getMatrixQuadrantMeta(4, 2).key, 'moneyPit');
  });

  it('normalizeReportDiagramSvg thins connector strokes and arrow markers for PDF print', () => {
    const raw =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">' +
          '<defs><marker id="arrow" markerWidth="6" markerHeight="6" orient="auto">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="#000000"/></marker></defs>' +
          '<rect x="50" y="150" width="120" height="60" fill="#dae8fc" stroke="#6c8ebf" stroke-width="1"/>' +
          '<path d="M 170 180 L 300 180" fill="none" stroke="#cccccc" stroke-width="2" marker-end="url(#arrow)"/>' +
          '</svg>'
      );
    const normalized = DRH.normalizeReportDiagramSvg(raw);
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    assert.match(svgText, /stroke-width="1"/);
    assert.doesNotMatch(svgText, /vector-effect="non-scaling-stroke"/);
    assert.match(svgText, /markerWidth="5"/);
    assert.match(svgText, /markerUnits="strokeWidth"/);
    assert.match(svgText, /stroke="#64748b"/);
    assert.doesNotMatch(svgText, /stroke="#cccccc"/);
    assert.doesNotMatch(svgText, /stroke-width="2\.25"/);
  });

  it('normalizeReportDiagramSvg preserveConnectors keeps original org chart arrows', () => {
    const raw =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">' +
          '<defs><marker id="arrow" markerWidth="6" markerHeight="6" orient="auto">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="#000000"/></marker></defs>' +
          '<path d="M 170 180 L 300 180" fill="none" stroke="#cccccc" stroke-width="2" marker-end="url(#arrow)"/>' +
          '</svg>'
      );
    const normalized = DRH.normalizeReportDiagramSvg(raw, { preserveConnectors: true });
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    assert.match(svgText, /stroke-width="2"/);
    assert.match(svgText, /stroke="#cccccc"/);
    assert.match(svgText, /markerWidth="6"/);
    assert.doesNotMatch(svgText, /markerUnits="strokeWidth"/);
  });

  it('normalizeReportDiagramSvg applies professional presentation polish', () => {
    const raw =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
          '<rect x="20" y="40" width="120" height="60" fill="#dae8fc" stroke="#6c8ebf" stroke-width="1"/>' +
          '<text x="80" y="75" font-size="9" fill="#333333">Review</text>' +
          '</svg>'
      );
    const normalized = DRH.normalizeReportDiagramSvg(raw);
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    assert.match(svgText, /data-report-bg="1"/);
    assert.match(svgText, /fill="#f0fdfa"/);
    assert.match(svgText, /stroke="#0f766e"/);
    assert.match(svgText, /font-family="Montserrat/);
    assert.match(svgText, /text-rendering:optimizeLegibility/);
    assert.match(svgText, /viewBox="[^"]+"/);
    assert.doesNotMatch(svgText, /viewBox="0 0 400 200"/);
  });

  it('normalizeReportDiagramSvg crops sparse draw.io canvas whitespace for larger print diagrams', () => {
    const raw =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">' +
          '<rect x="500" y="450" width="140" height="70" fill="#dae8fc" stroke="#6c8ebf" stroke-width="1"/>' +
          '<rect x="780" y="450" width="140" height="70" fill="#d5e8d4" stroke="#82b366" stroke-width="1"/>' +
          '<path d="M 640 485 L 780 485" fill="none" stroke="#cccccc" stroke-width="2"/>' +
          '<text x="520" y="490" font-size="12" fill="#333333">Intake</text>' +
          '</svg>'
      );
    const normalized = DRH.normalizeReportDiagramSvg(raw);
    const svgText = decodeURIComponent(normalized.slice(normalized.indexOf(',') + 1));
    const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/i);
    assert.ok(viewBoxMatch);
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    const vw = parts[2];
    const vh = parts[3];
    assert.ok(vw < 700, `expected tight width, got ${vw}`);
    assert.ok(vh < 250, `expected tight height, got ${vh}`);
    assert.ok(Number(svgText.match(/\bwidth="([\d.]+)"/i)?.[1]) < 700);
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

  it('buildDefaultExecutiveLetter lists all mapped process names', () => {
    const letter = DRH.buildDefaultExecutiveLetter({
      tabs: [
        { id: 'a', name: 'Sales', present: {} },
        { id: 'b', name: 'Fulfillment', present: {} },
        { id: 'c', name: 'Billing', present: {} },
      ],
      subSaaS: [],
      synthesis: { matrix: { items: [] } },
      orgChartMembers: [],
      formatCurrency: (v) => `P${v}`,
      DiagramEditor: mockDiagramEditor,
    });
    assert.match(letter, /3 core processes/);
    assert.match(letter, /Sales, Fulfillment, Billing/);
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

  it('getReportWorkflowTabs returns all mapped workflows ranked by leakage', () => {
    const tabs = [
      { id: 'a', name: 'Sales', present: {} },
      { id: 'b', name: 'Ops', present: {} },
    ];
    const all = DRH.getReportWorkflowTabs(tabs, mockDiagramEditor);
    assert.equal(all.length, 2);
    assert.equal(all[0].id, 'a');
    const topOnly = DRH.getReportWorkflowTabs(tabs, mockDiagramEditor, { topOnly: true });
    assert.equal(topOnly.length, 1);
    assert.equal(topOnly[0].id, 'a');
  });

  it('tabNeedsWorkflowSvgExport detects missing svg cache with drawio XML', () => {
    const drawioXml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Submit Request" style="rounded=1;" vertex="1" parent="1"><mxGeometry width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>`;
    const withSvg = { id: 'a', present: { drawioXml, svgCache: 'data:image/svg+xml,ok' } };
    const needsExport = { id: 'b', present: { drawioXml, svgCache: '' } };
    assert.equal(DRH.tabNeedsWorkflowSvgExport(withSvg), false);
    assert.equal(DRH.tabNeedsWorkflowSvgExport(needsExport), true);
    assert.equal(DRH.tabNeedsWorkflowSvgExport({ id: 'c', present: {} }), false);
  });

  it('getReportWorkflowTabs includes tabs with exported svg even without parsed steps', () => {
    const tabs = [
      { id: 'a', name: 'Sales', present: { format: 'bpmn', drawioXml: '', svgCache: 'data:image/svg+xml,test', cellMeta: {} } },
    ];
    const emptyEditor = {
      getWorkflowViewModel: () => ({ tasks: [], lanes: [], svgCache: 'data:image/svg+xml,test' }),
      computeTabChaosTax: () => ({ annual: 0 }),
    };
    const all = DRH.getReportWorkflowTabs(tabs, emptyEditor);
    assert.equal(all.length, 1);
    assert.equal(all[0].id, 'a');
  });

  it('buildCoiBreakdown exposes formula and assumption sentence', () => {
    const coi = DRH.buildCoiBreakdown(120000, 24000, 2, (v) => `P${v}`);
    assert.equal(coi.baseAnnual, 144000);
    assert.ok(coi.projected > coi.threeYearBase);
    assert.match(coi.formulaLabel, /process \+ P24000 subscriptions/);
    assert.match(coi.assumptionSentence, /2 additional headcount/);
  });

  it('previewMatrixGeneration counts new items by source', () => {
    const tabs = [{ id: 'a', name: 'Sales', present: {} }];
    const saas = [{ tool: 'Slack', billing: 500, users: 10, reason: 'Cut idle seats' }];
    const preview = DRH.previewMatrixGeneration(tabs, saas, [], mockDiagramEditor);
    assert.ok(preview.counts.total >= 2);
    assert.ok(preview.counts.workflow >= 1);
    assert.ok(preview.counts.saas >= 1);
  });

  it('generateMatrixFromDiagnosis replace mode discards existing items', () => {
    const tabs = [{ id: 'a', name: 'Sales', present: {} }];
    const existing = [{ id: 'old', text: 'Keep me', effort: 2, impact: 4 }];
    const items = DRH.generateMatrixFromDiagnosis(tabs, [], existing, mockDiagramEditor, { replace: true });
    assert.ok(!items.some((i) => i.id === 'old'));
    assert.ok(items.length >= 1);
  });

  it('buildOwnerSuggestions merges org chart and lane owners', () => {
    const suggestions = DRH.buildOwnerSuggestions(
      [{ name: 'Jane', role: 'CEO' }],
      [{ id: 'a', name: 'Sales', present: {} }],
      {},
      mockDiagramEditor,
    );
    assert.ok(suggestions.includes('Jane'));
    assert.ok(suggestions.includes('Maria'));
  });

  it('buildInsightMatrixItem creates plan row from finding text', () => {
    const item = DRH.buildInsightMatrixItem('Staff feedback theme: Slow approvals', 0);
    assert.match(item.text, /Address staff feedback/);
    assert.equal(item.source, 'insight');
  });

  it('buildNextPhaseHint recommends Mod 2 when documentation fixes dominate', () => {
    const matrix = [
      { id: '1', text: 'Assign RACI for approvals', effort: 2, impact: 4, expectedSavings: 5000 },
      { id: '2', text: 'Document handoff playbook', effort: 3, impact: 4, expectedSavings: 4000 },
      { id: '3', text: 'Cut Zoom seats', effort: 2, impact: 3, expectedSavings: 3000 },
    ];
    const hint = DRH.buildNextPhaseHint(matrix, [{ key: 'MOD 2', title: 'How Your Business Runs' }]);
    assert.match(hint, /Module 2|How Your Business Runs/);
  });

  it('parseTargetWeekRange parses week ranges and singles', () => {
    assert.deepEqual(DRH.parseTargetWeekRange('Week 1–2'), { startWeek: 1, endWeek: 2 });
    assert.deepEqual(DRH.parseTargetWeekRange('Week 3-4'), { startWeek: 3, endWeek: 4 });
    assert.deepEqual(DRH.parseTargetWeekRange('wk 5'), { startWeek: 5, endWeek: 5 });
    assert.equal(DRH.parseTargetWeekRange(''), null);
    assert.equal(DRH.parseTargetWeekRange('TBD'), null);
  });

  it('buildRecoveryPlanGantt builds rows from matrix target weeks', () => {
    const items = [
      { id: '1', text: 'Fix approvals', effort: 2, impact: 5, expectedSavings: 8000, owner: 'Maria', targetWeek: 'Week 1–2' },
      { id: '2', text: 'Cut Zoom seats', effort: 2, impact: 4, expectedSavings: 5000, owner: 'Ops', targetWeek: 'Week 3–4' },
      { id: '3', text: 'No schedule yet', effort: 3, impact: 3, expectedSavings: 2000, owner: 'Ops' },
    ];
    const full = DRH.buildRecoveryPlanGantt(items);
    assert.equal(full.rows.length, 2);
    assert.equal(full.unscheduledCount, 1);
    assert.equal(full.rows[0].startWeek, 1);
    assert.equal(full.rows[1].startWeek, 3);
    assert.ok(full.maxWeek >= 12);

    const top5 = DRH.buildRecoveryPlanGantt(items, { onlyTop5: true });
    assert.ok(top5.rows.every((r) => r.isTop5));
  });

  it('sortMatrixByImpactEffort orders items by impact ÷ effort', () => {
    const items = [
      { id: 'low', text: 'Low score', effort: 4, impact: 2, expectedSavings: 1000 },
      { id: 'high', text: 'High score', effort: 2, impact: 5, expectedSavings: 2000 },
      { id: 'mid', text: 'Mid score', effort: 2, impact: 3, expectedSavings: 1500 },
    ];
    const sorted = DRH.sortMatrixByImpactEffort(items);
    assert.deepEqual(sorted.map((i) => i.id), ['high', 'mid', 'low']);
    assert.notEqual(sorted, items);
  });
});
