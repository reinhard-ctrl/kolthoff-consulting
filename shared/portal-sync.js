/**
 * Profile → client portal sync for legacy HTML apps.
 * Depends on window.EngagementConfig (engagement-config.js).
 * Sets window.PortalSync.
 */
(function (global) {
  const EC = () => global.EngagementConfig || {};

  function resolvePortalAccessCode(profile) {
    return profile?.quoteId || profile?.links?.portalClientId || null;
  }

  function computeSaasAnnualWaste(subSaaS) {
    if (!subSaaS?.length) return 0;
    const monthly = subSaaS.reduce(
      (acc, row) => acc + (Number(row.billing) || 0) * (Number(row.users) || 1),
      0,
    );
    return Math.round(monthly * 12);
  }

  function mapSubSaaSToPortalAssets(subSaaS) {
    return (subSaaS || []).map((row, i) => ({
      id: Date.now() + i,
      title: String(row.tool || 'Software tool'),
      category: 'MOD 1',
      date: new Date().toISOString().slice(0, 10),
      type: 'link',
      gDriveLink: String(row.reason || 'Synced from SOW / diagnosis'),
    }));
  }

  function mapCustomAssetsToPortalAssets(customAssets) {
    return (customAssets || []).map((row, i) => ({
      id: Date.now() + i + 1000,
      title: String(row.title || 'Custom asset'),
      category: String(row.category || 'MOD 1'),
      date: new Date().toISOString().slice(0, 10),
      type: 'link',
      gDriveLink: String(row.link || ''),
    }));
  }

  function mapOrgChartToPortal(orgChart) {
    const members = orgChart?.members || [];
    return members
      .filter((m) => String(m.name || '').trim())
      .map((m) => ({
        id: String(m.id || ''),
        name: String(m.name || '').trim(),
        role: String(m.role || '').trim(),
        department: String(m.department || '').trim(),
        managerId: m.managerId ? String(m.managerId) : null,
      }));
  }

  function mapRolesToActionItems(roles) {
    return (roles || []).map((row, i) => ({
      id: Date.now() + i + 2000,
      title: String(row.owner || row.name || 'Team member'),
      desc: String(row.role || row.title || 'Role pending'),
      type: 'roster',
      status: 'pending',
    }));
  }

  function mergePortalAssets(existing, incoming) {
    const byTitle = new Map();
    (existing || []).forEach((a) => {
      const key = String(a.title || '').trim().toLowerCase();
      if (key) byTitle.set(key, a);
    });
    (incoming || []).forEach((a) => {
      const key = String(a.title || '').trim().toLowerCase();
      if (key) byTitle.set(key, a);
    });
    return Array.from(byTitle.values());
  }

  const LEAK_SCAN_REPORT_ASSET_TITLE = 'Leak Scan Report';
  const LEGACY_LEAK_SCAN_REPORT_ASSET_TITLE = 'Waste-to-Peso Report';
  const LOOM_WALKTHROUGH_ASSET_TITLE = 'Mod 1 Walkthrough Video';
  const STAFF_DIRECTORY_ASSET_TITLE = 'Team List & Privacy Ground Rules';
  const FEEDBACK_FORM_ASSET_TITLE = 'Anonymous Staff Feedback Form';

  function upsertCustomAssetByTitle(existing, title, link, category) {
    const list = [...existing];
    const key = String(title || '').trim().toLowerCase();
    const idx = list.findIndex((a) => String(a.title || '').trim().toLowerCase() === key);
    const trimmed = String(link || '').trim();
    if (!trimmed) {
      if (idx >= 0) list.splice(idx, 1);
      return list;
    }
    const row = { title, category: category || 'MOD 1', link: trimmed };
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    return list;
  }

  function removeCustomAssetByTitle(existing, title) {
    const key = String(title || '').trim().toLowerCase();
    return (existing || []).filter((a) => String(a.title || '').trim().toLowerCase() !== key);
  }

  /** Upsert Mod 1 deliverable links into profile.customAssets for portal vault sync. */
  function upsertMod1DeliverableAssets(profile) {
    const synthesis = profile?.synthesis || {};
    let existing = [...(profile?.customAssets || [])];
    existing = removeCustomAssetByTitle(existing, LEGACY_LEAK_SCAN_REPORT_ASSET_TITLE);
    existing = upsertCustomAssetByTitle(existing, LEAK_SCAN_REPORT_ASSET_TITLE, synthesis.clientDeliverableUrl);
    existing = upsertCustomAssetByTitle(existing, LOOM_WALKTHROUGH_ASSET_TITLE, synthesis.loomWalkthroughUrl);
    existing = upsertCustomAssetByTitle(existing, STAFF_DIRECTORY_ASSET_TITLE, synthesis.staffDirectoryDeliverableUrl);
    existing = upsertCustomAssetByTitle(existing, FEEDBACK_FORM_ASSET_TITLE, synthesis.feedbackFormUrl);
    return existing;
  }

  /** Stamp deliveredAt on selected Mod 1 SOW line items (excludes optional m1-06). */
  function stampMod1TasksDelivered(tasks, deliveredAt) {
    if (!deliveredAt) return tasks || [];
    return (tasks || []).map((task) => {
      const id = String(task.id || '');
      if (!id.startsWith('m1-') || id === 'm1-06' || task.selected === false) return task;
      return { ...task, deliveredAt };
    });
  }

  function mergeActionItems(existing, incoming) {
    const byTitle = new Map();
    (existing || []).forEach((a) => {
      const key = String(a.title || '').trim().toLowerCase();
      if (key) byTitle.set(key, a);
    });
    (incoming || []).forEach((a) => {
      const key = String(a.title || '').trim().toLowerCase();
      if (key) byTitle.set(key, a);
    });
    return Array.from(byTitle.values());
  }

  /** After Mod 1 Leak Scan Report delivery: mark MOD 1 complete and advance portal to MOD 2. */
  function buildMod1CompletePortalPatch(existing) {
    const engagement = EC();
    const mods = engagement.MODULES || [];
    const defaultRoadmap = engagement.buildDefaultPortalRoadmap?.() || [];
    const base = existing?.roadmap?.length ? existing.roadmap : defaultRoadmap;
    const roadmap = base.map((item, i) => {
      if (i === 0) return { ...item, status: 'completed' };
      if (i === 1) return { ...item, status: 'active' };
      const prior = String(item.status || '').trim().toLowerCase();
      const done = prior === 'completed' || prior === 'complete';
      return { ...item, status: done ? 'completed' : 'pending' };
    });
    const mod2 = mods[1];
    return {
      roadmap,
      currentPhase: mod2?.portalPhase || 'MOD 2: How Your Business Runs',
      mod2UnlockedAt: new Date().toISOString(),
      mod1CompleteNotice:
        'Module 1 (Business Leak Scan) is complete. Your consultant is now delivering Module 2 — How Your Business Runs (playbooks, policies, and to-be workflows).',
    };
  }

  /**
   * Mark Mod 1 complete on the linked client portal (roadmap + currentPhase).
   * Returns access code on success, null if no portal.
   */
  async function syncMod1CompleteToPortal(profile) {
    const code = resolvePortalAccessCode(profile);
    if (!code || !global.firebaseDb || !global.appId) return null;

    const portalRef = global.doc(
      global.firebaseDb,
      'artifacts',
      global.appId,
      'public',
      'data',
      'clients',
      code,
    );
    const snap = await global.getDoc(portalRef);
    if (!snap.exists()) return null;

    const existing = snap.data();
    const patch = buildMod1CompletePortalPatch(existing);
    const assetsProfile = { ...profile, customAssets: upsertMod1DeliverableAssets(profile) };
    const fromSaas = mapSubSaaSToPortalAssets(assetsProfile.subSaaS);
    const fromCustom = mapCustomAssetsToPortalAssets(assetsProfile.customAssets);
    patch.assets = mergePortalAssets(existing?.assets || [], [...fromSaas, ...fromCustom]);
    if (assetsProfile.orgChart) {
      patch.orgChart = mapOrgChartToPortal(assetsProfile.orgChart);
    }
    await global.setDoc(portalRef, patch, { merge: true });
    return code;
  }

  function buildPortalPatchFromProfile(profile, existing, options) {
    const engagement = EC();
    const saasWaste = computeSaasAnnualWaste(profile.subSaaS);
    const patch = {
      companyName: engagement.getClientDisplayName
        ? engagement.getClientDisplayName(profile)
        : (profile.clientCompany || profile.clientName || 'Untitled Client'),
      repName: profile.clientRep || existing?.repName || 'Representative',
      sowReference: profile.quoteId || existing?.sowReference || '',
      metrics: {
        annualLeakageIdentified: engagement.getChaosTaxValue
          ? engagement.getChaosTaxValue(profile)
          : (profile.chaosTax?.value ?? profile.annualOperationalLeakage ?? 0),
        chaosTaxEliminated: existing?.metrics?.chaosTaxEliminated ?? 0,
        saasSavingsIdentified: saasWaste || existing?.metrics?.saasSavingsIdentified || 0,
      },
    };

    if (!existing?.roadmap?.length && engagement.buildDefaultPortalRoadmap) {
      patch.roadmap = engagement.buildDefaultPortalRoadmap();
    }

    if (!existing?.currentPhase && engagement.MODULES?.[0]) {
      patch.currentPhase = engagement.MODULES[0].portalPhase;
    }

    if (options?.syncIntakeAssets) {
      const assetsProfile = { ...profile, customAssets: upsertMod1DeliverableAssets(profile) };
      const fromSaas = mapSubSaaSToPortalAssets(assetsProfile.subSaaS);
      const fromCustom = mapCustomAssetsToPortalAssets(assetsProfile.customAssets);
      patch.assets = mergePortalAssets(existing?.assets || [], [...fromSaas, ...fromCustom]);
    }

    if (options?.syncOrgChart) {
      patch.orgChart = mapOrgChartToPortal(profile.orgChart);
    }

    return patch;
  }

  /**
   * Push profile fields to clients/{accessCode} when a linked portal exists.
   * Returns access code on success, null if no portal linked or doc missing.
   */
  async function syncProfileToPortalIfExists(profile, options) {
    const code = resolvePortalAccessCode(profile);
    if (!code || !global.firebaseDb || !global.appId) return null;

    const portalRef = global.doc(
      global.firebaseDb,
      'artifacts',
      global.appId,
      'public',
      'data',
      'clients',
      code,
    );
    const snap = await global.getDoc(portalRef);
    if (!snap.exists()) return null;

    const patch = buildPortalPatchFromProfile(profile, snap.data(), options);
    await global.setDoc(portalRef, patch, { merge: true });
    return code;
  }

  /**
   * Push invoice rows to clients/{accessCode}.contracts for portal billing tab.
   */
  async function syncInvoicesToPortal(accessCode, invoiceList) {
    if (!accessCode || !global.firebaseDb || !global.appId) return null;

    const portalRef = global.doc(
      global.firebaseDb,
      'artifacts',
      global.appId,
      'public',
      'data',
      'clients',
      accessCode,
    );
    const portalSnap = await global.getDoc(portalRef);
    if (!portalSnap.exists()) return null;

    let invoices = invoiceList;
    if (!invoices && global.query && global.where && global.collection && global.getDocs) {
      const invoicesRef = global.collection(
        global.firebaseDb,
        'artifacts',
        global.appId,
        'public',
        'data',
        'invoices',
      );
      const q = global.query(invoicesRef, global.where('portalAccessCode', '==', accessCode));
      const snap = await global.getDocs(q);
      invoices = [];
      snap.forEach((d) => invoices.push({ id: d.id, ...d.data() }));
    }

    const Invoices = global.InvoiceHelpers;
    if (!Invoices?.mergePortalContractsFromInvoices) return null;

    const existing = portalSnap.data();
    const contracts = Invoices.mergePortalContractsFromInvoices(existing?.contracts, invoices || []);
    await global.setDoc(portalRef, { contracts }, { merge: true });
    return accessCode;
  }

  global.PortalSync = {
    resolvePortalAccessCode,
    computeSaasAnnualWaste,
    mapSubSaaSToPortalAssets,
    mapCustomAssetsToPortalAssets,
    mapOrgChartToPortal,
    mapRolesToActionItems,
    mergePortalAssets,
    mergeActionItems,
    LEAK_SCAN_REPORT_ASSET_TITLE,
    LEGACY_LEAK_SCAN_REPORT_ASSET_TITLE,
    LOOM_WALKTHROUGH_ASSET_TITLE,
    STAFF_DIRECTORY_ASSET_TITLE,
    FEEDBACK_FORM_ASSET_TITLE,
    upsertCustomAssetByTitle,
    upsertMod1DeliverableAssets,
    stampMod1TasksDelivered,
    buildMod1CompletePortalPatch,
    syncMod1CompleteToPortal,
    buildPortalPatchFromProfile,
    syncProfileToPortalIfExists,
    syncInvoicesToPortal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
