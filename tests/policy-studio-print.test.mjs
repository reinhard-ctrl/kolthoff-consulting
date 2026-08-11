/**
 * Policy Studio print/PDF CSS regressions (RACI sections must paginate fully).
 * Run: node --test tests/policy-studio-print.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'apps/operations/policy_studio.html'), 'utf8');

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

describe('policy studio print / PDF', () => {
  const printBlock = extractMediaBlock(html, 'print');

  it('does not force every layout tr to avoid page breaks', () => {
    // Blanket tr{break-inside:avoid} clips tall RACI/DOA sections off the PDF page.
    assert.doesNotMatch(
      printBlock,
      /(?<!\.print-table\s)tr\s*\{\s*[^}]*page-break-inside:\s*avoid/,
    );
    assert.match(printBlock, /\.print-table\s+tr\s*\{[^}]*page-break-inside:\s*avoid/);
  });

  it('does not collapse textareas with height:auto in print', () => {
    // height:auto on rows={1} textareas clips multi-line section content when printing in edit mode.
    const textareaRule = printBlock.match(/textarea\s*\{[^}]+\}/g) || [];
    assert.ok(textareaRule.length >= 1, 'expected textarea print rule');
    assert.ok(
      textareaRule.every((rule) => !/height:\s*auto\s*!important/.test(rule)),
      'textarea print rules must not force height:auto !important',
    );
  });

  it('makes overflow wrappers visible so tables are not clipped', () => {
    assert.match(printBlock, /\.overflow-hidden[\s\S]*overflow:\s*visible\s*!important/);
    assert.match(printBlock, /\.overflow-x-auto[\s\S]*overflow:\s*visible\s*!important/);
  });

  it('exports PDF via handleExportPdf (preview-safe print path)', () => {
    assert.match(html, /const handleExportPdf\s*=/);
    assert.match(html, /onClick=\{\(\)\s*=>\s*runIfUnlocked\(handleExportPdf\)\}/);
    assert.match(html, /setIsEditMode\(false\)/);
  });

  it('splits RACI DOA and matrices into separate printable layout rows', () => {
    assert.match(html, /renderRaciPolicyEditor/);
    assert.match(
      html,
      /Separate layout rows so DOA \+ matrices can paginate/,
    );
    assert.match(html, /matrices\.map\(\(mx, mxIdx\)\s*=>\s*\(\s*<tr/);
  });
});
