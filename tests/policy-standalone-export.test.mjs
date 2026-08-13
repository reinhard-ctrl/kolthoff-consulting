/**
 * Standalone Policy Studio export helpers.
 * Run: node tests/policy-standalone-export.test.mjs
 */
import assert from 'node:assert/strict';

const escapeJsonForInlineScript = (value) =>
  JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const SHARED_SCRIPT_RE = /<script\s+src="(\.\.\/\.\.\/shared\/[^"]+)"[^>]*>\s*<\/script>/gi;

const sampleHtml = `
<head>
  <script src="../../shared/policy-catalog.js?v=1"></script>
  <script src="../../shared/policy-chapters.js?v=2"></script>
  <script src="https://cdn.example.com/react.js"></script>
</head>
`;

const found = [...sampleHtml.matchAll(SHARED_SCRIPT_RE)].map((m) => m[1]);
assert.deepEqual(found, [
  '../../shared/policy-catalog.js?v=1',
  '../../shared/policy-chapters.js?v=2',
]);

const withBreak = escapeJsonForInlineScript({
  content: 'See </script><script>alert(1)</script>',
});
assert.match(withBreak, /\\u003c\\\/script/);
assert.doesNotMatch(withBreak, /<\/script>/i);

console.log('policy-standalone-export.test.mjs: all assertions passed');
