/** SOW financial pipeline — shared with project planner and contract ledger */

export const RATE_TIERS: Record<string, number> = {
  principal: 3500,
  senior: 2500,
  partner: 2000,
  associate: 1500,
};

export function getRate(tier: string) {
  return RATE_TIERS[tier] ?? RATE_TIERS.associate;
}

export function getProfileRate(profile: Profile | null | undefined, tier: string) {
  const customRates: Record<string, number | undefined> = {
    principal: profile?.principalRate,
    senior: profile?.seniorRate,
    partner: profile?.partnerRate,
    associate: profile?.associateRate,
  };
  const custom = customRates[tier];
  if (custom != null && custom > 0) return custom;
  return getRate(tier);
}

export function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val);
}

interface Task {
  selected?: boolean;
  estHours?: number;
  tier?: string;
  isMonthlyRetainer?: boolean;
  category?: string;
}

interface Profile {
  tasks?: Task[];
  frictionBuffer?: number;
  discountPercent?: number;
  includeTax?: boolean;
  applyCreditBack?: boolean;
  subscriptionMonths?: number;
  principalRate?: number;
  seniorRate?: number;
  partnerRate?: number;
  associateRate?: number;
}

export function getFinancials(profile: Profile | null | undefined) {
  const empty = {
    total: 0, subtotal: 0, appliedCredit: 0, tax: 0, discountPercent: 0,
    includeTax: false, subscriptionMonths: 6, standardSubtotal: 0, discountAmount: 0,
    creditBackAmount: 0, isCreditBackEligible: false, finalProjectCostBase: 0, retainerCostTotalBase: 0,
  };
  if (!profile?.tasks) return empty;

  const tasks = profile.tasks.filter((t) => t.selected);
  const frictionBuffer = profile.frictionBuffer || 0;
  const discountPercent = profile.discountPercent || 0;
  const includeTax = profile.includeTax || false;
  const applyCreditBack = profile.applyCreditBack || false;
  const subscriptionMonths = profile.subscriptionMonths ?? 6;
  const bufferMultiplier = 1 + frictionBuffer / 100;

  const rateFor = (tier: string) => getProfileRate(profile, tier);
  const projectCostBaseUndiscounted = Math.round(
    tasks.filter((t) => !t.isMonthlyRetainer).reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier || 'associate'), 0) * bufferMultiplier
  );
  const retainerCostBaseUndiscounted = Math.round(
    tasks.filter((t) => t.isMonthlyRetainer).reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier || 'associate'), 0)
  );
  const mod1CostBase = Math.round(
    tasks.filter((t) => t.selected && t.category?.startsWith('MOD 1') && t.id !== 'm1-06').reduce((acc, t) => acc + (t.estHours || 0) * rateFor(t.tier || 'associate'), 0) * bufferMultiplier
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
