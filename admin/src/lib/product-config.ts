import { type NavGroup, DEFAULT_NAV_GROUPS } from '../config/navigation';

export type ProductId = 'kolthoff-os' | 'agency-ops-starter';

export interface ProductBranding {
  /** Primary brand name, e.g. "Pixel & Code" */
  name: string;
  /** Accent word or second line, e.g. "Studio" — empty string hides accent span */
  accent: string;
  /** Subtitle under logo */
  subtitle: string;
  /** Tailwind color token prefix, e.g. brandTeal */
  accentColor: 'brandTeal' | 'brandAmber' | 'brandSky';
}

export type ProductTheme = 'light' | 'dark';

/** User-facing names for the three starter workflow modules. */
export interface ModuleLabels {
  sales: string;
  quotes: string;
  invoicing: string;
}

export const AGENCY_OPS_MODULE_LABELS: ModuleLabels = {
  sales: 'Sales',
  quotes: 'Quotes',
  invoicing: 'Invoicing',
};

export interface ProductConfig {
  id: ProductId;
  /** Firestore tenant for admin data */
  tenantId: string;
  branding: ProductBranding;
  /** Shell color scheme */
  theme: ProductTheme;
  /** Browser router basename, e.g. /admin or /agency-ops */
  basePath: string;
  /** Sidebar navigation groups for this product */
  navGroups: NavGroup[];
  /** localStorage key prefix for nav preferences */
  navStorageKey: string;
  /** Demo / sales sandbox flag */
  isDemo: boolean;
  /** Shown on login screen for demo tenants */
  demoPasscodeHint?: string;
  /** Prefilled passcode for demo login (Agency Ops Starter) */
  demoPasscode?: string;
  /** Query params appended to embedded legacy HTML apps */
  embedParams: Record<string, string>;
  /** Sidebar / page titles for workflow modules */
  moduleLabels: ModuleLabels;
}

/** Slim nav for Agency Ops Starter — Sales → Quotes → Invoicing */
export const AGENCY_OPS_STARTER_NAV: NavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    items: [{ id: 'dashboard', label: 'Dashboard', type: 'route', path: '/' }],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [{ id: 'crm-pipeline', label: AGENCY_OPS_MODULE_LABELS.sales, type: 'embed', href: '/apps/operations/crm_pipeline.html' }],
  },
  {
    id: 'quotes',
    label: 'Quotes',
    items: [{ id: 'project-planner', label: AGENCY_OPS_MODULE_LABELS.quotes, type: 'embed', href: '/apps/delivery/project_planner.html' }],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [{ id: 'collections', label: AGENCY_OPS_MODULE_LABELS.invoicing, type: 'route', path: '/collections' }],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [{ id: 'branding', label: 'Company Branding', type: 'route', path: '/settings/branding' }],
  },
];

const KOLTHOFF_OS: ProductConfig = {
  id: 'kolthoff-os',
  tenantId: 'kolthoff-admin-app',
  branding: {
    name: 'KOLTHOFF',
    accent: 'CONSULTING',
    subtitle: 'Operations Suite',
    accentColor: 'brandTeal',
  },
  basePath: '/admin',
  navGroups: DEFAULT_NAV_GROUPS,
  navStorageKey: 'kolthoff-admin-nav-preferences',
  isDemo: false,
  theme: 'dark',
  embedParams: {},
  moduleLabels: {
    sales: 'CRM Pipeline',
    quotes: 'Project Planner',
    invoicing: 'Collections',
  },
};

const AGENCY_OPS_STARTER: ProductConfig = {
  id: 'agency-ops-starter',
  tenantId: 'agency-ops-demo',
  branding: {
    name: 'Studio',
    accent: 'North',
    subtitle: 'Creative & Digital Services',
    accentColor: 'brandTeal',
  },
  basePath: '/agency-ops',
  navGroups: AGENCY_OPS_STARTER_NAV,
  navStorageKey: 'agency-ops-starter-nav-preferences',
  isDemo: true,
  theme: 'light',
  demoPasscode: 'demostart2026',
  demoPasscodeHint: 'Demo passcode: demostart2026',
  embedParams: {
    product: 'agency-ops-starter',
    tenant: 'agency-ops-demo',
  },
  moduleLabels: AGENCY_OPS_MODULE_LABELS,
};

const PRODUCTS: Record<ProductId, ProductConfig> = {
  'kolthoff-os': KOLTHOFF_OS,
  'agency-ops-starter': AGENCY_OPS_STARTER,
};

/** Resolve product from Vite env (set at build time). */
export function getProductIdFromEnv(): ProductId {
  const raw = import.meta.env.VITE_PRODUCT_ID as string | undefined;
  if (raw === 'agency-ops-starter') return 'agency-ops-starter';
  return 'kolthoff-os';
}

export function getProductConfig(productId?: ProductId): ProductConfig {
  const id = productId ?? getProductIdFromEnv();
  if (id === 'agency-ops-starter') {
    return resolveAgencyOpsRuntimeConfig();
  }
  return PRODUCTS[id] ?? KOLTHOFF_OS;
}

const AGENCY_TENANT_SESSION_KEY = 'agency-ops-tenant-id';

function isValidAgencyTenantId(tenant: string): boolean {
  return /^agency-[a-z0-9-]+$/.test(tenant) && tenant !== 'agency-ops-demo';
}

/** Persist ?tenant= across reloads for paid white-label clients. */
export function resolveAgencyTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('tenant')?.trim();
  if (fromUrl && isValidAgencyTenantId(fromUrl)) {
    try {
      sessionStorage.setItem(AGENCY_TENANT_SESSION_KEY, fromUrl);
    } catch {
      /* ignore quota / private mode */
    }
    return fromUrl;
  }
  try {
    const stored = sessionStorage.getItem(AGENCY_TENANT_SESSION_KEY);
    if (stored && isValidAgencyTenantId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

/** Keep ?tenant= visible in the address bar when restored from session. */
export function syncAgencyTenantUrl(): void {
  if (typeof window === 'undefined') return;
  const tenant = resolveAgencyTenantId();
  if (!tenant) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('tenant') === tenant) return;
  url.searchParams.set('tenant', tenant);
  window.history.replaceState(null, '', url.toString());
}

/** Resolve Agency Ops tenant from ?tenant= for paid white-label clients. */
export function resolveAgencyOpsRuntimeConfig(): ProductConfig {
  const base = AGENCY_OPS_STARTER;
  const tenant = resolveAgencyTenantId();
  if (tenant) {
    return {
      ...base,
      tenantId: tenant,
      isDemo: false,
      demoPasscode: undefined,
      demoPasscodeHint: undefined,
      embedParams: {
        product: 'agency-ops-starter',
        tenant,
      },
    };
  }
  return base;
}

export function getAdminTenantId(productId?: ProductId): string {
  return getProductConfig(productId).tenantId;
}

export function isAgencyOpsStarter(productId?: ProductId): boolean {
  return getProductConfig(productId).id === 'agency-ops-starter';
}

export function isLightProductTheme(productId?: ProductId): boolean {
  return getProductConfig(productId).theme === 'light';
}
