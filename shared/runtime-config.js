/**
 * App Check + runtime config injection for Kolthoff HTML apps.
 * Loaded before firebase-init.js when injected at build time.
 */
(function initKolthoffRuntimeConfig() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const debugToken = params.get('appCheckDebug');
  if (debugToken) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === '1' || debugToken === 'true'
      ? true
      : debugToken;
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.KOLTHOFF_APPCHECK_OPTIONAL = true;
  }
})();
