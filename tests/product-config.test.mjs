import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTS,
  AGENCY_MOD_LABELS,
  getProductId,
  getTenantId,
  getProductConfig,
  isStarterMode,
  getModLabels,
  getModLabel,
  getPlannerTabLabels,
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

  it('agency-ops-starter uses agency-friendly MOD phase labels', () => {
    assert.equal(AGENCY_MOD_LABELS.mod1.chip, 'Discovery');
    assert.equal(AGENCY_MOD_LABELS.mod2.title, 'Process Design');
    assert.equal(AGENCY_MOD_LABELS.mod3.chip, 'Implementation');
    assert.equal(AGENCY_MOD_LABELS.mod4.title, 'Ongoing Support');
    assert.equal(getModLabel('mod1', 'chip'), 'MOD 1 · Leak Scan');
    globalThis.__PRODUCT_ID__ = 'agency-ops-starter';
    assert.equal(getModLabel('mod2', 'chip'), 'Process Design');
    delete globalThis.__PRODUCT_ID__;
  });

  it('planner tab labels rename sandbox to Estimate in starter mode', () => {
    const labels = getPlannerTabLabels();
    assert.equal(labels.sandbox, 'Estimate');
  });
});
