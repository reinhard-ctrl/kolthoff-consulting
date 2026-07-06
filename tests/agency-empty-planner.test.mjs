/**
 * Agency Ops planner should start empty and skip Engagement Packages.
 * Run: node tests/agency-empty-planner.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const plannerHtml = readFileSync(join(root, 'apps/delivery/project_planner.html'), 'utf8');

assert.match(plannerHtml, /useState\(STARTER_UI \? \[\] : DEFAULT_CLIENTS\)/);
assert.match(plannerHtml, /!window\.KOLTHOFF_DISABLE_CLIENT_SEED && !STARTER_UI/);
assert.match(plannerHtml, /setView\(STARTER_UI \? 'sandbox' : 'packages'\)/);
assert.match(plannerHtml, /view === 'packages' && !STARTER_UI/);
assert.match(plannerHtml, /buildNewAgencyWorkspace/);
assert.match(plannerHtml, /EMPTY_AGENCY_WORKSPACE_STUB/);

console.log('agency-empty-planner.test.mjs: ok');
