/** Core Workspace branding — same shape as Agency Ops tenant_settings/config.branding */
export interface WorkspaceBrandingConfig {
  companyName: string;
  tagline: string;
  primaryColor: string;
  logoUrl: string;
}

export const DEFAULT_WORKSPACE_BRAND_COLOR = '#14B8A6';

export function defaultWorkspaceBranding(clientName: string): WorkspaceBrandingConfig {
  return {
    companyName: clientName.trim() || 'Workspace',
    tagline: 'Team workspace',
    primaryColor: DEFAULT_WORKSPACE_BRAND_COLOR,
    logoUrl: '',
  };
}

export function normalizeWorkspaceBranding(
  raw: Partial<WorkspaceBrandingConfig> | null | undefined,
  fallbackName?: string,
): WorkspaceBrandingConfig {
  const base = defaultWorkspaceBranding(fallbackName || 'Workspace');
  if (!raw) return base;
  return {
    companyName: raw.companyName?.trim() || base.companyName,
    tagline: raw.tagline?.trim() || base.tagline,
    primaryColor: raw.primaryColor?.trim() || base.primaryColor,
    logoUrl: raw.logoUrl?.trim() || '',
  };
}

export function brandingWritePayload(config: WorkspaceBrandingConfig) {
  return {
    companyName: config.companyName.trim(),
    tagline: config.tagline.trim(),
    primaryColor: config.primaryColor.trim() || DEFAULT_WORKSPACE_BRAND_COLOR,
    logoUrl: config.logoUrl.trim(),
  };
}
