import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTS,
  getProductId,
  getTenantId,
  getProductConfig,
  isStarterMode,
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

  it('planner tab labels rename sandbox to Estimate in starter mode', () => {
    const labels = getPlannerTabLabels();
    assert.equal(labels.sandbox, 'Estimate');
  });
});
