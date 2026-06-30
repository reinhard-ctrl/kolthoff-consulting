import { DEFAULT_NAV_GROUPS, type NavGroup, type NavItem } from '../config/navigation';

const STORAGE_KEY = 'kolthoff-admin-nav-preferences';

export type NavPreferences = {
  groupOrder: string[];
  /** groupId -> ordered item ids (supports moving items between groups) */
  assignments: Record<string, string[]>;
};

export function loadNavPreferences(): NavPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavPreferences & { itemOrder?: Record<string, string[]> };
    if (parsed.assignments) return parsed;
    // Migrate legacy itemOrder-only prefs
    if (parsed.itemOrder) {
      return {
        groupOrder: parsed.groupOrder ?? DEFAULT_NAV_GROUPS.map((g) => g.id),
        assignments: parsed.itemOrder,
      };
    }
    return null;
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

function buildItemCatalog(): Map<string, NavItem> {
  const map = new Map<string, NavItem>();
  for (const group of DEFAULT_NAV_GROUPS) {
    for (const item of group.items) map.set(item.id, item);
  }
  return map;
}

function defaultAssignments(): Record<string, string[]> {
  return Object.fromEntries(DEFAULT_NAV_GROUPS.map((g) => [g.id, g.items.map((i) => i.id)]));
}

export function buildPreferencesFromGroups(groups: NavGroup[]): NavPreferences {
  return {
    groupOrder: groups.map((g) => g.id),
    assignments: Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)])),
  };
}

export function applyNavPreferences(groups: NavGroup[], prefs: NavPreferences | null): NavGroup[] {
  const catalog = buildItemCatalog();
  const meta = new Map(groups.map((g) => [g.id, g]));
  const assignments = prefs?.assignments ?? defaultAssignments();

  const orderedGroupIds = prefs?.groupOrder?.length
    ? [
        ...prefs.groupOrder.filter((id) => meta.has(id)),
        ...groups.map((g) => g.id).filter((id) => !prefs!.groupOrder.includes(id)),
      ]
    : groups.map((g) => g.id);

  return orderedGroupIds.map((groupId) => {
    const groupMeta = meta.get(groupId)!;
    const savedIds = assignments[groupId] ?? groupMeta.items.map((i) => i.id);
    const defaultIds = groupMeta.items.map((i) => i.id);
    const mergedIds = [
      ...savedIds.filter((id) => catalog.has(id)),
      ...defaultIds.filter((id) => !savedIds.includes(id)),
    ];
    const items = mergedIds.map((id) => catalog.get(id)!).filter(Boolean);
    return { ...groupMeta, items };
  });
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

export function moveItemToGroup(groups: NavGroup[], itemId: string, fromGroupId: string, toGroupId: string): NavGroup[] {
  if (fromGroupId === toGroupId) return groups;
  let moved: NavItem | undefined;
  const stripped = groups.map((group) => {
    if (group.id !== fromGroupId) return group;
    const items = group.items.filter((item) => {
      if (item.id === itemId) {
        moved = item;
        return false;
      }
      return true;
    });
    return { ...group, items };
  });
  if (!moved) return groups;
  return stripped.map((group) =>
    group.id === toGroupId ? { ...group, items: [...group.items, moved!] } : group
  );
}

export function findItemGroup(groups: NavGroup[], itemId: string): string | undefined {
  return groups.find((g) => g.items.some((i) => i.id === itemId))?.id;
}

export function getNavItem(id: string): (NavItem & { group: string }) | undefined {
  for (const group of getEffectiveNavGroups()) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, group: group.label };
  }
  for (const group of DEFAULT_NAV_GROUPS) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, group: group.label };
  }
  return undefined;
}
