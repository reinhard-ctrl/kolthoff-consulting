/**
 * Org chart helper tests — mirrors admin/src/lib/org-chart.ts
 * Run: node tests/org-chart.test.mjs
 */
import assert from 'node:assert/strict';

function buildOrgChartTree(members) {
  const nodes = new Map();
  members.forEach((m) => nodes.set(m.id, { ...m, children: [] }));
  const roots = [];
  members.forEach((m) => {
    const node = nodes.get(m.id);
    if (!node) return;
    if (m.managerId && nodes.has(m.managerId) && m.managerId !== m.id) {
      nodes.get(m.managerId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function migrateRolesToOrgChart(roles) {
  return (roles || []).map((row, i) => ({
    id: `m${i}`,
    name: String(row.owner || row.name || '').trim(),
    role: String(row.role || row.title || '').trim(),
    department: '',
    managerId: null,
  }));
}

const members = [
  { id: 'a', name: 'Jane', role: 'GM', department: 'Executive', managerId: null },
  { id: 'b', name: 'Juan', role: 'Ops Lead', department: 'Operations', managerId: 'a' },
  { id: 'c', name: 'Ana', role: 'Staff', department: 'Operations', managerId: 'b' },
];

const tree = buildOrgChartTree(members);
assert.equal(tree.length, 1);
assert.equal(tree[0].name, 'Jane');
assert.equal(tree[0].children.length, 1);
assert.equal(tree[0].children[0].name, 'Juan');
assert.equal(tree[0].children[0].children[0].name, 'Ana');

const migrated = migrateRolesToOrgChart([{ owner: 'Legacy User', role: 'Manager' }]);
assert.equal(migrated.length, 1);
assert.equal(migrated[0].name, 'Legacy User');
assert.equal(migrated[0].role, 'Manager');

console.log('org-chart.test.mjs: all assertions passed');
