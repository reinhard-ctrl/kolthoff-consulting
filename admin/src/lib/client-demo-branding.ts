import type { BrandingPreset } from './tenant-branding';
import { listBrandingPresets } from './tenant-branding';

export const CLIENT_DEMO_PRESETS_STORAGE_KEY = 'agency-ops-client-demo-branding-presets';
const LEGACY_PRIVATE_PRESETS_STORAGE_KEY = 'agency-ops-private-branding-presets';

export function loadClientDemoBrandingPresets(): BrandingPreset[] {
  try {
    let raw = localStorage.getItem(CLIENT_DEMO_PRESETS_STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_PRIVATE_PRESETS_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(CLIENT_DEMO_PRESETS_STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_PRIVATE_PRESETS_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return listBrandingPresets(parsed);
  } catch {
    return [];
  }
}

export function saveClientDemoBrandingPresets(presets: BrandingPreset[]): void {
  try {
    const map = Object.fromEntries(presets.map((preset) => [preset.id, preset]));
    localStorage.setItem(CLIENT_DEMO_PRESETS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function upsertClientDemoBrandingPreset(preset: BrandingPreset): BrandingPreset[] {
  const next = [
    ...loadClientDemoBrandingPresets().filter((item) => item.id !== preset.id),
    preset,
  ];
  saveClientDemoBrandingPresets(next);
  return next;
}

export function removeClientDemoBrandingPreset(presetId: string): BrandingPreset[] {
  const next = loadClientDemoBrandingPresets().filter((item) => item.id !== presetId);
  saveClientDemoBrandingPresets(next);
  return next;
}

export function mergeClientDemoBrandingPresets(incoming: BrandingPreset[]): BrandingPreset[] {
  const existing = loadClientDemoBrandingPresets();
  const merged = [...existing];
  for (const preset of incoming) {
    if (!merged.some((item) => item.id === preset.id)) {
      merged.push(preset);
    }
  }
  saveClientDemoBrandingPresets(merged);
  return merged;
}
