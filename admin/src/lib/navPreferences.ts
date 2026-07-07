import { DEFAULT_NAV_GROUPS, type NavGroup, type NavItem } from '../config/navigation';
import { getProductConfig } from './product-config';

function productNavGroups(): NavGroup[] {
  return getProductConfig().navGroups;
}

function navStorageKey(): string {
  return getProductConfig().navStorageKey;
}
/** Bump when shipped DEFAULT_NAV_GROUPS layout changes — clears stale localStorage layouts. */
export const NAV_PREFS_VERSION = 9;

/** Map legacy group ids from older saved layouts. */
export function migrateNavPreferences(prefs: NavPreferences): NavPreferences {
  const next: NavPreferences = {
    ...prefs,
    groupOrder: [...(prefs.groupOrder ?? [])],
    assignments: { ...(prefs.assignments ?? {}) },
    groupLabels: prefs.groupLabels ? { ...prefs.groupLabels } : undefined,
    itemLabels: prefs.itemLabels ? { ...prefs.itemLabels } : undefined,
    hiddenGroups: prefs.hiddenGroups ? [...prefs.hiddenGroups] : undefined,
  };

  if (next.assignments.workspace && !next.assignments.product) {
    next.assignments.product = next.assignments.workspace;
    delete next.assignments.workspace;
  }
  if (next.groupLabels?.workspace && !next.groupLabels.product) {
    next.groupLabels.product = next.groupLabels.workspace;
    delete next.groupLabels.workspace;
  }
  if (next.groupOrder?.includes('workspace')) {
    next.groupOrder = next.groupOrder.map((id) => (id === 'workspace' ? 'product' : id));
  }
  if (next.hiddenGroups?.includes('workspace')) {
    next.hiddenGroups = next.hiddenGroups.map((id) => (id === 'workspace' ? 'product' : id));
  }

  return next;
}

export type NavPreferences = {
  version?: number;
  groupOrder: string[];
  /** groupId -> ordered item ids (supports moving items between groups) */
  assignments: Record<string, string[]>;
  /** Default groups hidden from the sidebar */
  hiddenGroups?: string[];
  /** groupId -> custom header label */
  groupLabels?: Record<string, string>;
  /** itemId -> custom card label */
  itemLabels?: Record<string, string>;
};

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildItemCatalog(groups: NavGroup[] = productNavGroups()): Map<string, NavItem> {
  const map = new Map<string, NavItem>();
  for (const group of groups) {
    for (const item of group.items) map.set(item.id, item);
  }
  return map;
}

function resolveGroupLabel(groupId: string, defaultLabel: string, prefs: NavPreferences | null): string {
  const custom = prefs?.groupLabels?.[groupId]?.trim();
  return custom || defaultLabel;
}

function buildGroupLabelsFromGroups(groups: NavGroup[]): Record<string, string> | undefined {
  const defaults = productNavGroups();
  const groupLabels: Record<string, string> = {};
  for (const group of groups) {
    const defaultLabel = defaults.find((g) => g.id === group.id)?.label ?? group.label;
    const label = group.label.trim();
    if (label && label !== defaultLabel) groupLabels[group.id] = label;
  }
  return Object.keys(groupLabels).length ? groupLabels : undefined;
}

function getDefaultItemLabel(itemId: string, groups: NavGroup[] = productNavGroups()): string | undefined {
  for (const group of groups) {
    const item = group.items.find((i) => i.id === itemId);
    if (item) return item.label;
  }
  return undefined;
}

function resolveItemLabel(itemId: string, defaultLabel: string, prefs: NavPreferences | null): string {
  const custom = prefs?.itemLabels?.[itemId]?.trim();
  return custom || defaultLabel;
}

function buildItemLabelsFromGroups(groups: NavGroup[]): Record<string, string> | undefined {
  const itemLabels: Record<string, string> = {};
  for (const group of groups) {
    for (const item of group.items) {
      const defaultLabel = getDefaultItemLabel(item.id) ?? item.label;
      const label = item.label.trim();
      if (label && label !== defaultLabel) itemLabels[item.id] = label;
    }
  }
  return Object.keys(itemLabels).length ? itemLabels : undefined;
}

function applyItemLabel(item: NavItem, prefs: NavPreferences | null): NavItem {
  const defaultLabel = getDefaultItemLabel(item.id) ?? item.label;
  return { ...item, label: resolveItemLabel(item.id, defaultLabel, prefs) };
}

