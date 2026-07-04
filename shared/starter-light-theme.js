/**
 * Light workspace theme for Agency Ops Starter HTML apps (CRM, Estimates).
 */
(function applyStarterLightTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function isStarterContext() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('product') === 'agency-ops-starter') return true;
    if (params.get('tenant') === 'agency-ops-demo') return true;
    const cfg = window.ProductConfig?.getProductConfig?.();
    return Boolean(cfg?.starterMode);
  }

  if (!isStarterContext()) return;

  const root = document.documentElement;
  root.classList.remove('dark');
  root.classList.add('agency-starter-light');

  if (document.getElementById('agency-starter-light-styles')) return;

  const script = document.currentScript;
  const cssHref = script?.src
    ? script.src.replace(/starter-light-theme\.js(\?.*)?$/, 'starter-light-theme.css$1')
    : '../../shared/starter-light-theme.css';

  const link = document.createElement('link');
  link.id = 'agency-starter-light-styles';
  link.rel = 'stylesheet';
  link.href = cssHref.includes('?') ? cssHref : `${cssHref}?v=20250704-pro-v1`;
  document.head.appendChild(link);
})();
