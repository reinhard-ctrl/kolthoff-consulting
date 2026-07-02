import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const dir = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(dir, '../shared/crm-planner-sync.js'), 'utf8');
const sandbox = { window: {}, globalThis: {} };
sandbox.window = sandbox;
vm.runInNewContext(code, sandbox);

const { findLinkedProfile } = sandbox.CrmPlannerSync;
const profiles = [
  { id: 'p1', quoteId: 'KC-2026-ABC', links: {} },
  { id: 'p2', quoteId: 'OTHER', links: { crmDealId: 'deal-99' } },
];

if (findLinkedProfile(profiles, 'KC-2026-ABC')?.id !== 'p1') throw new Error('quoteId link failed');
if (findLinkedProfile(profiles, 'deal-99')?.id !== 'p2') throw new Error('crmDealId link failed');
if (findLinkedProfile(profiles, 'missing') !== null) throw new Error('expected null for missing deal');

console.log('crm-planner-sync.test.mjs: all assertions passed');
