import { DEFAULT_NAV_GROUPS, type NavGroup, type NavItem } from '../config/navigation';

const STORAGE_KEY = 'kolthoff-admin-nav-preferences';

export type NavPreferences = {
  groupOrder: string[];
  /** groupId -> ordered item ids (supports moving items between groups) */
  assignments: Record<string, string[]>;
};

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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

function resolveGroupOrder(groups: NavGroup[], prefs: NavPreferences | null): string[] {
  const known = new Set(groups.map((g) => g.id));
  if (!prefs?.groupOrder?.length) return groups.map((g) => g.id);
  return [
    ...prefs.groupOrder.filter((id) => known.has(id)),
    ...groups.map((g) => g.id).filter((id) => !prefs.groupOrder.includes(id)),
  ];
}

/** Each nav item belongs to exactly one group; saved assignments override defaults. */
function resolveItemAssignments(groups: NavGroup[], prefs: NavPreferences | null): Map<string, string> {
  const catalog = buildItemCatalog();
  const itemHome = new Map<string, string>();

  for (const group of groups) {
    for (const item of group.items) {
      itemHome.set(item.id, group.id);
    }
  }

  if (!prefs?.assignments) return itemHome;

  for (const groupId of resolveGroupOrder(groups, prefs)) {
    const savedIds = dedupeIds(prefs.assignments[groupId] ?? []);
    for (const id of savedIds) {
      if (catalog.has(id)) itemHome.set(id, groupId);
    }
  }

  return itemHome;
}

export function loadNavPreferences(): NavPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavPreferences & { itemOrder?: Record<string, string[]> };
    let prefs: NavPreferences | null = null;
    if (parsed.assignments) {
      prefs = parsed;
    } else if (parsed.itemOrder) {
      prefs = {
        groupOrder: parsed.groupOrder ?? DEFAULT_NAV_GROUPS.map((g) => g.id),
        assignments: parsed.itemOrder,
      };
    }
    if (!prefs) return null;
    const sanitized = sanitizeNavPreferences(prefs);
    const cleaned = JSON.stringify(sanitized);
    if (cleaned !== JSON.stringify(prefs)) {
      localStorage.setItem(STORAGE_KEY, cleaned);
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function saveNavPreferences(prefs: NavPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeNavPreferences(prefs)));
}

export function clearNavPreferences() {
  localStorage.removeItem(STORAGE_KEY);
}

export function buildPreferencesFromGroups(groups: NavGroup[]): NavPreferences {
  return {
    groupOrder: groups.map((g) => g.id),
    assignments: Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)])),
  };
}

export function sanitizeNavPreferences(
  prefs: NavPreferences,
  groups: NavGroup[] = DEFAULT_NAV_GROUPS,
): NavPreferences {
  return buildPreferencesFromGroups(applyNavPreferences(groups, prefs));
}

export function applyNavPreferences(groups: NavGroup[], prefs: NavPreferences | null): NavGroup[] {
  const catalog = buildItemCatalog();
  const meta = new Map(groups.map((g) => [g.id, g]));
  const itemHome = resolveItemAssignments(groups, prefs);
  const orderedGroupIds = resolveGroupOrder(groups, prefs);

  return orderedGroupIds
    .filter((id) => meta.has(id))
    .map((groupId) => {
      const groupMeta = meta.get(groupId)!;
      const savedIds = dedupeIds(prefs?.assignments?.[groupId] ?? []);
      const idsInGroup = [...itemHome.entries()]
        .filter(([, gid]) => gid === groupId)
        .map(([id]) => id);

      const orderedIds = dedupeIds([
        ...savedIds.filter((id) => itemHome.get(id) === groupId && catalog.has(id)),
        ...idsInGroup.filter((id) => !savedIds.includes(id) && catalog.has(id)),
      ]);

      const items = orderedIds.map((id) => catalog.get(id)!).filter(Boolean);
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

export function reorderGroups(groups: NavGroup[], fromIndex: number, toIndex: number): NavGroup[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= groups.length || toIndex >= groups.length) {
    return groups;
  }
  const copy = [...groups];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy;
}

export function insertItemAt(
  groups: NavGroup[],
  itemId: string,
  fromGroupId: string,
  toGroupId: string,
  toIndex: number
): NavGroup[] {
  const fromGroup = groups.find((g) => g.id === fromGroupId);
  const fromIndex = fromGroup?.items.findIndex((i) => i.id === itemId) ?? -1;
  if (fromIndex < 0) return groups;

  let adjustedIndex = toIndex;
  if (fromGroupId === toGroupId && fromIndex < toIndex) {
    adjustedIndex -= 1;
  }

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

  return stripped.map((group) => {
    if (group.id !== toGroupId) return group;
    const items = [...group.items];
    const index = Math.max(0, Math.min(adjustedIndex, items.length));
    items.splice(index, 0, moved!);
    return { ...group, items };
  });
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
