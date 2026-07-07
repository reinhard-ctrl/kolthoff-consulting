/**
 * Mod 1 / Mod 2 delivery gates for legacy HTML apps.
 * Sets window.ModGating.
 */
(function (global) {
  const ADMIN_UNLOCK_PREFIX = 'mod2AdminUnlock:';

  function isMod1Complete(profile) {
    if (!profile) return false;
    return profile.mod1Status === 'complete' || Boolean(profile.mod1DeliveredAt);
  }

  function adminUnlockStorageKey(profileId) {
    return `${ADMIN_UNLOCK_PREFIX}${String(profileId || '').trim()}`;
  }

  /** Session flag: admin explicitly unlocked Mod 2 tools for this workbook profile. */
  function hasAdminMod2Unlock(profileId) {
    if (!profileId || typeof global.sessionStorage === 'undefined') return false;
    try {
      return global.sessionStorage.getItem(adminUnlockStorageKey(profileId)) === '1';
    } catch {
      return false;
    }
  }

  function setAdminMod2Unlock(profileId, unlocked) {
    if (!profileId || typeof global.sessionStorage === 'undefined') return;
    try {
      const key = adminUnlockStorageKey(profileId);
      if (unlocked) global.sessionStorage.setItem(key, '1');
      else global.sessionStorage.removeItem(key);
    } catch {
      /* ignore quota / private mode */
    }
  }

  /** Policy Studio / Mod 2 apps: locked until Mod 1 delivery unless admin override. */
  function isMod2Locked(profile, options) {
    const opts = options || {};
    if (opts.standalone) return false;
    if (isMod1Complete(profile)) return false;
    const profileId = opts.profileId || profile?.id;
    if (opts.adminUnlock || hasAdminMod2Unlock(profileId)) return false;
    return true;
  }

  /** Normalize roadmap status strings for client portal UI (completed | active | pending). */
  function normalizePortalRoadmapStatus(status) {
    const s = String(status || '')
      .toLowerCase()
      .replace(/\s+/g, '');
    if (s.includes('complete')) return 'completed';
    if (s.includes('progress') || s === 'active' || s === 'inprogress') return 'active';
    return 'pending';
  }

  function isMod2Phase(currentPhase) {
    return String(currentPhase || '').toUpperCase().includes('MOD 2');
  }

  global.ModGating = {
    isMod1Complete,
    isMod2Locked,
    hasAdminMod2Unlock,
    setAdminMod2Unlock,
    adminUnlockStorageKey,
    normalizePortalRoadmapStatus,
    isMod2Phase,
  };
})(typeof window !== 'undefined' ? window : globalThis);
