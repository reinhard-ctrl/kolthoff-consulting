/**
 * Markdown format helpers.
 * Run: node tests/markdown-format.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/markdown-format.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const MF = win.MarkdownFormat;
assert.ok(MF);

const bold = MF.applyMarkdownFormat('Hello world', 6, 11, 'bold');
assert.equal(bold.value, 'Hello **world**');
assert.equal(bold.value.slice(bold.selectionStart, bold.selectionEnd), 'world');

const bullet = MF.applyMarkdownFormat('One\nTwo', 0, 7, 'bullet');
assert.equal(bullet.value, '- One\n- Two');

const numbered = MF.applyMarkdownFormat('One\nTwo\nThree', 0, 13, 'number');
assert.equal(numbered.value, '1. One\n2. Two\n3. Three');

const emptyBullet = MF.applyMarkdownFormat('Intro\n', 6, 6, 'bullet');
assert.equal(emptyBullet.value, 'Intro\n- ');

const link = MF.applyMarkdownFormat('Click here', 6, 10, 'link');
assert.equal(link.value, 'Click [here](https://)');

const italicEmpty = MF.applyMarkdownFormat('', 0, 0, 'italic');
assert.equal(italicEmpty.value, '*italic text*');

console.log('markdown-format.test.mjs: all assertions passed');
