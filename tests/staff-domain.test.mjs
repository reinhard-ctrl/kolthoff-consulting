import { isKolthoffStaffEmail, KOLTHOFF_STAFF_EMAIL_DOMAIN } from '../shared/staff-domain.js';

if (KOLTHOFF_STAFF_EMAIL_DOMAIN !== 'kolthoff-consulting.com') {
  throw new Error('unexpected staff domain constant');
}
if (!isKolthoffStaffEmail('Staff@Kolthoff-Consulting.com')) {
  throw new Error('kolthoff staff email should match case-insensitively');
}
if (isKolthoffStaffEmail('client@gmail.com')) {
  throw new Error('external email must not match');
}

console.log('staff-domain.test.mjs: all assertions passed');
