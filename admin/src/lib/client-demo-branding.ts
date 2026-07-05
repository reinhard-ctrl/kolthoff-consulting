import type { BrandingPreset } from './tenant-branding';
import { listBrandingPresets } from './tenant-branding';

export const CLIENT_DEMO_PRESETS_STORAGE_KEY = 'agency-ops-client-demo-branding-presets';
const LEGACY_PRIVATE_PRESETS_STORAGE_KEY = 'agency-ops-private-branding-presets';

/** Bundled client rehearsal profiles — local browser only, never shared Firestore. */
export const DEFAULT_CLIENT_DEMO_BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: 'golfx',
    name: 'GolfX',
    companyName: 'GolfX',
    tagline: 'Indoor Golf & Performance Training',
    primaryColor: '#166534',
    logoUrl: '',
    updatedAt: 1751606400000,
  },
  {
    id: 'player-2-production',
    name: 'Player 2 Production',
    companyName: 'Player 2 Production',
    tagline: 'Events, Festivals & Live Experiences',
    primaryColor: '#7c3aed',
    logoUrl: '',
    updatedAt: 1751606400000,
  },
  {
    id: 'wp-gaming',
    name: 'WP / Gaming',
    companyName: 'WP / Gaming',
    tagline: 'Gaming & Esports Marketing',
    primaryColor: '#0284c7',
    logoUrl: '',
    updatedAt: 1751606400000,
  },
];

const BUNDLED_CLIENT_DEMO_PRESET_IDS = new Set(
  DEFAULT_CLIENT_DEMO_BRANDING_PRESETS.map((preset) => preset.id),
);

export function isBundledClientDemoPresetId(id: string | null | undefined): boolean {
  return Boolean(id && BUNDLED_CLIENT_DEMO_PRESET_IDS.has(id));
}

export function mergeDefaultClientDemoPresets(presets: BrandingPreset[]): BrandingPreset[] {
  return [
    ...presets,
    ...DEFAULT_CLIENT_DEMO_BRANDING_PRESETS.filter(
      (demo) => !presets.some((preset) => preset.id === demo.id),
    ),
  ];
}

export function shouldSeedDefaultClientDemoPresets(presets: BrandingPreset[]): boolean {
  return DEFAULT_CLIENT_DEMO_BRANDING_PRESETS.some(
    (demo) => !presets.some((preset) => preset.id === demo.id),
  );
}

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

export function restoreDefaultClientDemoPresets(): BrandingPreset[] {
  const next = mergeDefaultClientDemoPresets(loadClientDemoBrandingPresets());
  saveClientDemoBrandingPresets(next);
  return next;
}
