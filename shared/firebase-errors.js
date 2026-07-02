/**
 * User-facing Firebase connection error guidance for HTML apps.
 */
(function (global) {
  const REFERRER_PATTERNS = [
    'auth/requests-from-referer-null-are-blocked',
    'auth/requests-from-referer-blocked',
    'requests-from-referer',
  ];

  const DEFAULT_REFERRERS = [
    'https://kolthoff-portal.web.app/*',
    'https://kolthoff-consulting.com/*',
    'https://www.kolthoff-consulting.com/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
    'http://localhost:5000/*',
    'http://127.0.0.1:5000/*',
  ];

  function normalizeDetail(detail) {
    if (!detail) return '';
    if (typeof detail === 'string') return detail;
    return detail.message || detail.code || String(detail);
  }

  function isReferrerError(detail) {
    const msg = normalizeDetail(detail).toLowerCase();
    return REFERRER_PATTERNS.some((p) => msg.includes(p.toLowerCase()));
  }

  function isFileProtocol() {
    if (typeof window === 'undefined') return false;
    try {
      return window.location?.protocol === 'file:';
    } catch {
      return false;
    }
  }

  function currentOrigin() {
    if (typeof window === 'undefined') return '';
    try {
      if (isFileProtocol()) return 'file:// (local disk — blocked by Firebase)';
      return window.location?.origin || window.location?.href || '(unknown)';
    } catch {
      return '(unknown)';
    }
  }

  /**
   * @returns {{ title: string, summary: string, steps: string[] }}
   */
  function getFirebaseConnectionHelp(detail) {
    const msg = normalizeDetail(detail);
    const file = isFileProtocol();
    const referrer = isReferrerError(msg) || file;

    if (referrer) {
      const steps = [
        'Use the hosted app (recommended): https://kolthoff-portal.web.app/apps/delivery/project_planner.html — sign in via Admin first if embedded.',
        'Local dev: run `npm run serve:hosting` then open http://localhost:5000/apps/delivery/project_planner.html',
        'Google Cloud Console → APIs & Services → Credentials → Browser key (AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI) → Application restrictions → HTTP referrers. Add your origin if missing:',
        ...DEFAULT_REFERRERS.map((r) => `  • ${r}`),
      ];
      if (file) {
        return {
          title: 'Firebase Connection Error',
          summary: 'This page was opened from your file system (`file://`). Firebase Auth blocks that path. Use the hosted URL or a local web server instead of double-clicking the HTML file.',
          steps,
        };
      }
      return {
        title: 'Firebase Connection Error',
        summary: `Firebase rejected this origin: ${currentOrigin()}. The browser API key HTTP referrer list does not include it yet.`,
        steps,
      };
    }

    if (/firebase-init|duplicate export|syntaxerror/i.test(msg)) {
      return {
        title: 'Cloud sync module failed to load',
        summary: msg,
        steps: [
          'Hard-refresh (Ctrl+Shift+R) or use a private window.',
          'Deploy latest hosting: `npm run build && firebase deploy --only hosting`',
        ],
      };
    }

    return {
      title: 'Cloud sync unavailable',
      summary: msg || 'Authentication or Firestore connection failed.',
      steps: [
        'Sign in at https://kolthoff-portal.web.app/admin/ then reopen the planner.',
        'Enable Anonymous sign-in in Firebase Console → Authentication.',
        'Check the browser console for the exact error code.',
      ],
    };
  }

  global.FirebaseErrors = {
    getFirebaseConnectionHelp,
    isReferrerError,
    isFileProtocol,
    DEFAULT_REFERRERS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
