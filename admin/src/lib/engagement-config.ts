/** Canonical engagement content (MOD 1–4) — mirror of shared/engagement-config.js */

export const SCHEMA_VERSION = 2;

export interface EngagementModule {
  id: string;
  key: string;
  category: string;
  title: string;
  shortTitle: string;
  phase: string;
  portalPhase: string;
}

export interface ChaosTaxSlice {
  source: 'planner' | 'diagnosis' | string;
  value: number;
  inputs?: Record<string, unknown>;
}

export interface ProfileLinks {
  crmDealId: string | null;
  portalClientId: string | null;
  contractId: string | null;
}

export interface WorkbookProfileMeta {
  schemaVersion: number;
  updatedAt: number;
  totalHours?: number;
  validatedAt?: number;
}

const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  'MOD 1 - Workflow Diagnosis': 'mod1',
  'MOD 2 - Organizing How You Work': 'mod2',
  'MOD 3 - Workspace Automation': 'mod3',
  'MOD 4 - Ongoing Support': 'mod4',
};

export const MODULES: EngagementModule[] = [
  {
    id: 'mod1',
    key: 'MOD 1',
    category: 'MOD 1 - Business Leak Scan',
    title: 'Business Leak Scan',
    shortTitle: 'Leak Scan',
    phase: 'Phase 1: Diagnosis & Alignment',
    portalPhase: 'MOD 1: Business Leak Scan',
  },
  {
    id: 'mod2',
    key: 'MOD 2',
    category: 'MOD 2 - How Your Business Runs',
    title: 'How Your Business Runs',
    shortTitle: 'Process Architecture',
    phase: 'Phase 2: Process Architecture',
    portalPhase: 'MOD 2: How Your Business Runs',
  },
  {
    id: 'mod3',
    key: 'MOD 3',
    category: 'MOD 3 - Your Team Workspace',
    title: 'Your Team Workspace',
    shortTitle: 'Workspace',
    phase: 'Phase 3: Workspace Tracking & Automation',
    portalPhase: 'MOD 3: Your Team Workspace',
  },
  {
    id: 'mod4',
    key: 'MOD 4',
    category: 'MOD 4 - Care Plan',
    title: 'Care Plan',
    shortTitle: 'Care Plan',
    phase: 'Phase 4: Governance & Support Care',
    portalPhase: 'MOD 4: Care Plan',
  },
];

export const CATEGORY_TO_PRESET: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.category, m.id]),
);
Object.assign(CATEGORY_TO_PRESET, LEGACY_CATEGORY_ALIASES);

export const MOD_CATEGORIES: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.id, m.category]),
);


export function getModuleByCategory(category?: string | null) {
  if (!category) return undefined;
  const preset = CATEGORY_TO_PRESET[category];
  if (preset) return MODULES.find((m) => m.id === preset);
  return MODULES.find((m) => category.startsWith(m.key));
}

export function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

export function computePlannerChaosTax(staffCount: number, monthlySalary: number, wastedHours: number) {
  const staff = Number(staffCount) || 0;
  const salary = Number(monthlySalary) || 0;
  const hours = Number(wastedHours) || 0;
  return Math.round(staff * salary * 12 * (hours / 8));
}

export function resolveChaosTax(profile?: {
  chaosTax?: ChaosTaxSlice;
  annualOperationalLeakage?: number;
  staffCount?: number;
  monthlySalary?: number;
  wastedHours?: number;
} | null): ChaosTaxSlice {
  if (!profile) return { source: 'planner', value: 0, inputs: {} };
  if (profile.chaosTax && typeof profile.chaosTax.value === 'number') return profile.chaosTax;
  return {
    source: 'planner',
    value: profile.annualOperationalLeakage ?? 0,
    inputs: {
      staffCount: profile.staffCount,
      monthlySalary: profile.monthlySalary,
      wastedHours: profile.wastedHours,
    },
  };
}

export function getChaosTaxValue(profile?: Parameters<typeof resolveChaosTax>[0]) {
  return resolveChaosTax(profile).value;
}

export function getClientDisplayName(profile?: { clientCompany?: string; clientName?: string } | null) {
  return profile?.clientCompany?.trim() || profile?.clientName?.trim() || 'Untitled Client';
}

export function buildProfileMeta(extra?: Record<string, unknown>): WorkbookProfileMeta {
  return { schemaVersion: SCHEMA_VERSION, updatedAt: Date.now(), ...extra };
}

export function buildChaosTaxPayload(
  source: ChaosTaxSlice['source'],
  value: number,
  inputs?: Record<string, unknown>,
): ChaosTaxSlice {
  return { source, value, inputs: inputs || {} };
}

export function buildProfileLinks(profile?: {
  id?: string;
  quoteId?: string;
  links?: Partial<ProfileLinks>;
} | null): ProfileLinks {
  const quoteId = profile?.quoteId || null;
  const crmDealId = profile?.links?.crmDealId || quoteId;
  return {
    crmDealId: crmDealId ?? null,
    portalClientId: profile?.links?.portalClientId || quoteId || null,
    contractId: profile?.links?.contractId || (quoteId ? `contract-${profile?.id || quoteId}` : null),
  };
}

export function buildDefaultPortalRoadmap() {
  return MODULES.map((m, i) => ({
    id: i + 1,
    phase: m.portalPhase,
    title: m.title,
    status: i === 0 ? 'In Progress' : 'Pending',
  }));
}
