/**
 * Communication Plan policy helpers.
 * Run: node tests/communication-plan.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/communication-plan.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const CP = win.CommunicationPlan;
assert.ok(CP);

assert.equal(CP.DEFAULT_COMMUNICATION_PLAN.title, 'Communication Plan');
assert.ok(CP.DEFAULT_COMMUNICATION_PLAN.tiers.length >= 2);
assert.equal(CP.DEFAULT_COMMUNICATION_PLAN.tiers[0].tier, 'Tier 1');
assert.match(CP.DEFAULT_COMMUNICATION_PLAN.tiers[0].name, /Strategy-to-Execution/);
assert.match(CP.DEFAULT_COMMUNICATION_PLAN.tiers[0].cadence, /Bi-Weekly/i);
assert.match(CP.DEFAULT_COMMUNICATION_PLAN.tiers[0].duration, /45/);
assert.equal(CP.DEFAULT_COMMUNICATION_PLAN.tiers[1].tier, 'Tier 2');
assert.match(CP.DEFAULT_COMMUNICATION_PLAN.tiers[1].name, /Operational Sync/);
assert.ok(CP.DEFAULT_COMMUNICATION_PLAN.channels.length >= 2);

const tier = CP.createEmptyTier({ tier: 'Tier 4', name: 'Client QBRs', cadence: 'Quarterly' });
assert.equal(tier.tier, 'Tier 4');
assert.equal(tier.name, 'Client QBRs');
assert.equal(tier.purpose, '');

const channel = CP.createEmptyChannel({ tool: 'Notion', purpose: 'Wiki' });
assert.equal(channel.tool, 'Notion');
assert.equal(channel.audience, '');

const merged = CP.mergeCommunicationPlan(CP.DEFAULT_COMMUNICATION_PLAN, {
  title: 'Custom Comm Plan',
  tiers: [{ id: 't1', tier: 'Tier 1', name: 'Leadership Sync', cadence: 'Monthly', duration: '60 mins' }],
});
assert.equal(merged.title, 'Custom Comm Plan');
assert.equal(merged.tiers.length, 1);
assert.equal(merged.tiers[0].name, 'Leadership Sync');
// channels default when omitted
assert.ok(merged.channels.length >= 2);

const fromEmpty = CP.mergeCommunicationPlan(CP.DEFAULT_COMMUNICATION_PLAN, {});
assert.ok(fromEmpty.tiers.length >= 2);
assert.ok(fromEmpty.channels.length >= 2);

const md = CP.compileCommunicationPlanMarkdown(merged);
assert.match(md, /^# Custom Comm Plan/m);
assert.match(md, /## 1\. Meeting Cadence Tiers/);
assert.match(md, /Leadership Sync/);
assert.match(md, /## 2\. Tools & Channels/);
assert.match(md, /Google Meet|Slack|Email/);

console.log('communication-plan.test.mjs: all assertions passed');
