import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTS,
  getProductId,
  getTenantId,
  getProductConfig,
  isStarterMode,
  getPlannerTabLabels,
  getModLabels,
  getModTitle,
  getModCategory,
  getModChipLabel,
  AGENCY_MOD_LABELS,
  KOLTHOFF_MOD_LABELS,
} from '../shared/product-config.js';

describe('product-config', () => {
  it('defaults to kolthoff-os tenant', () => {
    assert.equal(getTenantId(), 'kolthoff-admin-app');
    assert.equal(getProductConfig().id, 'kolthoff-os');
    assert.equal(isStarterMode(), false);
  });

  it('agency-ops-starter has slim planner tabs', () => {
    const cfg = PRODUCTS['agency-ops-starter'];
    assert.deepEqual(cfg.plannerTabs, ['sandbox', 'package', 'invoice']);
    assert.equal(cfg.tenantId, 'agency-ops-demo');
    assert.equal(cfg.starterMode, true);
  });

  it('agency-ops-starter uses friendly module labels', () => {
    const cfg = PRODUCTS['agency-ops-starter'];
    assert.equal(cfg.moduleLabels.sales, 'Sales');
    assert.equal(cfg.moduleLabels.quotes, 'Quotes');
    assert.equal(cfg.moduleLabels.invoicing, 'Invoicing');
    assert.equal(cfg.plannerSubtitle, 'Quotes');
    assert.equal(cfg.crmBadge, 'Sales');
  });

  it('planner tab labels rename sandbox to Estimate in starter mode', () => {
    const labels = getPlannerTabLabels();
    assert.equal(labels.sandbox, 'Estimate');
  });

  it('agency mod labels use agency-friendly titles', () => {
    assert.equal(AGENCY_MOD_LABELS.mod1.title, 'Discovery & Audit');
    assert.equal(AGENCY_MOD_LABELS.mod2.title, 'Process Design');
    assert.equal(AGENCY_MOD_LABELS.mod3.title, 'Build & Implementation');
    assert.equal(AGENCY_MOD_LABELS.mod4.title, 'Ongoing Support');
  });

  it('kolthoff mod labels keep legacy titles', () => {
    assert.equal(KOLTHOFF_MOD_LABELS.mod1.title, 'Business Leak Scan');
    assert.equal(KOLTHOFF_MOD_LABELS.mod4.title, 'Care Plan');
  });
});
