import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline merge logic mirror for unit test (admin/src/lib/tenant-branding.ts)
function mergeTenantBranding(firestore, productFallback) {
  const DEFAULT = { companyName: 'Studio North', tagline: 'Creative & Digital Services', primaryColor: '#6366f1', logoUrl: '' };
  const base = {
    companyName: productFallback?.name ? `${productFallback.name} ${productFallback.accent || ''}`.trim() : DEFAULT.companyName,
    tagline: productFallback?.subtitle || DEFAULT.tagline,
    primaryColor: DEFAULT.primaryColor,
    logoUrl: '',
  };
  if (!firestore) return base;
  return {
    companyName: firestore.companyName?.trim() || base.companyName,
    tagline: (firestore.tagline ?? firestore.subtitle ?? base.tagline).trim(),
    primaryColor: firestore.primaryColor?.trim() || base.primaryColor,
    logoUrl: firestore.logoUrl?.trim() || '',
  };
}

describe('tenant branding merge', () => {
  it('uses firestore companyName when set', () => {
    const merged = mergeTenantBranding(
      { companyName: 'Pixel Wave Studio', tagline: 'Design & Build', primaryColor: '#e11d48', logoUrl: 'https://x/logo.png' },
      { name: 'Studio', accent: 'North', subtitle: 'Fallback' },
    );
    assert.equal(merged.companyName, 'Pixel Wave Studio');
    assert.equal(merged.primaryColor, '#e11d48');
    assert.equal(merged.logoUrl, 'https://x/logo.png');
  });

  it('falls back to product defaults', () => {
    const merged = mergeTenantBranding(null, { name: 'Studio', accent: 'North', subtitle: 'Creative' });
    assert.equal(merged.companyName, 'Studio North');
    assert.equal(merged.tagline, 'Creative');
  });
});
