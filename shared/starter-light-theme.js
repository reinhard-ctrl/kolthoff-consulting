/**
 * Agency Ops Starter light theme bootstrap for embedded HTML apps.
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

  if (!document.getElementById('agency-starter-critical')) {
    const critical = document.createElement('style');
    critical.id = 'agency-starter-critical';
    critical.textContent = `
      html.agency-starter-light,
      html.agency-starter-light body {
        background: #f1f5f9 !important;
        background-image: none !important;
      }
      html.agency-starter-light.luxury-gradient,
      html.agency-starter-light .luxury-gradient {
        background: #f1f5f9 !important;
        background-image: none !important;
      }
    `;
    document.head.appendChild(critical);
  }

  function applyBodyBackground() {
    if (!document.body) return;
    document.body.style.backgroundColor = '#f1f5f9';
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

  if (document.getElementById('agency-starter-light-styles')) return;

  const script = document.currentScript;
  const cssHref = script?.src
    ? script.src.replace(/starter-light-theme\.js(\?.*)?$/, 'starter-light-theme.css$1')
    : '../../shared/starter-light-theme.css';

  const styleLink = document.createElement('link');
  styleLink.id = 'agency-starter-light-styles';
  styleLink.rel = 'stylesheet';
  styleLink.href = cssHref.includes('?') ? cssHref : `${cssHref}?v=20250704-ui-v4`;
  document.head.appendChild(styleLink);
})();
