/**
 * Bidirectional CRM ↔ planner link maintenance.
 * When a deal closes Won/Lost, push status into linked workbook_profiles.links slice.
 */
(function (global) {
  function findLinkedProfile(profiles, dealId) {
    if (!profiles?.length || !dealId) return null;
    return profiles.find(
      (p) => p.quoteId === dealId || p.id === dealId || p.links?.crmDealId === dealId,
    ) || null;
  }

  /**
   * @param {import('firebase/firestore').Firestore} db
   * @param {string} appId
   * @param {object} deal - crm_deals document
   * @param {object} profile - linked workbook_profiles document
   */
  async function syncDealStatusToProfile(db, appId, deal, profile) {
    if (!db || !appId || !deal?.id || !profile?.id) return false;

    const docFn = global.firestoreDoc || global.doc;
    const setFn = global.firestoreSetDoc || global.setDoc;
    if (!docFn || !setFn) return false;

    const profileRef = docFn(db, 'artifacts', appId, 'public', 'data', 'workbook_profiles', profile.id);
    const linksPatch = {
      ...(profile.links || {}),
      crmDealId: deal.id,
      crmStatus: deal.status || 'Active',
      crmPipelineStatus: deal.pipelineStatus || 'Lead / Prospect',
      crmSyncedAt: Date.now(),
    };

    await setFn(profileRef, {
      links: linksPatch,
      updatedAt: Date.now(),
    }, { merge: true });

    if (deal.status === 'Won' && global.PortalSync?.syncProfileToPortalIfExists) {
      try {
        await global.PortalSync.syncProfileToPortalIfExists({
          ...profile,
          links: linksPatch,
        });
      } catch (err) {
        console.warn('Portal sync after CRM won skipped:', err);
      }
    }

    return true;
  }

  async function syncDealToLinkedProfile(db, appId, deal, profiles) {
    const profile = findLinkedProfile(profiles, deal.id);
    if (!profile) return false;
    return syncDealStatusToProfile(db, appId, deal, profile);
  }

  global.CrmPlannerSync = {
    findLinkedProfile,
    syncDealStatusToProfile,
    syncDealToLinkedProfile,
  };
})(typeof window !== 'undefined' ? window : globalThis);
