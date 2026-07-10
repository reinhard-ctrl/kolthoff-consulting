/**
 * Client and sponsor party resolution tests.
 * Run: node tests/sponsor-party.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'apps/delivery/project_planner_helpers.js'), 'utf8');
const win = { window: {} };
vm.runInNewContext(code, win);
const { resolveClientParty, resolveSponsorParty } = win.window.PlannerHelpers;

const client = {
  clientCompany: 'Client Corp.',
  clientRep: 'Jane Client',
  clientAddress: '123 Client St',
  clientTin: '111-111-111-111',
};

const resolvedClient = resolveClientParty(client);
assert.equal(resolvedClient.company, 'Client Corp.');
assert.equal(resolvedClient.rep, 'Jane Client');

const defaultSponsor = resolveSponsorParty({ ...client, useCustomSponsor: false });
assert.equal(defaultSponsor.company, 'Client Corp.');
assert.equal(defaultSponsor.rep, 'Jane Client');

const customSponsor = resolveSponsorParty({
  ...client,
  useCustomSponsor: true,
  sponsorCompany: 'Sponsor Inc.',
  sponsorRep: 'John Sponsor',
  sponsorAddress: '456 Sponsor Ave',
  sponsorTin: '222-222-222-222',
});
assert.equal(customSponsor.company, 'Sponsor Inc.');
assert.equal(customSponsor.rep, 'John Sponsor');
assert.equal(customSponsor.address, '456 Sponsor Ave');
assert.equal(customSponsor.tin, '222-222-222-222');

const sponsorContract = win.window.PlannerHelpers.resolveContractParty({
  ...client,
  contractPartySource: 'sponsor',
  useCustomSponsor: true,
  sponsorCompany: 'Sponsor Inc.',
  sponsorRep: 'John Sponsor',
  sponsorAddress: '456 Sponsor Ave',
  sponsorTin: '222-222-222-222',
});
assert.equal(sponsorContract.company, 'Sponsor Inc.');

const clientContract = win.window.PlannerHelpers.resolveContractParty({
  ...client,
  contractPartySource: 'client',
  useCustomSponsor: true,
  sponsorCompany: 'Sponsor Inc.',
});
assert.equal(clientContract.company, 'Client Corp.');

console.log('sponsor-party.test.mjs: all assertions passed');
