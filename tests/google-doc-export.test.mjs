/**
 * Google Doc export helpers.
 * Run: node tests/google-doc-export.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/google-doc-export.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win, document: undefined });
const G = win.GoogleDocExport;
assert.ok(G);

assert.equal(G.sanitizeFileName('Code of Conduct!'), 'Code_of_Conduct');
assert.match(G.escapeHtml('<b>x</b>'), /&lt;b&gt;/);

const html = G.buildWordHtmlDocument('Code of Conduct', '<h2>Workplace</h2><ul><li>Be respectful</li></ul>', {
  company: 'Acme Ops',
});
assert.match(html, /<title>Code of Conduct<\/title>/);
assert.match(html, /Acme Ops/);
assert.match(html, /Be respectful/);
assert.match(html, /Word\.Document/);

console.log('google-doc-export.test.mjs: all assertions passed');
