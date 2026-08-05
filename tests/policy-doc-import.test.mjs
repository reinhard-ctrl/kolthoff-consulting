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

console.log('policy-doc-import.test.mjs: all assertions passed');
