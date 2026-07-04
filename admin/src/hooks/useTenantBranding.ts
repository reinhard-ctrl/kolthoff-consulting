import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';
import { getProductConfig, isAgencyOpsStarter } from '../lib/product-config';
import {
  applyTenantBrandingCss,
  brandingPresetsToMap,
  DEMO_AGENCY_OPS_BRANDING_PRESETS,
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

async function writeTenantConfig(patch: Record<string, unknown>) {
  const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
  await setDoc(ref, patch, { merge: true });
}

export function useTenantBranding() {
  const product = getProductConfig();
  const agencyOps = isAgencyOpsStarter(product.id);
  const [branding, setBranding] = useState<TenantBrandingConfig>(() =>
    mergeTenantBranding(null, product.branding, product.id),
  );
  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(agencyOps);
  const [saving, setSaving] = useState(false);
  const demoPresetsRestoreAttempted = useRef(false);

  useEffect(() => {
    if (!agencyOps) {
      setBranding(mergeTenantBranding(null, product.branding, product.id));
      setPresets([]);
      setActivePresetId(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const merged = mergeTenantBranding(
          data?.branding as Partial<TenantBrandingConfig> | undefined,
          product.branding,
          product.id,
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
  }, [agencyOps, product.branding, product.id]);

  useEffect(() => {
    if (loading || !isAgencyOpsStarter(product.id)) return;
    if (presets.length > 0 || demoPresetsRestoreAttempted.current) return;
    demoPresetsRestoreAttempted.current = true;

    void (async () => {
      setSaving(true);
      try {
        await writeTenantConfig({
          brandingPresets: brandingPresetsToMap(DEMO_AGENCY_OPS_BRANDING_PRESETS),
        });
      } catch {
        demoPresetsRestoreAttempted.current = false;
      } finally {
        setSaving(false);
      }
    })();
  }, [loading, presets.length, product.id]);

  const saveBranding = async (next: TenantBrandingConfig, presetId?: string | null) => {
    setSaving(true);
    try {
      await writeTenantConfig({
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
      const nextPresets = [
        ...presets.filter((p) => p.id !== id),
        preset,
      ];
      await writeTenantConfig({
        brandingPresets: brandingPresetsToMap(nextPresets),
      });
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
      await writeTenantConfig({
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
      const nextPresets = presets.filter((p) => p.id !== presetId);
      const patch: Record<string, unknown> = {
        brandingPresets: brandingPresetsToMap(nextPresets),
      };
      if (activePresetId === presetId) {
        patch.activeBrandingPresetId = null;
      }
      await writeTenantConfig(patch);
    } finally {
      setSaving(false);
    }
  };

  const restoreDemoPresets = async () => {
    setSaving(true);
    try {
      const merged = [
        ...presets,
        ...DEMO_AGENCY_OPS_BRANDING_PRESETS.filter(
          (demo) => !presets.some((preset) => preset.id === demo.id),
        ),
      ];
      await writeTenantConfig({
        brandingPresets: brandingPresetsToMap(merged),
      });
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
    restoreDemoPresets,
  };
}
