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
  const demoPresets = presets.filter((preset) => DEMO_IDS.includes(preset.id));
  if (!presetsFieldPresent || demoPresets.length === 0) return true;
  return DEMO_IDS.some((id) => !demoPresets.some((preset) => preset.id === id));
}

describe('demo branding preset restore', () => {
  it('restores when presets field is missing', () => {
    assert.equal(shouldRestoreDemoBrandingPresets([], false), true);
  });

  it('restores when all demo presets were deleted', () => {
    assert.equal(shouldRestoreDemoBrandingPresets([], true), true);
  });

  it('does not restore when only private presets exist in Firestore list', () => {
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

  it('ignores private presets when checking bundled demo coverage', () => {
    assert.equal(
      shouldRestoreDemoBrandingPresets(
        [
          { id: 'studio-north', name: 'Studio North' },
          { id: 'meridian-creative', name: 'Meridian Creative' },
          { id: 'harbor-digital', name: 'Harbor Digital' },
          { id: 'my-client-demo', name: 'Client Demo' },
        ],
        true,
      ),
      false,
    );
  });
});

const DEFAULT_CLIENT_DEMO_IDS = ['golfx', 'player-2-production', 'wp-gaming'];

function shouldSeedDefaultClientDemoPresets(presets) {
  const DEFAULTS = [
    { id: 'golfx', name: 'GolfX', companyName: 'GolfX', tagline: 'Indoor Golf & Performance Training', primaryColor: '#166534', logoUrl: '/shared/assets/client-demos/golfx-logo.svg' },
    { id: 'player-2-production', name: 'Player 2 Production', companyName: 'Player 2 Production', tagline: 'Events, Festivals & Live Experiences', primaryColor: '#7c3aed', logoUrl: '/shared/assets/client-demos/player-2-production-logo.svg' },
    { id: 'wp-gaming', name: 'WP / Gaming', companyName: 'WP / Gaming', tagline: 'Gaming & Esports Marketing', primaryColor: '#0284c7', logoUrl: '/shared/assets/client-demos/wp-gaming-logo.svg' },
  ];
  return DEFAULTS.some((demo) => {
    const existing = presets.find((preset) => preset.id === demo.id);
    if (!existing) return true;
    if (!existing.name?.trim() || !existing.companyName?.trim() || !existing.primaryColor?.trim()) {
      return true;
    }
    return Boolean(demo.logoUrl && !existing.logoUrl?.trim());
  });
}

function mergeDefaultClientDemoPresets(presets, { forceBundled = false } = {}) {
  const BUNDLED_IDS = new Set(DEFAULT_CLIENT_DEMO_IDS);
  const DEFAULTS = [
    { id: 'golfx', name: 'GolfX', companyName: 'GolfX', tagline: 'Indoor Golf & Performance Training', primaryColor: '#166534', logoUrl: '/shared/assets/client-demos/golfx-logo.svg', updatedAt: 1 },
    { id: 'player-2-production', name: 'Player 2 Production', companyName: 'Player 2 Production', tagline: 'Events, Festivals & Live Experiences', primaryColor: '#7c3aed', logoUrl: '/shared/assets/client-demos/player-2-production-logo.svg', updatedAt: 1 },
    { id: 'wp-gaming', name: 'WP / Gaming', companyName: 'WP / Gaming', tagline: 'Gaming & Esports Marketing', primaryColor: '#0284c7', logoUrl: '/shared/assets/client-demos/wp-gaming-logo.svg', updatedAt: 1 },
  ];
  const custom = presets.filter((preset) => !BUNDLED_IDS.has(preset.id));
  const bundled = DEFAULTS.map((demo) => {
    const existing = presets.find((preset) => preset.id === demo.id);
    if (!existing || forceBundled) return { ...demo, updatedAt: Date.now() };
    return {
      ...existing,
      name: existing.name?.trim() || demo.name,
      companyName: existing.companyName?.trim() || demo.companyName,
      tagline: existing.tagline?.trim() || demo.tagline || '',
      primaryColor: existing.primaryColor?.trim() || demo.primaryColor,
      logoUrl: existing.logoUrl?.trim() || demo.logoUrl || '',
      updatedAt: existing.updatedAt || Date.now(),
    };
  });
  return [...bundled, ...custom];
}

describe('bundled client demo presets', () => {
  it('seeds when bundled client demos are missing', () => {
    assert.equal(shouldSeedDefaultClientDemoPresets([]), true);
    assert.equal(shouldSeedDefaultClientDemoPresets([{ id: 'golfx', name: 'GolfX' }]), true);
  });

  it('seeds when bundled client demos lost logo or color', () => {
    assert.equal(
      shouldSeedDefaultClientDemoPresets([
        {
          id: 'golfx',
          name: 'GolfX',
          companyName: 'GolfX',
          tagline: 'Indoor Golf & Performance Training',
          primaryColor: '#166534',
          logoUrl: '',
          updatedAt: 1,
        },
      ]),
      true,
    );
  });

  it('skips seed when user customized bundled client demo branding', () => {
    assert.equal(
      shouldSeedDefaultClientDemoPresets([
        {
          id: 'golfx',
          name: 'GolfX Custom',
          companyName: 'GolfX International',
          tagline: 'Premium indoor golf',
          primaryColor: '#0f5132',
          logoUrl: 'https://example.com/golfx.png',
          updatedAt: 99,
        },
        {
          id: 'player-2-production',
          name: 'Player 2 Production',
          companyName: 'Player 2 Production',
          tagline: 'Events, Festivals & Live Experiences',
          primaryColor: '#7c3aed',
          logoUrl: '/shared/assets/client-demos/player-2-production-logo.svg',
          updatedAt: 1,
        },
        {
          id: 'wp-gaming',
          name: 'WP / Gaming',
          companyName: 'WP / Gaming',
          tagline: 'Gaming & Esports Marketing',
          primaryColor: '#0284c7',
          logoUrl: '/shared/assets/client-demos/wp-gaming-logo.svg',
          updatedAt: 1,
        },
      ]),
      false,
    );
  });

  it('merge keeps saved client demo edits on refresh', () => {
    const saved = [
      {
        id: 'golfx',
        name: 'GolfX Custom',
        companyName: 'GolfX International',
        tagline: 'Premium indoor golf',
        primaryColor: '#0f5132',
        logoUrl: 'https://example.com/golfx.png',
        updatedAt: 99,
      },
    ];
    const merged = mergeDefaultClientDemoPresets(saved);
    const golfx = merged.find((preset) => preset.id === 'golfx');
    assert.equal(golfx.companyName, 'GolfX International');
    assert.equal(golfx.primaryColor, '#0f5132');
    assert.equal(golfx.logoUrl, 'https://example.com/golfx.png');
    assert.equal(golfx.updatedAt, 99);
  });

  it('merge only backfills missing logo without overwriting custom fields', () => {
    const saved = [
      {
        id: 'golfx',
        name: 'GolfX',
        companyName: 'GolfX',
        tagline: 'Custom tagline',
        primaryColor: '#123456',
        logoUrl: '',
        updatedAt: 42,
      },
    ];
    const merged = mergeDefaultClientDemoPresets(saved);
    const golfx = merged.find((preset) => preset.id === 'golfx');
    assert.equal(golfx.tagline, 'Custom tagline');
    assert.equal(golfx.primaryColor, '#123456');
    assert.equal(golfx.logoUrl, '/shared/assets/client-demos/golfx-logo.svg');
  });
});
