/**
 * Engagement packages tests — applyPackageToTasks selection rules.
 * Run: node tests/engagement-packages.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadScripts() {
  const ecCode = readFileSync(join(root, 'shared/engagement-config.js'), 'utf8');
  const epCode = readFileSync(join(root, 'shared/engagement-packages.js'), 'utf8');
  const helpersCode = readFileSync(join(root, 'apps/delivery/project_planner_helpers.js'), 'utf8');
  const win = { window: {} };
  vm.runInNewContext(ecCode, win);
  vm.runInNewContext(epCode, win);
  vm.runInNewContext(helpersCode, win);
  return { EP: win.window.EngagementPackages, H: win.window.PlannerHelpers };
}

const { EP, H } = loadScripts();

const catalog = [
  { id: 'm1-01', category: 'MOD 1 - Business Leak Scan', selected: false, estHours: 3, tier: 'associate' },
  { id: 'm1-06', category: 'MOD 1 - Business Leak Scan', selected: false, estHours: 2, tier: 'principal' },
  { id: 'm2-01', category: 'MOD 2 - How Your Business Runs', selected: false, estHours: 6, tier: 'senior' },
  { id: 'm3-02', category: 'MOD 3 - Your Team Workspace', deliverable: 'Forms Pack (5)', description: 'Five forms', estHours: 18, tier: 'associate', selected: false },
  { id: 'm4-01', category: 'MOD 4 - Care Plan', selected: false, estHours: 4, tier: 'partner', isMonthlyRetainer: true },
];

assert.equal(EP.getMarketingPackages().length, 4);
assert.equal(EP.suggestPackageFromText('MOD 1+2 fix the flow'), 'fix-the-flow');

const leakScan = H.applyPackageToTasks('leak-scan', catalog, catalog);
assert.ok(leakScan.tasks.find((t) => t.id === 'm1-01')?.selected);
assert.equal(leakScan.tasks.find((t) => t.id === 'm1-06')?.selected, false);
assert.equal(leakScan.tasks.find((t) => t.id === 'm2-01')?.selected, false);
assert.equal(leakScan.activePresets.includes('mod1'), true);

const fixFlow = H.applyPackageToTasks('fix-the-flow', catalog, catalog);
assert.ok(fixFlow.tasks.find((t) => t.id === 'm2-01')?.selected);
assert.equal(fixFlow.activePresets.includes('mod2'), true);

const launchLite = H.applyPackageToTasks('launch-lite', catalog, catalog);
const liteForms = launchLite.tasks.find((t) => t.id === 'm3-02');
assert.equal(liteForms?.selected, true);
assert.equal(liteForms?.estHours, 12);
assert.match(liteForms?.deliverable || '', /up to 3/i);

const payload = H.buildProfilePayload('p1', 'Ws', {
  clientCompany: 'Co',
  clientRep: 'Rep',
  clientAddress: '',
  clientTin: '',
  quoteId: 'q1',
  quoteDate: '',
  quoteValidity: '',
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
  tasks: catalog,
  discountPercent: 0,
  dpaRetentionDays: 14,
  slaCureDays: 30,
  slaRecurrenceMonths: 3,
  subscriptionMonths: 6,
  printSow: true,
  printTimeline: true,
  printSla: true,
  printQuote: true,
  printCover: false,
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
  selectedPackageId: 'leak-scan',
  packageCustomized: false,
  packageAppliedAt: 1,
}, 500000);

assert.equal(payload.selectedPackageId, 'leak-scan');
assert.equal(payload.packageCustomized, false);

console.log('engagement-packages.test.mjs: all assertions passed');
