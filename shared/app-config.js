/** Global app configuration — injected at deploy or runtime */
export const APP_BASE_URL = typeof window !== 'undefined' && window.__APP_BASE_URL__
  ? window.__APP_BASE_URL__
  : (typeof window !== 'undefined' ? window.location.origin : '');

export const DEFAULT_APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'kolthoff-admin-app';

export const ROUTES = {
  home: '/',
  portal: '/apps/public/portal.html',
  orgChart: '/admin/org-chart',
  projectPlanner: '/apps/delivery/project_planner.html',
  contractLedger: '/admin/contracts',
  clientContractSign: '/apps/public/contract_sign.html',
  workspace: '/workspace/',
  adminConsole: '/admin/',
  masterAdmin: '/admin/master',
  portalManager: '/admin/portals',
  crmPipeline: '/apps/operations/crm_pipeline.html',
  crmPipelineShare: '/apps/public/crm_pipeline_view.html',
  firmAnalytics: '/apps/analytics/firm_analytics_dashboard.html',
};

export function appUrl(path) {
  return `${APP_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
