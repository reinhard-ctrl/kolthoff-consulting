/**
 * firebase-errors.js guidance helper tests.
 * Run: node tests/firebase-errors.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'shared/firebase-errors.js'), 'utf8');
const win = { window: {} };
vm.runInNewContext(code, win);
const { getFirebaseConnectionHelp, isReferrerError } = win.window.FirebaseErrors;

assert.equal(isReferrerError('auth/requests-from-referer-null-are-blocked'), true);
assert.equal(isReferrerError('auth/requests-from-referer-blocked'), true);
assert.equal(isReferrerError('Cloud sync failed'), false);

const nullHelp = getFirebaseConnectionHelp('auth/requests-from-referer-null-are-blocked');
assert.match(nullHelp.summary, /origin|referrer|file/i);
assert.ok(nullHelp.steps.length >= 2);

console.log('firebase-errors.test.mjs: all assertions passed');
