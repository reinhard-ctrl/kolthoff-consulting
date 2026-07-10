#!/usr/bin/env node
/** Build script: copies static assets + builds Vite SPAs into dist/ */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('Building Kolthoff OS...');
rmrf(dist);
fs.mkdirSync(dist, { recursive: true });

// Precompile project planner (JSX → JS, drops Babel CDN at runtime)
try {
  execSync('node scripts/compile-planner-app.js --skip-html-patch', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('Planner precompile failed:', e.message);
  process.exit(1);
}

// Shared assets
copyDir(path.join(root, 'shared'), path.join(dist, 'shared'));

// Public apps
copyDir(path.join(root, 'apps/public'), path.join(dist, 'apps/public'));

// Source MP4 stays in repo for reference; marketing site uses YouTube embed instead.
const distSourceMp4 = path.join(dist, 'apps/public/assets/Ops_Excellence_for_SMEs.mp4');
if (fs.existsSync(distSourceMp4)) fs.unlinkSync(distSourceMp4);
copyDir(path.join(root, 'apps/delivery'), path.join(dist, 'apps/delivery'));
copyDir(path.join(root, 'apps/operations'), path.join(dist, 'apps/operations'));
copyDir(path.join(root, 'apps/analytics'), path.join(dist, 'apps/analytics'));

// Root index + optional CNAME (custom domain)
copyFile(path.join(root, 'apps/public/index.html'), path.join(dist, 'index.html'));
const cname = path.join(root, 'CNAME');
if (fs.existsSync(cname)) copyFile(cname, path.join(dist, 'CNAME'));

// Build Vite apps if node_modules exist
for (const app of ['workspace', 'admin']) {
  const appDir = path.join(root, app);
  if (fs.existsSync(path.join(appDir, 'package.json'))) {
    console.log(`Building ${app}...`);
    try {
      execSync('npm ci --silent', { cwd: appDir, stdio: 'inherit' });
      execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
      const outDir = path.join(appDir, 'dist');
      if (fs.existsSync(outDir)) {
        copyDir(outDir, path.join(dist, app));
      }
      if (app === 'admin') {
        execSync('npm run build:agency-ops', { cwd: appDir, stdio: 'inherit' });
        const agencyOut = path.join(appDir, 'dist-agency-ops');
        if (fs.existsSync(agencyOut)) {
          copyDir(agencyOut, path.join(dist, 'agency-ops'));
          const agencyHtml = path.join(dist, 'agency-ops', 'agency-ops.html');
          const agencyIndex = path.join(dist, 'agency-ops', 'index.html');
          if (fs.existsSync(agencyHtml)) {
            fs.copyFileSync(agencyHtml, agencyIndex);
          }
        }
      }
    } catch (e) {
      console.error(`Error: ${app} build failed (${e.message})`);
      if (app === 'workspace' || app === 'admin') process.exit(1);
    }
  }
}

console.log('Build complete → dist/');

const recaptchaKey = process.env.RECAPTCHA_SITE_KEY || process.env.VITE_RECAPTCHA_SITE_KEY || '';
if (recaptchaKey) {
  const snippet = `window.__RECAPTCHA_SITE_KEY__=${JSON.stringify(recaptchaKey)};\n`;
  const runtimePath = path.join(dist, 'shared', 'runtime-config.js');
  if (fs.existsSync(runtimePath)) {
    const existing = fs.readFileSync(runtimePath, 'utf8');
    if (!existing.includes('__RECAPTCHA_SITE_KEY__')) {
      fs.writeFileSync(runtimePath, snippet + existing);
    }
  } else {
    fs.writeFileSync(runtimePath, snippet);
  }

  for (const app of ['admin', 'workspace', 'agency-ops']) {
    const indexPath = path.join(dist, app, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      if (!html.includes('__RECAPTCHA_SITE_KEY__')) {
        html = html.replace('</head>', `  <script>${snippet.trim()}</script>\n  </head>`);
        fs.writeFileSync(indexPath, html);
      }
    }
  }
  console.log('App Check site key injected into dist/');
}

const explainerYoutubeId = process.env.EXPLAINER_YOUTUBE_ID || 'pFNqGatXJ4A';
const explainerThumbSrc = process.env.EXPLAINER_THUMB_SRC
  || `/apps/public/assets/explainer-thumbnail.jpg`;
for (const relPath of ['index.html', 'apps/public/index.html']) {
  const htmlPath = path.join(dist, relPath);
  if (!fs.existsSync(htmlPath)) continue;
  let html = fs.readFileSync(htmlPath, 'utf8');
  const assignment = `const EXPLAINER_YOUTUBE_ID = ${JSON.stringify(explainerYoutubeId)};`;
  if (html.includes("const EXPLAINER_YOUTUBE_ID = '__EXPLAINER_YOUTUBE_ID__';")) {
    html = html.replace(
      "const EXPLAINER_YOUTUBE_ID = '__EXPLAINER_YOUTUBE_ID__';",
      assignment,
    );
  }
  html = html.replace(
    /\/apps\/public\/assets\/explainer-thumbnail\.jpg/g,
    explainerThumbSrc,
  );
  fs.writeFileSync(htmlPath, html);
}
if (explainerYoutubeId) {
  console.log('Explainer YouTube ID injected into dist/');
}
