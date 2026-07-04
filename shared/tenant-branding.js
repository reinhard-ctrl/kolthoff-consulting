/**
 * Runtime tenant branding from Firestore — merges over product-config defaults.
 * Used by legacy HTML apps (CRM, Estimates).
 */
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const KOLTHOFF_PRIMARY_COLOR = '#14B8A6';
const AGENCY_OPS_PRIMARY_COLOR = '#4f46e5';

const AGENCY_OPS_DEFAULTS = {
  companyName: 'Studio North',
  tagline: 'Creative & Digital Services',
  primaryColor: AGENCY_OPS_PRIMARY_COLOR,
  logoUrl: '',
  crmBadge: 'SALES PIPELINE',
  crmSubtitle: 'Track leads, proposals, and closed deals',
  plannerSubtitle: 'Project Estimates',
};

function getDefaultPrimaryColor(productConfig) {
  return productConfig?.id === 'agency-ops-starter' || productConfig?.starterMode
    ? AGENCY_OPS_PRIMARY_COLOR
    : KOLTHOFF_PRIMARY_COLOR;
}

function resolveCompanyName(b, productConfig) {
  if (b?.companyName?.trim()) return b.companyName.trim();
  const legacy = [b?.name, b?.accent].filter(Boolean).join(' ').trim();
  if (legacy) return legacy;
  const product = productConfig?.branding || {};
  const fromProduct = [product.name, product.accent].filter(Boolean).join(' ').trim();
  return fromProduct || AGENCY_OPS_DEFAULTS.companyName;
}

function resolveTagline(b, productConfig) {
  if (b?.tagline?.trim()) return b.tagline.trim();
  if (b?.subtitle?.trim()) return b.subtitle.trim();
  return productConfig?.branding?.subtitle || AGENCY_OPS_DEFAULTS.tagline;
}

function mergeBranding(firestoreBranding, productConfig) {
  const product = productConfig?.branding || {};
  const defaultColor = getDefaultPrimaryColor(productConfig);
  const base = {
    companyName: resolveCompanyName({
      name: product.name,
      accent: product.accent,
      tagline: product.subtitle,
    }, productConfig),
    tagline: resolveTagline({ subtitle: product.subtitle }, productConfig),
    primaryColor: defaultColor,
    logoUrl: '',
    crmBadge: productConfig?.crmBadge || AGENCY_OPS_DEFAULTS.crmBadge,
    crmSubtitle: productConfig?.crmSubtitle || AGENCY_OPS_DEFAULTS.crmSubtitle,
    plannerSubtitle: productConfig?.plannerSubtitle || AGENCY_OPS_DEFAULTS.plannerSubtitle,
  };
  if (!firestoreBranding) return base;
  return {
    ...base,
    companyName: resolveCompanyName({ ...base, ...firestoreBranding }, productConfig),
    tagline: resolveTagline({ ...base, ...firestoreBranding }, productConfig),
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

function isAgencyOpsStarter(productConfig) {
  return productConfig?.id === 'agency-ops-starter' || Boolean(productConfig?.starterMode);
}

/** Call after firebase-init (needs db + appId + auth). */
export function initTenantBranding(db, appId) {
  if (!db || !appId) return;
  if (unsubscribeFirestore) return;

  const product = globalThis.ProductConfig?.getProductConfig?.() || {};
  cached = mergeBranding(null, product);
  if (isAgencyOpsStarter(product)) {
    applyCss(cached);
  }
  notify();

  if (!isAgencyOpsStarter(product)) return;

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
    DEFAULTS: AGENCY_OPS_DEFAULTS,
    getEffectiveBranding,
    subscribe,
    initTenantBranding,
    splitDisplay,
    mergeBranding,
  };
}
