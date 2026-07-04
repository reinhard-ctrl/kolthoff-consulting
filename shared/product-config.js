/**
 * Runtime product + tenant resolution for legacy HTML apps and embeds.
 * Admin React shell passes ?product= & ?tenant= on iframe src URLs.
 */

/** Default Kolthoff OS service phase labels (display only; task categories unchanged). */
export const KOLTHOFF_MOD_LABELS = {
  mod1: {
    chip: 'MOD 1 · Leak Scan',
    title: 'Business Leak Scan',
    short: 'Leak Scan',
    phase: 'Phase 1: Business Leak Scan',
    description: 'Find where time and money leak before you spend on tools or training.',
  },
  mod2: {
    chip: 'MOD 2 · Playbooks',
    title: 'How Your Business Runs',
    short: 'Playbooks',
    phase: 'Phase 2: How Your Business Runs',
    description: 'Plain playbooks and charts so everyone knows the steps and who signs off.',
  },
  mod3: {
    chip: 'MOD 3 · Workspace',
    title: 'Your Team Workspace',
    short: 'Workspace',
    phase: 'Phase 3: Your Team Workspace',
    description: 'Launch a shared workspace, digitize forms, and train your team to use it daily.',
  },
  mod4: {
    chip: 'MOD 4 · Care Plan',
    title: 'Care Plan',
    short: 'Care Plan',
    phase: 'Phase 4: Care Plan',
    description: 'Hosting, bi-weekly check-ins, and periodic health checks after go-live.',
  },
};

/** Agency Ops Starter — generic agency-friendly phase names. */
export const AGENCY_MOD_LABELS = {
  mod1: {
    chip: 'Discovery',
    title: 'Discovery & Audit',
    short: 'Discovery',
    phase: 'Phase 1: Discovery & Audit',
    description: 'Review current workflows and pinpoint gaps before you invest in tools or training.',
  },
  mod2: {
    chip: 'Process Design',
    title: 'Process Design',
    short: 'Process Design',
    phase: 'Phase 2: Process Design',
    description: 'Document playbooks and roles so everyone knows the steps and who signs off.',
  },
  mod3: {
    chip: 'Implementation',
    title: 'Build & Implementation',
    short: 'Implementation',
    phase: 'Phase 3: Build & Implementation',
    description: 'Launch shared tools, digitize forms, and train your team for daily use.',
  },
  mod4: {
    chip: 'Ongoing Support',
    title: 'Ongoing Support',
    short: 'Support',
    phase: 'Phase 4: Ongoing Support',
    description: 'Hosting, regular check-ins, and periodic health checks after go-live.',
  },
};

export const PRODUCTS = {
  'kolthoff-os': {
    id: 'kolthoff-os',
    tenantId: 'kolthoff-admin-app',
    branding: {
      name: 'KOLTHOFF',
      accent: 'CONSULTING',
      subtitle: 'Operations Suite',
    },
    starterMode: false,
    plannerTabs: ['nda', 'packages', 'sandbox', 'package', 'addendum', 'invoice'],
    plannerSubtitle: 'Internal Project Workbook',
    crmSubtitle: 'Premium Sales Pipeline & Partnership Tracking Studio',
    crmBadge: 'PIPEDRIVE STUDIO',
    moduleLabels: {
      sales: 'CRM Pipeline',
      quotes: 'Project Planner',
      invoicing: 'Collections',
    },
  },
  'agency-ops-starter': {
    id: 'agency-ops-starter',
    tenantId: 'agency-ops-demo',
    branding: {
      name: 'Studio',
      accent: 'North',
      subtitle: 'Creative & Digital Services',
    },
    starterMode: true,
    plannerTabs: ['sandbox', 'package', 'invoice'],
    plannerSubtitle: 'Quotes',
    crmSubtitle: 'Track leads from inquiry to signed deal',
    crmBadge: 'Sales',
    moduleLabels: {
      sales: 'Sales',
      quotes: 'Quotes',
      invoicing: 'Invoicing',
    },
    modLabels: AGENCY_MOD_LABELS,
  },
};

function readParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function getProductId() {
  const params = readParams();
  if (params.get('product')) return params.get('product');
  if (typeof globalThis.__PRODUCT_ID__ !== 'undefined') return globalThis.__PRODUCT_ID__;
  return 'kolthoff-os';
}

export function getTenantId(fallback = 'kolthoff-admin-app') {
  const params = readParams();
  if (params.get('tenant')) return params.get('tenant');
  if (typeof globalThis.__TENANT_ID__ !== 'undefined') return globalThis.__TENANT_ID__;
  const product = PRODUCTS[getProductId()] || PRODUCTS['kolthoff-os'];
  return product.tenantId || fallback;
}

export function getProductConfig() {
  const id = getProductId();
  return PRODUCTS[id] || PRODUCTS['kolthoff-os'];
}

export function isStarterMode() {
  return Boolean(getProductConfig().starterMode);
}

export function getModLabels() {
  const cfg = getProductConfig();
  return cfg.modLabels || KOLTHOFF_MOD_LABELS;
}

export function getModLabel(modId, field = 'chip') {
  return getModLabels()[modId]?.[field] ?? modId;
}

export function getPlannerTabLabels() {
  return {
    nda: 'NDA',
    packages: 'Packages',
    sandbox: 'Estimate',
    package: 'Documents',
    addendum: 'Addendum',
    invoice: 'Invoice',
  };
}

if (typeof window !== 'undefined') {
  window.ProductConfig = {
    PRODUCTS,
    KOLTHOFF_MOD_LABELS,
    AGENCY_MOD_LABELS,
    getProductId,
    getTenantId,
    getProductConfig,
    isStarterMode,
    getModLabels,
    getModLabel,
    getPlannerTabLabels,
  };
}
