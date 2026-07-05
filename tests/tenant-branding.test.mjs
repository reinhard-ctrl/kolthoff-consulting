import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline merge logic mirror for unit test (admin/src/lib/tenant-branding.ts)
function mergeTenantBranding(firestore, productFallback) {
  const DEFAULT = { companyName: 'Studio North', tagline: 'Creative & Digital Services', primaryColor: '#4f46e5', logoUrl: '' };
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

function uniquePresetId(name, existingIds) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand';
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function listBrandingPresets(map) {
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map)
    .map(([key, raw]) => {
      if (!raw || typeof raw !== 'object') return null;
      const id = (raw.id ?? key)?.trim();
      const name = raw.name?.trim();
      if (!id || !name) return null;
      return { ...raw, id, name };
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

describe('branding presets', () => {
  it('creates unique preset ids', () => {
    assert.equal(uniquePresetId('Studio North', []), 'studio-north');
    assert.equal(uniquePresetId('Studio North', ['studio-north']), 'studio-north-2');
  });

  it('lists presets by updatedAt desc', () => {
    const list = listBrandingPresets({
      a: { id: 'a', name: 'A', updatedAt: 1 },
      b: { id: 'b', name: 'B', updatedAt: 3 },
    });
    assert.equal(list[0].id, 'b');
  });

  it('accepts preset id from map key when nested id is missing', () => {
    const list = listBrandingPresets({
      'studio-north': { name: 'Studio North', companyName: 'Studio North', updatedAt: 1 },
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'studio-north');
  });
});

function shouldRestoreDemoBrandingPresets(presets, presetsFieldPresent) {
  const DEMO_IDS = ['studio-north', 'meridian-creative', 'harbor-digital'];
  if (!presetsFieldPresent || presets.length === 0) return true;
  return DEMO_IDS.some((id) => !presets.some((preset) => preset.id === id));
}

describe('demo branding preset restore', () => {
  it('restores when presets field is missing', () => {
    assert.equal(shouldRestoreDemoBrandingPresets([], false), true);
  });

  it('restores when all presets were deleted', () => {
    assert.equal(shouldRestoreDemoBrandingPresets([], true), true);
  });

  it('restores when a bundled demo profile is missing', () => {
    assert.equal(
      shouldRestoreDemoBrandingPresets([{ id: 'custom-agency', name: 'Custom' }], true),
      true,
    );
  });

  it('skips restore when all demo profiles are present', () => {
    assert.equal(
      shouldRestoreDemoBrandingPresets(
        [
          { id: 'studio-north', name: 'Studio North' },
          { id: 'meridian-creative', name: 'Meridian Creative' },
          { id: 'harbor-digital', name: 'Harbor Digital' },
        ],
        true,
      ),
      false,
    );
  });
});
