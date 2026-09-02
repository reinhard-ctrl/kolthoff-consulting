/**
 * Policy Studio catalog — categories, enablement, and tombstones for removed defaults.
 * Persisted on policy_documents/{profileId}.policyCatalog so deleted drafts stay gone.
 *
 * Shape: {
 *   version: 1,
 *   removedDefaults: string[],
 *   customDocs: [{ key, title, blurb, categoryId, kind }],
 *   customCategories: [{ id, title, subtitle }],
 *   categoryOrder: string[],
 *   categoryAssignments: { [docKey]: categoryId }
 * }
 */
(function (global) {
  const DEFAULT_CATEGORIES = [
    {
      id: 'operations',
      title: 'Operations',
      subtitle: 'Day-to-day delivery, resilience, and workplace safety',
    },
    {
      id: 'client-delivery',
      title: 'Client Delivery',
      subtitle: 'External promises, service levels, and communication cadence',
    },
    {
      id: 'people',
      title: 'People',
      subtitle: 'Handbook, roles, onboarding, and performance',
    },
    {
      id: 'governance',
      title: 'Governance',
      subtitle: 'Structure, decision rights, and managerial authority',
    },
    {
      id: 'compliance',
      title: 'Compliance',
      subtitle: 'Conduct, confidentiality, and data protection',
    },
  ];

  /** Built-in docs and where they live by default. */
  const DEFAULT_DOC_DEFS = [
    { key: 'sops', title: 'SOP Manuals', blurb: 'Step-by-step procedures', categoryId: 'operations', kind: 'sop-group', storage: 'sops' },
    { key: 'bcp', title: 'Business Continuity', blurb: 'Keep running during outages', categoryId: 'operations', kind: 'standard', storage: 'standardDocs' },
    { key: 'healthSafety', title: 'Health & Safety', blurb: 'Evacuation, hazards, first aid', categoryId: 'operations', kind: 'standard', storage: 'standardDocs' },
    { key: 'sla', title: 'Service Agreements (SLA)', blurb: 'Response and uptime targets', categoryId: 'client-delivery', kind: 'standard', storage: 'standardDocs' },
    { key: 'communicationPlan', title: 'Communication Plan', blurb: 'Meeting cadences and channels', categoryId: 'client-delivery', kind: 'structured', storage: 'standardDocs' },
    { key: 'handbook', title: 'Employee Handbook', blurb: 'Hours, pay, leave, discipline', categoryId: 'people', kind: 'handbook', storage: 'handbook' },
    { key: 'jobDescriptions', title: 'Job Role Profiles', blurb: 'One-page role files', categoryId: 'people', kind: 'job-group', storage: 'standardDocs' },
    { key: 'onboarding', title: 'Onboarding & 90-Day', blurb: 'New-hire path to productive', categoryId: 'people', kind: 'standard', storage: 'standardDocs' },
    { key: 'performanceReview', title: 'Performance Reviews', blurb: 'Expectations, feedback, PIP', categoryId: 'people', kind: 'standard', storage: 'standardDocs' },
    { key: 'orgChart', title: 'Org Chart Policy', blurb: 'Reporting lines and roster', categoryId: 'governance', kind: 'structured', storage: 'standardDocs' },
    { key: 'raci', title: 'RACI Policy', blurb: 'Decision matrices by topic', categoryId: 'governance', kind: 'structured', storage: 'standardDocs' },
    { key: 'managerialRoles', title: 'Manager Governance & Authority Charter', blurb: 'Decision rights and authority by role', categoryId: 'governance', kind: 'structured', storage: 'standardDocs' },
    { key: 'conduct', title: 'Code of Conduct', blurb: 'Respect, ethics, workplace rules', categoryId: 'compliance', kind: 'standard', storage: 'standardDocs' },
    { key: 'nda', title: 'Non-Disclosure (NDA)', blurb: 'Protect confidential information', categoryId: 'compliance', kind: 'standard', storage: 'standardDocs' },
    { key: 'dataPrivacy', title: 'Data Privacy & IT', blurb: 'Systems, PII, breach reporting', categoryId: 'compliance', kind: 'standard', storage: 'standardDocs' },
  ];

  const BUILTIN_KEYS = DEFAULT_DOC_DEFS.map((d) => d.key);
  const STANDARD_BODY_KEYS = DEFAULT_DOC_DEFS
    .filter((d) => d.storage === 'standardDocs' && d.kind !== 'job-group')
    .map((d) => d.key)
    .concat(['jobDescriptions']);

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function slugify(title) {
    const base = String(title || 'policy')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'policy';
    return base;
  }

  function DEFAULT_POLICY_CATALOG() {
    const categoryAssignments = {};
    DEFAULT_DOC_DEFS.forEach((d) => {
      categoryAssignments[d.key] = d.categoryId;
    });
    return {
      version: 1,
      removedDefaults: [],
      customDocs: [],
      customCategories: [],
      categoryOrder: DEFAULT_CATEGORIES.map((c) => c.id),
      categoryAssignments,
      collapsedCategories: [],
    };
  }

  function mergePolicyCatalog(defaultCatalog, loadedCatalog) {
    const base = JSON.parse(JSON.stringify(defaultCatalog || DEFAULT_POLICY_CATALOG()));
    if (!loadedCatalog || typeof loadedCatalog !== 'object') return base;

    const removedDefaults = Array.isArray(loadedCatalog.removedDefaults)
      ? loadedCatalog.removedDefaults.map(String).filter(Boolean)
      : [];
    const customDocs = Array.isArray(loadedCatalog.customDocs)
      ? loadedCatalog.customDocs
          .filter((d) => d && d.key)
          .map((d) => ({
            key: String(d.key),
            title: d.title != null ? String(d.title) : 'Custom Policy',
            blurb: d.blurb != null ? String(d.blurb) : '',
            categoryId: d.categoryId != null ? String(d.categoryId) : 'operations',
            kind: d.kind === 'chapters' ? 'chapters' : 'sections',
          }))
      : [];
    const customCategories = Array.isArray(loadedCatalog.customCategories)
      ? loadedCatalog.customCategories
          .filter((c) => c && c.id)
          .map((c) => ({
            id: String(c.id),
            title: c.title != null ? String(c.title) : 'Category',
            subtitle: c.subtitle != null ? String(c.subtitle) : '',
          }))
      : [];

    const defaultOrder = base.categoryOrder || DEFAULT_CATEGORIES.map((c) => c.id);
    let categoryOrder = Array.isArray(loadedCatalog.categoryOrder) && loadedCatalog.categoryOrder.length
      ? loadedCatalog.categoryOrder.map(String)
      : defaultOrder.slice();
    // Ensure built-in + custom category ids are present
    DEFAULT_CATEGORIES.forEach((c) => {
      if (!categoryOrder.includes(c.id) && !removedCategoryId(loadedCatalog, c.id)) {
        categoryOrder.push(c.id);
      }
    });
    customCategories.forEach((c) => {
      if (!categoryOrder.includes(c.id)) categoryOrder.push(c.id);
    });
    // Drop unknown ids that are neither default nor custom
    const knownCat = new Set([
      ...DEFAULT_CATEGORIES.map((c) => c.id),
      ...customCategories.map((c) => c.id),
      ...(Array.isArray(loadedCatalog.removedCategories) ? loadedCatalog.removedCategories.map(String) : []),
    ]);
    categoryOrder = categoryOrder.filter((id) => knownCat.has(id) || customCategories.some((c) => c.id === id));

    const categoryAssignments = {
      ...(base.categoryAssignments || {}),
      ...(loadedCatalog.categoryAssignments && typeof loadedCatalog.categoryAssignments === 'object'
        ? loadedCatalog.categoryAssignments
        : {}),
    };

    return {
      version: 1,
      removedDefaults,
      removedCategories: Array.isArray(loadedCatalog.removedCategories)
        ? loadedCatalog.removedCategories.map(String).filter(Boolean)
        : [],
      customDocs,
      customCategories,
      categoryOrder,
      categoryAssignments,
      collapsedCategories: Array.isArray(loadedCatalog.collapsedCategories)
        ? loadedCatalog.collapsedCategories.map(String)
        : [],
    };
  }

  function removedCategoryId(catalog, id) {
    return Array.isArray(catalog?.removedCategories) && catalog.removedCategories.includes(id);
  }

  function getDocDef(key) {
    return DEFAULT_DOC_DEFS.find((d) => d.key === key) || null;
  }

  function listActiveBuiltinKeys(catalog) {
    const cat = catalog || DEFAULT_POLICY_CATALOG();
    const removed = new Set(cat.removedDefaults || []);
    return BUILTIN_KEYS.filter((k) => !removed.has(k));
  }

  function listActiveStandardBodyKeys(catalog) {
    const cat = catalog || DEFAULT_POLICY_CATALOG();
    const removed = new Set(cat.removedDefaults || []);
    const custom = (cat.customDocs || []).map((d) => d.key);
    const builtinBodies = STANDARD_BODY_KEYS.filter((k) => !removed.has(k));
    return [...builtinBodies, ...custom];
  }

  function listCategories(catalog) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const removedCats = new Set(cat.removedCategories || []);
    const byId = {};
    DEFAULT_CATEGORIES.forEach((c) => {
      if (!removedCats.has(c.id)) byId[c.id] = { ...c, builtin: true };
    });
    (cat.customCategories || []).forEach((c) => {
      if (byId[c.id]) {
        byId[c.id] = {
          ...byId[c.id],
          title: c.title != null ? c.title : byId[c.id].title,
          subtitle: c.subtitle != null ? c.subtitle : byId[c.id].subtitle,
        };
      } else {
        byId[c.id] = { ...c, builtin: false };
      }
    });
    const order = (cat.categoryOrder || []).filter((id) => byId[id]);
    Object.keys(byId).forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
    return order.map((id) => byId[id]);
  }

  function resolveCategoryId(catalog, docKey) {
    const cat = catalog || DEFAULT_POLICY_CATALOG();
    if (cat.categoryAssignments && cat.categoryAssignments[docKey]) {
      return cat.categoryAssignments[docKey];
    }
    const def = getDocDef(docKey);
    if (def) return def.categoryId;
    const custom = (cat.customDocs || []).find((d) => d.key === docKey);
    return custom?.categoryId || 'operations';
  }

  /**
   * Build navigation categories + items for dashboard/sidebar.
   * `bodies` supplies live objects for blurbs/status: { handbook, sops, standardDocs }
   */
  function resolveNavModel(catalog, bodies) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const removed = new Set(cat.removedDefaults || []);
    const categories = listCategories(cat);
    const itemsByCat = {};
    categories.forEach((c) => {
      itemsByCat[c.id] = [];
    });

    const pushItem = (item) => {
      const cid = resolveCategoryId(cat, item.key);
      if (!itemsByCat[cid]) itemsByCat[cid] = [];
      itemsByCat[cid].push(item);
    };

    DEFAULT_DOC_DEFS.forEach((def) => {
      if (removed.has(def.key)) return;
      if (def.kind === 'sop-group') {
        pushItem({
          key: def.key,
          id: 'sops-group',
          kind: 'group',
          groupType: 'sops',
          title: def.title,
          blurb: def.blurb,
          categoryId: resolveCategoryId(cat, def.key),
        });
        return;
      }
      if (def.kind === 'job-group') {
        pushItem({
          key: def.key,
          id: 'roles-group',
          kind: 'group',
          groupType: 'jobs',
          title: def.title,
          blurb: def.blurb,
          categoryId: resolveCategoryId(cat, def.key),
        });
        return;
      }
      if (def.kind === 'handbook') {
        pushItem({
          key: 'handbook',
          id: 'handbook',
          kind: 'doc',
          title: def.title,
          blurb: def.blurb,
          mode: 'handbook',
          obj: bodies?.handbook,
          categoryId: resolveCategoryId(cat, 'handbook'),
        });
        return;
      }
      pushItem({
        key: def.key,
        id: def.key,
        kind: 'doc',
        title: def.title,
        blurb: def.blurb,
        mode: def.key,
        obj: bodies?.standardDocs?.[def.key],
        categoryId: resolveCategoryId(cat, def.key),
        builtin: true,
      });
    });

    (cat.customDocs || []).forEach((d) => {
      pushItem({
        key: d.key,
        id: d.key,
        kind: 'doc',
        title: d.title,
        blurb: d.blurb || 'Custom policy draft',
        mode: d.key,
        obj: bodies?.standardDocs?.[d.key],
        categoryId: resolveCategoryId(cat, d.key),
        custom: true,
        docKind: d.kind,
      });
    });

    return categories
      .map((c) => ({
        ...c,
        items: itemsByCat[c.id] || [],
        collapsed: (cat.collapsedCategories || []).includes(c.id),
      }))
      .filter((c) => c.items.length > 0 || !c.builtin); // keep empty custom categories visible for editing
  }

  function removeDefaultDoc(catalog, key) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    if (!BUILTIN_KEYS.includes(key)) return cat;
    if (!cat.removedDefaults.includes(key)) {
      cat.removedDefaults = [...cat.removedDefaults, key];
    }
    return cat;
  }

  function restoreDefaultDoc(catalog, key) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    cat.removedDefaults = (cat.removedDefaults || []).filter((k) => k !== key);
    return cat;
  }

  function removeCustomDoc(catalog, key) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    cat.customDocs = (cat.customDocs || []).filter((d) => d.key !== key);
    if (cat.categoryAssignments) delete cat.categoryAssignments[key];
    return cat;
  }

  function addCustomDoc(catalog, { title, blurb, categoryId, kind } = {}) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const base = slugify(title);
    let key = `custom-${base}`;
    let n = 2;
    const used = new Set([
      ...BUILTIN_KEYS,
      ...(cat.customDocs || []).map((d) => d.key),
    ]);
    while (used.has(key)) {
      key = `custom-${base}-${n++}`;
    }
    const doc = {
      key,
      title: title || 'New Policy Draft',
      blurb: blurb || '',
      categoryId: categoryId || (cat.categoryOrder || [])[0] || 'operations',
      kind: kind === 'chapters' ? 'chapters' : 'sections',
    };
    cat.customDocs = [...(cat.customDocs || []), doc];
    cat.categoryAssignments = { ...(cat.categoryAssignments || {}), [key]: doc.categoryId };
    return { catalog: cat, doc };
  }

  function addCategory(catalog, { title, subtitle } = {}) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const base = slugify(title);
    let id = base;
    let n = 2;
    const used = new Set([
      ...DEFAULT_CATEGORIES.map((c) => c.id),
      ...(cat.customCategories || []).map((c) => c.id),
      ...(cat.removedCategories || []),
    ]);
    while (used.has(id)) id = `${base}-${n++}`;
    const category = {
      id,
      title: title || 'New Category',
      subtitle: subtitle || '',
    };
    cat.customCategories = [...(cat.customCategories || []), category];
    cat.categoryOrder = [...(cat.categoryOrder || []), id];
    // If this id was previously removed as a built-in, clear that tombstone
    cat.removedCategories = (cat.removedCategories || []).filter((x) => x !== id);
    return { catalog: cat, category };
  }

  function removeCategory(catalog, categoryId) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const builtin = DEFAULT_CATEGORIES.some((c) => c.id === categoryId);
    const fallback = (cat.categoryOrder || []).find((id) => id !== categoryId) || 'operations';

    // Reassign docs that pointed here
    Object.keys(cat.categoryAssignments || {}).forEach((docKey) => {
      if (cat.categoryAssignments[docKey] === categoryId) {
        cat.categoryAssignments[docKey] = fallback;
      }
    });
    (cat.customDocs || []).forEach((d) => {
      if (d.categoryId === categoryId) d.categoryId = fallback;
    });

    cat.categoryOrder = (cat.categoryOrder || []).filter((id) => id !== categoryId);
    if (builtin) {
      if (!cat.removedCategories.includes(categoryId)) {
        cat.removedCategories = [...(cat.removedCategories || []), categoryId];
      }
    } else {
      cat.customCategories = (cat.customCategories || []).filter((c) => c.id !== categoryId);
    }
    return cat;
  }

  function renameCategory(catalog, categoryId, patch) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const p = patch && typeof patch === 'object' ? patch : {};
    if (DEFAULT_CATEGORIES.some((c) => c.id === categoryId)) {
      // Store overrides as a custom category overlay with same id
      const existing = (cat.customCategories || []).find((c) => c.id === categoryId);
      if (existing) {
        cat.customCategories = cat.customCategories.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                title: p.title != null ? String(p.title) : c.title,
                subtitle: p.subtitle != null ? String(p.subtitle) : c.subtitle,
              }
            : c
        );
      } else {
        const base = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
        cat.customCategories = [
          ...(cat.customCategories || []),
          {
            id: categoryId,
            title: p.title != null ? String(p.title) : base.title,
            subtitle: p.subtitle != null ? String(p.subtitle) : base.subtitle,
          },
        ];
      }
    } else {
      cat.customCategories = (cat.customCategories || []).map((c) =>
        c.id === categoryId
          ? {
              ...c,
              title: p.title != null ? String(p.title) : c.title,
              subtitle: p.subtitle != null ? String(p.subtitle) : c.subtitle,
            }
          : c
      );
    }
    return cat;
  }

  function moveCategory(catalog, categoryId, dir) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const order = (cat.categoryOrder || []).slice();
    const idx = order.indexOf(categoryId);
    if (idx < 0) return cat;
    const next = idx + (dir < 0 ? -1 : 1);
    if (next < 0 || next >= order.length) return cat;
    const tmp = order[idx];
    order[idx] = order[next];
    order[next] = tmp;
    cat.categoryOrder = order;
    return cat;
  }

  function assignDocCategory(catalog, docKey, categoryId) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    cat.categoryAssignments = { ...(cat.categoryAssignments || {}), [docKey]: categoryId };
    cat.customDocs = (cat.customDocs || []).map((d) =>
      d.key === docKey ? { ...d, categoryId } : d
    );
    return cat;
  }

  function createEmptyCustomPolicyDoc({ title, kind } = {}) {
    const now = new Date().toISOString().slice(0, 10);
    const doc = {
      title: title || 'New Policy Draft',
      docControl: {
        version: '0.1',
        effectiveDate: now,
        lastReviewed: now,
        owner: '',
      },
      introduction: '',
      sections: [
        {
          id: makeId('sec'),
          title: 'Purpose',
          content: 'Describe why this policy exists and who it applies to.',
        },
      ],
    };
    if (kind === 'chapters') {
      doc.chapters = [
        {
          id: makeId('ch'),
          title: 'Overview',
          sections: doc.sections,
        },
      ];
    }
    return doc;
  }

  function listRemovableLibrary(catalog) {
    const cat = mergePolicyCatalog(DEFAULT_POLICY_CATALOG(), catalog);
    const removed = new Set(cat.removedDefaults || []);
    return DEFAULT_DOC_DEFS.filter((d) => removed.has(d.key));
  }

  const api = {
    DEFAULT_CATEGORIES,
    DEFAULT_DOC_DEFS,
    BUILTIN_KEYS,
    STANDARD_BODY_KEYS,
    DEFAULT_POLICY_CATALOG,
    mergePolicyCatalog,
    getDocDef,
    listActiveBuiltinKeys,
    listActiveStandardBodyKeys,
    listCategories,
    resolveCategoryId,
    resolveNavModel,
    removeDefaultDoc,
    restoreDefaultDoc,
    removeCustomDoc,
    addCustomDoc,
    addCategory,
    removeCategory,
    renameCategory,
    moveCategory,
    assignDocCategory,
    createEmptyCustomPolicyDoc,
    listRemovableLibrary,
    makeId,
    slugify,
  };

  global.PolicyCatalog = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
