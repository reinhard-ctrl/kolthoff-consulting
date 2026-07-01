/**
 * Engagement config tests — shared MOD names, chaos tax, links.
 * Run: node tests/engagement-config.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEngagementConfig() {
  const code = readFileSync(join(root, 'shared/engagement-config.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.EngagementConfig;
}

const EC = loadEngagementConfig();

assert.equal(EC.SCHEMA_VERSION, 2);
assert.equal(EC.MODULES.length, 4);
assert.equal(EC.MOD_CATEGORIES.mod1, 'MOD 1 - Business Leak Scan');
assert.equal(EC.CATEGORY_TO_PRESET['MOD 1 - Workflow Diagnosis'], 'mod1');
assert.equal(EC.getModuleByCategory('MOD 2 - How Your Business Runs')?.id, 'mod2');

const chaos = EC.computePlannerChaosTax(15, 25000, 2);
assert.equal(chaos, 1125000);

const resolved = EC.resolveChaosTax({
  chaosTax: { source: 'diagnosis', value: 900000, inputs: {} },
  annualOperationalLeakage: 1125000,
});
assert.equal(resolved.source, 'diagnosis');
assert.equal(resolved.value, 900000);

const legacy = EC.resolveChaosTax({ annualOperationalLeakage: 500000 });
assert.equal(legacy.value, 500000);

assert.equal(EC.getClientDisplayName({ clientCompany: 'Acme' }), 'Acme');
assert.equal(EC.getClientDisplayName({ clientName: 'Legacy Co' }), 'Legacy Co');

const links = EC.buildProfileLinks({ id: 'p1', quoteId: 'deal-99' });
assert.equal(links.crmDealId, 'deal-99');
assert.equal(links.contractId, 'contract-p1');

const roadmap = EC.buildDefaultPortalRoadmap();
assert.equal(roadmap.length, 4);
assert.equal(roadmap[0].phase, 'MOD 1: Business Leak Scan');
assert.equal(roadmap[0].status, 'In Progress');

// Planner payload integration (helpers expect EngagementConfig on window)
const helpersCode = readFileSync(join(root, 'apps/delivery/project_planner_helpers.js'), 'utf8');
const win = { EngagementConfig: EC };
vm.runInNewContext(helpersCode, { window: win });
const H = win.PlannerHelpers;
assert.ok(H, 'PlannerHelpers should load');

const payload = H.buildProfilePayload('test-id', 'Workspace', {
  clientCompany: 'Test Co',
  clientRep: 'Rep',
  clientAddress: '',
  clientTin: '',
  quoteId: 'deal-abc',
  quoteDate: '2026-01-01',
  quoteValidity: '30',
  includeTax: false,
  preparerTitle: '',
  targetStartDate: '',
  proposalObjectives: '',
  proposalSponsor: '',
  preDiagnosticList: '',
  frictionBuffer: 10,
  principalToSeniorDelegate: 20,
  seniorToAssociateDelegate: 40,
  overrideTimeline: '',
  weeklyHours: 16,
  clientReviewWeeks: 1,
  tasks: [],
  discountPercent: 0,
  applyCreditBack: false,
  creditBackDays: 14,
  dpaRetentionDays: 14,
  slaCureDays: 30,
  slaRecurrenceMonths: 3,
  subscriptionMonths: 6,
  printSow: true,
  printTimeline: true,
  printSla: true,
  printQuote: true,
  printCover: false,
  printRoadmapGantt: true,
  printRoadmapTable: true,
  printRoadmapScale: true,
  milestoneSplit: 'auto',
  customSplit1: 40,
  customSplit2: 40,
  customSplit3: 20,
  ndaEffectiveDate: '',
  ndaPurpose: '',
  ndaTerm: '',
  ndaJurisdiction: '',
  invoiceMilestone: '',
  customInvoiceAmount: 0,
  invoiceNumberSuffix: '',
  invoiceDueDate: '',
  staffCount: 10,
  monthlySalary: 20000,
  wastedHours: 2,
  principalRate: 3500,
  seniorRate: 2500,
  associateRate: 1500,
  partnerRate: 2000,
}, 800000);

assert.equal(payload._meta.schemaVersion, 2);
assert.equal(payload.chaosTax.source, 'planner');
assert.equal(payload.chaosTax.value, 800000);
assert.equal(payload.links.crmDealId, 'deal-abc');
assert.equal(payload.clientCompany, 'Test Co');

console.log('engagement-config.test.mjs: all assertions passed');
