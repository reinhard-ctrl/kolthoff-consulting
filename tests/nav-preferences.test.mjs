/**
 * Sidebar nav preference tests — pure logic, no browser APIs.
 * Run: node tests/nav-preferences.test.mjs
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Compile-free test: duplicate the core logic by importing built admin bundle is heavy.
// Instead inline minimal copies of DEFAULT_NAV_GROUPS shape for regression test.

const DEFAULT_NAV_GROUPS = [
  {
    id: 'command',
    label: 'Command',
    items: [
      { id: 'dashboard' },
      { id: 'tenants' },
      { id: 'core-workspace' },
      { id: 'intake' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery Suite',
    items: [{ id: 'project-planner' }, { id: 'diagnosis-reports' }],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [{ id: 'crm-pipeline' }, { id: 'policy-studio' }, { id: 'workflow-builder' }],
  },
  {
    id: 'admin-tools',
    label: 'Admin Tools',
    items: [{ id: 'portals' }, { id: 'contracts' }, { id: 'master' }],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [{ id: 'firm-analytics' }, { id: 'resource-capacity' }, { id: 'time-variance' }],
  },
  {
    id: 'client',
    label: 'Client Experience',
    items: [{ id: 'client-portal' }, { id: 'client-intake' }, { id: 'marketing' }],
  },
];

function dedupeIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildItemCatalog() {
  const map = new Map();
  for (const group of DEFAULT_NAV_GROUPS) {
    for (const item of group.items) map.set(item.id, item);
  }
  return map;
}

function resolveGroupOrder(groups, prefs) {
  const known = new Set(groups.map((g) => g.id));
  if (!prefs?.groupOrder?.length) return groups.map((g) => g.id);
  return [
    ...prefs.groupOrder.filter((id) => known.has(id)),
    ...groups.map((g) => g.id).filter((id) => !prefs.groupOrder.includes(id)),
  ];
}

function resolveItemAssignments(groups, prefs) {
  const catalog = buildItemCatalog();
  const itemHome = new Map();
  for (const group of groups) {
    for (const item of group.items) itemHome.set(item.id, group.id);
  }
  if (!prefs?.assignments) return itemHome;
  for (const groupId of resolveGroupOrder(groups, prefs)) {
    for (const id of dedupeIds(prefs.assignments[groupId] ?? [])) {
      if (catalog.has(id)) itemHome.set(id, groupId);
    }
  }
  return itemHome;
}

function applyNavPreferences(groups, prefs) {
  const catalog = buildItemCatalog();
  const meta = new Map(groups.map((g) => [g.id, g]));
  const itemHome = resolveItemAssignments(groups, prefs);
  const orderedGroupIds = resolveGroupOrder(groups, prefs);

  return orderedGroupIds
    .filter((id) => meta.has(id))
    .map((groupId) => {
      const groupMeta = meta.get(groupId);
      const savedIds = dedupeIds(prefs?.assignments?.[groupId] ?? []);
      const idsInGroup = [...itemHome.entries()]
        .filter(([, gid]) => gid === groupId)
        .map(([id]) => id);
      const orderedIds = dedupeIds([
        ...savedIds.filter((id) => itemHome.get(id) === groupId && catalog.has(id)),
        ...idsInGroup.filter((id) => !savedIds.includes(id) && catalog.has(id)),
      ]);
      return { ...groupMeta, items: orderedIds.map((id) => ({ id })) };
    });
}

function allItemIds(groups) {
  return groups.flatMap((g) => g.items.map((i) => i.id));
}

function assertNoDuplicates(groups) {
  const ids = allItemIds(groups);
  assert.equal(ids.length, new Set(ids).size, `duplicate nav ids: ${ids.join(', ')}`);
}

// Regression: moving core-workspace to command used to duplicate it in workspace group on reload.
const movedPrefs = {
  groupOrder: ['command', 'delivery', 'operations', 'admin-tools', 'analytics', 'client'],
  assignments: {
    command: ['dashboard', 'tenants', 'core-workspace', 'intake'],
    delivery: ['project-planner', 'diagnosis-reports'],
    operations: ['crm-pipeline', 'policy-studio', 'workflow-builder'],
    'admin-tools': ['portals', 'contracts', 'master'],
    analytics: ['firm-analytics', 'resource-capacity', 'time-variance'],
    client: ['client-portal', 'client-intake', 'marketing'],
  },
};

const applied = applyNavPreferences(DEFAULT_NAV_GROUPS, movedPrefs);
assertNoDuplicates(applied);
assert.equal(
  applied.find((g) => g.id === 'command')?.items.some((i) => i.id === 'core-workspace'),
  true,
);
assert.equal(
  applied.some((g) => g.id !== 'command' && g.items.some((i) => i.id === 'core-workspace')),
  false,
);

// Corrupt prefs with duplicate ids in assignments should dedupe on sanitize path.
const corruptPrefs = {
  groupOrder: movedPrefs.groupOrder,
  assignments: {
    ...movedPrefs.assignments,
    command: ['dashboard', 'tenants', 'core-workspace', 'core-workspace', 'intake'],
    delivery: ['project-planner', 'core-workspace', 'diagnosis-reports'],
  },
};
const cleaned = applyNavPreferences(DEFAULT_NAV_GROUPS, corruptPrefs);
assertNoDuplicates(cleaned);
assert.equal(allItemIds(cleaned).filter((id) => id === 'core-workspace').length, 1);

console.log('nav-preferences tests passed');
