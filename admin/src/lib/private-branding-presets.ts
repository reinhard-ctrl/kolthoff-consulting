import type { BrandingPreset } from './tenant-branding';
import { listBrandingPresets } from './tenant-branding';

export const PRIVATE_BRANDING_PRESETS_STORAGE_KEY = 'agency-ops-private-branding-presets';

export function loadPrivateBrandingPresets(): BrandingPreset[] {
  try {
    const raw = localStorage.getItem(PRIVATE_BRANDING_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return listBrandingPresets(parsed);
  } catch {
    return [];
  }
}

export function savePrivateBrandingPresets(presets: BrandingPreset[]): void {
  try {
    const map = Object.fromEntries(presets.map((preset) => [preset.id, preset]));
    localStorage.setItem(PRIVATE_BRANDING_PRESETS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function upsertPrivateBrandingPreset(preset: BrandingPreset): BrandingPreset[] {
  const next = [
    ...loadPrivateBrandingPresets().filter((item) => item.id !== preset.id),
    preset,
  ];
  savePrivateBrandingPresets(next);
  return next;
}

export function removePrivateBrandingPreset(presetId: string): BrandingPreset[] {
  const next = loadPrivateBrandingPresets().filter((item) => item.id !== presetId);
  savePrivateBrandingPresets(next);
  return next;
}

export function mergePrivateBrandingPresets(incoming: BrandingPreset[]): BrandingPreset[] {
  const existing = loadPrivateBrandingPresets();
  const merged = [...existing];
  for (const preset of incoming) {
    if (!merged.some((item) => item.id === preset.id)) {
      merged.push(preset);
    }
  }
  savePrivateBrandingPresets(merged);
  return merged;
}
