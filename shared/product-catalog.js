/**
 * Kolthoff Product (PRO) catalog — subscription software SKUs (separate from MOD services).
 * Consumed by engagement-packages, planner, and Kolthoff OS CRM tagging.
 */
(function (global) {
  const PRODUCTS = [
    {
      id: 'pro1',
      key: 'PRO 1',
      category: 'PRO 1 - Agency Ops Platform',
      title: 'Agency Ops',
      shortTitle: 'Agency Ops',
      description: 'White-label quote-to-cash for creative and digital agencies — CRM, estimates, and invoicing.',
      phase: 'Product: Quote-to-Cash Platform',
      portalPhase: 'PRO 1: Agency Ops Platform',
      skuLabel: 'PRO 1 · Agency Ops',
      defaultMilestoneSplit: '50-50',
      subscriptionMonths: 12,
    },
    {
      id: 'pro2',
      key: 'PRO 2',
      category: 'PRO 2 - Core Workspace Platform',
      title: 'Core Workspace',
      shortTitle: 'Core Workspace',
      description: 'Team workspace with digital forms, approvals, and shared folders for general SMB ops.',
      phase: 'Product: Team Workspace Platform',
      portalPhase: 'PRO 2: Core Workspace Platform',
      skuLabel: 'PRO 2 · Core Workspace',
      defaultMilestoneSplit: '50-50',
      subscriptionMonths: 12,
      status: 'planned',
    },
  ];

  const CATEGORY_TO_PRODUCT = Object.fromEntries(PRODUCTS.map((p) => [p.category, p.id]));

  const LEGACY_PRO_ALIASES = {
    'PRO 1 - Agency Ops': 'pro1',
    'PRO 2 - Core Workspace': 'pro2',
  };
  Object.assign(CATEGORY_TO_PRODUCT, LEGACY_PRO_ALIASES);

  function getProductById(id) {
    return PRODUCTS.find((p) => p.id === id) || null;
  }

  function getProductByCategory(category) {
    if (!category) return undefined;
    const id = CATEGORY_TO_PRODUCT[category];
    if (id) return getProductById(id);
    return PRODUCTS.find((p) => category.startsWith(p.key));
  }

  function isProCategory(categoryOrTask, productId) {
    const cat = typeof categoryOrTask === 'object'
      ? (categoryOrTask.category || categoryOrTask.moduleKey)
      : categoryOrTask;
    if (typeof cat === 'string' && cat.startsWith('PRO ')) {
      if (!productId) return true;
      const p = getProductByCategory(cat);
      return p?.id === productId;
    }
    if (typeof cat === 'string' && /^pro[12]$/.test(cat)) {
      return !productId || cat === productId;
    }
    return false;
  }

  function getActiveProducts() {
    return PRODUCTS.filter((p) => p.status !== 'planned');
  }

  global.ProductCatalog = {
    PRODUCTS,
    CATEGORY_TO_PRODUCT,
    getProductById,
    getProductByCategory,
    isProCategory,
    getActiveProducts,
  };
})(typeof window !== 'undefined' ? window : globalThis);
