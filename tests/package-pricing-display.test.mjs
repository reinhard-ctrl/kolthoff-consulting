/**
 * Package card pricing — must include System Health Check (m4-03) when selected.
 * Run: node tests/package-pricing-display.test.mjs
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

const MOD_4 = 'MOD 4 - Care Plan';
const catalog = [
  { id: 'm1-01', category: 'MOD 1 - Business Leak Scan', estHours: 2, tier: 'associate', selected: false },
  { id: 'm1-02', category: 'MOD 1 - Business Leak Scan', estHours: 1, tier: 'associate', selected: false },
  { id: 'm1-03', category: 'MOD 1 - Business Leak Scan', estHours: 5, tier: 'senior', selected: false },
  { id: 'm1-04', category: 'MOD 1 - Business Leak Scan', estHours: 2, tier: 'associate', selected: false },
  { id: 'm1-05', category: 'MOD 1 - Business Leak Scan', estHours: 3, tier: 'senior', selected: false },
  { id: 'm1-06', category: 'MOD 1 - Business Leak Scan', estHours: 2, tier: 'principal', selected: false },
  { id: 'm2-01', category: 'MOD 2 - How Your Business Runs', estHours: 6, tier: 'senior', selected: false },
  { id: 'm2-02', category: 'MOD 2 - How Your Business Runs', estHours: 6, tier: 'senior', selected: false },
  { id: 'm2-03', category: 'MOD 2 - How Your Business Runs', estHours: 6, tier: 'senior', selected: false },
  { id: 'm2-04', category: 'MOD 2 - How Your Business Runs', estHours: 6, tier: 'associate', selected: false },
  { id: 'm2-05', category: 'MOD 2 - How Your Business Runs', estHours: 8, tier: 'associate', selected: false },
  { id: 'm3-01', category: 'MOD 3 - Your Team Workspace', estHours: 6, tier: 'senior', selected: false },
  { id: 'm3-01b', category: 'MOD 3 - Your Team Workspace', estHours: 4, tier: 'associate', selected: false },
  { id: 'm3-02', category: 'MOD 3 - Your Team Workspace', estHours: 18, tier: 'associate', selected: false },
  { id: 'm3-03', category: 'MOD 3 - Your Team Workspace', estHours: 12, tier: 'associate', selected: false },
  { id: 'm3-04', category: 'MOD 3 - Your Team Workspace', estHours: 6, tier: 'senior', selected: false },
  { id: 'm3-05', category: 'MOD 3 - Your Team Workspace', estHours: 4, tier: 'associate', selected: false },
  { id: 'm4-01', category: MOD_4, estHours: 4, tier: 'partner', selected: false, isMonthlyRetainer: true },
  { id: 'm4-02', category: MOD_4, estHours: 4, tier: 'senior', selected: false, isMonthlyRetainer: true },
  { id: 'm4-03', category: MOD_4, estHours: 6, tier: 'senior', selected: false },
];

const rates = { principalRate: 3500, seniorRate: 2500, associateRate: 1500, partnerRate: 2000 };
const formatCurrency = (v) => `₱${v.toLocaleString('en-PH')}`;

function economicsForPackage(packageId) {
  const pkg = EP.getPackageById(packageId);
  const defs = pkg?.defaults || {};
  const previewTasks = H.previewPackageSelection(packageId, catalog, catalog);
  return H.computeProjectEconomics({
    tasks: previewTasks,
    frictionBuffer: defs.frictionBuffer ?? 10,
    discountPercent: defs.discountPercent ?? 0,
    includeTax: false,
    subscriptionMonths: defs.subscriptionMonths ?? 6,
    milestoneSplit: 'auto',
    customSplit1: 40,
    customSplit2: 40,
    customSplit3: 20,
    rates,
    principalToSeniorDelegate: 20,
    seniorToAssociateDelegate: 40,
    recoveryPotential: 0,
    staffCount: 15,
    monthlySalary: 25000,
    wastedHours: 2,
    formatCurrency,
  });
}

function sowSubtotal(econ) {
  return econ.finalProjectCostBase + econ.retainerCostTotalBase;
}

function auditCost(econ) {
  const row = econ.moduleInvestmentSummaries.find((r) => r.modNum === '4a');
  return row?.afterDiscount || 0;
}

// Care Plan — monthly retainer only
const carePlan = economicsForPackage('care-plan');
assert.equal(H.formatPackagePriceLabel(carePlan, formatCurrency), `${formatCurrency(carePlan.retainerCostBase)}/mo`);

// Care Plan + Health Check — retainer + audit (matches SOW subtotal)
const carePlus = economicsForPackage('care-plan-plus-audit');
assert.ok(H.previewPackageSelection('care-plan-plus-audit', catalog, catalog).find((t) => t.id === 'm4-03')?.selected);
const careAudit = auditCost(carePlus);
assert.ok(careAudit > 0);
const careLabel = H.formatPackagePriceLabel(carePlus, formatCurrency);
assert.equal(careLabel, formatCurrency(sowSubtotal(carePlus)));
assert.equal(sowSubtotal(carePlus), carePlus.retainerCostTotalBase + careAudit);

// Full Stack + Care — full subtotal includes health check + retainer
const fullStack = economicsForPackage('full-stack-care');
assert.ok(H.previewPackageSelection('full-stack-care', catalog, catalog).find((t) => t.id === 'm4-03')?.selected);
const fullLabel = H.formatPackagePriceLabel(fullStack, formatCurrency);
assert.equal(fullLabel, formatCurrency(sowSubtotal(fullStack)));
assert.ok(auditCost(fullStack) > 0);
assert.ok(fullStack.retainerCostTotalBase > 0);

// Leak Scan — SME entry pricing (13h MOD 1, 9% friction buffer → ₱29,975)
const leakScan = economicsForPackage('leak-scan');
assert.equal(leakScan.finalProjectCostBase, 29975);
assert.equal(H.formatPackagePriceLabel(leakScan, formatCurrency), formatCurrency(leakScan.finalProjectCostBase));

console.log('package-pricing-display.test.mjs: all assertions passed');
