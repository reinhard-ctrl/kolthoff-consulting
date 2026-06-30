import { DEFAULT_NAV_GROUPS, type NavGroup } from '../config/navigation';

const STORAGE_KEY = 'kolthoff-admin-nav-preferences';

export type NavPreferences = {
  groupOrder: string[];
  itemOrder: Record<string, string[]>;
};

export function loadNavPreferences(): NavPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NavPreferences;
  } catch {
    return null;
  }
}

export function saveNavPreferences(prefs: NavPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function clearNavPreferences() {
  localStorage.removeItem(STORAGE_KEY);
}

function orderByIds<T extends { id: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order?.length) return items;
  const map = new Map(items.map((i) => [i.id, i]));
  const ordered = order.map((id) => map.get(id)).filter(Boolean) as T[];
  for (const item of items) {
    if (!order.includes(item.id)) ordered.push(item);
  }
  return ordered;
}

export function applyNavPreferences(groups: NavGroup[], prefs: NavPreferences | null): NavGroup[] {
  if (!prefs) return groups;

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const orderedGroupIds = [
    ...prefs.groupOrder.filter((id) => groupMap.has(id)),
    ...groups.map((g) => g.id).filter((id) => !prefs.groupOrder.includes(id)),
  ];

  return orderedGroupIds.map((id) => {
    const group = groupMap.get(id)!;
    return {
      ...group,
      items: orderByIds(group.items, prefs.itemOrder[id]),
    };
  });
}

export function buildPreferencesFromGroups(groups: NavGroup[]): NavPreferences {
  return {
    groupOrder: groups.map((g) => g.id),
    itemOrder: Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)])),
  };
}

export function getEffectiveNavGroups(): NavGroup[] {
  return applyNavPreferences(DEFAULT_NAV_GROUPS, loadNavPreferences());
}

export function moveGroup(groups: NavGroup[], groupId: string, direction: -1 | 1): NavGroup[] {
  const idx = groups.findIndex((g) => g.id === groupId);
  const next = idx + direction;
  if (idx < 0 || next < 0 || next >= groups.length) return groups;
  const copy = [...groups];
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  return copy;
}

export function moveItem(groups: NavGroup[], groupId: string, itemId: string, direction: -1 | 1): NavGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group;
    const idx = group.items.findIndex((i) => i.id === itemId);
    const next = idx + direction;
    if (idx < 0 || next < 0 || next >= group.items.length) return group;
    const items = [...group.items];
    [items[idx], items[next]] = [items[next], items[idx]];
    return { ...group, items };
  });
}
