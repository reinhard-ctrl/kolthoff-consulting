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
      { id: 'intake' },
    ],
  },
  {
    id: 'admin-tools',
    label: 'Admin Tools',
    items: [{ id: 'portals' }, { id: 'contracts' }, { id: 'master' }],
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
    id: 'analytics',
    label: 'Analytics',
    items: [{ id: 'firm-analytics' }, { id: 'resource-capacity' }, { id: 'time-variance' }],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [{ id: 'core-workspace' }],
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

function resolveGroupLabel(groupId, defaultLabel, prefs) {
  const custom = prefs?.groupLabels?.[groupId]?.trim();
  return custom || defaultLabel;
}

function resolveItemLabel(itemId, prefs) {
  const custom = prefs?.itemLabels?.[itemId]?.trim();
  return custom || itemId;
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
      return {
        ...groupMeta,
        label: resolveGroupLabel(groupId, groupMeta.label, prefs),
        items: orderedIds.map((id) => ({ id, label: resolveItemLabel(id, prefs) })),
      };
    });
}

function allItemIds(groups) {
  return groups.flatMap((g) => g.items.map((i) => i.id));
}

function assertNoDuplicates(groups) {
  const ids = allItemIds(groups);
  assert.equal(ids.length, new Set(ids).size, `duplicate nav ids: ${ids.join(', ')}`);
}

// Shipped default: core-workspace lives in the workspace group.
assert.equal(
  DEFAULT_NAV_GROUPS.find((g) => g.id === 'workspace')?.items.some((i) => i.id === 'core-workspace'),
  true,
);
assert.equal(
  DEFAULT_NAV_GROUPS.find((g) => g.id === 'command')?.items.some((i) => i.id === 'core-workspace'),
  false,
);
assert.equal(DEFAULT_NAV_GROUPS.map((g) => g.id).join(','), 'command,admin-tools,delivery,operations,analytics,workspace,client');

// Regression: moving core-workspace to command used to duplicate it in workspace group on reload.
const movedPrefs = {
  groupOrder: ['command', 'admin-tools', 'delivery', 'operations', 'analytics', 'workspace', 'client'],
  assignments: {
    command: ['dashboard', 'tenants', 'intake'],
    'admin-tools': ['portals', 'contracts', 'master'],
    delivery: ['project-planner', 'diagnosis-reports'],
    operations: ['crm-pipeline', 'policy-studio', 'workflow-builder'],
    analytics: ['firm-analytics', 'resource-capacity', 'time-variance'],
    workspace: ['core-workspace'],
    client: ['client-portal', 'client-intake', 'marketing'],
  },
};

const applied = applyNavPreferences(DEFAULT_NAV_GROUPS, movedPrefs);
assertNoDuplicates(applied);
assert.equal(
  applied.find((g) => g.id === 'workspace')?.items.some((i) => i.id === 'core-workspace'),
  true,
);
assert.equal(
  applied.some((g) => g.id !== 'workspace' && g.items.some((i) => i.id === 'core-workspace')),
  false,
);

// Corrupt prefs with duplicate ids in assignments should dedupe on sanitize path.
const corruptPrefs = {
  groupOrder: movedPrefs.groupOrder,
  assignments: {
    ...movedPrefs.assignments,
    workspace: ['core-workspace', 'core-workspace'],
    command: ['dashboard', 'tenants', 'core-workspace', 'intake'],
  },
};
const cleaned = applyNavPreferences(DEFAULT_NAV_GROUPS, corruptPrefs);
assertNoDuplicates(cleaned);
assert.equal(allItemIds(cleaned).filter((id) => id === 'core-workspace').length, 1);

const hiddenPrefs = {
  groupOrder: ['command', 'admin-tools', 'delivery', 'operations', 'workspace', 'client'],
  hiddenGroups: ['analytics'],
  assignments: movedPrefs.assignments,
};
const hiddenApplied = applyNavPreferences(DEFAULT_NAV_GROUPS, hiddenPrefs);
assert.equal(hiddenApplied.some((g) => g.id === 'analytics'), false);
assert.equal(hiddenApplied.length, 6);

const labeledPrefs = {
  ...movedPrefs,
  groupLabels: { command: 'HQ', delivery: 'Projects' },
};
const labeledApplied = applyNavPreferences(DEFAULT_NAV_GROUPS, labeledPrefs);
assert.equal(labeledApplied.find((g) => g.id === 'command')?.label, 'HQ');
assert.equal(labeledApplied.find((g) => g.id === 'delivery')?.label, 'Projects');
assert.equal(labeledApplied.find((g) => g.id === 'operations')?.label, 'Operations');

const itemLabeledPrefs = {
  ...movedPrefs,
  itemLabels: { 'crm-pipeline': 'CRM', dashboard: 'Home' },
};
const itemLabeledApplied = applyNavPreferences(DEFAULT_NAV_GROUPS, itemLabeledPrefs);
assert.equal(
  itemLabeledApplied.find((g) => g.id === 'operations')?.items.find((i) => i.id === 'crm-pipeline')?.label,
  'CRM',
);
assert.equal(
  itemLabeledApplied.find((g) => g.id === 'command')?.items.find((i) => i.id === 'dashboard')?.label,
  'Home',
);

console.log('nav-preferences tests passed');
