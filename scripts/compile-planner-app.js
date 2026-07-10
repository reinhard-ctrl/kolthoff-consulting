#!/usr/bin/env node
/**
 * Precompile project_planner_app.jsx → project_planner_app.js
 * Eliminates ~2.7 MB Babel CDN + main-thread JSX transform on every load.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const deliveryDir = path.join(root, 'apps', 'delivery');
const htmlPath = path.join(deliveryDir, 'project_planner.html');
const jsxPath = path.join(deliveryDir, 'project_planner_app.jsx');
const jsPath = path.join(deliveryDir, 'project_planner_app.js');

function extractJsxFromHtml() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const marker = '<script type="text/babel">';
  const endMarker = '</script>';
  const start = html.indexOf(marker);
  if (start === -1) {
    if (fs.existsSync(jsxPath)) return;
    throw new Error('No inline Babel block found and project_planner_app.jsx is missing.');
  }
  const contentStart = start + marker.length;
  const end = html.indexOf(endMarker, contentStart);
  if (end === -1) throw new Error('Unclosed Babel script block in project_planner.html');
  const jsx = html.slice(contentStart, end).replace(/^\n/, '').replace(/\n  $/, '\n');
  fs.writeFileSync(jsxPath, jsx);
  console.log(`Extracted ${jsxPath} (${jsx.length} bytes)`);
}

function patchHtmlForPrecompiledApp() {
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (html.includes('project_planner_app.js')) return;

  html = html.replace(
    /\n  <!-- Babel CDN -->\n  <script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone[^<]+<\/script>\n/,
    '\n',
  );

  const babelBlock = /<script type="text\/babel">[\s\S]*?<\/script>\n?/;
  if (!babelBlock.test(html)) {
    throw new Error('Could not find Babel block to replace in project_planner.html');
  }
  html = html.replace(
    babelBlock,
    '<script defer src="project_planner_app.js?v=20250710-precompile-v1"></script>\n',
  );

  html = html.replace(
    /<script src="project_planner_helpers\.js[^"]*"><\/script>\n  <script src="project_planner_addendum\.js[^"]*"><\/script>\n/,
    '<script defer src="project_planner_helpers.js?v=20250710-precompile-v1"></script>\n',
  );

  html = html.replace(
    /<script src="\.\.\/\.\.\/shared\/engagement-addendum-templates\.js[^"]*"><\/script>\n  <script src="\.\.\/\.\.\/shared\/portal-sync\.js[^"]*"><\/script>\n/,
    '',
  );

  html = html.replace(
    /family=Montserrat:ital,wght@0,100\.\.900;1,100\.\.900&family=Playfair\+Display:ital,wght@0,400\.\.900;1,400\.\.900/,
    'family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400',
  );

  fs.writeFileSync(htmlPath, html);
  console.log('Patched project_planner.html for precompiled app');
}

async function compileJsx() {
  if (!fs.existsSync(jsxPath)) extractJsxFromHtml();

  const result = await esbuild.build({
    entryPoints: [jsxPath],
    outfile: jsPath,
    bundle: false,
    minify: true,
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: ['es2020'],
    logLevel: 'info',
  });

  const stat = fs.statSync(jsPath);
  console.log(`Compiled ${jsPath} (${stat.size} bytes)`);
  return result;
}

(async () => {
  const extractOnly = process.argv.includes('--extract-only');
  const skipHtmlPatch = process.argv.includes('--skip-html-patch');

  if (!fs.existsSync(jsxPath)) extractJsxFromHtml();
  if (!extractOnly) {
    await compileJsx();
    if (!skipHtmlPatch && fs.readFileSync(htmlPath, 'utf8').includes('type="text/babel"')) {
      patchHtmlForPrecompiledApp();
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