function resolveGroupOrder(groups: NavGroup[], prefs: NavPreferences | null): string[] {
  const known = new Set(groups.map((g) => g.id));
  const hidden = new Set(prefs?.hiddenGroups ?? []);

  if (!prefs?.groupOrder?.length) {
    return groups.map((g) => g.id).filter((id) => !hidden.has(id));
  }

  const ordered = dedupeIds(prefs.groupOrder.filter((id) => known.has(id) && !hidden.has(id)));
  const append = groups
    .map((g) => g.id)
    .filter((id) => !hidden.has(id) && !ordered.includes(id));

  return [...ordered, ...append];
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
    const raw = localStorage.getItem(navStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavPreferences & { itemOrder?: Record<string, string[]> };
    if (parsed.version !== NAV_PREFS_VERSION) {
      localStorage.removeItem(navStorageKey());
      return null;
    }
    let prefs: NavPreferences | null = null;
    if (parsed.assignments) {
      prefs = parsed;
    } else if (parsed.itemOrder) {
      prefs = {
        groupOrder: parsed.groupOrder ?? productNavGroups().map((g) => g.id),
        assignments: parsed.itemOrder,
      };
    }
    if (!prefs) return null;
    const migrated = migrateNavPreferences(prefs);
    const sanitized = sanitizeNavPreferences(migrated);
    const cleaned = JSON.stringify(sanitized);
    if (cleaned !== JSON.stringify(prefs)) {
      localStorage.setItem(navStorageKey(), cleaned);
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function saveNavPreferences(prefs: NavPreferences) {
  localStorage.setItem(
    navStorageKey(),
    JSON.stringify({ ...sanitizeNavPreferences(prefs), version: NAV_PREFS_VERSION }),
  );
}

export function clearNavPreferences() {
  localStorage.removeItem(navStorageKey());
}

export function buildPreferencesFromGroups(groups: NavGroup[]): NavPreferences {
  const defaults = productNavGroups();
  const visibleIds = new Set(groups.map((g) => g.id));
  const hiddenGroups = defaults.map((g) => g.id).filter((id) => !visibleIds.has(id));
  return {
    groupOrder: groups.map((g) => g.id),
    assignments: Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)])),
    hiddenGroups: hiddenGroups.length ? hiddenGroups : undefined,
    groupLabels: buildGroupLabelsFromGroups(groups),
    itemLabels: buildItemLabelsFromGroups(groups),
  };
}

export function sanitizeNavPreferences(
  prefs: NavPreferences,
  groups: NavGroup[] = productNavGroups(),
): NavPreferences {
  return buildPreferencesFromGroups(applyNavPreferences(groups, prefs));
}

export function applyNavPreferences(groups: NavGroup[], prefs: NavPreferences | null): NavGroup[] {
  const catalog = buildItemCatalog(groups);
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

      const items = orderedIds
        .map((id) => catalog.get(id)!)
        .filter(Boolean)
        .map((item) => applyItemLabel(item, prefs));
      return {
        ...groupMeta,
        label: resolveGroupLabel(groupId, groupMeta.label, prefs),
        items,
      };
    });
}

export function getDefaultNavGroups(): NavGroup[] {
  return productNavGroups();
}

export function getEffectiveNavGroups(baselineGroups?: NavGroup[] | null): NavGroup[] {
  const catalog = productNavGroups();
  const baseline = baselineGroups ?? catalog;
  const prefs = loadNavPreferences();
  if (!prefs) {
    return baselineGroups ? baseline : catalog;
  }
  return applyNavPreferences(baseline, prefs);
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
  for (const group of productNavGroups()) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, group: group.label };
  }
  return undefined;
}

export function getAvailableNavGroupsToAdd(groups: NavGroup[]): NavGroup[] {
  const visible = new Set(groups.map((g) => g.id));
  return productNavGroups().filter((g) => !visible.has(g.id));
}

/** Remove a group card; its links move into the nearest remaining group. */
export function removeNavGroup(groups: NavGroup[], groupId: string): NavGroup[] {
  if (groups.length <= 1) return groups;
  const index = groups.findIndex((g) => g.id === groupId);
  if (index < 0) return groups;

  const removed = groups[index];
  const targetIndex = index > 0 ? index - 1 : 1;
  const targetId = groups[targetIndex]?.id;
  if (!targetId) return groups;

  return groups
    .filter((g) => g.id !== groupId)
    .map((g) =>
      g.id === targetId ? { ...g, items: [...g.items, ...removed.items] } : g
    );
}

/** Restore a hidden default group card (empty until links are dragged in). */
export function addNavGroup(groups: NavGroup[], groupId: string): NavGroup[] {
  if (groups.some((g) => g.id === groupId)) return groups;
  const meta = productNavGroups().find((g) => g.id === groupId);
  if (!meta) return groups;
  return [...groups, { ...meta, items: [] }];
}

export function renameNavGroup(groups: NavGroup[], groupId: string, label: string): NavGroup[] {
  const trimmed = label.trim();
  if (!trimmed) return groups;
  return groups.map((group) => (group.id === groupId ? { ...group, label: trimmed } : group));
}

export function renameNavItem(groups: NavGroup[], itemId: string, label: string): NavGroup[] {
  const trimmed = label.trim();
  if (!trimmed) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.id === itemId ? { ...item, label: trimmed } : item)),
  }));
}
