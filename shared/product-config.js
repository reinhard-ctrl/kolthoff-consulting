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
  },
  'agency-ops-starter': {
    id: 'agency-ops-starter',
    tenantId: 'agency-ops-demo',
    branding: {
      name: 'AGENCY',
      accent: 'OPS',
      subtitle: 'Quote-to-Cash for Agencies',
    },
    starterMode: true,
    plannerTabs: ['sandbox', 'package', 'invoice'],
    plannerSubtitle: 'Project Estimates',
    crmSubtitle: 'Track leads, proposals, and closed deals',
    crmBadge: 'SALES PIPELINE',
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
    getProductId,
    getTenantId,
    getProductConfig,
    isStarterMode,
    getPlannerTabLabels,
  };
}
