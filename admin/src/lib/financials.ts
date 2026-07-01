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
  id?: string;
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
  milestoneSplit?: 'auto' | '50-50' | '30-40-30' | 'custom' | string;
  customSplit1?: number;
  customSplit2?: number;
  customSplit3?: number;
}

export interface BillingMilestone {
  label: string;
  amount: number;
  desc: string;
}

export interface BillingSchedule {
  milestones: BillingMilestone[];
  milestoneSplit: string;
  finalProjectCostPart: number;
  retainerMonthly: number;
  retainerMonths: number;
  retainerTotal: number;
  includeTax: boolean;
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

export function computeBillingMilestones(ctx: {
  finalProjectCostPart: number;
  milestoneSplit?: string;
  customSplit1?: number;
  customSplit2?: number;
  customSplit3?: number;
  applyCreditBack?: boolean;
  isCreditBackEligible?: boolean;
  getModNet: (modNum: number) => number;
  includeTax?: boolean;
}): BillingMilestone[] {
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
    const arr: BillingMilestone[] = [];
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
  const arr: BillingMilestone[] = [];
  if (m1 > 0) arr.push({ label: `1. Milestone 1 (${m1}%)`, amount: Math.round(finalProjectCostPart * (m1 / 100)), desc: 'Custom structured payment part 1.' });
  if (m2 > 0) arr.push({ label: `2. Milestone 2 (${m2}%)`, amount: Math.round(finalProjectCostPart * (m2 / 100)), desc: 'Custom structured payment part 2.' });
  if (m3 > 0) arr.push({ label: `3. Milestone 3 (${m3}%)`, amount: Math.round(finalProjectCostPart * (m3 / 100)), desc: 'Custom structured payment part 3.' });
  return arr;
}

export function getBillingSchedule(profile: Profile | null | undefined): BillingSchedule {
  const empty: BillingSchedule = {
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

  const getModNet = (modNum: number) =>
    Math.round(
      profile.tasks!
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

export function milestoneSplitLabel(split: string): string {
  switch (split) {
    case 'auto': return 'Stage-Gated (Auto)';
    case '50-50': return '50 / 50 Split';
    case '30-40-30': return '30 / 40 / 30 Split';
    case 'custom': return 'Custom Split';
    default: return split;
  }
}
