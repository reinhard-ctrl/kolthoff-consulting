/**
 * Mod gating helper tests — mirrors shared/mod-gating.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'shared/mod-gating.js'), 'utf8');
const sessionStore = {};
const sandbox = {
  sessionStorage: {
    getItem: (k) => sessionStore[k] ?? null,
    setItem: (k, v) => { sessionStore[k] = String(v); },
    removeItem: (k) => { delete sessionStore[k]; },
  },
};
sandbox.window = sandbox;
vm.runInNewContext(code, sandbox);
const MG = sandbox.window.ModGating;

assert.equal(MG.isMod1Complete({ mod1Status: 'complete' }), true);
assert.equal(MG.isMod1Complete({ mod1DeliveredAt: '2026-07-07' }), true);
assert.equal(MG.isMod1Complete({}), false);

assert.equal(MG.normalizePortalRoadmapStatus('Complete'), 'completed');
assert.equal(MG.normalizePortalRoadmapStatus('In Progress'), 'active');
assert.equal(MG.normalizePortalRoadmapStatus('Pending'), 'pending');

assert.equal(MG.isMod2Phase('MOD 2: How Your Business Runs'), true);
assert.equal(MG.isMod2Phase('MOD 1: Business Leak Scan'), false);

assert.equal(MG.isMod2Locked({}, { standalone: true }), false);
assert.equal(MG.isMod2Locked({ mod1Status: 'complete' }, {}), false);
assert.equal(MG.isMod2Locked({}, { profileId: 'p1' }), true);
MG.setAdminMod2Unlock('p1', true);
assert.equal(MG.hasAdminMod2Unlock('p1'), true);
assert.equal(MG.isMod2Locked({}, { profileId: 'p1', adminUnlock: true }), false);
MG.setAdminMod2Unlock('p1', false);

console.log('mod-gating.test.mjs: all assertions passed');
