import { getProductConfig, isAgencyOpsStarter, type ProductId } from './product-config';

export const DEMO_APPEARANCE_STORAGE_KEY = 'agency-ops-demo-appearance';

export type DemoAppearance = 'light' | 'dark';

export const DEFAULT_DEMO_APPEARANCE: DemoAppearance = 'light';

export function getStoredDemoAppearance(): DemoAppearance {
  try {
    const raw = localStorage.getItem(DEMO_APPEARANCE_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    /* ignore storage errors */
  }
  return DEFAULT_DEMO_APPEARANCE;
}

export function setStoredDemoAppearance(appearance: DemoAppearance): void {
  try {
    localStorage.setItem(DEMO_APPEARANCE_STORAGE_KEY, appearance);
  } catch {
    /* ignore storage errors */
  }
}

export function applyDemoAppearanceToDocument(appearance: DemoAppearance): void {
  const root = document.documentElement;
  root.classList.remove('agency-ops-light', 'agency-ops-dark');
  if (appearance === 'light') {
    root.classList.add('agency-ops-light');
  } else {
    root.classList.add('agency-ops-dark');
  }
}

/** Resolve whether the admin shell should use light styling. */
export function resolveShellIsLight(productId?: ProductId): boolean {
  const product = getProductConfig(productId);
  if (isAgencyOpsStarter(product.id)) {
    return getStoredDemoAppearance() === 'light';
  }
  return product.theme === 'light';
}
