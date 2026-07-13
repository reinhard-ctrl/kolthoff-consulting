/**
 * Module 1 Leak Scan Report — shared assembly helpers for diagnosis reports.
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

  const MATURITY_INDEX_EXPLAINER =
    'Operational readiness across team communication, process documentation, handoff accountability, and software use.';

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
    return buildCoiBreakdown(annualChaosTax, saasAnnualWaste, expectedGrowth).projected;
  }

  function buildCoiBreakdown(annualChaosTax, saasAnnualWaste, expectedGrowth, formatCurrencyFn) {
    const fmt = formatCurrencyFn || ((v) => String(v));
    const processAnnual = Number(annualChaosTax) || 0;
    const saasAnnual = Number(saasAnnualWaste) || 0;
    const baseAnnual = processAnnual + saasAnnual;
    const growth = Number(expectedGrowth) || 0;
    const growthMultiplier = 1 + growth * 0.1;
    const threeYearBase = baseAnnual * 3;
    const projected = Math.round(threeYearBase * growthMultiplier);
    return {
      processAnnual,
      saasAnnual,
      baseAnnual,
      growth,
      growthMultiplier,
      threeYearBase,
      projected,
      assumptionSentence: growth > 0
        ? `Assumes ${growth} additional headcount without process fixes (+${Math.round((growthMultiplier - 1) * 100)}% compounding).`
        : 'Assumes flat headcount — no team growth without process fixes.',
      formulaLabel: `(${fmt(processAnnual)} process + ${fmt(saasAnnual)} subscriptions) × 3 years × ${growthMultiplier.toFixed(2)} growth factor`,
    };
  }

  function computeMaturityIndex(synthesis) {
    const s = synthesis || {};
    const scores = [s.communication, s.documentation, s.accountability, s.software].map((v) => Number(v) || 3);
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  const REPORT_METHODOLOGY_DISCLAIMER =
    'Leakage figures are estimates based on stated delay minutes, salary assumptions, and subscription seat counts you provided. Validate numbers with your leadership team before acting. This report is operational advisory only — not legal, HR, tax, or accounting advice.';

  function buildMaturityScorecardRows(synthesis) {
    const s = synthesis || {};
    return Object.entries(MATURITY_RUBRIC).map(([key, rubric]) => {
      const score = Number(s[key]) || 3;
      let observed = rubric.low;
      if (score >= 4) observed = rubric.high;
      else if (score === 3) observed = `Between baseline and target — ${rubric.low}`;
      return { key, label: rubric.label, score, observed };
    });
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

  function previewMatrixGeneration(tabs, subSaaS, existingItems, DiagramEditor, options) {
    const existing = Array.isArray(existingItems) ? existingItems : [];
    const existingIds = new Set(existing.map((i) => i.id));
    const mergedItems = generateMatrixFromDiagnosis(tabs, subSaaS, existing, DiagramEditor, options);
    const newItems = mergedItems.filter((i) => !existingIds.has(i.id));
    const counts = { workflow: 0, saas: 0, feedback: 0, raci: 0, manual: 0, total: newItems.length };
    newItems.forEach((i) => {
      const src = i.source || 'manual';
      if (Object.prototype.hasOwnProperty.call(counts, src)) counts[src] += 1;
      else counts.manual += 1;
    });
    const replaceItems = generateMatrixFromDiagnosis(tabs, subSaaS, [], DiagramEditor, { ...options, replace: true });
    return { counts, newItems, mergedItems, replaceCount: replaceItems.length };
  }

  function buildOwnerSuggestions(orgChartMembers, tabs, raciAssignments, DiagramEditor) {
    const suggestions = new Set();
    (orgChartMembers || []).forEach((m) => {
      const name = String(m.name || m.label || '').trim();
      const role = String(m.role || m.title || '').trim();
      if (name) suggestions.add(name);
      if (role && role !== name) suggestions.add(role);
    });
    (tabs || []).forEach((tab) => {
      const { vm } = getProcessNodes(tab, DiagramEditor);
      (vm.lanes || []).forEach((lane) => {
        const owner = String(lane.owner || '').trim();
        if (owner) suggestions.add(owner);
      });
    });
    return [...suggestions].sort((a, b) => a.localeCompare(b));
  }

  function buildInsightMatrixItem(insightText, index) {
    const raw = String(insightText || '').trim();
    let text = raw;
    if (raw.startsWith('Staff feedback theme:')) {
      text = `Address staff feedback: ${raw.replace(/^Staff feedback theme:\s*/i, '').trim()}`;
    } else if (raw.length > 120) {
      text = `${raw.slice(0, 117)}…`;
    }
    const effort = 3;
    const impact = 3.5;
    return {
      id: `insight-${Date.now()}-${index}`,
      text,
      effort,
      impact,
      owner: '',
      targetWeek: suggestTargetWeek(effort, impact, index),
      expectedSavings: 0,
      source: 'insight',
      sourceDetail: 'Live finding',
    };
  }

  function buildNextPhaseHint(matrixItems, modules) {
    const top5 = getTop5Fixes(matrixItems || []);
    if (!top5.length) return null;
    const mod2 = (modules || []).find((m) => m.key === 'MOD 2');
    const docKeywords = ['document', 'raci', 'handoff', 'playbook', 'accountable', 'sop'];
    const docNeeded = top5.filter((i) => {
      const lower = String(i.text || '').toLowerCase();
      return docKeywords.some((kw) => lower.includes(kw));
    }).length;
    if (docNeeded >= 2) {
      return `${docNeeded} of your Top ${top5.length} fixes need playbook documentation or RACI clarity — ${mod2?.title || 'Module 2'} is the natural next step.`;
    }
    if (top5.some((i) => i.source === 'saas')) {
      return 'Subscription overlap appears in your Top 5 — Mod 2 playbooks help lock in seat reductions after quick wins.';
    }
    return null;
  }

  function generateMatrixFromDiagnosis(tabs, subSaaS, existingItems, DiagramEditor, options) {
    const opts = options || {};
    const raciAssignments = opts.raciAssignments || {};
    const staffFeedbackThemes = opts.staffFeedbackThemes || [];
    const synthesis = opts.synthesis || {};
    let items = opts.replace
      ? []
      : [...(Array.isArray(existingItems) ? existingItems : [])];
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
      'MOD 1': `Module 1 identified ${fmt(totalAnnualWaste)} in annual operational leakage. Use the 90-Day Recovery Plan below before investing in new tools or headcount.`,
      'MOD 2': `Your Leak Scan Report and 90-Day Recovery Plan identified ${fmt(totalAnnualWaste)} in recoverable leakage. ${mod2?.title || 'Module 2'} turns those findings into order playbooks, sign-off roles, and a Philippines-ready employee handbook your team can follow daily.`,
      'MOD 3': `With playbooks and policies in place, ${mod3?.title || 'Module 3'} launches your branded workspace — digitized approval forms, training, and two-week post go-live support so fixes stick.`,
      'MOD 4': `After go-live, ${mod4?.title || 'Module 4'} keeps momentum with hosting, bi-weekly manager check-ins, and semi-annual health checks — so leakage does not creep back.`,
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
    if (!hasLeakage) warnings.push('No step delays recorded — set delay minutes on workflow tasks for leakage calculations.');
    if (hasWorkflow) warnings.push('Confirm you synced the Workflow Builder (Sync to Cloud in section 2) — diagrams save separately.');
    if (workflowUpdatedAt && reportDataUpdatedAt && workflowUpdatedAt > reportDataUpdatedAt) {
      warnings.push('Workflow was saved after your last report sync — click Sync to Cloud here to refresh chaos tax in the PDF.');
    }
    if (!subSaaS.length) warnings.push('SaaS audit is empty — add subscription rows for software savings.');
    if (matrixCount < 3) warnings.push('Fewer than 3 priority items — generate or add fixes for the 90-Day Recovery Plan.');
    if (matrixCount === 0) errors.push('No 90-Day Recovery Plan items — add priorities in Strategy or click Generate from Diagnosis.');
    if (!orgChartSvg) warnings.push('Org chart not exported — open Org Chart section and save.');
    if (Object.keys(raciAssignments).length === 0) warnings.push('RACI grid is empty — assign roles to workflow steps.');

    const top5Check = validateTop5Readiness(ctx);
    errors.push(...(top5Check.errors || []));
    warnings.push(...(top5Check.warnings || []));

    const ready = hasWorkflow && matrixCount >= 1 && top5Check.ready;
    return { ready, warnings, errors, top5: top5Check.top5 };
  }

  /**
   * Canonical Mod 1 anonymous staff feedback Google Form template (m1-02).
   * Master form lives in Kolthoff Google Drive — update templateFormId if the template moves.
   */
  const M102_FEEDBACK_FORM_TEMPLATE = {
    taskId: 'm1-02',
    title: 'Anonymous Staff Feedback Channel',
    documentTitle: 'Kolthoff Mod 1 — Anonymous Staff Feedback (m1-02)',
    description:
      'Your answers are anonymous — please do not write your name, email, or phone number. ' +
      'Tell us what makes daily work harder: slow approvals, waiting on other teams, or tools that do not work well. ' +
      'Management only sees a summary of common themes, not individual answers.',
    settings: {
      collectEmail: false,
    },
    questions: [
      {
        type: 'section',
        title: 'About your job',
        description: 'Choose the option that best fits what you do. Do not write your name.',
      },
      {
        type: 'choice',
        title: 'What kind of work do you do most days?',
        required: true,
        options: [
          'Operations or delivery (getting work done for clients)',
          'Sales or working with clients',
          'Finance or admin',
          'HR or people support',
          'Management or leadership',
          'Other',
        ],
      },
      {
        type: 'scale',
        title: 'How often do you wait on someone else’s approval or for work to be passed to the next person?',
        required: true,
        lowLabel: 'Almost never',
        highLabel: 'Every day',
        low: 1,
        high: 5,
      },
      {
        type: 'paragraph',
        title: 'What part of your job is most frustrating or takes too long?',
        description: 'Describe the step or process — not people by name.',
        required: true,
      },
      {
        type: 'paragraph',
        title: 'Where do requests or files get held up when they move between teams?',
        description: 'For example: waiting for sign-off, missing information, or entering the same data twice.',
        required: true,
      },
      {
        type: 'short',
        title: 'Which apps, tools, or Excel files cause you the most trouble?',
        required: true,
      },
      {
        type: 'paragraph',
        title: 'If management could fix one thing in the next 3 months, what should it be?',
        required: true,
      },
      {
        type: 'choice',
        title: 'How urgent is this for you?',
        required: true,
        options: [
          'Not urgent — nice to fix when we can',
          'It slows us down every week',
          'It is hurting sales or client service',
          'It is a safety or compliance concern',
        ],
      },
      {
        type: 'paragraph',
        title: 'Anything else you would like us to know? (optional)',
        required: false,
      },
    ],
    /** Kolthoff master template — share in Drive as Anyone with the link → Editor */
    templateFormId: '1A8MHTf3JXnYYUSH1zAClqcXQUWVZ1rrc94BsRvueEt8',
  };

  function extractGoogleFormId(urlOrId) {
    const raw = String(urlOrId || '').trim();
    if (!raw) return '';
    if (!raw.includes('/')) return raw;
    const match = raw.match(/\/forms\/d\/(?:e\/)?([^/?#]+)/i);
    return match ? match[1] : '';
  }

  function buildFeedbackFormViewUrl(templateIdOrUrl) {
    const formId = extractGoogleFormId(templateIdOrUrl || M102_FEEDBACK_FORM_TEMPLATE.templateFormId);
    if (!formId) return '';
    return `https://docs.google.com/forms/d/${formId}/viewform`;
  }

  function getM102FeedbackFormTemplate() {
    return M102_FEEDBACK_FORM_TEMPLATE;
  }

  const DEFAULT_FEEDBACK_LAUNCH_GUIDE =
    '1. Open the Kolthoff m1-02 form template and make a copy in Google Forms for this client.\n' +
    '2. In your copy: Form → Settings → confirm “Collect email addresses” is OFF, then publish.\n' +
    '3. Paste the live viewform link above and share it with staff (QR poster, Viber, or email) for 5–7 business days.\n' +
    '4. Export themes only — paste summarized themes below (no raw submissions or names).\n' +
    '5. Sync to cloud pushes the form link to the client portal vault.';

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

  function buildLinkQrUrl(linkUrl, size) {
    const url = String(linkUrl || '').trim();
    if (!url) return '';
    const px = Number(size) || 180;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${encodeURIComponent(url)}`;
  }

  function buildFeedbackFormQrUrl(formUrl) {
    return buildLinkQrUrl(formUrl, 180);
  }

  function isMod1TaskInScope(tasks, taskId) {
    const task = (tasks || []).find((t) => t.id === taskId);
    if (!task) return true;
    return task.selected !== false;
  }

  function buildMod1DeliverableStatus(ctx) {
    const {
      tasks = [],
      orgChartSvg = '',
      orgChartMembers = [],
      tabs = [],
      subSaaS = [],
      synthesis = {},
      DiagramEditor,
    } = ctx;

    const items = [];
    const rosterRows = normalizeStaffDirectoryRows(orgChartMembers);
    const feedbackThemes = (synthesis.staffFeedbackThemes || []).filter((t) => t && String(t).trim());
    const hasWorkflow = (tabs || []).some((tab) => getProcessNodes(tab, DiagramEditor).tasks.length > 0);
    const hasLeakage = buildStepLeakageList(tabs, DiagramEditor).length > 0;
    const top5Check = validateTop5Readiness({ synthesis, tasks });

    const push = (id, label, inScope, complete, warningHint, pendingHint) => {
      if (!inScope) return;
      let status = 'pending';
      let hint = pendingHint || '';
      if (complete) {
        status = 'complete';
        hint = '';
      } else if (warningHint) {
        status = 'warning';
        hint = warningHint;
      }
      items.push({ id, label, status, hint });
    };

    push(
      'm1-01',
      'Staff Directory (m1-01)',
      isMod1TaskInScope(tasks, 'm1-01'),
      rosterRows.length > 0 && !!String(orgChartSvg || '').trim(),
      rosterRows.length > 0 ? 'Export org chart diagram' : 'Add staff in Org Chart section',
      'Build org chart and sync roster',
    );
    push(
      'm1-02',
      'Staff Feedback (m1-02)',
      isMod1TaskInScope(tasks, 'm1-02'),
      !!String(synthesis.feedbackFormUrl || '').trim() && feedbackThemes.length > 0,
      !String(synthesis.feedbackFormUrl || '').trim() ? 'Add feedback form URL' : 'Add at least one feedback theme',
      'Launch anonymous feedback form',
    );
    push(
      'm1-03',
      'Workflow Study (m1-03)',
      isMod1TaskInScope(tasks, 'm1-03'),
      hasWorkflow && hasLeakage,
      hasWorkflow ? 'Set delay minutes on bottleneck steps' : 'Map at least one workflow',
      'Map as-is workflows in section 2',
    );
    push(
      'm1-04',
      'SaaS Review (m1-04)',
      isMod1TaskInScope(tasks, 'm1-04'),
      (subSaaS || []).length > 0,
      '',
      'Add subscription rows in SaaS audit',
    );
    push(
      'm1-05',
      'Leak Scan Report (m1-05)',
      isMod1TaskInScope(tasks, 'm1-05'),
      top5Check.ready
        && !!String(synthesis.clientDeliverableUrl || '').trim()
        && !!String(synthesis.loomWalkthroughUrl || '').trim(),
      !top5Check.ready ? 'Complete Top 5 (owner + week)' : 'Add Drive PDF + Loom URLs in Client Handoff',
      'Build 90-Day Recovery Plan and client handoff links',
    );

    return items;
  }

  function buildDefaultExecutiveLetter(ctx) {
    const {
      tabs = [],
      subSaaS = [],
      synthesis = {},
      orgChartMembers = [],
      formatCurrency = (v) => String(v),
      DiagramEditor,
    } = ctx;

    const rankings = buildProcessRankings(tabs, DiagramEditor);
    const top = rankings[0];
    const top5 = getTop5Fixes(synthesis.matrix?.items || []);
    const saasMonthly = (subSaaS || []).reduce(
      (acc, curr) => acc + (Number(curr.billing) || 0) * (Number(curr.users) || 0),
      0,
    );
    const processAnnual = rankings.reduce((acc, row) => acc + (row.annual || 0), 0);
    const totalAnnual = processAnnual + saasMonthly * 12;
    const recapture = computeRecaptureSummary(top5, totalAnnual);
    const processCount = (tabs || []).filter((tab) => getProcessNodes(tab, DiagramEditor).tasks.length > 0).length;
    const staffCount = normalizeStaffDirectoryRows(orgChartMembers).length;
    const toolCount = (subSaaS || []).length;

    const parts = [];
    parts.push(
      `We mapped ${processCount || 'no'} core process${processCount === 1 ? '' : 'es'}, ${staffCount || 'no'} team member${staffCount === 1 ? '' : 's'}, and ${toolCount} software subscription${toolCount === 1 ? '' : 's'} during your Module 1 Business Leak Scan.`,
    );
    if (top && top.annual > 0) {
      parts.push(
        ` The highest-leak process is "${top.tabName}" at approximately ${formatCurrency(top.monthly)}/month — bottleneck: ${String(top.topStepLabel || '').replace(/\n/g, ' ').trim() || 'see process maps'}.`,
      );
    }
    if (totalAnnual > 0) {
      parts.push(` Total identified leakage is ${formatCurrency(totalAnnual)}/year (process delays + subscription overlap).`);
    }
    if (recapture.annual > 0 && top5.length > 0) {
      parts.push(
        ` Executing the 90-Day Recovery Plan (Top ${top5.length} fixes in this Leak Scan Report) can recover approximately ${formatCurrency(recapture.annual)} in Year 1`,
      );
      if (recapture.pctOfTotalLeakage > 0) {
        parts.push(` (~${recapture.pctOfTotalLeakage}% of total leakage) within 90 days without adding headcount.`);
      } else {
        parts.push(' within 90 days without adding headcount.');
      }
    }
    return parts.join('');
  }

  function getBriefingWorkflowTabs(tabs, DiagramEditor) {
    const rankings = buildProcessRankings(tabs, DiagramEditor);
    if (!rankings.length) return [];
    const topId = rankings[0].tabId;
    return (tabs || []).filter((tab) => tab.id === topId);
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
      warnings.push('Staff Directory (m1-01) is in SOW scope — add staff in the Org Chart section and print the directory.');
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
   * Connector strokes are clamped thin (never boosted) so org lines and workflow arrows
   * stay proportional when the diagram scales down for PDF print.
   */
  const REPORT_DIAGRAM_CONNECTOR_STROKE = '#64748b';
  const REPORT_DIAGRAM_MIN_STROKE = 0.75;
  const REPORT_DIAGRAM_MAX_STROKE = 1;
  const REPORT_DIAGRAM_MARKER_MAX = 6;

  function clampReportDiagramStroke(width, min, max) {
    const sw = Number(width);
    if (!Number.isFinite(sw) || sw <= 0) return min;
    return Math.min(max, Math.max(min, sw));
  }

  function parseSvgStrokeWidth(attrs) {
    const match = attrs.match(/\bstroke-width="([\d.]+)"/i);
    return match ? Number(match[1]) : 1;
  }

  function isReportDiagramConnector(tag, attrs) {
    if (/marker-(start|end)=/i.test(attrs)) return true;
    if (tag === 'line') return true;
    if (tag === 'polyline') return true;
    if (tag !== 'path') return false;
    const fillMatch = attrs.match(/\bfill="([^"]*)"/i);
    const fill = fillMatch ? fillMatch[1].trim().toLowerCase() : 'none';
    return !fill || fill === 'none' || fill === 'transparent';
  }

  function normalizeReportDiagramConnectorAttrs(attrs) {
    let next = attrs;
    const strokeWidth = clampReportDiagramStroke(
      parseSvgStrokeWidth(next),
      REPORT_DIAGRAM_MIN_STROKE,
      REPORT_DIAGRAM_MAX_STROKE
    );

    if (/\bstroke-width="/i.test(next)) {
      next = next.replace(/\bstroke-width="[\d.]+"/i, `stroke-width="${strokeWidth}"`);
    } else {
      next += ` stroke-width="${strokeWidth}"`;
    }

    if (/\bstroke="/i.test(next)) {
      next = next.replace(/\bstroke="[^"]*"/i, `stroke="${REPORT_DIAGRAM_CONNECTOR_STROKE}"`);
    } else {
      next += ` stroke="${REPORT_DIAGRAM_CONNECTOR_STROKE}"`;
    }

    next = next.replace(/\svector-effect="non-scaling-stroke"/gi, '');
    if (!/\bstroke-linecap="/i.test(next)) next += ' stroke-linecap="round"';
    if (!/\bstroke-linejoin="/i.test(next)) next += ' stroke-linejoin="round"';
    return next;
  }

  function normalizeReportDiagramMarkerSize(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 4;
    return Math.round(Math.min(REPORT_DIAGRAM_MARKER_MAX, Math.max(3, n * 0.75)));
  }

  function scaleReportDiagramMarkers(svgText) {
    return svgText.replace(/<marker\b([^>]*)>([\s\S]*?)<\/marker>/gi, (full, attrs, inner) => {
      let nextAttrs = attrs;
      nextAttrs = nextAttrs.replace(/\bmarkerWidth="([\d.]+)"/i, (_, value) =>
        `markerWidth="${normalizeReportDiagramMarkerSize(value)}"`
      );
      nextAttrs = nextAttrs.replace(/\bmarkerHeight="([\d.]+)"/i, (_, value) =>
        `markerHeight="${normalizeReportDiagramMarkerSize(value)}"`
      );
      nextAttrs = nextAttrs.replace(/\bmarkerUnits="userSpaceOnUse"/i, 'markerUnits="strokeWidth"');
      if (!/\bmarkerUnits=/i.test(nextAttrs)) nextAttrs += ' markerUnits="strokeWidth"';

      const nextInner = inner
        .replace(/<path\b([^>]*)\bfill="[^"]*"([^>]*)(\/>|>)/gi, (match, before, after, close) =>
          `<path${before}fill="${REPORT_DIAGRAM_CONNECTOR_STROKE}"${after}${close}`
        )
        .replace(/<polygon\b([^>]*)\bfill="[^"]*"([^>]*)(\/>|>)/gi, (match, before, after, close) =>
          `<polygon${before}fill="${REPORT_DIAGRAM_CONNECTOR_STROKE}"${after}${close}`
        );

      return `<marker${nextAttrs}>${nextInner}</marker>`;
    });
  }

  function enhanceReportDiagramConnectorVisibility(svgText) {
    let next = scaleReportDiagramMarkers(svgText);
    next = next.replace(/<(path|line|polyline)\b([^>]*?)(\/>|>)/gi, (match, tag, attrs, close) => {
      if (!isReportDiagramConnector(tag.toLowerCase(), attrs)) return match;
      return `<${tag}${normalizeReportDiagramConnectorAttrs(attrs)}${close}`;
    });
    return next;
  }

  const REPORT_DIAGRAM_SHAPE_STROKE = '#64748b';
  const REPORT_DIAGRAM_SHAPE_STROKE_MIN = 0.75;
  const REPORT_DIAGRAM_SHAPE_STROKE_MAX = 1;
  const REPORT_DIAGRAM_TEXT_FILL = '#0f172a';
  const REPORT_DIAGRAM_FONT_STACK = 'Montserrat, Helvetica, Arial, sans-serif';
  const REPORT_DIAGRAM_FILL_REMAP = {
    '#dae8fc': '#f0fdfa',
    '#d5e8d4': '#ecfdf5',
    '#fff2cc': '#fffbeb',
    '#f8cecc': '#fff1f2',
    '#e1d5e7': '#f5f3ff',
    '#ffffff': '#ffffff',
  };
  const REPORT_DIAGRAM_STROKE_REMAP = {
    '#6c8ebf': '#0f766e',
    '#82b366': '#059669',
    '#d6b656': '#d97706',
    '#b85450': '#e11d48',
    '#9673a6': '#7c3aed',
    '#000000': REPORT_DIAGRAM_SHAPE_STROKE,
    '#666666': '#64748b',
  };

  function remapDiagramColor(value, map, fallback) {
    if (!value || typeof value !== 'string') return fallback;
    const key = value.trim().toLowerCase();
    if (map[key]) return map[key];
    const rgb = key.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgb) {
      const hex =
        '#' +
        [rgb[1], rgb[2], rgb[3]]
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('');
      if (map[hex]) return map[hex];
    }
    return value;
  }

  function getSvgAttribute(attrs, name) {
    const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
    return match ? match[1] : '';
  }

  function isReportDiagramFilledShape(tag, attrs) {
    const fill = getSvgAttribute(attrs, 'fill').trim().toLowerCase();
    if (tag === 'rect' || tag === 'ellipse' || tag === 'circle' || tag === 'polygon') {
      if (!fill || fill === 'none' || fill === 'transparent') return false;
      return true;
    }
    if (tag !== 'path') return false;
    return fill && fill !== 'none' && fill !== 'transparent';
  }

  function boostReportDiagramShapeAttrs(attrs) {
    let next = attrs;
    const fill = getSvgAttribute(next, 'fill');
    if (fill) {
      next = next.replace(/\bfill="[^"]*"/i, `fill="${remapDiagramColor(fill, REPORT_DIAGRAM_FILL_REMAP, fill)}"`);
    }
    const stroke = getSvgAttribute(next, 'stroke');
    if (stroke && stroke.toLowerCase() !== 'none') {
      next = next.replace(/\bstroke="[^"]*"/i, `stroke="${remapDiagramColor(stroke, REPORT_DIAGRAM_STROKE_REMAP, stroke)}"`);
    } else if (!stroke) {
      next += ` stroke="${REPORT_DIAGRAM_SHAPE_STROKE}"`;
    }
    const sw = parseSvgStrokeWidth(next);
    const boosted = clampReportDiagramStroke(sw, REPORT_DIAGRAM_SHAPE_STROKE_MIN, REPORT_DIAGRAM_SHAPE_STROKE_MAX);
    if (/\bstroke-width="/i.test(next)) {
      next = next.replace(/\bstroke-width="[\d.]+"/i, `stroke-width="${boosted}"`);
    } else {
      next += ` stroke-width="${boosted}"`;
    }
    return next;
  }

  function boostReportDiagramTextAttrs(attrs) {
    let next = attrs;
    if (/\bfill="/i.test(next)) {
      next = next.replace(/\bfill="[^"]*"/i, `fill="${REPORT_DIAGRAM_TEXT_FILL}"`);
    } else {
      next += ` fill="${REPORT_DIAGRAM_TEXT_FILL}"`;
    }
    if (!/\bfont-family="/i.test(next)) next += ` font-family="${REPORT_DIAGRAM_FONT_STACK}"`;
    const fontSize = Number(getSvgAttribute(next, 'font-size'));
    if (!Number.isFinite(fontSize) || fontSize < 11) {
      if (/\bfont-size="/i.test(next)) {
        next = next.replace(/\bfont-size="[\d.]+"/i, 'font-size="11"');
      } else {
        next += ' font-size="11"';
      }
    }
    return next;
  }

  function parseSvgViewBox(attrs) {
    const match = attrs.match(/\bviewBox="([^"]+)"/i);
    if (!match) return null;
    const parts = match[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    return parts;
  }

  function pushSvgNumberPair(target, a, b) {
    const x = Number(a);
    const y = Number(b);
    if (Number.isFinite(x) && Number.isFinite(y)) target.push([x, y]);
  }

  function expandSvgBounds(bounds, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return bounds;
    if (!bounds) return { minX: x, minY: y, maxX: x, maxY: y };
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    return bounds;
  }

  function expandSvgBoundsByBox(bounds, x, y, w, h, pad = 0) {
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return bounds;
    bounds = expandSvgBounds(bounds, x - pad, y - pad);
    bounds = expandSvgBounds(bounds, x + w + pad, y + h + pad);
    return bounds;
  }

  function parseSvgPointsAttr(points) {
    if (!points || typeof points !== 'string') return [];
    const pairs = [];
    const tokens = points.trim().split(/[\s,]+/).filter(Boolean);
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      pushSvgNumberPair(pairs, tokens[i], tokens[i + 1]);
    }
    return pairs;
  }

  function parseSvgPathPoints(d) {
    if (!d || typeof d !== 'string') return [];
    const pairs = [];
    const absCommands = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;
    let match;
    let cx = 0;
    let cy = 0;
    while ((match = absCommands.exec(d))) {
      const cmd = match[1];
      const args = match[2]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite);
      const upper = cmd.toUpperCase();
      const isRel = cmd !== upper;

      const takePoint = (idx) => {
        if (idx + 1 >= args.length) return null;
        let x = args[idx];
        let y = args[idx + 1];
        if (isRel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        pushSvgNumberPair(pairs, x, y);
        return [x, y];
      };

      if (upper === 'Z') continue;
      if (upper === 'M' || upper === 'L' || upper === 'T') {
        for (let i = 0; i + 1 < args.length; i += 2) takePoint(i);
        continue;
      }
      if (upper === 'H') {
        for (let i = 0; i < args.length; i += 1) {
          const x = isRel ? cx + args[i] : args[i];
          cx = x;
          pushSvgNumberPair(pairs, cx, cy);
        }
        continue;
      }
      if (upper === 'V') {
        for (let i = 0; i < args.length; i += 1) {
          const y = isRel ? cy + args[i] : args[i];
          cy = y;
          pushSvgNumberPair(pairs, cx, cy);
        }
        continue;
      }
      if (upper === 'C') {
        for (let i = 0; i + 5 < args.length; i += 6) {
          takePoint(i);
          takePoint(i + 2);
          takePoint(i + 4);
        }
        continue;
      }
      if (upper === 'S' || upper === 'Q') {
        for (let i = 0; i + 3 < args.length; i += 4) {
          takePoint(i);
          takePoint(i + 2);
        }
        continue;
      }
      if (upper === 'A') {
        for (let i = 0; i + 6 < args.length; i += 7) {
          takePoint(i + 5);
        }
      }
    }
    return pairs;
  }

  function isLikelyReportDiagramBackgroundRect(attrs, canvasViewBox) {
    if (/data-report-bg=/i.test(attrs)) return true;
    const fill = getSvgAttribute(attrs, 'fill').trim().toLowerCase();
    if (!fill || (fill !== '#ffffff' && fill !== '#fff' && fill !== 'white')) return false;
    if (!canvasViewBox) return false;
    const x = Number(getSvgAttribute(attrs, 'x') || 0);
    const y = Number(getSvgAttribute(attrs, 'y') || 0);
    const w = Number(getSvgAttribute(attrs, 'width'));
    const h = Number(getSvgAttribute(attrs, 'height'));
    if (![x, y, w, h].every(Number.isFinite)) return false;
    const [cx, cy, cw, ch] = canvasViewBox;
    const coversCanvas =
      Math.abs(x - cx) <= cw * 0.02 &&
      Math.abs(y - cy) <= ch * 0.02 &&
      w >= cw * 0.92 &&
      h >= ch * 0.92;
    return coversCanvas;
  }

  function resolveReportDiagramCanvasViewBox(attrs) {
    const fromViewBox = parseSvgViewBox(attrs);
    if (fromViewBox) return fromViewBox;
    const width = readSvgLengthAttr(attrs, 'width');
    const height = readSvgLengthAttr(attrs, 'height');
    if (width && height) return [0, 0, width, height];
    return null;
  }

  function estimateReportDiagramContentBounds(svgText) {
    let bounds = null;
    const rootAttrs = svgText.match(/<svg([^>]*)>/i)?.[1] || '';
    const canvasViewBox = resolveReportDiagramCanvasViewBox(rootAttrs);
    const openTagRe = /<(rect|ellipse|circle|polygon|polyline|line|path|text|image|use)\b([^>]*)(\/>|>)/gi;
    let match;
    while ((match = openTagRe.exec(svgText))) {
      const tag = match[1].toLowerCase();
      const attrs = match[2] || '';
      if (/data-report-bg=/i.test(attrs)) continue;

      if (tag === 'rect' || tag === 'image' || tag === 'use') {
        if (tag === 'rect' && isLikelyReportDiagramBackgroundRect(attrs, canvasViewBox)) continue;
        const x = Number(getSvgAttribute(attrs, 'x') || 0);
        const y = Number(getSvgAttribute(attrs, 'y') || 0);
        const w = Number(getSvgAttribute(attrs, 'width'));
        const h = Number(getSvgAttribute(attrs, 'height'));
        const sw = Number(getSvgAttribute(attrs, 'stroke-width') || 0);
        bounds = expandSvgBoundsByBox(bounds, x, y, w, h, Number.isFinite(sw) ? sw / 2 : 0);
        continue;
      }

      if (tag === 'circle') {
        const cx = Number(getSvgAttribute(attrs, 'cx'));
        const cy = Number(getSvgAttribute(attrs, 'cy'));
        const r = Number(getSvgAttribute(attrs, 'r'));
        if ([cx, cy, r].every(Number.isFinite) && r > 0) {
          bounds = expandSvgBoundsByBox(bounds, cx - r, cy - r, r * 2, r * 2);
        }
        continue;
      }

      if (tag === 'ellipse') {
        const cx = Number(getSvgAttribute(attrs, 'cx'));
        const cy = Number(getSvgAttribute(attrs, 'cy'));
        const rx = Number(getSvgAttribute(attrs, 'rx'));
        const ry = Number(getSvgAttribute(attrs, 'ry'));
        if ([cx, cy, rx, ry].every(Number.isFinite) && rx > 0 && ry > 0) {
          bounds = expandSvgBoundsByBox(bounds, cx - rx, cy - ry, rx * 2, ry * 2);
        }
        continue;
      }

      if (tag === 'line') {
        const x1 = Number(getSvgAttribute(attrs, 'x1'));
        const y1 = Number(getSvgAttribute(attrs, 'y1'));
        const x2 = Number(getSvgAttribute(attrs, 'x2'));
        const y2 = Number(getSvgAttribute(attrs, 'y2'));
        bounds = expandSvgBounds(bounds, x1, y1);
        bounds = expandSvgBounds(bounds, x2, y2);
        continue;
      }

      if (tag === 'polygon' || tag === 'polyline') {
        parseSvgPointsAttr(getSvgAttribute(attrs, 'points')).forEach(([x, y]) => {
          bounds = expandSvgBounds(bounds, x, y);
        });
        continue;
      }

      if (tag === 'path') {
        parseSvgPathPoints(getSvgAttribute(attrs, 'd')).forEach(([x, y]) => {
          bounds = expandSvgBounds(bounds, x, y);
        });
        continue;
      }

      if (tag === 'text') {
        const x = Number(getSvgAttribute(attrs, 'x'));
        const y = Number(getSvgAttribute(attrs, 'y'));
        const fontSize = Number(getSvgAttribute(attrs, 'font-size') || 12);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          const approxW = Math.max(24, fontSize * 6);
          const approxH = Math.max(12, fontSize * 1.4);
          bounds = expandSvgBoundsByBox(bounds, x - 2, y - approxH, approxW, approxH * 1.35);
        }
      }
    }
    return bounds;
  }

  function tightReportDiagramViewBox(svgText, paddingRatio = 0.02) {
    return svgText.replace(/<svg([^>]*)>/i, (match, attrs) => {
      const current = resolveReportDiagramCanvasViewBox(attrs);
      const content = estimateReportDiagramContentBounds(svgText);
      if (!content || !current) return match;

      let minX = content.minX;
      let minY = content.minY;
      let maxX = content.maxX;
      let maxY = content.maxY;
      let w = maxX - minX;
      let h = maxY - minY;
      if (!(w > 1 && h > 1)) return match;

      const [cx, cy, cw, ch] = current;
      const areaRatio = (w * h) / Math.max(1, cw * ch);
      const coversMostCanvas = areaRatio > 0.72;
      const roughlyMatches =
        Math.abs(minX - cx) < cw * 0.05 &&
        Math.abs(minY - cy) < ch * 0.05 &&
        Math.abs(w - cw) < cw * 0.1 &&
        Math.abs(h - ch) < ch * 0.1;

      // Dense diagrams that already fill the canvas keep the original frame.
      if (coversMostCanvas || roughlyMatches) return match;

      const padX = Math.max(8, w * paddingRatio);
      const padY = Math.max(8, h * paddingRatio);
      const nextViewBox = `${minX - padX} ${minY - padY} ${w + padX * 2} ${h + padY * 2}`;
      let nextAttrs = attrs;
      if (/\bviewBox="/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bviewBox="[^"]+"/i, `viewBox="${nextViewBox}"`);
      } else {
        nextAttrs += ` viewBox="${nextViewBox}"`;
      }
      return `<svg${nextAttrs}>`;
    });
  }

  function ensureReportDiagramWhiteBackground(svgText, viewBox) {
    if (!viewBox || /<rect[^>]*data-report-bg=/i.test(svgText)) return svgText;
    const [x, y, w, h] = viewBox;
    const bg = `<rect data-report-bg="1" x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="none"/>`;
    return svgText.replace(/<svg([^>]*)>/i, (match) => `${match}${bg}`);
  }

  function expandReportDiagramViewBox(svgText, paddingRatio = 0.012) {
    return svgText.replace(/<svg([^>]*)>/i, (match, attrs) => {
      const viewBox = parseSvgViewBox(attrs);
      if (!viewBox) return match;
      const [x, y, w, h] = viewBox;
      const padX = w * paddingRatio;
      const padY = h * paddingRatio;
      const nextViewBox = `${x - padX} ${y - padY} ${w + padX * 2} ${h + padY * 2}`;
      const nextAttrs = attrs.replace(/\bviewBox="[^"]+"/i, `viewBox="${nextViewBox}"`);
      return `<svg${nextAttrs}>`;
    });
  }

  function injectReportDiagramPresentationStyles(svgText) {
    const styleBlock =
      '<style type="text/css" data-report-presentation-style="1"><![CDATA[' +
      'svg{text-rendering:optimizeLegibility;shape-rendering:geometricPrecision;}' +
      `text,tspan{font-family:${REPORT_DIAGRAM_FONT_STACK};fill:${REPORT_DIAGRAM_TEXT_FILL};}` +
      ']]></style>';
    if (/data-report-presentation-style=/i.test(svgText)) return svgText;
    return svgText.replace(/<svg([^>]*)>/i, (match) => `${match}${styleBlock}`);
  }

  function enhanceReportDiagramProfessionalPresentation(svgText) {
    let next = enhanceReportDiagramConnectorVisibility(svgText);
    next = next.replace(/<(rect|ellipse|circle|polygon|path)\b([^>]*?)(\/>|>)/gi, (match, tag, attrs, close) => {
      if (!isReportDiagramFilledShape(tag.toLowerCase(), attrs)) return match;
      return `<${tag}${boostReportDiagramShapeAttrs(attrs)}${close}`;
    });
    next = next.replace(/<(text|tspan)\b([^>]*?)(\/>|>)/gi, (match, tag, attrs, close) => {
      return `<${tag}${boostReportDiagramTextAttrs(attrs)}${close}`;
    });
    // Crop unused draw.io canvas margins so diagrams fill the printable page width.
    next = tightReportDiagramViewBox(next);
    next = expandReportDiagramViewBox(next);
    const viewBox = parseSvgViewBox(next.match(/<svg([^>]*)>/i)?.[1] || '');
    next = ensureReportDiagramWhiteBackground(next, viewBox);
    return injectReportDiagramPresentationStyles(next);
  }

  function readSvgLengthAttr(attrs, name) {
    const match = attrs.match(new RegExp(`\\b${name}="([^"]+)"`, 'i'));
    if (!match) return null;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  function extractReportDiagramSvgMarkup(src) {
    if (!src || typeof src !== 'string') return '';
    let text = src.trim();
    if (!text) return '';

    if (text.startsWith('data:image/svg+xml')) {
      try {
        text = decodeReportDiagramSvgPayload(text);
      } catch {
        return '';
      }
    }

    if (text.startsWith('<?xml')) {
      text = text.replace(/^[\s\S]*?(<svg[\s\S]*)$/i, '$1');
    }

    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) return svgMatch[0];
    if (/^<svg[\s>]/i.test(text)) return text;
    return '';
  }

  function truncateReportLabel(text, maxLen = 34) {
    const value = String(text || '').trim().replace(/\s+/g, ' ');
    if (!value) return '';
    if (value.length <= maxLen) return value;
    return `${value.slice(0, Math.max(1, maxLen - 1)).trim()}…`;
  }

  function getMatrixQuadrantMeta(effort, impact) {
    const e = Number(effort) || 3;
    const i = Number(impact) || 3;
    if (e < 3 && i >= 3) return { key: 'quickWin', label: 'Quick Wins', color: '#059669', bg: '#ecfdf5' };
    if (e >= 3 && i >= 3) return { key: 'majorProject', label: 'Major Projects', color: '#2563eb', bg: '#eff6ff' };
    if (e >= 3) return { key: 'moneyPit', label: 'Low ROI — defer', color: '#dc2626', bg: '#fff1f2' };
    return { key: 'fillIn', label: 'Fill-ins', color: '#64748b', bg: '#f8fafc' };
  }

  function ensureReportDiagramDataUri(src) {
    if (!src || typeof src !== 'string') return '';
    const trimmed = src.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:image/svg+xml')) return trimmed;
    const svgMarkup = extractReportDiagramSvgMarkup(trimmed);
    if (svgMarkup) {
      return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
    }
    return trimmed;
  }

  function finalizeReportDiagramSvgRoot(svgText) {
    return svgText.replace(/<svg([^>]*)>/i, (match, attrs) => {
      let next = attrs
        .replace(/\swidth="[^"]*"/gi, '')
        .replace(/\sheight="[^"]*"/gi, '')
        .replace(/\spreserveAspectRatio="[^"]*"/gi, '');

      let viewBox = parseSvgViewBox(next);
      if (!viewBox) {
        const width = readSvgLengthAttr(attrs, 'width');
        const height = readSvgLengthAttr(attrs, 'height');
        if (width && height) {
          viewBox = [0, 0, width, height];
          next += ` viewBox="0 0 ${width} ${height}"`;
        }
      }

      if (viewBox) {
        const width = Math.max(1, Math.round(viewBox[2]));
        const height = Math.max(1, Math.round(viewBox[3]));
        next += ` width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"`;
      } else {
        next += ' preserveAspectRatio="xMidYMid meet"';
      }
      return `<svg${next}>`;
    });
  }

  function decodeReportDiagramSvgPayload(uri) {
    const commaIdx = uri.indexOf(',');
    if (commaIdx < 0) return '';
    const meta = uri.slice(0, commaIdx);
    const payload = uri.slice(commaIdx + 1);
    if (/;base64/i.test(meta)) {
      if (typeof atob === 'function') return atob(payload);
      if (typeof Buffer !== 'undefined') return Buffer.from(payload, 'base64').toString('utf8');
      return payload;
    }
    return decodeURIComponent(payload);
  }

  function decodeReportDiagramSvgMarkup(src) {
    const extracted = extractReportDiagramSvgMarkup(src);
    if (!extracted) return '';
    const uri = normalizeReportDiagramSvg(ensureReportDiagramDataUri(extracted));
    if (!uri || !uri.startsWith('data:image/svg+xml')) return extracted;
    try {
      const text = decodeReportDiagramSvgPayload(uri);
      return text && /<svg[\s>]/i.test(text) ? text : extracted;
    } catch {
      return extracted;
    }
  }

  function normalizeReportDiagramSvg(svgDataUri) {
    const prepared = ensureReportDiagramDataUri(svgDataUri);
    if (!prepared || !prepared.startsWith('data:image/svg+xml')) return prepared || svgDataUri || '';

    try {
      const commaIdx = prepared.indexOf(',');
      if (commaIdx < 0) return prepared;
      const meta = prepared.slice(0, commaIdx);
      const payload = prepared.slice(commaIdx + 1);
      const isBase64 = /;base64/i.test(meta);
      const decodePayload = () => decodeReportDiagramSvgPayload(prepared);
      const encodePayload = (text) => {
        if (isBase64) {
          if (typeof btoa === 'function') return btoa(text);
          if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
          return text;
        }
        return encodeURIComponent(text);
      };

      let svgText = decodePayload();
      svgText = enhanceReportDiagramProfessionalPresentation(svgText);
      svgText = finalizeReportDiagramSvgRoot(svgText);

      const encodedPrefix = isBase64 ? ';base64,' : ',';
      return `${meta}${encodedPrefix}${encodePayload(svgText)}`;
    } catch {
      return prepared;
    }
  }

  function parseTargetWeekRange(targetWeek) {
    const s = String(targetWeek || '').trim();
    if (!s) return null;
    const range = s.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (range) {
      const startWeek = Number(range[1]);
      const endWeek = Number(range[2]);
      if (startWeek > 0 && endWeek >= startWeek) return { startWeek, endWeek };
    }
    const single = s.match(/(?:week|wk)\s*(\d+)/i) || s.match(/^(\d+)$/);
    if (single) {
      const w = Number(single[1]);
      if (w > 0) return { startWeek: w, endWeek: w };
    }
    return null;
  }

  function buildRecoveryPlanGantt(matrixItems, options) {
    const opts = options || {};
    const items = Array.isArray(matrixItems) ? matrixItems : [];
    const top5List = getTop5Fixes(items);
    const top5Ids = new Set(top5List.map((i) => i.id));
    const source = opts.onlyTop5 ? top5List : items;
    const rows = [];

    source.forEach((item, idx) => {
      const range = parseTargetWeekRange(item.targetWeek);
      if (!range) return;
      rows.push({
        id: item.id,
        label: item.text || '',
        owner: String(item.owner || '').trim(),
        targetWeek: item.targetWeek,
        startWeek: range.startWeek,
        endWeek: range.endWeek,
        rank: opts.onlyTop5 ? idx + 1 : items.findIndex((i) => i.id === item.id) + 1,
        isTop5: top5Ids.has(item.id),
      });
    });

    rows.sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek || a.rank - b.rank);
    const maxWeek = Math.max(12, ...rows.map((r) => r.endWeek), 4);
    const unscheduledCount = items.filter((i) => !parseTargetWeekRange(i.targetWeek)).length;

    return { rows, maxWeek, top5Ids: [...top5Ids], unscheduledCount };
  }

  const PRINT_PRESETS = {
    full: {
      showExecutiveSummary: true,
      showExecutiveLetter: true,
      showFixOrder: true,
      showLeakageRanking: true,
      showOrgChart: true,
      showFlowcharts: true,
      flowchartsTopOnly: false,
      showRaci: true,
      showSaas: true,
      showSynthesis: true,
      showMatrix: true,
      showFindings: true,
      showNextSteps: true,
      showAppendix: true,
      showFeedbackAppendix: true,
    },
    briefing: {
      showExecutiveSummary: true,
      showExecutiveLetter: true,
      showFixOrder: true,
      showLeakageRanking: true,
      showOrgChart: false,
      showFlowcharts: true,
      flowchartsTopOnly: true,
      showRaci: false,
      showSaas: true,
      showSynthesis: true,
      showMatrix: true,
      showFindings: true,
      showNextSteps: true,
      showAppendix: false,
      showFeedbackAppendix: false,
    },
  };

  const DiagnosisReportHelpers = {
    QUADRANT,
    TARGET_WEEK_OPTIONS,
    MATURITY_INDEX_EXPLAINER,
    REPORT_METHODOLOGY_DISCLAIMER,
    MATURITY_RUBRIC,
    getQuadrant,
    stepMonthlyLoss,
    computeCoiForecast,
    buildCoiBreakdown,
    previewMatrixGeneration,
    buildOwnerSuggestions,
    buildInsightMatrixItem,
    buildNextPhaseHint,
    computeMaturityIndex,
    buildMaturityScorecardRows,
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
    M102_FEEDBACK_FORM_TEMPLATE,
    getM102FeedbackFormTemplate,
    extractGoogleFormId,
    buildFeedbackFormViewUrl,
    normalizeStaffDirectoryRows,
    normalizeReportDiagramSvg,
    ensureReportDiagramDataUri,
    extractReportDiagramSvgMarkup,
    decodeReportDiagramSvgMarkup,
    estimateReportDiagramContentBounds,
    tightReportDiagramViewBox,
    truncateReportLabel,
    parseTargetWeekRange,
    buildRecoveryPlanGantt,
    getMatrixQuadrantMeta,
    enhanceReportDiagramConnectorVisibility,
    enhanceReportDiagramProfessionalPresentation,
    buildLinkQrUrl,
    buildFeedbackFormQrUrl,
    isMod1TaskInScope,
    buildMod1DeliverableStatus,
    buildDefaultExecutiveLetter,
    getBriefingWorkflowTabs,
    PRINT_PRESETS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiagnosisReportHelpers;
  }
  global.DiagnosisReportHelpers = DiagnosisReportHelpers;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
