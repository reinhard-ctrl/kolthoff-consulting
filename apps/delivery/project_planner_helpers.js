/** Project Planner helpers — task catalog, profile persistence, ID generation */

import { DEFAULT_TASK_CATALOG, getFinancials, formatCurrency } from '../shared/financials.js';

export { DEFAULT_TASK_CATALOG, getFinancials, formatCurrency };

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function createEmptyProfile(clientName = 'New Client') {
  return {
    clientName,
    companyName: '',
    accessCode: '',
    frictionBuffer: 15,
    discountPercent: 0,
    includeTax: false,
    applyCreditBack: false,
    subscriptionMonths: 6,
    tasks: DEFAULT_TASK_CATALOG.map((t) => ({ ...t })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function normalizeProfile(data) {
  return {
    ...createEmptyProfile(),
    ...data,
    tasks: (data.tasks || DEFAULT_TASK_CATALOG).map((t) => ({ ...DEFAULT_TASK_CATALOG.find((d) => d.id === t.id) || {}, ...t })),
  };
}

export async function saveProfile(profileId, profile) {
  const payload = { ...profile, updatedAt: Date.now() };
  await window.setDoc(
    window.doc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', profileId),
    payload,
    { merge: true }
  );
  return payload;
}

export async function deleteProfile(profileId) {
  await window.deleteDoc(
    window.doc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', profileId)
  );
}

export function subscribeProfiles(onData, onError) {
  return window.onSnapshot(
    window.collection(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles'),
    (snap) => {
      const profiles = [];
      snap.forEach((d) => profiles.push({ id: d.id, ...d.data() }));
      onData(profiles);
    },
    onError
  );
}

export const CRM_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export function createDeal(overrides = {}) {
  return {
    id: generateId(),
    title: 'New Opportunity',
    company: '',
    contact: '',
    value: 0,
    stage: 'lead',
    ownerId: '',
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
