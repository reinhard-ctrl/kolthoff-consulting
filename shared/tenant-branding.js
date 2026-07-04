/**
 * Runtime tenant branding from Firestore — merges over product-config defaults.
 * Used by legacy HTML apps (CRM, Estimates).
 */
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const DEFAULTS = {
  companyName: 'Studio North',
  tagline: 'Creative & Digital Services',
  primaryColor: '#6366f1',
  logoUrl: '',
  crmBadge: 'SALES PIPELINE',
  crmSubtitle: 'Track leads, proposals, and closed deals',
  plannerSubtitle: 'Project Estimates',
};

function resolveCompanyName(b) {
  if (b?.companyName?.trim()) return b.companyName.trim();
  const legacy = [b?.name, b?.accent].filter(Boolean).join(' ').trim();
  return legacy || DEFAULTS.companyName;
}

function resolveTagline(b) {
  return (b?.tagline ?? b?.subtitle ?? DEFAULTS.tagline).trim();
}

function mergeBranding(firestoreBranding, productConfig) {
  const product = productConfig?.branding || {};
  const base = {
    companyName: resolveCompanyName({
      name: product.name,
      accent: product.accent,
      tagline: product.subtitle,
    }),
    tagline: product.subtitle || DEFAULTS.tagline,
    primaryColor: DEFAULTS.primaryColor,
    logoUrl: '',
    crmBadge: productConfig?.crmBadge || DEFAULTS.crmBadge,
    crmSubtitle: productConfig?.crmSubtitle || DEFAULTS.crmSubtitle,
    plannerSubtitle: productConfig?.plannerSubtitle || DEFAULTS.plannerSubtitle,
  };
  if (!firestoreBranding) return base;
  return {
    ...base,
    companyName: resolveCompanyName({ ...base, ...firestoreBranding }),
    tagline: resolveTagline({ ...base, ...firestoreBranding }),
    primaryColor: firestoreBranding.primaryColor?.trim() || base.primaryColor,
    logoUrl: firestoreBranding.logoUrl?.trim() || '',
  };
}

function splitDisplay(companyName) {
  const parts = companyName.trim().split(/\s+/);
  if (parts.length <= 1) return { line1: companyName, line2: '' };
  return { line1: parts[0], line2: parts.slice(1).join(' ') };
}

function applyCss(branding) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
  document.documentElement.style.setProperty('--brand-primary-soft', `${branding.primaryColor}26`);
}

let cached = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => {
    try { fn(cached); } catch (e) { console.warn('TenantBranding subscriber error', e); }
  });
}

export function getEffectiveBranding() {
  if (cached) return cached;
  const product = globalThis.ProductConfig?.getProductConfig?.() || {};
  cached = mergeBranding(null, product);
  return cached;
}

export function subscribe(fn) {
  subscribers.add(fn);
  fn(getEffectiveBranding());
  return () => subscribers.delete(fn);
}

let unsubscribeFirestore = null;

/** Call after firebase-init (needs db + appId + auth). */
export function initTenantBranding(db, appId) {
  if (!db || !appId) return;
  if (unsubscribeFirestore) return;

  const product = globalThis.ProductConfig?.getProductConfig?.() || {};
  cached = mergeBranding(null, product);
  applyCss(cached);
  notify();

  const ref = doc(db, 'artifacts', appId, 'public', 'data', 'tenant_settings', 'config');
  unsubscribeFirestore = onSnapshot(
    ref,
    (snap) => {
      const firestoreBranding = snap.exists() ? snap.data()?.branding : null;
      cached = mergeBranding(firestoreBranding, product);
      applyCss(cached);
      notify();
    },
    (err) => console.warn('TenantBranding listener failed:', err.message),
  );
}

if (typeof window !== 'undefined') {
  window.TenantBranding = {
    DEFAULTS,
    getEffectiveBranding,
    subscribe,
    initTenantBranding,
    splitDisplay,
    mergeBranding,
  };
}
