/**
 * Intake merge tests — compile-free mirror of admin intake-merge logic.
 * Run: node tests/intake-merge.test.mjs
 */
import assert from 'node:assert/strict';

function mergeIntakeResponses(existing, incoming, target) {
  if (!incoming.length) return existing ? [...existing] : [];
  if (target === 'subSaaS') {
    const byKey = new Map();
    (existing || []).forEach((row) => {
      const key = String(row.tool || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    incoming.forEach((row) => {
      const key = String(row.tool || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    return Array.from(byKey.values());
  }
  if (target === 'roles') {
    const byKey = new Map();
    (existing || []).forEach((row) => {
      const key = String(row.owner || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    incoming.forEach((row) => {
      const key = String(row.owner || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    return Array.from(byKey.values());
  }
  return [...(existing || []), ...incoming.map((row) => ({ ...row, _intakeAt: 'test' }))];
}

const existing = [{ tool: 'Zoom', billing: 100 }];
const incoming = [{ tool: 'zoom', billing: 200 }, { tool: 'Slack', billing: 50 }];
const merged = mergeIntakeResponses(existing, incoming, 'subSaaS');
assert.equal(merged.length, 2);
assert.equal(merged.find((r) => r.tool === 'zoom').billing, 200);

const roles = mergeIntakeResponses(
  [{ owner: 'Alice', role: 'CEO' }],
  [{ owner: 'alice', role: 'Founder' }],
  'roles',
);
assert.equal(roles.length, 1);
assert.equal(roles[0].role, 'Founder');

const assets = mergeIntakeResponses([{ title: 'A' }], [{ title: 'B' }], 'customAssets');
assert.equal(assets.length, 2);

console.log('intake-merge.test.mjs: all assertions passed');
