import type { ProductBranding } from './product-config';

/** Firestore tenant_settings/config.branding — active workspace branding */
export interface TenantBrandingConfig {
  companyName: string;
  tagline?: string;
  primaryColor: string;
  logoUrl?: string;
  /** @deprecated use companyName */
  name?: string;
  /** @deprecated use companyName */
  accent?: string;
  /** @deprecated use tagline */
  subtitle?: string;
}

/** Saved branding profile under tenant_settings/config.brandingPresets */
export interface BrandingPreset {
  id: string;
  name: string;
  companyName: string;
  tagline?: string;
  primaryColor: string;
  logoUrl?: string;
  updatedAt: number;
}

export const DEFAULT_TENANT_BRANDING: TenantBrandingConfig = {
  companyName: 'Studio North',
  tagline: 'Creative & Digital Services',
  primaryColor: '#4f46e5',
  logoUrl: '',
};

/** Demo tenant seed profiles — restored when Firestore has none saved yet. */
export const DEMO_AGENCY_OPS_BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: 'studio-north',
    name: 'Studio North',
    companyName: 'Studio North',
    tagline: 'Creative & Digital Services',
    primaryColor: '#4f46e5',
    logoUrl: '',
    updatedAt: 1751606400000,
  },
  {
    id: 'meridian-creative',
    name: 'Meridian Creative',
    companyName: 'Meridian Creative Co.',
    tagline: 'Brand & Campaign Studio',
    primaryColor: '#0d9488',
    logoUrl: '',
    updatedAt: 1751606400000,
  },
  {
    id: 'harbor-digital',
    name: 'Harbor Digital',
    companyName: 'Harbor Digital Agency',
    tagline: 'Web & Performance Marketing',
    primaryColor: '#e11d48',
    logoUrl: '',
    updatedAt: 1751606400000,
  },
];

export function brandingPresetsToMap(presets: BrandingPreset[]): Record<string, BrandingPreset> {
  return Object.fromEntries(presets.map((preset) => [preset.id, preset]));
}

export function slugifyPresetId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `brand-${Date.now()}`;
}

export function uniquePresetId(name: string, existingIds: string[]): string {
  const base = slugifyPresetId(name);
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function presetFromConfig(id: string, name: string, config: TenantBrandingConfig): BrandingPreset {
  return {
    id,
    name: name.trim() || config.companyName.trim() || 'Untitled brand',
    companyName: config.companyName.trim(),
    tagline: config.tagline?.trim() || '',
    primaryColor: config.primaryColor.trim() || DEFAULT_TENANT_BRANDING.primaryColor,
    logoUrl: config.logoUrl?.trim() || '',
    updatedAt: Date.now(),
  };
}

export function presetToConfig(preset: BrandingPreset): TenantBrandingConfig {
  return {
    companyName: preset.companyName,
    tagline: preset.tagline,
    primaryColor: preset.primaryColor,
    logoUrl: preset.logoUrl,
  };
}

export function normalizeBrandingPreset(raw: unknown, mapKey?: string): BrandingPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<BrandingPreset>;
  const id = (p.id ?? mapKey)?.trim();
  const name = p.name?.trim();
  if (!id || !name) return null;
  return presetFromConfig(id, name, {
    companyName: p.companyName ?? name,
    tagline: p.tagline,
    primaryColor: p.primaryColor ?? DEFAULT_TENANT_BRANDING.primaryColor,
    logoUrl: p.logoUrl,
  });
}

export function listBrandingPresets(
  map: Record<string, unknown> | null | undefined,
): BrandingPreset[] {
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map)
    .map(([key, raw]) => normalizeBrandingPreset(raw, key))
    .filter((p): p is BrandingPreset => Boolean(p))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export function resolveCompanyName(b: Partial<TenantBrandingConfig> | null | undefined): string {
  if (!b) return DEFAULT_TENANT_BRANDING.companyName;
  if (b.companyName?.trim()) return b.companyName.trim();
  const legacy = [b.name, b.accent].filter(Boolean).join(' ').trim();
  return legacy || DEFAULT_TENANT_BRANDING.companyName;
}

export function resolveTagline(b: Partial<TenantBrandingConfig> | null | undefined): string {
  if (!b) return DEFAULT_TENANT_BRANDING.tagline ?? '';
  return (b.tagline ?? b.subtitle ?? DEFAULT_TENANT_BRANDING.tagline ?? '').trim();
}

export function mergeTenantBranding(
  firestore: Partial<TenantBrandingConfig> | null | undefined,
  productFallback?: Partial<ProductBranding>,
): TenantBrandingConfig {
  const base: TenantBrandingConfig = {
    companyName: resolveCompanyName({
      companyName: productFallback?.name
        ? [productFallback.name, productFallback.accent].filter(Boolean).join(' ')
        : undefined,
      name: productFallback?.name,
      accent: productFallback?.accent,
      tagline: productFallback?.subtitle,
      subtitle: productFallback?.subtitle,
      primaryColor: DEFAULT_TENANT_BRANDING.primaryColor,
      logoUrl: '',
    }),
    tagline: productFallback?.subtitle ?? DEFAULT_TENANT_BRANDING.tagline,
    primaryColor: DEFAULT_TENANT_BRANDING.primaryColor,
    logoUrl: '',
  };

  if (!firestore) return base;

  return {
    companyName: resolveCompanyName({ ...base, ...firestore }),
    tagline: resolveTagline({ ...base, ...firestore }),
    primaryColor: firestore.primaryColor?.trim() || base.primaryColor,
    logoUrl: firestore.logoUrl?.trim() || '',
  };
}

export function applyTenantBrandingCss(branding: TenantBrandingConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', branding.primaryColor);
  root.style.setProperty('--brand-primary-soft', `${branding.primaryColor}26`);
}

/** Split "Studio North" → { line1: "Studio", line2: "North" } for two-line headers */
export function splitCompanyDisplay(companyName: string): { line1: string; line2: string } {
  const parts = companyName.trim().split(/\s+/);
  if (parts.length <= 1) return { line1: companyName.trim(), line2: '' };
  return { line1: parts[0], line2: parts.slice(1).join(' ') };
}
