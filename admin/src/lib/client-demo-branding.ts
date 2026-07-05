import type { BrandingPreset } from './tenant-branding';
import { listBrandingPresets } from './tenant-branding';

export const CLIENT_DEMO_PRESETS_STORAGE_KEY = 'agency-ops-client-demo-branding-presets';
const LEGACY_PRIVATE_PRESETS_STORAGE_KEY = 'agency-ops-private-branding-presets';

/** Bump when bundled client demos are removed and Firestore should reset once. */
export const CLIENT_DEMO_SETUP_VERSION = 2;

export function listClientDemoPresets(
  map: Record<string, unknown> | null | undefined,
): BrandingPreset[] {
  return listBrandingPresets(map);
}

export function clearLegacyClientDemoBrandingPresets(): void {
  try {
    localStorage.removeItem(CLIENT_DEMO_PRESETS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PRIVATE_PRESETS_STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function upsertClientDemoBrandingPreset(
  presets: BrandingPreset[],
  preset: BrandingPreset,
): BrandingPreset[] {
  return [...presets.filter((item) => item.id !== preset.id), preset];
}

export function removeClientDemoBrandingPreset(
  presets: BrandingPreset[],
  presetId: string,
): BrandingPreset[] {
  return presets.filter((item) => item.id !== presetId);
}

export function mergeClientDemoBrandingPresets(
  existing: BrandingPreset[],
  incoming: BrandingPreset[],
): BrandingPreset[] {
  const merged = [...existing];
  for (const preset of incoming) {
    if (!merged.some((item) => item.id === preset.id)) {
      merged.push(preset);
    }
  }
  return merged;
}

export const APPLIED_CLIENT_DEMO_STORAGE_KEY = 'agency-ops-applied-client-demo-id';

export function loadAppliedClientDemoId(): string | null {
  try {
    return sessionStorage.getItem(APPLIED_CLIENT_DEMO_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveAppliedClientDemoId(presetId: string | null): void {
  try {
    if (presetId) {
      sessionStorage.setItem(APPLIED_CLIENT_DEMO_STORAGE_KEY, presetId);
      return;
    }
    sessionStorage.removeItem(APPLIED_CLIENT_DEMO_STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}
