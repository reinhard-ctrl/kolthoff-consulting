/**
 * Policy Doc import parser tests.
 * Run: node tests/policy-doc-import.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/policy-doc-import.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const P = win.PolicyDocImport;

assert.ok(P);

assert.equal(
  P.extractGoogleDocId('https://docs.google.com/document/d/abc123XYZ/edit'),
  'abc123XYZ',
);
assert.equal(
  P.extractGoogleDocId('https://drive.google.com/file/d/driveFile99/view?usp=sharing'),
  'driveFile99',
);
assert.equal(P.extractGoogleDocId('not a url'), null);

assert.equal(P.isGoogleDocHtmlPage('<!DOCTYPE html><html>Sign in</html>'), true);
assert.equal(P.isGoogleDocHtmlPage('Code of Conduct\n\nBe respectful.'), false);

const md = P.parsePolicyDocText(`# Code of Conduct

These rules set the baseline for respectful work.

## Dress & appearance
Dress neat and work-appropriate.

## Anti-harassment
Zero tolerance for harassment.
`);
assert.equal(md.title, 'Code of Conduct');
assert.match(md.introduction, /baseline for respectful/);
assert.equal(md.sections.length, 2);
assert.equal(md.sections[0].title, 'Dress & appearance');
assert.match(md.sections[0].content, /Dress neat/);
assert.equal(md.sections[1].title, 'Anti-harassment');

const numbered = P.parsePolicyDocText(`# Workplace Code

1. Purpose
Everyone must follow these rules.

2. Conflicts of interest
Disclose side deals to Compliance.
`);
assert.equal(numbered.title, 'Workplace Code');
assert.equal(numbered.sections.length, 2);
assert.equal(numbered.sections[0].title, 'Purpose');
assert.match(numbered.sections[0].content, /Everyone must follow/);
assert.equal(numbered.sections[1].title, 'Conflicts of interest');

const caps = P.parsePolicyDocText(`CODE OF CONDUCT

Intro paragraph here.

DRESS CODE
Business casual Monday to Thursday.

SOCIAL MEDIA
Do not share client data.
`);
assert.equal(caps.title, 'CODE OF CONDUCT');
assert.match(caps.introduction, /Intro paragraph/);
assert.equal(caps.sections.length, 2);
assert.equal(caps.sections[0].title, 'DRESS CODE');

const withIntroHeading = P.parsePolicyDocText(`# NDA

## Introduction
Protects confidential information.

## Obligations
Keep secrets secure.
`);
assert.equal(withIntroHeading.title, 'NDA');
assert.match(withIntroHeading.introduction, /Protects confidential/);
assert.equal(withIntroHeading.sections.length, 1);
assert.equal(withIntroHeading.sections[0].title, 'Obligations');

const html = P.parsePolicyDocText(`<html><body>
<h1>Health &amp; Safety</h1>
<p>Stay safe at work.</p>
<h2>Evacuation</h2>
<p>Use stairs, not elevators.</p>
</body></html>`);
assert.equal(html.title, 'Health & Safety');
assert.match(html.introduction, /Stay safe/);
assert.equal(html.sections[0].title, 'Evacuation');

const plain = P.parsePolicyDocText(`First paragraph is the intro.

Second block becomes imported content with more detail.`);
assert.match(plain.introduction, /First paragraph/);
assert.equal(plain.sections.length, 1);
assert.equal(plain.sections[0].title, 'Imported content');

const applied = P.applyParsedToStandardDoc(
  {
    title: 'Old Title',
    docControl: { version: '1.0', owner: 'Compliance' },
    introduction: 'old',
    sections: [{ id: 'x', title: 'X', content: 'Y' }],
  },
  md,
  { updateTitle: true },
);
assert.equal(applied.title, 'Code of Conduct');
assert.equal(applied.docControl.owner, 'Compliance');
assert.equal(applied.sections.length, 2);

const keepTitle = P.applyParsedToStandardDoc(
  { title: 'Keep Me', introduction: '', sections: [] },
  md,
  { updateTitle: false },
);
assert.equal(keepTitle.title, 'Keep Me');

const chaptered = P.parsePolicyDocText(`# Workplace Policy

Intro for the whole policy.

## Conduct
Opening note under conduct.

### Dress code
Business casual.

### Harassment
Zero tolerance.

## Safety

### Evacuation
Use stairs.
`);
assert.equal(chaptered.title, 'Workplace Policy');
assert.match(chaptered.introduction, /Intro for the whole/);
assert.equal(chaptered.chapters.length, 2);
assert.equal(chaptered.chapters[0].title, 'Conduct');
assert.equal(chaptered.chapters[0].sections[0].title, 'Overview');
assert.match(chaptered.chapters[0].sections[0].content, /Opening note/);
assert.equal(chaptered.chapters[0].sections[1].title, 'Dress code');
assert.equal(chaptered.chapters[1].title, 'Safety');
assert.equal(chaptered.chapters[1].sections[0].title, 'Evacuation');

const htmlStructured = P.parsePolicyDocText(`<html><body>
<h1>Data Privacy</h1>
<p>Protect personal data.</p>
<h2>Collection</h2>
<h3>What we collect</h3>
<p>Name and email.</p>
<table>
  <tr><th>Field</th><th>Purpose</th></tr>
  <tr><td>Email</td><td>Login</td></tr>
</table>
</body></html>`);
assert.equal(htmlStructured.title, 'Data Privacy');
assert.equal(htmlStructured.chapters.length, 1);
assert.equal(htmlStructured.chapters[0].title, 'Collection');
assert.ok(htmlStructured.chapters[0].sections.some((s) => s.title === 'What we collect'));
const tableSec = htmlStructured.chapters[0].sections.find((s) => s.kind === 'table');
assert.ok(tableSec);
assert.equal(tableSec.table.headers.join('|'), 'Field|Purpose');
assert.equal(tableSec.table.rows[0].cells[0], 'Email');

const appliedChapters = P.applyParsedToStandardDoc(
  { title: 'Old', docControl: { owner: 'Legal' }, introduction: '', sections: [] },
  chaptered,
  { updateTitle: true },
);
assert.equal(appliedChapters.title, 'Workplace Policy');
assert.equal(appliedChapters.docControl.owner, 'Legal');
assert.equal(appliedChapters.chapters.length, 2);
assert.ok(appliedChapters.sections.length >= 3);

const summary = P.summarizeParsed(htmlStructured);
assert.equal(summary.chapterCount, 1);
assert.ok(summary.tableCount >= 1);

console.log('policy-doc-import.test.mjs: all assertions passed');
