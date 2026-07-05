/** Admin iframe embed — mirrors shared/embed-mode.js for the workspace React app. */
export function isEmbeddedView(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('embed')) return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function initEmbedMode(): boolean {
  if (typeof document === 'undefined' || !isEmbeddedView()) return false;

  document.documentElement.classList.add('kolthoff-embed');

  if (document.getElementById('kolthoff-embed-styles')) return true;

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
    html.kolthoff-embed main,
    html.kolthoff-embed .flex.h-screen {
      height: 100% !important;
      min-height: 0 !important;
    }
  `;
  document.head.appendChild(style);
  return true;
}
