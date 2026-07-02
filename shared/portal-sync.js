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
      gDriveLink: String(row.reason || 'Synced from SOW / intake'),
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
      const fromSaas = mapSubSaaSToPortalAssets(profile.subSaaS);
      const fromCustom = mapCustomAssetsToPortalAssets(profile.customAssets);
      patch.assets = mergePortalAssets(existing?.assets || [], [...fromSaas, ...fromCustom]);
    }

    if (options?.syncRoles && profile.roles?.length) {
      const fromRoles = mapRolesToActionItems(profile.roles);
      patch.actionItems = mergeActionItems(existing?.actionItems || [], fromRoles);
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
    mapRolesToActionItems,
    mergePortalAssets,
    mergeActionItems,
    buildPortalPatchFromProfile,
    syncProfileToPortalIfExists,
    syncInvoicesToPortal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
