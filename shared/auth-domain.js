/**
 * Match Firebase authDomain to the page origin.
 * Chrome 115+ deletes auth state when auth uses firebaseapp.com but the app runs on web.app / custom domain.
 * @see https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
export function resolveAuthDomain() {
  if (typeof window === 'undefined') {
    return 'kolthoff-portal.web.app';
  }

  const host = window.location.hostname;

  if (host === 'kolthoff-consulting.com' || host === 'www.kolthoff-consulting.com') {
    return host;
  }

  if (host === 'kolthoff-portal.web.app' || host === 'kolthoff-portal.firebaseapp.com') {
    return 'kolthoff-portal.web.app';
  }

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'kolthoff-portal.web.app';
  }

  return 'kolthoff-portal.web.app';
}
