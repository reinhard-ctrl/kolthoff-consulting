/** Shared SOW financial pipeline — used by project_planner and contract_ledger */

export const MOD_DISPLAY_NAMES = {
  1: 'Business Leak Scan',
  2: 'How Your Business Runs',
  3: 'Your Team Workspace',
  4: 'Care Plan',
};

export function getModDisplayName(modNum) {
  return MOD_DISPLAY_NAMES[modNum] || `Module ${modNum}`;
}

export function isModCategory(category, modNum) {
  return typeof category === 'string' && category.startsWith(`MOD ${modNum}`);
}

export const RATE_TIERS = {
  principal: 3500,
  senior: 2500,
  partner: 2000,
  associate: 1500,
};

export function getRate(tier) {
  return RATE_TIERS[tier] ?? RATE_TIERS.associate;
}

export function getProfileRate(profile, tier) {
  const customRates = {
    principal: profile?.principalRate,
    senior: profile?.seniorRate,
    partner: profile?.partnerRate,
    associate: profile?.associateRate,
  };
  const custom = customRates[tier];
  if (custom != null && custom > 0) return custom;
  return getRate(tier);
}

export function formatCurrency(val) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val);
}

export function getFinancials(profile) {
  const empty = {
    total: 0, subtotal: 0, appliedCredit: 0, tax: 0, discountPercent: 0,
    includeTax: false, subscriptionMonths: 6,
  };
  if (!profile || !profile.tasks) return empty;

  const tasks = profile.tasks.filter((t) => t.selected);
  const frictionBuffer = profile.frictionBuffer || 0;
  const discountPercent = profile.discountPercent || 0;
  const includeTax = profile.includeTax || false;
  const applyCreditBack = profile.applyCreditBack || false;
  const subscriptionMonths = profile.subscriptionMonths !== undefined ? profile.subscriptionMonths : 6;
  const bufferMultiplier = 1 + frictionBuffer / 100;

  const rateFor = (tier) => getProfileRate(profile, tier);
  const projectCostBaseUndiscounted = Math.round(
    tasks.filter((t) => !t.isMonthlyRetainer).reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier
  );
  const retainerCostBaseUndiscounted = Math.round(
    tasks.filter((t) => t.isMonthlyRetainer).reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0)
  );
  const mod1CostBase = Math.round(
    tasks.filter((t) => t.selected && t.category?.startsWith('MOD 1') && t.id !== 'm1-06').reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier
  );

  const activeDiag = tasks.some((t) => t.selected && t.category?.startsWith('MOD 1'));
  const activeSOP = tasks.some((t) => t.selected && t.category?.startsWith('MOD 2'));
  const activePMO = tasks.some((t) => t.selected && t.category?.startsWith('MOD 3'));
  const isCreditBackEligible = activeDiag && (activeSOP || activePMO);

  const creditBackAmount = isCreditBackEligible ? Math.round(mod1CostBase * (1 - discountPercent / 100)) : 0;
  const appliedCreditBackAmount = applyCreditBack && isCreditBackEligible ? creditBackAmount : 0;

  const projectCostBase = Math.round(projectCostBaseUndiscounted * (1 - discountPercent / 100));
  const finalProjectCostBase = Math.max(0, projectCostBase - appliedCreditBackAmount);
  const retainerCostBase = Math.round(retainerCostBaseUndiscounted * (1 - discountPercent / 100));
  const retainerCostTotalBaseUndiscounted = Math.round(retainerCostBaseUndiscounted * subscriptionMonths);
  const retainerCostTotalBase = Math.round(retainerCostBase * subscriptionMonths);

  const subtotal = finalProjectCostBase + retainerCostTotalBase;
  const tax = includeTax ? Math.round(subtotal * 0.12) : 0;

  return {
    total: subtotal + tax,
    subtotal,
    tax,
    appliedCredit: appliedCreditBackAmount,
    creditBackAmount,
    isCreditBackEligible,
    discountPercent,
    includeTax,
    subscriptionMonths,
    projectCostBaseUndiscounted,
    retainerCostTotalBaseUndiscounted,
    standardSubtotal: projectCostBaseUndiscounted + retainerCostTotalBaseUndiscounted,
    discountAmount: (projectCostBaseUndiscounted + retainerCostTotalBaseUndiscounted) - (projectCostBase + retainerCostTotalBase),
    finalProjectCostBase,
    retainerCostTotalBase,
  };
}

