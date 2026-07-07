/**
 * Module 1 Waste-to-Peso Report — shared assembly helpers for diagnosis reports.
 * Used by apps/delivery/diagnoses_report.html (classic) and test suite.
 */
(function (global) {
  const QUADRANT = {
    quickWin: { effortMax: 3, impactMin: 3 },
    majorProject: { effortMin: 3, impactMin: 3 },
    fillIn: { effortMax: 3, impactMax: 3 },
    moneyPit: { effortMin: 3, impactMax: 3 },
  };

  function getQuadrant(effort, impact) {
    const e = Number(effort) || 3;
    const i = Number(impact) || 3;
    if (e < QUADRANT.quickWin.effortMax && i >= QUADRANT.quickWin.impactMin) return 'quickWin';
    if (e >= QUADRANT.majorProject.effortMin && i >= QUADRANT.majorProject.impactMin) return 'majorProject';
    if (e < QUADRANT.fillIn.effortMax && i < QUADRANT.fillIn.impactMax) return 'fillIn';
    return 'moneyPit';
  }

  function getProcessNodes(tab, DiagramEditor) {
    const vm = DiagramEditor?.getWorkflowViewModel?.(tab?.present) || { tasks: [], lanes: [] };
    const tasks = (vm.tasks || []).filter((t) => t.type !== 'gateway' && t.type !== 'event');
    return { vm, tasks };
  }

  function stepMonthlyLoss(step) {
    const hours = ((Number(step.delayMinutes) || 0) * (Number(step.affectedStaff) || 1)) / 60;
    return Math.round(hours * (Number(step.hourlyRate) || 0) * 22);
  }

  function computeCoiForecast(annualChaosTax, saasAnnualWaste, expectedGrowth) {
    const baseAnnual = (Number(annualChaosTax) || 0) + (Number(saasAnnualWaste) || 0);
    const growthMultiplier = 1 + (Number(expectedGrowth) || 0) * 0.1;
    return Math.round(baseAnnual * 3 * growthMultiplier);
  }

  function computeMaturityIndex(synthesis) {
    const s = synthesis || {};
    const scores = [s.communication, s.documentation, s.accountability, s.software].map((v) => Number(v) || 3);
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  function buildProcessRankings(tabs, DiagramEditor) {
    const rows = (tabs || []).map((tab) => {
      const { vm, tasks } = getProcessNodes(tab, DiagramEditor);
      const tax = DiagramEditor?.computeTabChaosTax?.(tasks) || { annual: 0 };
      let topStep = null;
      let topStepLoss = 0;
      tasks.forEach((step) => {
        const loss = stepMonthlyLoss(step);
        if (loss > topStepLoss) {
          topStepLoss = loss;
          topStep = step;
        }
      });
      return {
        tabId: tab.id,
        tabName: tab.name,
        annual: tax.annual || 0,
        monthly: Math.round((tax.annual || 0) / 12),
        topStepLabel: topStep?.label || '—',
        topStepMonthly: topStepLoss,
        taskCount: tasks.length,
        svgCache: vm.svgCache || '',
      };
    });
    const totalAnnual = rows.reduce((acc, r) => acc + r.annual, 0);
    return rows
      .map((r) => ({ ...r, pctOfTotal: totalAnnual > 0 ? Math.round((r.annual / totalAnnual) * 100) : 0 }))
      .sort((a, b) => b.annual - a.annual);
  }

  function buildStepLeakageList(tabs, DiagramEditor) {
    const all = [];
    (tabs || []).forEach((tab) => {
      const { tasks } = getProcessNodes(tab, DiagramEditor);
      tasks.forEach((step) => {
        const monthly = stepMonthlyLoss(step);
        if (monthly <= 0) return;
        all.push({
          tabName: tab.name,
          stepLabel: step.label,
          delayMinutes: Number(step.delayMinutes) || 0,
          affectedStaff: Number(step.affectedStaff) || 1,
          monthly,
          annual: monthly * 12,
        });
      });
    });
    return all.sort((a, b) => b.monthly - a.monthly);
  }

  function buildRaciGaps(tabs, raciAssignments, DiagramEditor) {
    let totalSteps = 0;
    let unassignedSteps = 0;
    let noAccountable = 0;
    const gaps = [];

    (tabs || []).forEach((tab) => {
      const { vm, tasks } = getProcessNodes(tab, DiagramEditor);
      const roles = vm.lanes || [];
      tasks.forEach((act) => {
        totalSteps += 1;
        const row = raciAssignments?.[act.id] || {};
        const values = Object.values(row).filter(Boolean);
        if (values.length === 0) {
          unassignedSteps += 1;
          gaps.push({ tabName: tab.name, stepLabel: act.label, issue: 'No RACI assignment' });
        } else if (!values.includes('A')) {
          noAccountable += 1;
          gaps.push({ tabName: tab.name, stepLabel: act.label, issue: 'No accountable owner (A)' });
        }
      });
      roles.forEach((role) => {
        if (!role.owner) {
          gaps.push({ tabName: tab.name, stepLabel: role.label, issue: 'Lane has no named owner' });
        }
      });
    });

    return { totalSteps, unassignedSteps, noAccountable, gaps: gaps.slice(0, 12) };
  }

  function buildOperationalInsights(ctx) {
    const {
      synthesis = {},
      subSaaS = [],
      tabs = [],
      raciAssignments = {},
      orgChartMembers = [],
      staffFeedbackThemes = [],
      formatCurrency = (v) => String(v),
      DiagramEditor,
    } = ctx;

    const bullets = [];
    const saasMonthly = subSaaS.reduce((acc, curr) => acc + (Number(curr.billing) || 0) * (Number(curr.users) || 0), 0);
    const rankings = buildProcessRankings(tabs, DiagramEditor);
    const topProcess = rankings[0];
    const raciGaps = buildRaciGaps(tabs, raciAssignments, DiagramEditor);

    if (topProcess && topProcess.annual > 0) {
      bullets.push(
        `Highest-leak process: "${topProcess.tabName}" costs approximately ${formatCurrency(topProcess.monthly)}/month — bottleneck step "${topProcess.topStepLabel.replace(/\n/g, ' ')}".`
      );
    }

    if (Number(synthesis.communication) <= 2) {
      bullets.push('Communication gaps: handoffs rely on informal channels, causing repeated follow-ups and lost context between teams.');
    } else if (Number(synthesis.communication) <= 3) {
      bullets.push('Communication is partially structured but lacks consistent SLAs on cross-team handoffs.');
    }

    if (Number(synthesis.documentation) <= 1) {
      bullets.push('Documentation risk: critical steps depend on tribal knowledge — employee turnover could disrupt service delivery.');
    } else if (Number(synthesis.documentation) <= 2) {
      bullets.push('Process documentation is incomplete; teams execute the same work differently during busy periods.');
    }

    if (Number(synthesis.accountability) <= 2) {
      bullets.push(`Accountability gaps: ${raciGaps.unassignedSteps} of ${raciGaps.totalSteps} workflow steps lack clear RACI ownership.`);
    }

    if (Number(synthesis.software) <= 2) {
      const toolNames = subSaaS.slice(0, 3).map((s) => s.tool).filter(Boolean);
      const toolHint = toolNames.length ? ` (e.g. ${toolNames.join(', ')})` : '';
      bullets.push(`Software stack is fragmented or under-utilized${toolHint}. Consolidating tools reduces training overhead and duplicate spend.`);
    }

    if (saasMonthly >= 500) {
      bullets.push(`Subscription waste: ${formatCurrency(saasMonthly)}/month in recoverable SaaS spend from idle seats or overlapping tools.`);
    }

    if (orgChartMembers.length > 0 && raciGaps.noAccountable > 0) {
      bullets.push(`${raciGaps.noAccountable} process steps have no single accountable owner despite ${orgChartMembers.length} staff mapped on the org chart.`);
    }

    (staffFeedbackThemes || []).slice(0, 3).forEach((theme) => {
      if (theme && String(theme).trim()) {
        bullets.push(`Staff feedback theme: ${String(theme).trim()}`);
      }
    });

    return bullets.slice(0, 8);
  }

  function buildRiskProfiles(ctx) {
    const { synthesis = {}, subSaaS = [], tabs = [], raciAssignments = {}, formatCurrency = (v) => String(v), DiagramEditor } = ctx;
    const profiles = [];
    const saasMonthly = subSaaS.reduce((acc, curr) => acc + (Number(curr.billing) || 0) * (Number(curr.users) || 0), 0);
    const raciGaps = buildRaciGaps(tabs, raciAssignments, DiagramEditor);

    if (Number(synthesis.communication) <= 2) {
      profiles.push({
        title: 'Manual Handover Friction',
        severity: 'amber',
        text: 'Critical handoffs run on unmonitored channels. Teams spend extra time chasing updates instead of executing work.',
      });
    }
    if (Number(synthesis.documentation) <= 2) {
      profiles.push({
        title: 'Operational Tribal Dependency',
        severity: 'rose',
        text: 'Standard operating procedures are missing or outdated. Execution quality varies by who is on shift.',
      });
    }
    if (Number(synthesis.accountability) <= 2 || raciGaps.unassignedSteps > 0) {
      profiles.push({
        title: 'Unclear Ownership Boundaries',
        severity: 'amber',
        text: `${raciGaps.unassignedSteps} workflow step(s) have no RACI assignment. Decisions stall when no one is clearly accountable.`,
      });
    }
    if (Number(synthesis.software) <= 2) {
      profiles.push({
        title: 'Fragmented Software Stack',
        severity: 'slate',
        text: 'Teams use overlapping tools without a consolidated workspace, increasing cost and training burden.',
      });
    }
    if (saasMonthly >= 500) {
      profiles.push({
        title: 'Subscription Bill Leakage',
        severity: 'slate',
        text: `Recover up to ${formatCurrency(saasMonthly * 12)}/year by cancelling duplicate subscriptions and right-sizing seat counts.`,
      });
    }
    return profiles;
  }

  function generateMatrixFromDiagnosis(tabs, subSaaS, existingItems, DiagramEditor) {
    const existing = Array.isArray(existingItems) ? existingItems : [];
    const existingTexts = new Set(existing.map((i) => (i.text || '').toLowerCase().trim()));
    const generated = [];
    const steps = buildStepLeakageList(tabs, DiagramEditor).slice(0, 6);

    steps.forEach((step, idx) => {
      const text = `Reduce wait time on "${step.stepLabel.replace(/\n/g, ' ')}" in ${step.tabName}`;
      if (existingTexts.has(text.toLowerCase())) return;
      const impact = Math.min(5, Math.max(2, Math.round(step.monthly / 5000) + 2));
      generated.push({
        id: `gen-step-${Date.now()}-${idx}`,
        text,
        effort: 2.5,
        impact,
        owner: '',
        targetWeek: '',
        expectedSavings: step.monthly,
        source: 'workflow',
      });
    });

    subSaaS.forEach((item, idx) => {
      const monthly = (Number(item.billing) || 0) * (Number(item.users) || 0);
      if (monthly < 100) return;
      const text = item.reason
        ? `${item.reason} — ${item.tool}`
        : `Review ${item.tool} licenses (${item.users} seats)`;
      if (existingTexts.has(text.toLowerCase())) return;
      generated.push({
        id: `gen-saas-${Date.now()}-${idx}`,
        text,
        effort: 1.5,
        impact: Math.min(5, Math.max(2, Math.round(monthly / 3000) + 2)),
        owner: '',
        targetWeek: 'Week 1–2',
        expectedSavings: monthly,
        source: 'saas',
      });
    });

    return [...existing, ...generated];
  }

  function getTop5Fixes(matrixItems) {
    const items = (matrixItems || []).map((item) => {
      const effort = Number(item.effort) || 3;
      const impact = Number(item.impact) || 3;
      const score = impact / effort;
      return { ...item, score, quadrant: getQuadrant(effort, impact) };
    });
    return items.sort((a, b) => b.score - a.score || b.impact - a.impact).slice(0, 5);
  }

  function buildModulePitch(modKey, totalAnnualWaste, formatCurrencyFn, modules) {
    const fmt = formatCurrencyFn || ((v) => String(v));
    const list = modules || [];
    const mod2 = list.find((m) => m.key === 'MOD 2');
    const mod3 = list.find((m) => m.key === 'MOD 3');
    const mod4 = list.find((m) => m.key === 'MOD 4');
    const pitches = {
      'MOD 1': `Module 1 identified ${fmt(totalAnnualWaste)} in annual operational leakage. Use the 90-day fix list below before investing in new tools or headcount.`,
      'MOD 2': `To recover ${fmt(totalAnnualWaste)} lost annually to manual delays, we recommend ${mod2?.title || 'Module 2'} — clear order playbooks, roles charts, and an employee handbook your team can follow.`,
      'MOD 3': `With core processes defined, the next step is ${mod3?.title || 'Module 3'}. We launch your workspace, digitize approval forms, and train your team for daily use.`,
      'MOD 4': `To maintain operational integrity after go-live, we recommend ${mod4?.title || 'Module 4'} — hosting, bi-weekly check-ins, and semi-annual health checks.`,
    };
    return pitches[modKey] || '';
  }

  function validateReportReadiness(ctx) {
    const {
      tabs = [],
      subSaaS = [],
      synthesis = {},
      orgChartSvg = '',
      raciAssignments = {},
      DiagramEditor,
    } = ctx;

    const warnings = [];
    const errors = [];
    const matrixCount = synthesis.matrix?.items?.length || 0;
    const hasWorkflow = tabs.some((tab) => {
      const { tasks } = getProcessNodes(tab, DiagramEditor);
      return tasks.length > 0;
    });
    const hasLeakage = buildStepLeakageList(tabs, DiagramEditor).length > 0;

    if (!hasWorkflow) warnings.push('No workflow steps mapped — add at least one process in the Workflow Builder.');
    if (!hasLeakage) warnings.push('No step delays recorded — set delay minutes on workflow tasks for peso calculations.');
    if (hasWorkflow) warnings.push('Confirm you synced the Workflow Builder (Sync to Cloud in section 1) — diagrams save separately.');
    if (!subSaaS.length) warnings.push('SaaS audit is empty — add subscription rows for software savings.');
    if (matrixCount < 3) warnings.push('Fewer than 3 priority items — generate or add fixes for the 90-day plan.');
    if (matrixCount === 0) errors.push('No 90-day fix items — add priorities in Strategy or click Generate from Diagnosis.');
    if (!orgChartSvg) warnings.push('Org chart not exported — open Org Chart section and save.');
    if (Object.keys(raciAssignments).length === 0) warnings.push('RACI grid is empty — assign roles to workflow steps.');

    const ready = hasWorkflow && matrixCount >= 1;
    return { ready, warnings, errors };
  }

  const PRINT_PRESETS = {
    full: {
      showExecutiveSummary: true,
      showFixOrder: true,
      showLeakageRanking: true,
      showOrgChart: true,
      showFlowcharts: true,
      showRaci: true,
      showSaas: true,
      showSynthesis: true,
      showMatrix: true,
      showFindings: true,
      showNextSteps: true,
      showAppendix: false,
    },
    briefing: {
      showExecutiveSummary: true,
      showFixOrder: true,
      showLeakageRanking: true,
      showOrgChart: false,
      showFlowcharts: false,
      showRaci: false,
      showSaas: true,
      showSynthesis: true,
      showMatrix: true,
      showFindings: true,
      showNextSteps: true,
      showAppendix: false,
    },
  };

  const DiagnosisReportHelpers = {
    QUADRANT,
    getQuadrant,
    stepMonthlyLoss,
    computeCoiForecast,
    computeMaturityIndex,
    buildProcessRankings,
    buildStepLeakageList,
    buildRaciGaps,
    buildOperationalInsights,
    buildRiskProfiles,
    generateMatrixFromDiagnosis,
    getTop5Fixes,
    buildModulePitch,
    validateReportReadiness,
    PRINT_PRESETS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiagnosisReportHelpers;
  }
  global.DiagnosisReportHelpers = DiagnosisReportHelpers;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
