/**
 * Dashboard quick action preference tests.
 * Run: node tests/quick-action-preferences.test.mjs
 */
import assert from 'node:assert/strict';

const DEFAULT_QUICK_ACTION_IDS = ['new-sow', 'contracts', 'tenants', 'portals'];
const CATALOG = [
  { id: 'new-sow' },
  { id: 'contracts' },
  { id: 'portals' },
  { id: 'crm-pipeline' },
  { id: 'tenants' },
];

function dedupeIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function reorderQuickActions(order, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= order.length || toIndex >= order.length) {
    return order;
  }
  const copy = [...order];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy;
}

function replaceQuickAction(order, index, nextId) {
  if (index < 0 || index >= order.length || !CATALOG.some((action) => action.id === nextId)) return order;
  const existingIndex = order.indexOf(nextId);
  if (existingIndex >= 0 && existingIndex !== index) {
    const copy = [...order];
    [copy[index], copy[existingIndex]] = [copy[existingIndex], copy[index]];
    return dedupeIds(copy);
  }
  const copy = [...order];
  copy[index] = nextId;
  return dedupeIds(copy);
}

const reordered = reorderQuickActions(DEFAULT_QUICK_ACTION_IDS, 0, 3);
assert.deepEqual(reordered, ['contracts', 'tenants', 'portals', 'new-sow']);

const swapped = replaceQuickAction(DEFAULT_QUICK_ACTION_IDS, 0, 'portals');
assert.deepEqual(swapped, ['portals', 'contracts', 'tenants', 'new-sow']);

const replaced = replaceQuickAction(DEFAULT_QUICK_ACTION_IDS, 1, 'crm-pipeline');
assert.deepEqual(replaced, ['new-sow', 'crm-pipeline', 'tenants', 'portals']);

console.log('quick-action-preferences tests passed');
