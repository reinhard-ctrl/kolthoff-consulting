/**
 * Policy chapters helpers.
 * Run: node tests/policy-chapters.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/policy-chapters.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const PC = win.PolicyChapters;
assert.ok(PC);

const legacy = PC.normalizeStandardPolicyDoc({
  title: 'Code of Conduct',
  introduction: 'Be respectful.',
  sections: [
    { id: 'c-1', title: 'Dress', content: 'Business casual.' },
    { id: 'c-2', title: 'Harassment', content: 'Zero tolerance.' },
  ],
});
assert.equal(legacy.chapters.length, 1);
assert.equal(legacy.chapters[0].title, 'Policy provisions');
assert.equal(legacy.chapters[0].sections.length, 2);
assert.equal(legacy.sections.length, 2);
assert.equal(legacy.sections[0].title, 'Dress');

const withChapters = PC.normalizeStandardPolicyDoc({
  title: 'Code of Conduct',
  introduction: 'Intro',
  chapters: [
    {
      id: 'ch-1',
      title: 'Workplace',
      sections: [{ id: 's-1', title: 'Dress', content: 'Neat.' }],
    },
    {
      id: 'ch-2',
      title: 'Ethics',
      sections: [{ id: 's-2', title: 'Conflicts', content: 'Disclose.' }],
    },
  ],
  sections: [{ id: 'ignored', title: 'Old', content: 'Ignored when chapters present' }],
});
assert.equal(withChapters.chapters.length, 2);
assert.equal(withChapters.chapters[0].title, 'Workplace');
assert.equal(withChapters.sections.length, 2);
assert.equal(withChapters.sections[1].title, 'Conflicts');

const md = PC.compileStandardPolicyMarkdown(withChapters);
assert.match(md, /^# Code of Conduct/m);
assert.match(md, /## Introduction/);
assert.match(md, /## 1\. Workplace/);
assert.match(md, /### 1\.1 Dress/);
assert.match(md, /## 2\. Ethics/);

const emptyCh = PC.createEmptyChapter({ title: 'New Chapter' });
assert.equal(emptyCh.title, 'New Chapter');
assert.equal(emptyCh.sections.length, 1);

const blank = PC.createEmptyChapter();
assert.equal(blank.title, 'Untitled chapter');
assert.equal(blank.sections[0].title, 'Untitled section');
assert.equal(blank.sections[0].content, '');

console.log('policy-chapters.test.mjs: all assertions passed');
