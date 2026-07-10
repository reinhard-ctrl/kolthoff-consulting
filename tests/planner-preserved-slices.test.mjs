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
  subscriptionMonths: 6,
  printSow: true,
  printTimeline: true,
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
  invoicePartySource: 'client',
  useCustomSponsor: false,
  sponsorCompany: '',
  sponsorRep: '',
  sponsorAddress: '',
  contractPartySource: 'client',
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
addendumRecord.id = 'addendum-test-a1';
assert.equal(addendumRecord.suffix, 'A1');
assert.equal(addendumRecord.ref, 'KC-2026-APARRI-A1');
assert.equal(addendumRecord.templateId, 'training-day');
assert.equal(addendumRecord.partySource, 'client');
assert.ok(addendumRecord.tasks.find((t) => t.id === 'm3-05')?.selected);

const hrCoachingAddendum = H.createAddendumRecord({
  parentQuoteId: 'KC-2026-APARRI',
  addenda: [],
  templateId: 'hr-coaching-package',
  catalogTasks: [
    { id: 'addon-hr-01', deliverable: 'HR Manager Coaching Sessions', category: 'ADD-ON - HR Coaching', selected: false, estHours: 8, tier: 'senior' },
    { id: 'addon-hr-02', deliverable: 'Performance Conversation Toolkit', category: 'ADD-ON - HR Coaching', selected: false, estHours: 4, tier: 'associate' },
    { id: 'addon-hr-03', deliverable: 'Quarterly HR Operating Rhythm', category: 'ADD-ON - HR Coaching', selected: false, estHours: 2, tier: 'associate' },
  ],
});
assert.equal(hrCoachingAddendum.templateId, 'hr-coaching-package');
assert.equal(hrCoachingAddendum.title, 'HR Coaching Package');
assert.ok(hrCoachingAddendum.tasks.filter((t) => t.selected).length === 3);

const secondAddendum = H.createAddendumRecord({
  parentQuoteId: 'KC-2026-APARRI',
  addenda: [addendumRecord],
  templateId: 'custom',
  catalogTasks: [],
});
secondAddendum.id = 'addendum-test-a2';
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

assert.equal(H.canDeleteAddendum({ status: 'draft' }), true);
assert.equal(H.canDeleteAddendum({ status: 'issued' }), true);
assert.equal(H.canDeleteAddendum({ status: 'invoiced' }), false);

const sponsorDefaultAddendum = H.createAddendumRecord({
  parentQuoteId: 'KC-2026-APARRI',
  addenda: [],
  templateId: 'custom',
  catalogTasks: [],
  defaultPartySource: 'sponsor',
});
assert.equal(sponsorDefaultAddendum.partySource, 'sponsor');

const addendumValidation = H.validatePrintReadiness('addendum', {
  clientCompany: 'Acme Corp',
  clientRep: 'John Smith',
  activeAddendum: addendumRecord,
  issueInvoice: true,
  invoiceDueDate: '',
});
assert.equal(addendumValidation.ok, false);
assert.ok(addendumValidation.issues.some((i) => i.includes('due date')));

const payloadWithInvoiceAddendum = H.buildProfilePayload('client-1', 'Acme Workspace', {
  ...plannerState,
  addenda: [addendumRecord],
  activeAddendumId: addendumRecord.id,
  invoiceAddendumId: addendumRecord.id,
}, 1125000, preservedProfile);
assert.equal(payloadWithInvoiceAddendum.invoiceAddendumId, addendumRecord.id);

const addendumInvoiceValidation = H.validatePrintReadiness('invoice', {
  clientCompany: 'Acme Corp',
  clientRep: 'John Smith',
  clientAddress: '123 Main',
  clientTin: '123-456-789-000',
  invoiceTargetAddendum: addendumRecord,
  issueInvoice: true,
  invoiceDueDate: '',
  validateTIN: () => true,
  tasks: [],
});
assert.equal(addendumInvoiceValidation.ok, false);
assert.ok(addendumInvoiceValidation.issues.some((i) => i.includes('due date')));

const sparseState = { ...plannerState, targetStartDate: undefined, proposalObjectives: undefined };
const sparsePayload = H.buildProfilePayload('ao-brandco-web', 'Brand Co Web', sparseState, 1125000);
assert.equal(sparsePayload.targetStartDate, '');
assert.equal(sparsePayload.proposalObjectives, '');
assert.equal('targetStartDate' in sparsePayload, true);
assert.equal(Object.values(sparsePayload).includes(undefined), false);

const deluxe = H.computeAgencyLineItemPricing({
  lineQty: 6,
  lineDuration: 4,
  lineUnitPrice: 1800,
  lineMarkUp: 33.33333333333333,
});
assert.equal(deluxe.basePrice, 43200);
assert.equal(deluxe.grossProfit, 14400);
assert.equal(deluxe.estimateCost, 57600);
assert.equal(deluxe.gpMargin, 25);

console.log('planner-preserved-slices.test.mjs passed');