export function computeBillingMilestones(ctx) {
  const {
    finalProjectCostPart,
    milestoneSplit = 'auto',
    customSplit1 = 0,
    customSplit2 = 0,
    customSplit3 = 0,
    applyCreditBack = false,
    isCreditBackEligible = false,
    getModNet,
    includeTax = false,
  } = ctx;

  if (finalProjectCostPart <= 0) return [];

  const taxMultiplier = includeTax ? 1.12 : 1.0;
  const m1Net = getModNet(1);
  const m2Net = getModNet(2);
  const m3Net = getModNet(3);

  if (milestoneSplit === 'auto') {
    const arr = [];
    if (m1Net > 0) {
      arr.push({
        label: 'Gate 1: Module 1 Commitment — Business Leak Scan',
        amount: Math.round(m1Net * taxMultiplier),
        desc: 'Authorized immediately at initial signup. Deliverable yields a waste-to-peso report and prioritized fix list from your leak scan.',
      });
    }
    if (m2Net > 0) {
      let m2Billed = m2Net;
      let creditNotice = '';
      if (applyCreditBack && isCreditBackEligible && m1Net > 0) {
        m2Billed = Math.max(0, m2Net - m1Net);
        creditNotice = ` (Pre-applied Module 1 Credit-Back savings: -${formatCurrency(Math.round(m1Net * taxMultiplier))})`;
      }
      arr.push({
        label: `Gate 2: Module 2 Commitment — How Your Business Runs${creditNotice}`,
        amount: Math.round(m2Billed * taxMultiplier),
        desc: 'Billed only upon completion of Phase 1 and client authorization to proceed. Unlocks order playbooks, roles charts, and employee handbook.',
      });
    }
    if (m3Net > 0) {
      let m3Billed = m3Net;
      let creditNotice = '';
      if (applyCreditBack && isCreditBackEligible && m1Net > 0 && m2Net === 0) {
        m3Billed = Math.max(0, m3Net - m1Net);
        creditNotice = ` (Pre-applied Module 1 Credit-Back savings: -${formatCurrency(Math.round(m1Net * taxMultiplier))})`;
      } else if (applyCreditBack && isCreditBackEligible && m1Net > m2Net && m2Net > 0) {
        const leftoverCredit = m1Net - m2Net;
        m3Billed = Math.max(0, m3Net - leftoverCredit);
        creditNotice = ` (Pre-applied remaining Module 1 Credit balance: -${formatCurrency(Math.round(leftoverCredit * taxMultiplier))})`;
      }
      arr.push({
        label: `Gate 3: Module 3 Commitment — Your Team Workspace${creditNotice}`,
        amount: Math.round(m3Billed * taxMultiplier),
        desc: 'Billed only upon completion of Phase 2 and client authorization to proceed. Unlocks workspace go-live, digital forms, training, and launch help desk.',
      });
    }
    return arr;
  }

  if (milestoneSplit === '50-50') {
    return [
      { label: '1. Project Kickoff & Workspace Access Setup (50%)', amount: Math.round(finalProjectCostPart * 0.5), desc: 'Invoice issued when SOW is approved and setup begins.' },
      { label: '2. Final Handover & Team Walkthrough Completion (50%)', amount: Math.round(finalProjectCostPart * 0.5), desc: 'Invoice issued upon completion and launch of all agreed tasks.' },
    ];
  }

  if (milestoneSplit === '30-40-30') {
    return [
      { label: '1. Project Launch & Discovery Stage (30%)', amount: Math.round(finalProjectCostPart * 0.3), desc: 'Invoice issued upon signing and launching setup.' },
      { label: '2. Process Writing & Playbook Drafting (40%)', amount: Math.round(finalProjectCostPart * 0.4), desc: 'Invoice issued when draft playbooks and flows are ready.' },
      { label: '3. Workspace Tool Launch & Team Training (30%)', amount: Math.round(finalProjectCostPart * 0.3), desc: 'Invoice issued upon completion of custom tools and team training.' },
    ];
  }

  const m1 = Number(customSplit1) || 0;
  const m2 = Number(customSplit2) || 0;
  const m3 = Number(customSplit3) || 0;
  const arr = [];
  if (m1 > 0) arr.push({ label: `1. Milestone 1 (${m1}%)`, amount: Math.round(finalProjectCostPart * (m1 / 100)), desc: 'Custom structured payment part 1.' });
  if (m2 > 0) arr.push({ label: `2. Milestone 2 (${m2}%)`, amount: Math.round(finalProjectCostPart * (m2 / 100)), desc: 'Custom structured payment part 2.' });
  if (m3 > 0) arr.push({ label: `3. Milestone 3 (${m3}%)`, amount: Math.round(finalProjectCostPart * (m3 / 100)), desc: 'Custom structured payment part 3.' });
  return arr;
}

