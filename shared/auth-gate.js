/**
 * Staff auth gate for internal Kolthoff OS HTML apps.
 * Redirects to /admin/ or /agency-ops/ when no valid session exists.
 * Public apps (marketing, portal, intake) must NOT import this module.
 */
import { getRedirectResult } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getProductId, getTenantId } from './product-config.js';

const FIRM_APP = 'kolthoff-admin-app';

function firebaseDeps() {
  return {
    auth: window.firebaseAuth,
    db: window.firebaseDb,
    appId: window.appId || getTenantId(FIRM_APP),
    initialAuthToken: window.initialAuthToken,
    bootstrapAuth: window.bootstrapAuth,
    hasAdminSession: window.hasAdminSession,
  };
}

function adminSessionRef(db, tenantId, uid) {
  return doc(db, 'artifacts', tenantId, 'public', 'data', 'admin_sessions', uid);
}

function googleAdminSessionRef(db, tenantId, uid) {
  return doc(db, 'artifacts', tenantId, 'public', 'data', 'google_admin_sessions', uid);
}

function revealPage() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('kolthoff-auth-pending');
}

/** Skip gate for offline Policy Studio bundles */
function isStandalonePolicyStudio() {
  return typeof window !== 'undefined' && typeof window.STANDALONE_POLICIES !== 'undefined';
}

/** Client-facing contract signing link (?contract=...) */
function isClientContractLedgerView() {
  if (typeof window === 'undefined') return false;
  return (
    (window.location.pathname.includes('contract_ledger') ||
      window.location.pathname.includes('contract_sign')) &&
    new URLSearchParams(window.location.search).has('contract')
  );
}

/** External read-only CRM pipeline share link (?token=...) */
function isCrmPipelineShareView() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.includes('crm_pipeline_view') &&
    new URLSearchParams(window.location.search).has('token')
  );
}

/** Agency Ops starter embeds use the light theme during auth bootstrap. */
function isAgencyStarterContext() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('product') === 'agency-ops-starter') return true;
  if (params.get('tenant')?.startsWith('agency-')) return true;
  if (params.get('tenant') === 'agency-ops-demo') return true;
  const cfg = window.ProductConfig?.getProductConfig?.();
  return Boolean(cfg?.starterMode);
}

function applyAgencyStarterLightBody() {
  if (!isAgencyStarterContext() || typeof document === 'undefined') return;
  document.documentElement.classList.add('agency-starter-light');
  if (document.body) {
    document.body.style.backgroundColor = '#e3e6eb';
    document.body.style.backgroundImage = 'none';
  }
}

/** Embedded in admin console iframe — never redirect to /admin/ (it blocks framing). */
function isEmbeddedView() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('embed')) return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function resolveLoginPath() {
  if (isAgencyStarterContext()) {
    const tenant = getTenantId();
    const params = new URLSearchParams();
    if (tenant && tenant.startsWith('agency-')) params.set('tenant', tenant);
    const query = params.toString();
    return `/agency-ops/${query ? `?${query}` : ''}`;
  }
  return '/admin/';
}

async function hasFirmAdminSession(user, db) {
  const firmSession = await getDoc(adminSessionRef(db, FIRM_APP, user.uid));
  if (firmSession.exists()) return true;
  const googleSession = await getDoc(googleAdminSessionRef(db, FIRM_APP, user.uid));
  return googleSession.exists();
}

export async function hasStaffAccess(user) {
  if (!user) return false;

  const { initialAuthToken, appId, db, hasAdminSession } = firebaseDeps();
  if (initialAuthToken) return true;

  try {
    const { claims } = await user.getIdTokenResult();
    if (claims.role === 'kolthoff_admin' || claims.role === 'admin') return true;
    if (claims.tenantId && claims.role !== 'portal_client') return true;
  } catch {
    /* continue */
  }

  const email = user.email?.toLowerCase();
  const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
  if (isGoogle && email?.endsWith('@kolthoff-consulting.com')) {
    return true;
  }

  if (await hasFirmAdminSession(user, db)) return true;

  if (typeof hasAdminSession === 'function') {
    return await hasAdminSession();
  }

  const tenantSession = await getDoc(adminSessionRef(db, appId, user.uid));
  return tenantSession.exists();
}

async function resolveAuthUser() {
  const { auth, bootstrapAuth } = firebaseDeps();
  await auth.authStateReady();

  try {
    const result = await getRedirectResult(auth);
    if (result?.user && (await hasStaffAccess(result.user))) {
      return result.user;
    }
  } catch (err) {
    console.warn('Google redirect result failed:', err);
  }

  const existing = auth.currentUser;
  if (existing && (await hasStaffAccess(existing))) {
    return existing;
  }

  return bootstrapAuth();
}

