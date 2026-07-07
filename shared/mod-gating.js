/**
 * Mod 1 / Mod 2 delivery gates for legacy HTML apps.
 * Sets window.ModGating.
 */
(function (global) {
  function isMod1Complete(profile) {
    if (!profile) return false;
    return profile.mod1Status === 'complete' || Boolean(profile.mod1DeliveredAt);
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
    normalizePortalRoadmapStatus,
    isMod2Phase,
  };
})(typeof window !== 'undefined' ? window : globalThis);
