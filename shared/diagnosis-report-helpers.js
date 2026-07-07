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

  const TARGET_WEEK_OPTIONS = [
    'Week 1–2',
    'Week 3–4',
    'Week 5–6',
    'Week 7–8',
    'Week 9–10',
    'Week 11–12',
  ];

  const MATURITY_RUBRIC = {
    communication: {
      label: 'Team Communication',
      low: 'Viber/chat approvals, no SLA on handoffs',
      high: 'Documented channels with response-time expectations',
    },
    documentation: {
      label: 'Process Documentation',
      low: 'Tribal knowledge only — no SOPs in busy weeks',
      high: 'SOPs exist and teams use them under load',
    },
    accountability: {
      label: 'Handoff Accountability',
      low: 'RACI gaps — no single accountable owner on critical steps',
      high: 'Every critical step has a named Accountable (A)',
    },
    software: {
      label: 'Software Utilization',
      low: 'Duplicate tools and idle seats across departments',
      high: 'Consolidated stack with known owners per tool',
    },
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

  function resolveOwnerFromRaci(tab, step, raciAssignments, DiagramEditor) {
    const { vm } = getProcessNodes(tab, DiagramEditor);
    const roles = vm.lanes || [];
    const row = raciAssignments?.[step.id] || {};
    for (const role of roles) {
      if (row[role.id] === 'A' && String(role.owner || '').trim()) return String(role.owner).trim();
    }
    for (const role of roles) {
      if (row[role.id] && String(role.owner || '').trim()) return String(role.owner).trim();
    }
    return '';
  }

  function formatSaasEvidence(item) {
    const monthly = (Number(item.billing) || 0) * (Number(item.users) || 0);
    const billing = Number(item.billing || 0).toLocaleString();
    return `${item.tool} — ${item.users} seats @ ₱${billing}/mo (≈ ₱${monthly.toLocaleString()}/mo)`;
  }

  function suggestTargetWeek(effort, impact, index) {
    const e = Number(effort) || 3;
    const i = Number(impact) || 3;
    const earlyWeeks = ['Week 1–2', 'Week 3–4'];
    const lateWeeks = ['Week 5–6', 'Week 7–8', 'Week 9–10', 'Week 11–12'];
    if (e < 3 && i >= 3) return earlyWeeks[index % earlyWeeks.length];
    if (e >= 3 && i >= 3) return lateWeeks[index % lateWeeks.length];
    return earlyWeeks[index % earlyWeeks.length];
  }

  function getRootCauseKey(item) {
    if (item.rootCauseKey) return item.rootCauseKey;
    const src = item.source || 'manual';
    if (src === 'saas') {
      const tool = String(item.sourceDetail || item.text || '').split('—')[0].trim().toLowerCase();
      return `saas:${tool || 'unknown'}`;
    }
    if (src === 'workflow') {
      const proc = String(item.sourceDetail || item.text || '').split(',')[0]?.trim().toLowerCase();
      return `workflow:${proc || 'unknown'}`;
    }
    if (src === 'feedback') return `feedback:${String(item.sourceDetail || item.text || '').slice(0, 40).toLowerCase()}`;
    if (src === 'raci') return `raci:${String(item.sourceDetail || item.text || '').slice(0, 40).toLowerCase()}`;
    return `manual:${String(item.text || '').slice(0, 50).toLowerCase()}`;
  }

  function formatMatrixEvidence(item, formatCurrencyFn) {
    const fmt = formatCurrencyFn || ((v) => String(v));
    const src = item.source || 'manual';
    if (src === 'workflow' && item.sourceDetail) return `Source: ${item.sourceDetail}`;
    if (src === 'saas' && item.sourceDetail) return `Source: SaaS audit — ${item.sourceDetail}`;
    if (src === 'feedback') return `Source: Staff feedback — ${item.sourceDetail || item.text || 'theme'}`;
    if (src === 'raci') return `Source: RACI gap — ${item.sourceDetail || item.text}`;
    if (Number(item.expectedSavings) > 0) return `Est. savings: ${fmt(item.expectedSavings)}/mo`;
    return '';
  }

  function computeRecaptureSummary(topFixes, totalAnnualWaste) {
    const monthly = (topFixes || []).reduce((acc, i) => acc + (Number(i.expectedSavings) || 0), 0);
    const annual = monthly * 12;
    const total = Number(totalAnnualWaste) || 0;
    const pctOfTotalLeakage = total > 0 ? Math.round((annual / total) * 100) : 0;
    return { monthly, annual, pctOfTotalLeakage };
  }

  function isDefaultMaturity(synthesis) {
    const s = synthesis || {};
    return [s.communication, s.documentation, s.accountability, s.software]
      .every((v) => !v || Number(v) === 3);
  }

  function generateMatrixFromFeedback(themes, existingItems, existingTexts) {
    const items = [...existingItems];
    const texts = existingTexts || new Set(items.map((i) => (i.text || '').toLowerCase().trim()));
    (themes || []).filter((t) => t && String(t).trim()).forEach((theme, idx) => {
      const trimmed = String(theme).trim();
      const text = `Address staff feedback: ${trimmed}`;
      const key = text.toLowerCase();
      if (texts.has(key)) return;
      texts.add(key);
      items.push({
        id: `gen-fb-${Date.now()}-${idx}`,
        text,
        effort: 2.5,
        impact: 3.5,
        owner: '',
        targetWeek: 'Week 3–4',
        expectedSavings: 0,
        source: 'feedback',
        sourceDetail: trimmed,
        rootCauseKey: `feedback:${trimmed.slice(0, 40).toLowerCase()}`,
      });
    });
    return items;
  }

  function generateRaciGapMatrixItems(tabs, raciAssignments, DiagramEditor, existingItems, existingTexts) {
    const gaps = buildRaciGaps(tabs, raciAssignments, DiagramEditor).gaps.slice(0, 4);
    const items = [...existingItems];
    const texts = existingTexts || new Set(items.map((i) => (i.text || '').toLowerCase().trim()));
    gaps.forEach((gap, idx) => {
      const stepLabel = gap.stepLabel.replace(/\n/g, ' ');
      const text = gap.issue.includes('Accountable')
        ? `Assign accountable owner (A) for "${stepLabel}" in ${gap.tabName}`
        : `Assign RACI roles for "${stepLabel}" in ${gap.tabName}`;
      const key = text.toLowerCase();
      if (texts.has(key)) return;
      texts.add(key);
      items.push({
        id: `gen-raci-${Date.now()}-${idx}`,
        text,
        effort: 2,
        impact: 3,
        owner: '',
        targetWeek: 'Week 1–2',
        expectedSavings: 0,
        source: 'raci',
        sourceDetail: `${gap.tabName}: ${stepLabel}`,
        rootCauseKey: `raci:${gap.tabName}:${stepLabel.slice(0, 30).toLowerCase()}`,
      });
    });
    return items;
  }

  function generateMatrixFromDiagnosis(tabs, subSaaS, existingItems, DiagramEditor, options) {
    const opts = options || {};
    const raciAssignments = opts.raciAssignments || {};
    const staffFeedbackThemes = opts.staffFeedbackThemes || [];
    const synthesis = opts.synthesis || {};
    let items = [...(Array.isArray(existingItems) ? existingItems : [])];
    const existingTexts = new Set(items.map((i) => (i.text || '').toLowerCase().trim()));
    let workflowIdx = 0;

    (tabs || []).forEach((tab) => {
      const { tasks } = getProcessNodes(tab, DiagramEditor);
      tasks.forEach((step) => {
        const monthly = stepMonthlyLoss(step);
        if (monthly <= 0) return;
        const stepLabel = step.label.replace(/\n/g, ' ');
        const text = `Reduce wait time on "${stepLabel}" in ${tab.name}`;
        const key = text.toLowerCase();
        if (existingTexts.has(key)) return;
        existingTexts.add(key);
        const impact = Math.min(5, Math.max(2, Math.round(monthly / 5000) + 2));
        const effort = 2.5;
        items.push({
          id: `gen-step-${Date.now()}-${workflowIdx}`,
          text,
          effort,
          impact,
          owner: resolveOwnerFromRaci(tab, step, raciAssignments, DiagramEditor),
          targetWeek: suggestTargetWeek(effort, impact, workflowIdx),
          expectedSavings: monthly,
          source: 'workflow',
          sourceDetail: `${tab.name}, Step: ${stepLabel}`,
          rootCauseKey: `workflow:${tab.name.toLowerCase()}`,
        });
        workflowIdx += 1;
      });
    });

    const seenTools = new Set();
    (subSaaS || []).forEach((item, idx) => {
      const toolKey = String(item.tool || '').toLowerCase().trim();
      if (seenTools.has(toolKey)) return;
      const monthly = (Number(item.billing) || 0) * (Number(item.users) || 0);
      if (monthly < 100) return;
      seenTools.add(toolKey);
      const text = item.reason
        ? `${item.reason} — ${item.tool}`
        : `Review ${item.tool} licenses (${item.users} seats)`;
      const key = text.toLowerCase();
      if (existingTexts.has(key)) return;
      existingTexts.add(key);
      items.push({
        id: `gen-saas-${Date.now()}-${idx}`,
        text,
        effort: 1.5,
        impact: Math.min(5, Math.max(2, Math.round(monthly / 3000) + 2)),
        owner: '',
        targetWeek: 'Week 1–2',
        expectedSavings: monthly,
        source: 'saas',
        sourceDetail: formatSaasEvidence(item),
        rootCauseKey: `saas:${toolKey}`,
      });
    });

    items = generateMatrixFromFeedback(staffFeedbackThemes, items, existingTexts);

    if (Number(synthesis.accountability) <= 2) {
      items = generateRaciGapMatrixItems(tabs, raciAssignments, DiagramEditor, items, existingTexts);
    }

    return items;
  }

  function getTop5Fixes(matrixItems) {
    const items = (matrixItems || []).map((item) => {
      const effort = Number(item.effort) || 3;
      const impact = Number(item.impact) || 3;
      const score = impact / effort;
      return {
        ...item,
        score,
        quadrant: getQuadrant(effort, impact),
        rootCauseKey: getRootCauseKey(item),
      };
    });
    const sorted = items.sort(
      (a, b) => b.score - a.score
        || b.impact - a.impact
        || (Number(b.expectedSavings) || 0) - (Number(a.expectedSavings) || 0),
    );
    const seen = new Set();
    const deduped = [];
    for (const item of sorted) {
      const key = item.rootCauseKey || getRootCauseKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 5) break;
    }
    return deduped;
  }

  function validateTop5Readiness(ctx) {
    const { synthesis = {}, tasks = [] } = ctx;
    const matrixItems = synthesis.matrix?.items || [];
    const top5 = getTop5Fixes(matrixItems);
    const errors = [];
    const warnings = [];

    if (top5.length === 0) {
      errors.push('No Top 5 fixes — add matrix items or click Generate from Diagnosis.');
      return { ready: false, errors, warnings, top5 };
    }

    top5.forEach((item, idx) => {
      const n = idx + 1;
      if (!String(item.owner || '').trim()) errors.push(`Top ${n}: assign an owner for "${item.text.slice(0, 40)}…".`);
      if (!String(item.targetWeek || '').trim()) errors.push(`Top ${n}: set a target week.`);
      if (!(Number(item.expectedSavings) > 0)) warnings.push(`Top ${n}: add estimated monthly savings for "${item.text.slice(0, 40)}…".`);
    });

    if (isDefaultMaturity(synthesis)) {
      warnings.push('Maturity scores are all default (3/5) — calibrate against field observations before printing.');
    }

    const m102InScope = (tasks || []).some((t) => t.id === 'm1-02' && t.selected !== false);
    const feedbackThemes = (synthesis.staffFeedbackThemes || []).filter((t) => t && String(t).trim());
    const feedbackMatrixCount = matrixItems.filter((i) => i.source === 'feedback').length;
    if (m102InScope && feedbackThemes.length >= 2 && feedbackMatrixCount < 2) {
      warnings.push('Staff Feedback (m1-02) in scope — add at least 2 feedback themes as matrix rows.');
    }

    const ready = errors.length === 0;
    return { ready, errors, warnings, top5 };
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

  function buildRaciOrgInsights(tabs, raciAssignments, orgChartMembers, DiagramEditor) {
    const raciGaps = buildRaciGaps(tabs, raciAssignments, DiagramEditor);
    const lines = [];
    if (orgChartMembers.length > 0 && raciGaps.unassignedSteps > 0) {
      lines.push(`${raciGaps.unassignedSteps} workflow step(s) lack RACI assignments despite ${orgChartMembers.length} staff on the org chart — assign accountable owners before Mod 2.`);
    }
    if (raciGaps.noAccountable > 0) {
      lines.push(`${raciGaps.noAccountable} step(s) have no Accountable (A) role — decisions may stall at handoffs.`);
    }
    const unownedLanes = raciGaps.gaps.filter((g) => g.issue.includes('Lane has no named owner'));
    if (unownedLanes.length > 0) {
      lines.push(`${unownedLanes.length} workflow lane(s) have no named owner in the diagram — align lanes with org chart roles.`);
    }
    return lines;
  }

  function validateReportReadiness(ctx) {
    const {
      tabs = [],
      subSaaS = [],
      synthesis = {},
      orgChartSvg = '',
      raciAssignments = {},
      DiagramEditor,
      workflowUpdatedAt = 0,
      reportDataUpdatedAt = 0,
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
    if (workflowUpdatedAt && reportDataUpdatedAt && workflowUpdatedAt > reportDataUpdatedAt) {
      warnings.push('Workflow was saved after your last report sync — click Sync to Cloud here to refresh chaos tax in the PDF.');
    }
    if (!subSaaS.length) warnings.push('SaaS audit is empty — add subscription rows for software savings.');
    if (matrixCount < 3) warnings.push('Fewer than 3 priority items — generate or add fixes for the 90-day plan.');
    if (matrixCount === 0) errors.push('No 90-day fix items — add priorities in Strategy or click Generate from Diagnosis.');
    if (!orgChartSvg) warnings.push('Org chart not exported — open Org Chart section and save.');
    if (Object.keys(raciAssignments).length === 0) warnings.push('RACI grid is empty — assign roles to workflow steps.');

    const top5Check = validateTop5Readiness(ctx);
    errors.push(...(top5Check.errors || []));
    warnings.push(...(top5Check.warnings || []));

    const ready = hasWorkflow && matrixCount >= 1 && top5Check.ready;
    return { ready, warnings, errors, top5: top5Check.top5 };
  }

  const DEFAULT_FEEDBACK_LAUNCH_GUIDE =
    '1. Duplicate the Kolthoff anonymous feedback form template into your Google account.\n' +
    '2. Set the form to collect no names or email addresses.\n' +
    '3. Share the form link with staff (QR poster, Viber group, or email) for 5–7 business days.\n' +
    '4. Export themes only — paste summarized themes into Strategy (no raw submissions or names).\n' +
    '5. Upload the printed launch guide or form link to the client portal if requested.';

  function normalizeStaffDirectoryRows(members) {
    return (members || [])
      .map((m) => ({
        name: String(m.name || m.label || '').trim(),
        title: String(m.role || m.title || '').trim(),
        department: String(m.department || '').trim(),
        reportsTo: String(m.reportsTo || m.manager || '').trim(),
      }))
      .filter((row) => row.name);
  }

  function buildFeedbackFormQrUrl(formUrl) {
    const url = String(formUrl || '').trim();
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  }

  function validateMod1Handoff(ctx) {
    const base = validateReportReadiness(ctx);
    const { synthesis = {}, tasks = [] } = ctx;
    const errors = [...(base.errors || [])];
    const warnings = [...(base.warnings || [])];

    if (!String(synthesis.clientDeliverableUrl || '').trim()) {
      errors.push('Add a client deliverable link (Google Drive PDF URL) before marking Mod 1 complete.');
    }
    if (!String(synthesis.loomWalkthroughUrl || '').trim()) {
      errors.push('Add a Loom walkthrough URL (Mod 1 deliverable) before marking Mod 1 complete.');
    }

    const m102InScope = (tasks || []).some((t) => t.id === 'm1-02' && t.selected !== false);
    const m101InScope = (tasks || []).some((t) => t.id === 'm1-01' && t.selected !== false);
    const feedbackThemes = (synthesis.staffFeedbackThemes || []).filter((t) => t && String(t).trim());
    if (m102InScope && !String(synthesis.feedbackFormUrl || '').trim()) {
      warnings.push('Staff Feedback (m1-02) is in SOW scope — add the anonymous feedback form URL.');
    }
    if (m102InScope && feedbackThemes.length === 0) {
      warnings.push('Staff Feedback (m1-02) is in SOW scope — add at least one anonymous feedback theme.');
    }
    if (m101InScope && !(ctx.orgChartMembers || []).some((m) => String(m.name || m.label || '').trim())) {
      warnings.push('Team List (m1-01) is in SOW scope — add staff in the Org Chart section and print the directory.');
    }

    const ready =
      base.ready &&
      !!String(synthesis.clientDeliverableUrl || '').trim() &&
      !!String(synthesis.loomWalkthroughUrl || '').trim();

    return { ready, warnings, errors, top5: base.top5 };
  }

  /**
   * Strip fixed pixel dimensions from draw.io SVG exports so report/print CSS can scale
   * diagrams to the printable page width without clipping the right edge.
   */
  function normalizeReportDiagramSvg(svgDataUri) {
    if (!svgDataUri || typeof svgDataUri !== 'string') return svgDataUri || '';
    if (!svgDataUri.startsWith('data:image/svg+xml')) return svgDataUri;

    try {
      const commaIdx = svgDataUri.indexOf(',');
      if (commaIdx < 0) return svgDataUri;
      const meta = svgDataUri.slice(0, commaIdx);
      const payload = svgDataUri.slice(commaIdx + 1);
      const isBase64 = /;base64/i.test(meta);
      const decodePayload = () => {
        if (isBase64) {
          if (typeof atob === 'function') return atob(payload);
          if (typeof Buffer !== 'undefined') return Buffer.from(payload, 'base64').toString('utf8');
          return payload;
        }
        return decodeURIComponent(payload);
      };
      const encodePayload = (text) => {
        if (isBase64) {
          if (typeof btoa === 'function') return btoa(text);
          if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
          return text;
        }
        return encodeURIComponent(text);
      };

      let svgText = decodePayload();
      svgText = svgText.replace(/<svg([^>]*)>/i, (match, attrs) => {
        const widthMatch = attrs.match(/\bwidth="([\d.]+)/i);
        const heightMatch = attrs.match(/\bheight="([\d.]+)/i);
        let next = attrs
          .replace(/\swidth="[^"]*"/gi, '')
          .replace(/\sheight="[^"]*"/gi, '')
          .replace(/\spreserveAspectRatio="[^"]*"/gi, '');
        if (!/\bviewBox=/i.test(next) && widthMatch && heightMatch) {
          next += ` viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}"`;
        }
        next += ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet"';
        return `<svg${next}>`;
      });

      const encodedPrefix = isBase64 ? ';base64,' : ',';
      return `${meta}${encodedPrefix}${encodePayload(svgText)}`;
    } catch {
      return svgDataUri;
    }
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
    TARGET_WEEK_OPTIONS,
    MATURITY_RUBRIC,
    getQuadrant,
    stepMonthlyLoss,
    computeCoiForecast,
    computeMaturityIndex,
    computeRecaptureSummary,
    buildProcessRankings,
    buildStepLeakageList,
    buildRaciGaps,
    buildOperationalInsights,
    buildRiskProfiles,
    buildRaciOrgInsights,
    resolveOwnerFromRaci,
    formatMatrixEvidence,
    formatSaasEvidence,
    getRootCauseKey,
    suggestTargetWeek,
    isDefaultMaturity,
    generateMatrixFromFeedback,
    generateRaciGapMatrixItems,
    generateMatrixFromDiagnosis,
    getTop5Fixes,
    validateTop5Readiness,
    buildModulePitch,
    validateReportReadiness,
    validateMod1Handoff,
    DEFAULT_FEEDBACK_LAUNCH_GUIDE,
    normalizeStaffDirectoryRows,
    normalizeReportDiagramSvg,
    buildFeedbackFormQrUrl,
    PRINT_PRESETS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiagnosisReportHelpers;
  }
  global.DiagnosisReportHelpers = DiagnosisReportHelpers;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
