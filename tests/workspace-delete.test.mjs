/**
 * Workspace tenant delete validation.
 * Run: node tests/workspace-delete.test.mjs
 */
import assert from 'node:assert/strict';

const INTERNAL = 'kolthoff-admin-app';
const CLIENT_ID_RE = /^client-[a-z0-9-]{2,48}$/;

function validateDeleteTarget(tenantId) {
  if (tenantId === INTERNAL) {
    throw new Error('The internal Kolthoff workspace cannot be deleted.');
  }
  if (!CLIENT_ID_RE.test(tenantId)) {
    throw new Error('Invalid workspace tenant ID.');
  }
}

assert.throws(() => validateDeleteTarget(INTERNAL), /internal Kolthoff workspace/);
assert.throws(() => validateDeleteTarget('agency-test'), /Invalid workspace tenant ID/);
assert.throws(() => validateDeleteTarget('client-'), /Invalid workspace tenant ID/);
assert.doesNotThrow(() => validateDeleteTarget('client-acme-corp'));
assert.doesNotThrow(() => validateDeleteTarget('client-test-123'));

console.log('workspace-delete.test.mjs: ok');
