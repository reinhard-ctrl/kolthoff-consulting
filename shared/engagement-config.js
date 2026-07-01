/**
 * Kolthoff Operations Suite — canonical engagement content (MOD 1–4, phases, field names).
 * Classic script: sets window.EngagementConfig for legacy HTML apps.
 */
(function (global) {
  const SCHEMA_VERSION = 2;

  const LEGACY_CATEGORY_ALIASES = {
    'MOD 1 - Workflow Diagnosis': 'mod1',
    'MOD 2 - Organizing How You Work': 'mod2',
    'MOD 3 - Workspace Automation': 'mod3',
    'MOD 4 - Ongoing Support': 'mod4',
  };

  /** Canonical module / phase definitions — single source for Planner, Diagnosis, Portal, CRM. */
  const MODULES = [
    {
      id: 'mod1',
      key: 'MOD 1',
      category: 'MOD 1 - Business Leak Scan',
      title: 'Business Leak Scan',
      shortTitle: 'Leak Scan',
      phase: 'Phase 1: Diagnosis & Alignment',
      portalPhase: 'MOD 1: Business Leak Scan',
      creditBackGate: true,
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

  const CATEGORY_TO_PRESET = Object.fromEntries(
    MODULES.map((m) => [m.category, m.id])
  );
  Object.assign(CATEGORY_TO_PRESET, LEGACY_CATEGORY_ALIASES);

  const MOD_CATEGORIES = Object.fromEntries(MODULES.map((m) => [m.id, m.category]));

  const RATE_TIERS = ['principal', 'senior', 'associate', 'partner'];

  /** Intake Center → workbook_profiles field mapping targets */
  const INTAKE_MAPPED_TARGETS = ['subSaaS', 'roles', 'customAssets'];

  function getModuleByCategory(category) {
    if (!category) return undefined;
    const preset = CATEGORY_TO_PRESET[category];
    if (preset) return MODULES.find((m) => m.id === preset);
    return MODULES.find((m) => category.startsWith(m.key));
  }

  function getModuleById(id) {
    return MODULES.find((m) => m.id === id);
  }

  function getPhaseForCategory(category) {
    return getModuleByCategory(category)?.phase ?? '';
  }

  function getPortalPhaseForCategory(category) {
    return getModuleByCategory(category)?.portalPhase ?? MODULES[0].portalPhase;
  }

  function categoryStartsWithMod(category, modKey) {
    return Boolean(category?.startsWith(modKey));
  }

  function isMod1Category(category) {
    return categoryStartsWithMod(category, 'MOD 1');
  }

  function isMod2Category(category) {
    return categoryStartsWithMod(category, 'MOD 2');
  }

  function isMod3Category(category) {
    return categoryStartsWithMod(category, 'MOD 3');
  }

  /** Planner formula: staff × salary × 12 × (wasted hours / 8) */
  function computePlannerChaosTax(staffCount, monthlySalary, wastedHours) {
    const staff = Number(staffCount) || 0;
    const salary = Number(monthlySalary) || 0;
    const hours = Number(wastedHours) || 0;
    return Math.round(staff * salary * 12 * (hours / 8));
  }

  /** Resolve chaos tax from profile (supports legacy annualOperationalLeakage). */
  function resolveChaosTax(profile) {
    if (!profile) {
      return { source: 'planner', value: 0, inputs: {} };
    }
    if (profile.chaosTax && typeof profile.chaosTax.value === 'number') {
      return profile.chaosTax;
    }
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

  function getChaosTaxValue(profile) {
    return resolveChaosTax(profile).value;
  }

  /** Canonical client legal name (Planner writes clientCompany). */
  function getClientDisplayName(profile) {
    return profile?.clientCompany?.trim() || profile?.clientName?.trim() || 'Untitled Client';
  }

  function buildProfileMeta(extra) {
    return { schemaVersion: SCHEMA_VERSION, updatedAt: Date.now(), ...(extra || {}) };
  }

  function buildChaosTaxPayload(source, value, inputs) {
    return { source, value, inputs: inputs || {} };
  }

  function buildProfileLinks(profile) {
    const quoteId = profile?.quoteId || null;
    const crmDealId = profile?.links?.crmDealId || quoteId;
    return {
      crmDealId,
      portalClientId: profile?.links?.portalClientId || quoteId,
      contractId: profile?.links?.contractId || (quoteId ? `contract-${profile?.id || quoteId}` : null),
    };
  }

  /** Default portal roadmap from MOD phases */
  function buildDefaultPortalRoadmap() {
    return MODULES.map((m, i) => ({
      id: i + 1,
      phase: m.portalPhase,
      title: m.title,
      status: i === 0 ? 'In Progress' : 'Pending',
    }));
  }

  const bundle = {
    SCHEMA_VERSION,
    MODULES,
    MOD_CATEGORIES,
    CATEGORY_TO_PRESET,
    LEGACY_CATEGORY_ALIASES,
    RATE_TIERS,
    INTAKE_MAPPED_TARGETS,
    getModuleByCategory,
    getModuleById,
    getPhaseForCategory,
    getPortalPhaseForCategory,
    categoryStartsWithMod,
    isMod1Category,
    isMod2Category,
    isMod3Category,
    computePlannerChaosTax,
    resolveChaosTax,
    getChaosTaxValue,
    getClientDisplayName,
    buildProfileMeta,
    buildChaosTaxPayload,
    buildProfileLinks,
    buildDefaultPortalRoadmap,
  };

  global.EngagementConfig = bundle;
})(typeof window !== 'undefined' ? window : globalThis);
