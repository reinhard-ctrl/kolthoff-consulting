#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'dist-agency-ops', 'assets');
const mainJs = readdirSync(assetsDir).find((name) => /^main-.*\.js$/.test(name));

if (!mainJs) {
  console.error('verify-agency-ops-bundle: main-*.js not found in dist-agency-ops/assets');
  process.exit(1);
}

const source = readFileSync(join(assetsDir, mainJs), 'utf8');
if (/\]=useState\(|\(\)=useState\(|[^.$]useState\(/.test(source)) {
  console.error(`verify-agency-ops-bundle: bare useState found in ${mainJs}`);
  process.exit(1);
}

console.log(`verify-agency-ops-bundle: OK (${mainJs})`);
