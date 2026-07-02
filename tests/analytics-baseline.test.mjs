import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const dir = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(dir, '../shared/analytics-baseline.js'), 'utf8');
const sandbox = { window: {}, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);

const { profileTotalHours, aggregatePlannerBaselines } = sandbox.AnalyticsBaseline;

const profile = {
  _meta: { totalHours: 40 },
  tasks: [{ selected: true, estHours: 10, category: 'MOD 1 - Business Leak Scan' }],
};

if (profileTotalHours(profile) !== 40) throw new Error('should prefer _meta.totalHours');

const noMeta = {
  tasks: [
    { selected: true, estHours: 5, category: 'MOD 2 - How Your Business Runs' },
    { selected: false, estHours: 100, category: 'MOD 1' },
  ],
};
if (profileTotalHours(noMeta) !== 5) throw new Error('should sum selected tasks only');

const agg = aggregatePlannerBaselines([profile, noMeta]);
if (agg.totalHours !== 45) throw new Error(`expected 45 total hours, got ${agg.totalHours}`);
if (agg.activeSows !== 2) throw new Error('expected 2 active SOWs');

console.log('analytics-baseline.test.mjs: all assertions passed');
