/**
 * Admin iframe embed mode — hide duplicate app chrome when ?embed=1.
 * Sets html.kolthoff-embed and window.KOLTHOFF_EMBED.
 */
(function applyKolthoffEmbedMode() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const embedded = new URLSearchParams(window.location.search).has('embed');
  window.KOLTHOFF_EMBED = embedded;

  if (!embedded) return;

  document.documentElement.classList.add('kolthoff-embed');

  if (document.getElementById('kolthoff-embed-styles')) return;

  const style = document.createElement('style');
  style.id = 'kolthoff-embed-styles';
  style.textContent = `
    html.kolthoff-embed,
    html.kolthoff-embed body,
    html.kolthoff-embed #root {
      height: 100%;
      overflow: hidden;
    }
    html.kolthoff-embed [data-app-chrome],
    html.kolthoff-embed aside[data-app-sidebar] {
      display: none !important;
    }
    /* Project Planner: never hide tab nav when embed chrome is stripped */
    html.kolthoff-embed .planner-main-header {
      display: block !important;
    }
    html.kolthoff-embed .planner-main-header nav[aria-label="Main Navigation"] {
      display: flex !important;
      visibility: visible !important;
    }
    html.kolthoff-embed main,
    html.kolthoff-embed .flex.h-screen {
      height: 100% !important;
      min-height: 0 !important;
    }
  `;
  document.head.appendChild(style);
})();
