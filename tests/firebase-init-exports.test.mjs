/**
 * firebase-init.js must not re-export bindings already exported inline.
 * Run: node tests/firebase-init-exports.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'shared/firebase-init.js'), 'utf8');

function exportNames(pattern) {
  return [...src.matchAll(pattern)].map((m) => m[1]);
}

const inlineExports = new Set([
  ...exportNames(/export const (\w+)/g),
  ...exportNames(/export async function (\w+)/g),
  ...exportNames(/export function (\w+)/g),
]);

const blockMatch = src.match(/export \{([^}]+)\}/);
assert.ok(blockMatch, 'expected export block');
const blockExports = blockMatch[1]
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const duplicates = blockExports.filter((name) => inlineExports.has(name));
assert.equal(duplicates.length, 0, `duplicate export block names: ${duplicates.join(', ')}`);

console.log('firebase-init-exports.test.mjs: all assertions passed');
