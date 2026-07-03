export function resolveAuthDomain(): string {
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