async function waitForStaffAccess(maxMs = 10000) {
  const { auth, bootstrapAuth } = firebaseDeps();
  await auth.authStateReady();
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const user = auth.currentUser;
    if (user && (await hasStaffAccess(user))) return user;
    try {
      await bootstrapAuth();
    } catch {
      /* anonymous auth may be blocked briefly */
    }
    if (auth.currentUser && (await hasStaffAccess(auth.currentUser))) {
      return auth.currentUser;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

function showEmbedAuthRequired() {
  revealPage();
  const url = new URL(window.location.href);
  url.searchParams.delete('embed');
  const openUrl = url.pathname + url.search + url.hash;
  const light = isAgencyStarterContext();
  const agency = isAgencyStarterContext() && getProductId() === 'agency-ops-starter';
  const loginPath = resolveLoginPath();
  const message = agency
    ? 'Sign in to your Agency Ops console first, then reload this panel. Use your tenant passcode from the welcome email.'
    : 'Staff session required. Ensure you are logged into the admin console, then reload this panel.';
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:${light ? '#e3e6eb' : '#02050e'};color:${light ? '#6e7681' : '#94a3b8'};font-family:${light ? 'Inter' : 'Montserrat'},system-ui,sans-serif;text-align:center;">
      <div style="max-width:22rem;">
        <p style="margin:0 0 1rem;font-size:0.875rem;line-height:1.5;">${message}</p>
        <a href="${loginPath}" style="display:inline-block;margin:0 0.5rem;padding:0.625rem 1rem;background:${light ? '#4f46e5' : '#14B8A6'};color:#ffffff;border-radius:0.5rem;font-weight:700;font-size:0.75rem;text-decoration:none;">Open console</a>
        <a href="${openUrl}" target="_blank" rel="noopener" style="display:inline-block;margin:0 0.5rem;padding:0.625rem 1rem;background:${light ? '#ffffff' : '#1e293b'};color:${light ? '#334155' : '#e2e8f0'};border-radius:0.5rem;font-weight:700;font-size:0.75rem;text-decoration:none;border:1px solid ${light ? '#d0d7de' : '#334155'};">Open in new tab</a>
      </div>
    </div>
  `;
}

export async function requireStaffAuth() {
  if (isStandalonePolicyStudio()) {
    revealPage();
    return { user: null, role: 'standalone' };
  }

  if (isClientContractLedgerView()) {
    await resolveAuthUser();
    revealPage();
    return { user: firebaseDeps().auth.currentUser, role: 'client' };
  }

  if (isCrmPipelineShareView()) {
    await resolveAuthUser();
    revealPage();
    return { user: firebaseDeps().auth.currentUser, role: 'guest' };
  }

  try {
    if (isEmbeddedView()) {
      const user = await waitForStaffAccess();
      if (user) {
        revealPage();
        window.__KOLTHOFF_STAFF__ = true;
        return { user, role: 'staff' };
      }
      showEmbedAuthRequired();
      return new Promise(() => {});
    }

    const user = await resolveAuthUser();

    if (await hasStaffAccess(user)) {
      revealPage();
      window.__KOLTHOFF_STAFF__ = true;
      return { user, role: 'staff' };
    }

    revealPage();
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search + window.location.hash
    );
    window.location.replace(`${resolveLoginPath()}?return=${returnTo}`);
    return new Promise(() => {});
  } catch (err) {
    revealPage();
    throw err;
  }
}

if (typeof document !== 'undefined' && !isStandalonePolicyStudio() && !isClientContractLedgerView() && !isCrmPipelineShareView()) {
  document.documentElement.classList.add('kolthoff-auth-pending');
  applyAgencyStarterLightBody();
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', applyAgencyStarterLightBody, { once: true });
  }
  if (!document.getElementById('kolthoff-auth-gate-style')) {
    const style = document.createElement('style');
    style.id = 'kolthoff-auth-gate-style';
    style.textContent = `
      html.kolthoff-auth-pending #root { visibility: hidden; }
      html.kolthoff-auth-pending::after {
        content: 'Loading…';
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #020613;
        color: #94a3b8;
        font-family: Montserrat, system-ui, sans-serif;
        font-size: 14px;
        z-index: 99999;
      }
      html.agency-starter-light.kolthoff-auth-pending::after {
        background: #e3e6eb;
        color: #6e7681;
        font-family: Inter, system-ui, sans-serif;
      }
      html.agency-starter-light.kolthoff-auth-pending body {
        background: #e3e6eb !important;
        background-image: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  setTimeout(revealPage, 12000);
}

export const kolthoffStaffReady = requireStaffAuth().then((result) => {
  revealPage();
  return result;
}).catch((err) => {
  revealPage();
  throw err;
});

if (typeof window !== 'undefined') {
  window.kolthoffStaffReady = kolthoffStaffReady;
  window.hasStaffAccess = hasStaffAccess;
  window.requireStaffAuth = requireStaffAuth;
}
