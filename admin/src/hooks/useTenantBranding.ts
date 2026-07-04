import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';
import { getProductConfig } from '../lib/product-config';
import {
  applyTenantBrandingCss,
  listBrandingPresets,
  mergeTenantBranding,
  presetFromConfig,
  presetToConfig,
  uniquePresetId,
  type BrandingPreset,
  type TenantBrandingConfig,
} from '../lib/tenant-branding';

function brandingPayload(config: TenantBrandingConfig) {
  return {
    companyName: config.companyName.trim(),
    tagline: config.tagline?.trim() || '',
    primaryColor: config.primaryColor.trim(),
    logoUrl: config.logoUrl?.trim() || '',
  };
}

export function useTenantBranding() {
  const product = getProductConfig();
  const [branding, setBranding] = useState<TenantBrandingConfig>(() =>
    mergeTenantBranding(null, product.branding),
  );
  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const merged = mergeTenantBranding(
          data?.branding as Partial<TenantBrandingConfig> | undefined,
          product.branding,
        );
        setBranding(merged);
        setPresets(listBrandingPresets(data?.brandingPresets as Record<string, unknown> | undefined));
        setActivePresetId(
          typeof data?.activeBrandingPresetId === 'string' ? data.activeBrandingPresetId : null,
        );
        applyTenantBrandingCss(merged);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [product.branding]);

  const writeConfig = async (patch: Record<string, unknown>) => {
    const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
    await setDoc(ref, patch, { merge: true });
  };

  /** Apply branding to the live workspace (CRM, Estimates, shell). */
  const saveBranding = async (next: TenantBrandingConfig, presetId?: string | null) => {
    setSaving(true);
    try {
      await writeConfig({
        branding: brandingPayload(next),
        activeBrandingPresetId: presetId ?? activePresetId,
      });
    } finally {
      setSaving(false);
    }
  };

  /** Save current form as a named preset (does not apply until you click Apply). */
  const savePreset = async (name: string, config: TenantBrandingConfig, existingId?: string) => {
    setSaving(true);
    try {
      const id = existingId || uniquePresetId(name, presets.map((p) => p.id));
      const preset = presetFromConfig(id, name, config);
      const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
      await setDoc(
        ref,
        {
          brandingPresets: { [id]: preset },
        },
        { merge: true },
      );
      return id;
    } finally {
      setSaving(false);
    }
  };

  /** Apply a saved preset as the active workspace branding. */
  const applyPreset = async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setSaving(true);
    try {
      await writeConfig({
        branding: brandingPayload(presetToConfig(preset)),
        activeBrandingPresetId: presetId,
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async (presetId: string) => {
    setSaving(true);
    try {
      const nextMap = Object.fromEntries(
        presets.filter((p) => p.id !== presetId).map((p) => [p.id, p]),
      );
      const patch: Record<string, unknown> = { brandingPresets: nextMap };
      if (activePresetId === presetId) {
        patch.activeBrandingPresetId = null;
      }
      await writeConfig(patch);
    } finally {
      setSaving(false);
    }
  };

  return {
    branding,
    presets,
    activePresetId,
    loading,
    saving,
    saveBranding,
    savePreset,
    applyPreset,
    deletePreset,
  };
}
