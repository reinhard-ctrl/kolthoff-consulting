export interface WorkspaceBranding {
  companyName: string;
  tagline: string;
  primaryColor: string;
  logoUrl: string;
}

export const DEFAULT_WORKSPACE_PRIMARY = '#14B8A6';

export const DEFAULT_WORKSPACE_BRANDING: WorkspaceBranding = {
  companyName: 'Workspace',
  tagline: 'Team collaboration',
  primaryColor: DEFAULT_WORKSPACE_PRIMARY,
  logoUrl: '',
};

export function mergeWorkspaceBranding(
  firestore: Partial<WorkspaceBranding> | null | undefined,
  fallbackName?: string,
): WorkspaceBranding {
  const companyName =
    firestore?.companyName?.trim() ||
    fallbackName?.trim() ||
    DEFAULT_WORKSPACE_BRANDING.companyName;
  return {
    companyName,
    tagline: firestore?.tagline?.trim() || DEFAULT_WORKSPACE_BRANDING.tagline,
    primaryColor: firestore?.primaryColor?.trim() || DEFAULT_WORKSPACE_PRIMARY,
    logoUrl: firestore?.logoUrl?.trim() || '',
  };
}

export function applyWorkspaceBrandingCss(branding: WorkspaceBranding) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const primary = branding.primaryColor || DEFAULT_WORKSPACE_PRIMARY;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-primary-soft', `${primary}18`);
  root.style.setProperty('--brand-primary-ring', `${primary}33`);
  root.style.setProperty('--brand-primary-hover', primary);
  root.style.setProperty('--ws-teal-500', primary);
}

export function applyDocumentTitle(branding: WorkspaceBranding) {
  if (typeof document === 'undefined') return;
  document.title = branding.companyName?.trim()
    ? `${branding.companyName.trim()} Workspace`
    : 'Workspace';
}

export function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'W';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
