/**
 * Kolthoff staff email domain — single source for SSO and rules alignment.
 */
export const KOLTHOFF_STAFF_EMAIL_DOMAIN = 'kolthoff-consulting.com';

export function isKolthoffStaffEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase().endsWith(`@${KOLTHOFF_STAFF_EMAIL_DOMAIN}`);
}

export function normalizeStaffEmail(email) {
  return email?.trim()?.toLowerCase() || '';
}

if (typeof window !== 'undefined') {
  window.KolthoffStaffDomain = {
    KOLTHOFF_STAFF_EMAIL_DOMAIN,
    isKolthoffStaffEmail,
    normalizeStaffEmail,
  };
}

export default { KOLTHOFF_STAFF_EMAIL_DOMAIN, isKolthoffStaffEmail, normalizeStaffEmail };
