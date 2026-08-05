/**
 * Google Doc import fetch helpers (client-side contract).
 * Run: node tests/google-doc-import-fetch.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studio = readFileSync(join(__dirname, '../apps/operations/policy_studio.html'), 'utf8');
const rules = readFileSync(join(__dirname, '../firestore.rules'), 'utf8');
const fnSrc = readFileSync(join(__dirname, '../functions/src/index.ts'), 'utf8');

// Client must create the request before listening (rules need resource or owner).
assert.match(studio, /Create the request first, then listen/);
assert.match(studio, /\.then\(\(\) => \{\s*if \(settled\) return;\s*attachListener\(\);/);

// Rules must allow read when the doc does not exist yet (resource == null).
assert.match(rules, /google_doc_import_requests/);
assert.match(rules, /resource == null/);

// Server trigger + export fetch must exist.
assert.match(fnSrc, /export const onGoogleDocImportRequest/);
assert.match(fnSrc, /export\?format=txt/);
assert.match(fnSrc, /User-Agent/);

console.log('google-doc-import-fetch.test.mjs: all assertions passed');
