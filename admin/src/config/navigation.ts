export type NavItem = {
  id: string;
  label: string;
  type: 'route' | 'embed';
  /** In-app React route, e.g. /tenants */
  path?: string;
  /** External or legacy HTML path for iframe embeds */
  href?: string;
  /** Skip iframe and open in a new browser tab */
  openInNewTab?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/** Default sidebar groups and link order — edit here or use Customize in the sidebar UI. */
export const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    id: 'command',
    label: 'Command',
    items: [
      { id: 'dashboard', label: 'Dashboard', type: 'route', path: '/' },
      { id: 'tenants', label: 'Tenant Manager', type: 'route', path: '/tenants' },
      { id: 'intake', label: 'Intake Center', type: 'route', path: '/intake' },
    ],
  },
  {
    id: 'admin-tools',
    label: 'Admin Tools',
    items: [
      { id: 'portals', label: 'Portal Manager', type: 'route', path: '/portals' },
      { id: 'contracts', label: 'Contract Ledger', type: 'route', path: '/contracts' },
      { id: 'master', label: 'Master Admin', type: 'route', path: '/master' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery Suite',
    items: [
      { id: 'project-planner', label: 'Project Planner', type: 'embed', href: '/apps/delivery/project_planner.html' },
      { id: 'diagnosis-reports', label: 'Diagnosis Reports', type: 'embed', href: '/apps/delivery/diagnoses_report.html' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'crm-pipeline', label: 'CRM Pipeline', type: 'embed', href: '/apps/operations/crm_pipeline.html' },
      { id: 'policy-studio', label: 'Policy Studio', type: 'embed', href: '/apps/operations/policy_studio.html' },
      { id: 'workflow-builder', label: 'Workflow Builder', type: 'embed', href: '/apps/operations/workflow_builder.html' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { id: 'firm-analytics', label: 'Firm Analytics', type: 'embed', href: '/apps/analytics/firm_analytics_dashboard.html' },
      { id: 'resource-capacity', label: 'Resource Capacity', type: 'embed', href: '/apps/analytics/resource_capacity_manager.html' },
      { id: 'time-variance', label: 'Time Variance', type: 'embed', href: '/apps/analytics/time_tracking_variance_analyzer.html' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'core-workspace', label: 'Core Workspace', type: 'embed', href: '/workspace/' },
    ],
  },
  {
    id: 'client',
    label: 'Client Experience',
    items: [
      { id: 'client-portal', label: 'Client Portal', type: 'embed', href: '/apps/public/portal.html', openInNewTab: true },
      { id: 'client-intake', label: 'Client Intake Form', type: 'embed', href: '/apps/public/client_intake.html', openInNewTab: true },
      { id: 'marketing', label: 'Marketing Site', type: 'embed', href: '/', openInNewTab: true },
    ],
  },
];

const ALL_ITEMS = DEFAULT_NAV_GROUPS.flatMap((g) => g.items);

export function getNavItem(id: string): (NavItem & { group: string }) | undefined {
  for (const group of DEFAULT_NAV_GROUPS) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, group: group.label };
  }
  return undefined;
}

export function getNavLink(item: NavItem): string {
  if (item.type === 'route' && item.path) return item.path;
  return `/app/${item.id}`;
}

export function listEmbedItems(): NavItem[] {
  return ALL_ITEMS.filter((i) => i.type === 'embed' && !i.openInNewTab);
}
