import { DEFAULT_NAV_GROUPS, getNavLink, type NavItem } from './navigation';

export type QuickActionDef = {
  id: string;
  label: string;
  to: string;
  variant: 'primary' | 'secondary';
};

const PRIMARY_IDS = new Set(['new-sow']);

function navToQuickAction(item: NavItem, label?: string): QuickActionDef | null {
  if (item.openInNewTab) return null;
  return {
    id: item.id,
    label: label ?? item.label,
    to: getNavLink(item),
    variant: PRIMARY_IDS.has(item.id) ? 'primary' : 'secondary',
  };
}

/** All actions available for the dashboard quick-action bar. */
export const QUICK_ACTION_CATALOG: QuickActionDef[] = [
  { id: 'new-sow', label: 'New SOW', to: '/app/project-planner', variant: 'primary' },
  ...DEFAULT_NAV_GROUPS.flatMap((group) =>
    group.items
      .map((item) => navToQuickAction(item))
      .filter((action): action is QuickActionDef => action !== null && action.id !== 'dashboard')
  ),
].filter((action, index, list) => list.findIndex((a) => a.id === action.id) === index);

export const DEFAULT_QUICK_ACTION_IDS = ['new-sow', 'contracts', 'tenants', 'portals'];

export function getQuickAction(id: string): QuickActionDef | undefined {
  return QUICK_ACTION_CATALOG.find((action) => action.id === id);
}
