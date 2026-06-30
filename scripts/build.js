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

// Shared assets
copyDir(path.join(root, 'shared'), path.join(dist, 'shared'));

// Public apps
copyDir(path.join(root, 'apps/public'), path.join(dist, 'apps/public'));
copyDir(path.join(root, 'apps/delivery'), path.join(dist, 'apps/delivery'));
copyDir(path.join(root, 'apps/operations'), path.join(dist, 'apps/operations'));
copyDir(path.join(root, 'apps/analytics'), path.join(dist, 'apps/analytics'));

// Legacy admin HTML (embedded in SPA routes until fully migrated)
copyDir(path.join(root, 'admin/legacy'), path.join(dist, 'admin/legacy'));

// Root index + CNAME
copyFile(path.join(root, 'apps/public/index.html'), path.join(dist, 'index.html'));
copyFile(path.join(root, 'CNAME'), path.join(dist, 'CNAME'));

// Build Vite apps if node_modules exist
for (const app of ['workspace', 'admin']) {
  const appDir = path.join(root, app);
  if (fs.existsSync(path.join(appDir, 'package.json'))) {
    console.log(`Building ${app}...`);
    try {
      execSync('npm ci --silent', { cwd: appDir, stdio: 'inherit' });
      execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
      const outDir = app === 'workspace'
        ? path.join(appDir, 'dist')
        : path.join(appDir, 'dist');
      if (fs.existsSync(outDir)) {
        copyDir(outDir, path.join(dist, app));
      }
    } catch (e) {
      console.warn(`Warning: ${app} build skipped (${e.message})`);
    }
  }
}

console.log('Build complete → dist/');
