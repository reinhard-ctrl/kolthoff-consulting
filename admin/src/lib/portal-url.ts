const PORTAL_PATH = '/apps/public/portal.html';

/** Full client portal URL; optional access code pre-fills the login screen via ?code=. */
export function clientPortalUrl(accessCode?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kolthoff-consulting.com';
  const base = `${origin}${PORTAL_PATH}`;
  const code = accessCode?.trim().toUpperCase();
  if (!code) return base;
  return `${base}?code=${encodeURIComponent(code)}`;
}
