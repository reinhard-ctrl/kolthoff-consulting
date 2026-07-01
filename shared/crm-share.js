/**
 * CRM pipeline external share — token-gated read-only public view.
 * Staff sync sanitized snapshots to crm_public_view/{token}; external viewers use ?token=...
 */
import { db, appId as defaultAppId } from './firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const SHARE_LINKS_COLLECTION = 'crm_share_links';
const PUBLIC_VIEW_COLLECTION = 'crm_public_view';
const PUBLIC_VIEW_PATH = '/apps/public/crm_pipeline_view.html';

export function generateShareToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `share${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getShareTokenFromUrl(url = typeof window !== 'undefined' ? window.location : null) {
  if (!url) return null;
  const token = new URL(url.href || url).searchParams.get('token');
  return token && token.trim() ? token.trim() : null;
}

export function buildShareUrl(token, baseUrl = typeof window !== 'undefined' ? window.location.origin : '') {
  const origin = (baseUrl || '').replace(/\/$/, '');
  return `${origin}${PUBLIC_VIEW_PATH}?token=${encodeURIComponent(token)}`;
}

export function shareLinkDocRef(firestoreDb = db, tenantAppId = defaultAppId, token) {
  return doc(firestoreDb, 'artifacts', tenantAppId, 'public', 'data', SHARE_LINKS_COLLECTION, token);
}

export function publicViewDocRef(firestoreDb = db, tenantAppId = defaultAppId, token) {
  return doc(firestoreDb, 'artifacts', tenantAppId, 'public', 'data', PUBLIC_VIEW_COLLECTION, token);
}

/** Strip contact details and internal notes before publishing externally. */
export function sanitizeDealForPublic(deal) {
  return {
    id: deal.id,
    leadName: deal.leadName || '',
    company: deal.company || '',
    titleRole: deal.titleRole || '',
    pipelineStatus: deal.pipelineStatus || 'Lead / Prospect',
    estValue: Math.round(parseFloat(deal.estValue || 0)),
    nextAction: deal.nextAction || '',
    followUpDate: deal.followUpDate || '',
    status: deal.status || 'Active',
  };
}

export function buildPublicPipelineSnapshot(deals, stats = null) {
  const sanitized = (deals || []).map(sanitizeDealForPublic);
  const computed = stats || {
    activeCount: sanitized.filter((d) => d.status === 'Active' || !d.status).length,
    totalValue: sanitized
      .filter((d) => d.status === 'Active' || !d.status)
      .reduce((sum, d) => sum + (d.estValue || 0), 0),
  };
  return {
    syncedAt: Date.now(),
    deals: sanitized,
    stats: {
      activeCount: computed.activeCount ?? 0,
      totalValue: computed.totalValue ?? 0,
      winRate: computed.winRate ?? 0,
      avgSize: computed.avgSize ?? 0,
      overdueCount: computed.overdueCount ?? 0,
    },
  };
}

export async function ensureShareLink(firestoreDb = db, tenantAppId = defaultAppId, token) {
  const ref = shareLinkDocRef(firestoreDb, tenantAppId, token);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const payload = {
    enabled: false,
    token,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(ref, payload);
  return payload;
}

export async function setShareLinkEnabled(firestoreDb = db, tenantAppId = defaultAppId, token, enabled) {
  const ref = shareLinkDocRef(firestoreDb, tenantAppId, token);
  await setDoc(ref, {
    enabled: !!enabled,
    token,
    updatedAt: Date.now(),
  }, { merge: true });
}

export async function syncPublicPipelineView(firestoreDb = db, tenantAppId = defaultAppId, token, deals, stats) {
  const snapshot = buildPublicPipelineSnapshot(deals, stats);
  await setDoc(publicViewDocRef(firestoreDb, tenantAppId, token), snapshot);
  return snapshot;
}

if (typeof window !== 'undefined') {
  window.CrmShare = {
    generateShareToken,
    getShareTokenFromUrl,
    buildShareUrl,
    shareLinkDocRef,
    publicViewDocRef,
    sanitizeDealForPublic,
    buildPublicPipelineSnapshot,
    ensureShareLink,
    setShareLinkEnabled,
    syncPublicPipelineView,
    PUBLIC_VIEW_PATH,
  };
}
