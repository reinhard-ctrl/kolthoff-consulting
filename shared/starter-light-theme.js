/**
 * Agency Ops Starter appearance bootstrap for embedded HTML apps (light + dark).
 */
(function applyStarterAppearanceTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const GREY_CANVAS = '#e3e6eb';
  const DARK_CANVAS = '#1a1d21';
  const APPEARANCE_STORAGE_KEY = 'agency-ops-demo-appearance';
  const CACHE_VERSION = '20250705-ui-v19';

  function isStarterContext() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('product') === 'agency-ops-starter') return true;
    if (params.get('tenant') === 'agency-ops-demo') return true;
    const cfg = window.ProductConfig?.getProductConfig?.();
    return Boolean(cfg?.starterMode);
  }

  function resolveAppearance() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('appearance');
    if (fromParam === 'dark' || fromParam === 'light') return fromParam;
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      /* ignore storage errors */
    }
    return 'light';
  }

  if (!isStarterContext()) return;

  const appearance = resolveAppearance();
  const isLight = appearance === 'light';
  const root = document.documentElement;

  root.classList.remove('agency-starter-light', 'agency-starter-dark', 'dark');
  root.classList.add(isLight ? 'agency-starter-light' : 'agency-starter-dark');

  const canvas = isLight ? GREY_CANVAS : DARK_CANVAS;

  if (!document.getElementById('agency-starter-critical')) {
    const critical = document.createElement('style');
    critical.id = 'agency-starter-critical';
    critical.textContent = `
      html.agency-starter-light,
      html.agency-starter-light body,
      html.agency-starter-dark,
      html.agency-starter-dark body {
        background: ${canvas} !important;
        background-image: none !important;
      }
      html.agency-starter-light.luxury-gradient,
      html.agency-starter-light .luxury-gradient,
      html.agency-starter-dark.luxury-gradient,
      html.agency-starter-dark .luxury-gradient {
        background: ${canvas} !important;
        background-image: none !important;
      }
    `;
    document.head.appendChild(critical);
  }

  function applyBodyBackground() {
    if (!document.body) return;
    document.body.style.backgroundColor = canvas;
    document.body.style.backgroundImage = 'none';
  }

  applyBodyBackground();
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', applyBodyBackground, { once: true });
  }

  if (!document.getElementById('agency-starter-inter-font')) {
    const link = document.createElement('link');
    link.id = 'agency-starter-inter-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  const styleId = isLight ? 'agency-starter-light-styles' : 'agency-starter-dark-styles';
  const otherId = isLight ? 'agency-starter-dark-styles' : 'agency-starter-light-styles';
  document.getElementById(otherId)?.remove();

  if (document.getElementById(styleId)) return;

  const script = document.currentScript;
  const cssFile = isLight ? 'starter-light-theme.css' : 'starter-dark-theme.css';
  const cssHref = script?.src
    ? script.src.replace(/starter-light-theme\.js(\?.*)?$/, `${cssFile}$1`)
    : `../../shared/${cssFile}`;

  const styleLink = document.createElement('link');
  styleLink.id = styleId;
  styleLink.rel = 'stylesheet';
  styleLink.href = cssHref.includes('?') ? cssHref : `${cssHref}?v=${CACHE_VERSION}`;
  document.head.appendChild(styleLink);
})();
