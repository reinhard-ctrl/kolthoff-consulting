import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthDomain } from '../shared/auth-domain.js';

test('resolveAuthDomain uses web.app for firebase hosting default domain', () => {
  globalThis.window = { location: { hostname: 'kolthoff-portal.web.app' } };
  assert.equal(resolveAuthDomain(), 'kolthoff-portal.web.app');
  delete globalThis.window;
});

test('resolveAuthDomain uses custom domain on kolthoff-consulting.com', () => {
  globalThis.window = { location: { hostname: 'kolthoff-consulting.com' } };
  assert.equal(resolveAuthDomain(), 'kolthoff-consulting.com');
  delete globalThis.window;
});

test('resolveAuthDomain maps legacy firebaseapp.com host to web.app auth domain', () => {
  globalThis.window = { location: { hostname: 'kolthoff-portal.firebaseapp.com' } };
  assert.equal(resolveAuthDomain(), 'kolthoff-portal.web.app');
  delete globalThis.window;
});