export function getBillingSchedule(profile) {
  const empty = {
    milestones: [],
    milestoneSplit: 'auto',
    finalProjectCostPart: 0,
    retainerMonthly: 0,
    retainerMonths: 6,
    retainerTotal: 0,
    includeTax: false,
  };
  if (!profile?.tasks) return empty;

  const fin = getFinancials(profile);
  const includeTax = profile.includeTax || false;
  const taxMultiplier = includeTax ? 1.12 : 1.0;
  const discFactor = 1 - (profile.discountPercent || 0) / 100;
  const bufferMultiplier = 1 + (profile.frictionBuffer || 0) / 100;
  const milestoneSplit = profile.milestoneSplit || 'auto';

  const getModNet = (modNum) =>
    Math.round(
      profile.tasks
        .filter((t) => t.selected && !t.isMonthlyRetainer && t.category?.startsWith(`MOD ${modNum}`))
        .reduce((acc, t) => acc + (t.estHours || 0) * getProfileRate(profile, t.tier || 'associate'), 0)
        * bufferMultiplier * discFactor
    );

  const finalProjectCostPart = Math.round(fin.finalProjectCostBase * taxMultiplier);
  const months = fin.subscriptionMonths || 6;
  const retainerCostBase = fin.retainerCostTotalBase > 0 ? fin.retainerCostTotalBase / months : 0;
  const retainerMonthly = Math.round(retainerCostBase * taxMultiplier);

  return {
    milestones: computeBillingMilestones({
      finalProjectCostPart,
      milestoneSplit,
      customSplit1: profile.customSplit1,
      customSplit2: profile.customSplit2,
      customSplit3: profile.customSplit3,
      applyCreditBack: profile.applyCreditBack,
      isCreditBackEligible: fin.isCreditBackEligible,
      getModNet,
      includeTax,
    }),
    milestoneSplit,
    finalProjectCostPart,
    retainerMonthly,
    retainerMonths: fin.subscriptionMonths,
    retainerTotal: Math.round(fin.retainerCostTotalBase * taxMultiplier),
    includeTax,
  };
}

export function computeModuleInvestmentSummaries(profile) {
  if (!profile?.tasks) return [];

  const fin = getFinancials(profile);
  const tasks = profile.tasks;
  const frictionBuffer = profile.frictionBuffer || 0;
  const discountPercent = profile.discountPercent || 0;
  const applyCreditBack = profile.applyCreditBack || false;
  const bufferMultiplier = 1 + frictionBuffer / 100;
  const discFactor = 1 - discountPercent / 100;
  const rateFor = (tier) => getProfileRate(profile, tier || 'associate');

  const mod1CostBase = Math.round(
    tasks.filter((t) => t.selected && isModCategory(t.category, 1) && t.id !== 'm1-06')
      .reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier
  );

  const summaries = [];
  [1, 2, 3].forEach((modNum) => {
    const modTasks = tasks.filter((t) => t.selected && !t.isMonthlyRetainer && isModCategory(t.category, modNum));
    if (modTasks.length === 0) return;
    const baseUndiscounted = Math.round(
      modTasks.reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier
    );
    summaries.push({
      modNum,
      label: getModDisplayName(modNum),
      count: modTasks.length,
      baseUndiscounted,
      afterDiscount: Math.round(baseUndiscounted * discFactor),
    });
  });

  const mod4RetainerTasks = tasks.filter((t) => t.selected && t.isMonthlyRetainer && isModCategory(t.category, 4));
  const mod4AuditTasks = tasks.filter((t) => t.selected && !t.isMonthlyRetainer && isModCategory(t.category, 4));
  if (mod4RetainerTasks.length > 0) {
    const monthlyBase = Math.round(
      mod4RetainerTasks.reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * discFactor
    );
    summaries.push({ modNum: 4, label: getModDisplayName(4), count: mod4RetainerTasks.length, baseUndiscounted: monthlyBase, afterDiscount: monthlyBase, isMonthly: true });
  }
  if (mod4AuditTasks.length > 0) {
    const auditBase = Math.round(
      mod4AuditTasks.reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier * discFactor
    );
    summaries.push({ modNum: '4a', label: `${getModDisplayName(4)} — System Health Check (annual)`, count: mod4AuditTasks.length, baseUndiscounted: auditBase, afterDiscount: auditBase, isAnnual: true });
  }

  if (applyCreditBack && fin.isCreditBackEligible && mod1CostBase > 0) {
    let remainingCredit = Math.round(mod1CostBase * discFactor);
    const m1 = summaries.find((s) => s.modNum === 1);
    if (m1) m1.afterCredit = 0;
    const m2 = summaries.find((s) => s.modNum === 2);
    if (m2 && remainingCredit > 0) {
      const applied = Math.min(remainingCredit, m2.afterDiscount);
      m2.afterCredit = m2.afterDiscount - applied;
      remainingCredit -= applied;
    }
    const m3 = summaries.find((s) => s.modNum === 3);
    if (m3 && remainingCredit > 0) {
      const applied = Math.min(remainingCredit, m3.afterDiscount);
      m3.afterCredit = m3.afterDiscount - applied;
    }
  }

  return summaries;
}

export const DEFAULT_TASK_CATALOG = [
  { id: 't1', category: 'MOD 1 - Business Leak Scan', name: 'Daily Work Friction Study', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't2', category: 'MOD 2 - How Your Business Runs', name: 'Customer Order Playbook', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't3', category: 'MOD 3 - Your Team Workspace', name: 'Workspace Setup & Branding', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't4', category: 'MOD 4 - Care Plan', name: 'Platform Hosting & User Care', estHours: 4, tier: 'partner', selected: false, isMonthlyRetainer: true },
];
