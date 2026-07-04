import type { ProductBranding } from './product-config';

/** Firestore tenant_settings/config.branding */
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

export const DEFAULT_TENANT_BRANDING: TenantBrandingConfig = {
  companyName: 'Studio North',
  tagline: 'Creative & Digital Services',
  primaryColor: '#6366f1',
  logoUrl: '',
};

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
