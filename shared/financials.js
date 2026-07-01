/** Shared SOW financial pipeline — used by project_planner and contract_ledger */

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

export const DEFAULT_TASK_CATALOG = [
  { id: 't1', category: 'MOD 1 - Business Leak Scan', name: 'Daily Work Friction Study', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't2', category: 'MOD 2 - How Your Business Runs', name: 'Customer Order Playbook', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't3', category: 'MOD 3 - Your Team Workspace', name: 'Workspace Setup & Branding', estHours: 6, tier: 'senior', selected: false, isMonthlyRetainer: false },
  { id: 't4', category: 'MOD 4 - Care Plan', name: 'Platform Hosting & User Care', estHours: 4, tier: 'partner', selected: false, isMonthlyRetainer: true },
];
