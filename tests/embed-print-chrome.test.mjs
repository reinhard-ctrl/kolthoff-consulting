/**
 * Regression: embed-mode must not force planner/CRM tab chrome into print/PDF output.
 * Run: node --test tests/embed-print-chrome.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const embedMode = readFileSync(join(root, 'shared/embed-mode.js'), 'utf8');
const plannerHtml = readFileSync(join(root, 'apps/delivery/project_planner.html'), 'utf8');

function extractMediaBlock(source, media) {
  const re = new RegExp(`@media ${media}\\s*\\{`);
  const start = source.search(re);
  assert.ok(start >= 0, `missing @media ${media} block`);
  let depth = 0;
  let i = source.indexOf('{', start);
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed @media ${media} block`);
}

describe('embed print chrome', () => {
  it('scopes planner force-visible header rules to screen media only', () => {
    const screenBlock = extractMediaBlock(embedMode, 'screen');
    assert.match(screenBlock, /planner-main-header[\s\S]*display:\s*block !important/);
    assert.match(screenBlock, /crm-main-header[\s\S]*display:\s*block !important/);

    // Outside @media screen, embed styles must not force planner header visible.
    const withoutScreen = embedMode.replace(/@media screen\s*\{[\s\S]*?\n\s*\}/, '');
    assert.doesNotMatch(withoutScreen, /planner-main-header[\s\S]{0,80}display:\s*block !important/);
  });

  it('hides planner tab chrome during print in embed mode', () => {
    const printBlock = extractMediaBlock(embedMode, 'print');
    assert.match(printBlock, /planner-main-header/);
    assert.match(printBlock, /\.no-print/);
    assert.match(printBlock, /display:\s*none !important/);
  });

  it('planner HTML keeps embed tab visibility screen-only and print-hides header', () => {
    assert.match(plannerHtml, /@media screen\s*\{[\s\S]*html\.kolthoff-embed \.planner-main-header[\s\S]*display:\s*block !important/);
    assert.match(
      plannerHtml,
      /@media print\s*\{[\s\S]*html\.kolthoff-embed \.planner-main-header[\s\S]*display:\s*none !important/,
    );
  });
});
