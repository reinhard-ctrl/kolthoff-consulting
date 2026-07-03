/**
 * Planner profile save must preserve Policy Studio and sibling app slices.
 * Run: node tests/planner-preserved-slices.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadPlannerHelpers() {
  const engagementCode = readFileSync(join(root, 'shared/engagement-config.js'), 'utf8');
  const packagesCode = readFileSync(join(root, 'shared/engagement-packages.js'), 'utf8');
  const addendumCode = readFileSync(join(root, 'shared/engagement-addendum-templates.js'), 'utf8');
  const helpersCode = readFileSync(join(root, 'apps/delivery/project_planner_helpers.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(engagementCode, sandbox);
  vm.runInNewContext(packagesCode, sandbox);
  vm.runInNewContext(addendumCode, sandbox);
  vm.runInNewContext(helpersCode, sandbox);
  return sandbox.window.PlannerHelpers;
}

const H = loadPlannerHelpers();

const preservedProfile = {
  branding: { primaryColor: '#112233', logoUrl: 'https://example.com/logo.png' },
  sponsorTitle: 'Managing Director',
  policySignatoryName: 'Jane Doe',
  policySignatoryTitle: 'CEO',
  orgChart: { members: [{ id: '1', name: 'Jane Doe' }] },
  subSaaS: [{ id: 'crm', name: 'CRM' }],
  synthesis: { summary: 'test' },
};

const plannerState = {
  clientCompany: 'Acme Corp',
  clientRep: 'John Smith',
  clientAddress: '',
  clientTin: '',
  quoteId: 'Q-001',
  quoteDate: '2026-01-01',
  quoteValidity: '30 days',
  includeTax: true,
  preparerTitle: 'Strategist',
  targetStartDate: '2026-02-01',
  proposalObjectives: 'Improve ops',
  proposalSponsor: 'John Smith',
  preDiagnosticList: '',
  frictionBuffer: 10,
  principalToSeniorDelegate: 20,
  seniorToAssociateDelegate: 40,
  overrideTimeline: '',
  weeklyHours: 16,
  clientReviewWeeks: 1,
  tasks: [],
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
  ndaTerm: '5 (Five) Years',
  ndaJurisdiction: 'Philippines',
  invoiceMilestone: 'full',
  retainerBillingPeriod: '',
  customInvoiceAmount: 100000,
  invoiceNumberSuffix: '01',
  invoiceDueDate: '',
  useCustomInvoiceBillTo: false,
  invoiceBillToCompany: '',
  invoiceBillToRep: '',
  invoiceBillToAddress: '',
  invoiceBillToTin: '',
  staffCount: 15,
  monthlySalary: 25000,
  wastedHours: 2,
  principalRate: 5000,
  seniorRate: 3500,
  associateRate: 2500,
  partnerRate: 6000,
  selectedPackageId: 'leak-scan',
  packageCustomized: false,
  packageAppliedAt: null,
};

const payload = H.buildProfilePayload('client-1', 'Acme Workspace', plannerState, 1125000, preservedProfile);

assert.deepEqual(payload.branding, preservedProfile.branding);
assert.equal(payload.sponsorTitle, 'Managing Director');
assert.equal(payload.policySignatoryName, 'Jane Doe');
assert.equal(payload.orgChart.members[0].name, 'Jane Doe');
assert.equal(payload.clientCompany, 'Acme Corp');

const withoutPreserved = H.buildProfilePayload('client-1', 'Acme Workspace', plannerState, 1125000);
assert.equal(withoutPreserved.branding, undefined);

const picked = H.pickPreservedProfileSlices(preservedProfile);
assert.equal(Object.keys(picked).length, H.PRESERVED_PROFILE_SLICE_KEYS.filter((k) => preservedProfile[k] !== undefined).length);

const addendumRecord = H.createAddendumRecord({
  parentQuoteId: 'KC-2026-APARRI',
  addenda: [],
  templateId: 'training-day',
  catalogTasks: [{ id: 'm3-05', deliverable: 'Training', category: 'MOD 3', selected: false, estHours: 8, tier: 'senior' }],
  quoteDate: '2026-07-01',
});
assert.equal(addendumRecord.suffix, 'A1');
assert.equal(addendumRecord.ref, 'KC-2026-APARRI-A1');
assert.equal(addendumRecord.templateId, 'training-day');
assert.ok(addendumRecord.tasks.find((t) => t.id === 'm3-05')?.selected);

const secondAddendum = H.createAddendumRecord({
  parentQuoteId: 'KC-2026-APARRI',
  addenda: [addendumRecord],
  templateId: 'custom',
  catalogTasks: [],
});
assert.equal(secondAddendum.suffix, 'A2');

const payloadWithAddenda = H.buildProfilePayload('client-1', 'Acme Workspace', {
  ...plannerState,
  addenda: [addendumRecord],
  activeAddendumId: addendumRecord.id,
}, 1125000, preservedProfile);
assert.equal(payloadWithAddenda.addenda.length, 1);
assert.equal(payloadWithAddenda.activeAddendumId, addendumRecord.id);
assert.equal(payloadWithAddenda.branding.primaryColor, '#112233');

const afterDelete = H.removeAddendumFromList([addendumRecord, secondAddendum], addendumRecord.id);
assert.equal(afterDelete.length, 1);
assert.equal(afterDelete[0].suffix, 'A2');

const addendumValidation = H.validatePrintReadiness('addendum', {
  clientCompany: 'Acme Corp',
  clientRep: 'John Smith',
  activeAddendum: addendumRecord,
  issueInvoice: true,
  invoiceDueDate: '',
});
assert.equal(addendumValidation.ok, false);
assert.ok(addendumValidation.issues.some((i) => i.includes('due date')));

console.log('planner-preserved-slices.test.mjs passed');
