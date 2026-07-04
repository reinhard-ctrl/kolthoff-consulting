/**
 * Runtime product + tenant resolution for legacy HTML apps and embeds.
 * Admin React shell passes ?product= & ?tenant= on iframe src URLs.
 */
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
  },
};

/** Kolthoff OS — legacy MOD display names (MOD 1–4). */
export const KOLTHOFF_MOD_LABELS = {
  mod1: { title: 'Business Leak Scan', shortTitle: 'Leak Scan', description: 'Find where time and money leak before you spend on tools or training.' },
  mod2: { title: 'How Your Business Runs', shortTitle: 'Playbooks', description: 'Plain playbooks and charts so everyone knows the steps and who signs off.' },
  mod3: { title: 'Your Team Workspace', shortTitle: 'Workspace', description: 'Launch a shared workspace, digitize forms, and train your team to use it daily.' },
  mod4: { title: 'Care Plan', shortTitle: 'Care Plan', description: 'Hosting, bi-weekly check-ins, and periodic health checks after go-live.' },
};

/** Agency Ops Starter — agency-friendly MOD names for quotes and SOW. */
export const AGENCY_MOD_LABELS = {
  mod1: { title: 'Discovery & Audit', shortTitle: 'Discovery', description: 'Map current workflows, tools, and bottlenecks before scoping the engagement.' },
  mod2: { title: 'Process Design', shortTitle: 'Process', description: 'Design streamlined playbooks, roles, and approval paths for your team.' },
  mod3: { title: 'Build & Implementation', shortTitle: 'Build', description: 'Configure deliverables, integrations, and workspace with hands-on setup.' },
  mod4: { title: 'Ongoing Support', shortTitle: 'Support', description: 'Hosting, check-ins, and continuous improvements after launch.' },
};

function modKeyFromInput(modKeyOrNum) {
  if (typeof modKeyOrNum === 'number') return `mod${modKeyOrNum}`;
  if (typeof modKeyOrNum === 'string' && /^mod[1-4]$/.test(modKeyOrNum)) return modKeyOrNum;
  const n = Number(String(modKeyOrNum).match(/(\d)/)?.[1]);
  return n >= 1 && n <= 4 ? `mod${n}` : 'mod1';
}

function modNumFromInput(modKeyOrNum) {
  return Number(modKeyFromInput(modKeyOrNum).replace('mod', ''));
}

export function getModLabels() {
  return isStarterMode() ? AGENCY_MOD_LABELS : KOLTHOFF_MOD_LABELS;
}

export function getModTitle(modKeyOrNum) {
  const key = modKeyFromInput(modKeyOrNum);
  return getModLabels()[key]?.title || `Module ${modNumFromInput(modKeyOrNum)}`;
}

export function getModShortTitle(modKeyOrNum) {
  const key = modKeyFromInput(modKeyOrNum);
  const labels = getModLabels()[key];
  return labels?.shortTitle || labels?.title || getModTitle(modKeyOrNum);
}

export function getModDescription(modKeyOrNum) {
  const key = modKeyFromInput(modKeyOrNum);
  return getModLabels()[key]?.description || '';
}

export function getModCategory(modKeyOrNum) {
  const num = modNumFromInput(modKeyOrNum);
  return `MOD ${num} - ${getModTitle(modKeyOrNum)}`;
}

export function getModChipLabel(modKeyOrNum) {
  const num = modNumFromInput(modKeyOrNum);
  return `MOD ${num} · ${getModShortTitle(modKeyOrNum)}`;
}

export function getModPhase(modKeyOrNum) {
  const num = modNumFromInput(modKeyOrNum);
  return `Phase ${num}: ${getModTitle(modKeyOrNum)}`;
}

export function formatModCategoryDisplay(category, starterMode = isStarterMode()) {
  if (!category || typeof category !== 'string') return category || '';
  if (!starterMode) {
    return category.replace('MOD ', 'M').replace(' - ', ' · ');
  }
  const match = category.match(/^MOD (\d)/);
  if (match) return getModChipLabel(Number(match[1]));
  return category.replace('MOD ', 'M').replace(' - ', ' · ');
}

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
    getPlannerTabLabels,
    getModLabels,
    getModTitle,
    getModShortTitle,
    getModDescription,
    getModCategory,
    getModChipLabel,
    getModPhase,
    formatModCategoryDisplay,
  };
}
