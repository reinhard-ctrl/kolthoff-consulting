/** @kolthoff-consulting.com staff domain helpers (mirrors shared/staff-domain.js) */
export const KOLTHOFF_STAFF_EMAIL_DOMAIN = 'kolthoff-consulting.com';

export function isKolthoffStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${KOLTHOFF_STAFF_EMAIL_DOMAIN}`);
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}
