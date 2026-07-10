/** Shared SOW financial pipeline — used by project_planner and contract_ledger */

export const MOD_DISPLAY_NAMES = {
  1: 'Business Leak Scan',
  2: 'How Your Business Runs',
  3: 'Your Team Workspace',
  4: 'Care Plan',
};

export function getModDisplayName(modNum) {
  if (typeof globalThis !== 'undefined' && globalThis.ProductConfig?.getModTitle) {
    return globalThis.ProductConfig.getModTitle(modNum);
  }
  return MOD_DISPLAY_NAMES[modNum] || `Module ${modNum}`;
}

export function isModCategory(category, modNum) {
  return typeof category === 'string' && category.startsWith(`MOD ${modNum}`);
}

export function isProCategory(category) {
  return typeof category === 'string' && category.startsWith('PRO ');
}

export function getProDisplayLabel(category) {
  const PC = typeof globalThis !== 'undefined' ? globalThis.ProductCatalog : null;
  if (PC?.getProductByCategory) {
    const p = PC.getProductByCategory(category);
    if (p) return p.skuLabel || `${p.key} · ${p.shortTitle}`;
  }
  if (typeof category === 'string') return category.replace(' - ', ' · ');
  return 'PRO · Platform';
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
    total: 0, subtotal: 0, tax: 0, discountPercent: 0,
    includeTax: false, subscriptionMonths: 6,
  };
  if (!profile || !profile.tasks) return empty;

  const tasks = profile.tasks.filter((t) => t.selected);
  const frictionBuffer = profile.frictionBuffer || 0;
  const discountPercent = profile.discountPercent || 0;
  const includeTax = profile.includeTax || false;
  const subscriptionMonths = profile.subscriptionMonths !== undefined ? profile.subscriptionMonths : 6;
  const bufferMultiplier = 1 + frictionBuffer / 100;

  const rateFor = (tier) => getProfileRate(profile, tier);
  const projectCostBaseUndiscounted = Math.round(
    tasks.filter((t) => !t.isMonthlyRetainer).reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier
  );
  const retainerCostBaseUndiscounted = Math.round(
    tasks.filter((t) => t.isMonthlyRetainer).reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0)
  );

  const projectCostBase = Math.round(projectCostBaseUndiscounted * (1 - discountPercent / 100));
  const finalProjectCostBase = projectCostBase;
  const retainerCostBase = Math.round(retainerCostBaseUndiscounted * (1 - discountPercent / 100));
  const retainerCostTotalBaseUndiscounted = Math.round(retainerCostBaseUndiscounted * subscriptionMonths);
  const retainerCostTotalBase = Math.round(retainerCostBase * subscriptionMonths);

  const subtotal = finalProjectCostBase + retainerCostTotalBase;
  const tax = includeTax ? Math.round(subtotal * 0.12) : 0;

  return {
    total: subtotal + tax,
    subtotal,
    tax,
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
        desc: 'Authorized immediately at initial signup. Deliverable yields a Leak Scan Report and prioritized fix list from your leak scan.',
      });
    }
    if (m2Net > 0) {
      arr.push({
        label: 'Gate 2: Module 2 Commitment — How Your Business Runs',
        amount: Math.round(m2Net * taxMultiplier),
        desc: 'Billed only upon completion of Phase 1 and client authorization to proceed. Unlocks order playbooks, roles charts, and employee handbook.',
      });
    }
    if (m3Net > 0) {
      arr.push({
        label: 'Gate 3: Module 3 Commitment — Your Team Workspace',
        amount: Math.round(m3Net * taxMultiplier),
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

  const tasks = profile.tasks;
  const frictionBuffer = profile.frictionBuffer || 0;
  const discountPercent = profile.discountPercent || 0;
  const bufferMultiplier = 1 + frictionBuffer / 100;
  const discFactor = 1 - discountPercent / 100;
  const rateFor = (tier) => getProfileRate(profile, tier || 'associate');

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
    summaries.push({ modNum: '4a', label: `${getModDisplayName(4)} — System Health Check`, count: mod4AuditTasks.length, baseUndiscounted: auditBase, afterDiscount: auditBase, isAnnual: true });
  }

  const proSetupTasks = tasks.filter((t) => t.selected && isProCategory(t.category) && !t.isMonthlyRetainer);
  const proRetainerTasks = tasks.filter((t) => t.selected && isProCategory(t.category) && t.isMonthlyRetainer);
  const proLabel = getProDisplayLabel(proSetupTasks[0]?.category || proRetainerTasks[0]?.category);
  if (proSetupTasks.length > 0) {
    const baseUndiscounted = Math.round(
      proSetupTasks.reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * bufferMultiplier
    );
    summaries.push({
      modNum: 'pro1',
      label: proLabel,
      count: proSetupTasks.length,
      baseUndiscounted,
      afterDiscount: Math.round(baseUndiscounted * discFactor),
    });
  }
  if (proRetainerTasks.length > 0) {
    const monthlyBase = Math.round(
      proRetainerTasks.reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier), 0) * discFactor
    );
    summaries.push({
      modNum: 'pro1-sub',
      label: `${proLabel} — Subscription`,
      count: proRetainerTasks.length,
      baseUndiscounted: monthlyBase,
      afterDiscount: monthlyBase,
      isMonthly: true,
    });
  }

  return summaries;
}

export const DEFAULT_TASK_CATALOG = [
  { id: 't1', category: 'MOD 1 - Business Leak Scan', name: 'Daily Work Friction Study', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't2', category: 'MOD 2 - How Your Business Runs', name: 'Customer Order Playbook', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't3', category: 'MOD 3 - Your Team Workspace', name: 'Workspace Setup & Branding', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't4', category: 'MOD 4 - Care Plan', name: 'Platform Hosting & User Care', estHours: 4, tier: 'partner', selected: false, isMonthlyRetainer: true },
];
