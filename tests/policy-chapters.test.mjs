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

const toc = PC.tocEntries(withChapters);
assert.equal(toc[0].title, 'Introduction');
assert.equal(toc[0].number, '');
assert.equal(toc[1].number, '1.');
assert.equal(toc[1].title, 'Workplace');
assert.equal(toc[2].number, '1.1');
assert.equal(toc[2].title, 'Dress');
assert.equal(toc[3].number, '2.');
assert.equal(toc[4].number, '2.1');

const flatToc = PC.tocEntriesFlat({
  introduction: 'Hi',
  sections: [
    { id: 'a', title: 'First' },
    { id: 'b', title: 'Second' },
  ],
});
assert.equal(flatToc[1].number, '1.');
assert.equal(flatToc[2].number, '2.');

const emptyCh = PC.createEmptyChapter({ title: 'New Chapter' });
assert.equal(emptyCh.title, 'New Chapter');
assert.equal(emptyCh.sections.length, 1);

const blank = PC.createEmptyChapter();
assert.equal(blank.title, 'Untitled chapter');
assert.equal(blank.sections[0].title, 'Untitled section');
assert.equal(blank.sections[0].kind, 'text');
assert.equal(blank.sections[0].content, '');

const tableSec = PC.createEmptySection({
  kind: 'table',
  title: 'SLA targets',
  table: {
    headers: ['Metric', 'Target'],
    // Legacy nested arrays must migrate to Firestore-safe { id, cells } rows
    rows: [['Uptime', '99.9%'], ['Response', '4h']],
  },
});
assert.equal(tableSec.kind, 'table');
assert.equal(tableSec.table.headers.length, 2);
assert.equal(tableSec.table.rows.length, 2);
assert.ok(tableSec.table.rows[0].id);
assert.equal(tableSec.table.rows[0].cells[0], 'Uptime');
assert.equal(tableSec.table.rows[0].cells[1], '99.9%');
// Must not keep nested arrays (Firestore rejects array-of-arrays)
assert.equal(Array.isArray(tableSec.table.rows[0]), false);
assert.equal(typeof tableSec.table.rows[0], 'object');

const withTable = PC.normalizeStandardPolicyDoc({
  title: 'SLA',
  introduction: 'Targets',
  chapters: [
    {
      id: 'ch-1',
      title: 'Service levels',
      sections: [
        { id: 's-text', title: 'Scope', content: 'Applies to all clients.' },
        tableSec,
      ],
    },
  ],
});
assert.equal(withTable.sections[1].kind, 'table');
assert.equal(withTable.sections[1].table.rows[0].cells[1], '99.9%');

const tableMd = PC.compileStandardPolicyMarkdown(withTable);
assert.match(tableMd, /### 1\.2 SLA targets/);
assert.match(tableMd, /\| Metric \| Target \|/);
assert.match(tableMd, /\| Uptime \| 99\.9% \|/);

let grid = PC.normalizeTable({ headers: ['A', 'B'], rows: [['1', '2']] });
assert.equal(grid.rows[0].cells[0], '1');
assert.equal(grid.rows[0].cells[1], '2');
grid = PC.addTableRow(grid);
assert.equal(grid.rows.length, 2);
grid = PC.addTableColumn(grid);
assert.equal(grid.headers.length, 3);
grid = PC.setTableCell(grid, -1, 2, 'C');
assert.equal(grid.headers[2], 'C');
grid = PC.setTableCell(grid, 1, 2, 'x');
assert.equal(grid.rows[1].cells[2], 'x');
grid = PC.removeTableColumn(grid, 1);
assert.equal(grid.headers.join(','), 'A,C');
grid = PC.removeTableRow(grid, 0);
assert.equal(grid.rows.length, 1);

const tocTable = PC.tocEntries(withTable);
assert.equal(tocTable[3].kind, 'table');
assert.equal(tocTable[3].title, 'SLA targets');

console.log('policy-chapters.test.mjs: all assertions passed');
