import type { BrandingPreset } from './tenant-branding';
import { listBrandingPresets } from './tenant-branding';

export const CLIENT_DEMO_PRESETS_STORAGE_KEY = 'agency-ops-client-demo-branding-presets';
const LEGACY_PRIVATE_PRESETS_STORAGE_KEY = 'agency-ops-private-branding-presets';

/** Stable logo paths served from /shared (copied to dist on deploy). */
export const CLIENT_DEMO_LOGO_URLS = {
  golfx: '/shared/assets/client-demos/golfx-logo.svg',
  'player-2-production': '/shared/assets/client-demos/player-2-production-logo.svg',
  'wp-gaming': '/shared/assets/client-demos/wp-gaming-logo.svg',
} as const;

/** Bundled client rehearsal profiles — local browser only, never shared Firestore. */
export const DEFAULT_CLIENT_DEMO_BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: 'golfx',
    name: 'GolfX',
    companyName: 'GolfX',
    tagline: 'Indoor Golf & Performance Training',
    primaryColor: '#166534',
    logoUrl: CLIENT_DEMO_LOGO_URLS.golfx,
    updatedAt: 1751606400000,
  },
  {
    id: 'player-2-production',
    name: 'Player 2 Production',
    companyName: 'Player 2 Production',
    tagline: 'Events, Festivals & Live Experiences',
    primaryColor: '#7c3aed',
    logoUrl: CLIENT_DEMO_LOGO_URLS['player-2-production'],
    updatedAt: 1751606400000,
  },
  {
    id: 'wp-gaming',
    name: 'WP / Gaming',
    companyName: 'WP / Gaming',
    tagline: 'Gaming & Esports Marketing',
    primaryColor: '#0284c7',
    logoUrl: CLIENT_DEMO_LOGO_URLS['wp-gaming'],
    updatedAt: 1751606400000,
  },
];

const BUNDLED_CLIENT_DEMO_PRESET_IDS = new Set(
  DEFAULT_CLIENT_DEMO_BRANDING_PRESETS.map((preset) => preset.id),
);

export function isBundledClientDemoPresetId(id: string | null | undefined): boolean {
  return Boolean(id && BUNDLED_CLIENT_DEMO_PRESET_IDS.has(id));
}

function bundledPresetNeedsRefresh(existing: BrandingPreset, demo: BrandingPreset): boolean {
  return (
    (demo.logoUrl && !existing.logoUrl) ||
    existing.primaryColor !== demo.primaryColor ||
    existing.tagline !== demo.tagline ||
    existing.companyName !== demo.companyName ||
    existing.name !== demo.name
  );
}

export function mergeDefaultClientDemoPresets(
  presets: BrandingPreset[],
  options: { forceBundled?: boolean } = {},
): BrandingPreset[] {
  const custom = presets.filter((preset) => !isBundledClientDemoPresetId(preset.id));
  const bundled = DEFAULT_CLIENT_DEMO_BRANDING_PRESETS.map((demo) => {
    const existing = presets.find((preset) => preset.id === demo.id);
    if (!existing || options.forceBundled) {
      return { ...demo, updatedAt: Date.now() };
    }
    if (!bundledPresetNeedsRefresh(existing, demo)) return existing;
    return { ...demo, updatedAt: Date.now() };
  });
  return [...bundled, ...custom];
}

export function shouldSeedDefaultClientDemoPresets(presets: BrandingPreset[]): boolean {
  return DEFAULT_CLIENT_DEMO_BRANDING_PRESETS.some((demo) => {
    const existing = presets.find((preset) => preset.id === demo.id);
    if (!existing) return true;
    return bundledPresetNeedsRefresh(existing, demo);
  });
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

export function seedDefaultClientDemoPresets(): BrandingPreset[] {
  const next = mergeDefaultClientDemoPresets(loadClientDemoBrandingPresets());
  saveClientDemoBrandingPresets(next);
  return next;
}

export function restoreDefaultClientDemoPresets(): BrandingPreset[] {
  const next = mergeDefaultClientDemoPresets(loadClientDemoBrandingPresets(), { forceBundled: true });
  saveClientDemoBrandingPresets(next);
  return next;
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
